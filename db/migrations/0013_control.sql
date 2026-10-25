-- =====================================================================
-- Compás — migración 0013: control, alertas y reasignación N1 (spec 009, D33)
-- Fecha: 25-10-2026
-- * app.emitir_alerta: tope diario por persona (R40); pasado el tope, la alerta va al resumen.
-- * Evento SobreNegativo → alerta sin culpa (R16) y N1 abierto (R10).
-- * app.reasignar: Futuro o emergencia con doble firma (R37); bajo el umbral autoaprobada (R38);
--   sobre el umbral, solicitud al otro administrador.
-- * app.control_hogar / app.control_diario: ritmo (R09), balance proyectado (R12), pagos por vencer,
--   transferencias a 72 h y suplencia de solicitudes vencidas (R39). pg_cron a las 20:00 de Santiago.
-- =====================================================================
BEGIN;

-- Las sumas de las vistas son numeric: misma presentación $12.345
CREATE FUNCTION app.pesos_n(p_monto numeric) RETURNS text
LANGUAGE sql IMMUTABLE AS $$ SELECT app.pesos(round(p_monto)::bigint) $$;
GRANT EXECUTE ON FUNCTION app.pesos_n(numeric) TO compas_app, compas_ia, compas_sistema;

CREATE FUNCTION app.emitir_alerta(p_hogar uuid, p_destinatario uuid, p_tipo text, p_severidad med.severidad,
                                  p_regla text, p_sobre uuid, p_mensaje text, p_dato jsonb, p_clave text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, app, med AS $$
DECLARE v_hoy date := (now() AT TIME ZONE 'America/Santiago')::date; v_enviadas int; v_id uuid; v_max int;
BEGIN
  v_max := app.parametro_num(p_hogar, 'max_alertas_dia', 3)::int;
  SELECT count(*) INTO v_enviadas FROM med.alerta
   WHERE destinatario_id = p_destinatario AND fecha_local = v_hoy AND estado IN ('enviada','leida');
  INSERT INTO med.alerta(hogar_id, destinatario_id, tipo, severidad, regla_codigo, sobre_id, mensaje, dato, estado,
                         fecha_local, clave_dedup, enviada_en)
  VALUES (p_hogar, p_destinatario, p_tipo, p_severidad, (SELECT codigo FROM ref.regla_metodo WHERE codigo = p_regla),
          p_sobre, p_mensaje, p_dato, CASE WHEN v_enviadas >= v_max THEN 'en_resumen'::med.estado_alerta ELSE 'enviada' END,
          v_hoy, p_clave, CASE WHEN v_enviadas < v_max THEN now() END)
  ON CONFLICT (destinatario_id, fecha_local, clave_dedup) DO NOTHING
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;

-- Administradores activos con cuenta (los avisos van a quienes usan la app)
CREATE FUNCTION app.admins(p_hogar uuid) RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, gob AS $$
  SELECT id FROM gob.integrante WHERE hogar_id = p_hogar AND rol IN ('ORG','CAD') AND activo AND usuario_auth_id IS NOT NULL
   ORDER BY rol DESC
$$;

-- R10: sobre negativo abre N1 y avisa sin culpa (R16): hecho, regla y opción
CREATE FUNCTION app.al_sobre_negativo() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, app, plan, med AS $$
DECLARE v_sobre plan.v_sobre; v_dest uuid; v_resp uuid;
BEGIN
  IF NEW.tipo <> 'SobreNegativo' THEN RETURN NULL; END IF;
  -- un aviso nunca impide registrar el gasto que lo originó
  BEGIN
  SELECT * INTO v_sobre FROM plan.v_sobre WHERE id = (NEW.carga ->> 'sobre_id')::uuid;
  IF v_sobre.id IS NULL OR v_sobre.saldo >= 0 THEN RETURN NULL; END IF;
  SELECT id INTO v_resp FROM gob.integrante WHERE hogar_id = NEW.hogar_id AND rol IN ('CAD','ORG') AND activo
   ORDER BY rol LIMIT 1;
  IF NOT EXISTS (SELECT 1 FROM med.evento_recuperacion WHERE sobre_id = v_sobre.id AND nivel = 'N1'
                   AND estado IN ('abierto','en_curso')) THEN
    INSERT INTO med.evento_recuperacion(hogar_id, periodo_id, nivel, regla_codigo, sobre_id, responsable_id,
                                        criterio_salida, vence_el)
    VALUES (NEW.hogar_id, v_sobre.periodo_id, 'N1', 'R10', v_sobre.id, v_resp, '{"saldo_min":0}', current_date + 3);
    PERFORM app.emitir_evento(NEW.hogar_id, 'RecuperacionIniciada', NEW.actor_id,
                              jsonb_build_object('nivel', 'N1', 'sobre_id', v_sobre.id, 'regla', 'R10'));
  END IF;
  FOR v_dest IN SELECT app.admins(NEW.hogar_id) LOOP
    PERFORM app.emitir_alerta(NEW.hogar_id, v_dest, 'sobre_negativo', 'amarillo', 'R10', v_sobre.id,
      format('%s quedó en %s. Un sobre negativo se cubre moviendo dinero desde otro sobre (R10). Puedes cubrirlo ahora.',
             v_sobre.nombre, app.pesos_n(v_sobre.saldo)),
      jsonb_build_object('saldo', v_sobre.saldo), 'negativo:' || v_sobre.id);
  END LOOP;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'aviso de sobre negativo no generado: %', SQLERRM;
  END;
  RETURN NULL;
END $$;
CREATE TRIGGER trg_evento_sobre_negativo AFTER INSERT ON sys.evento_dominio
  FOR EACH ROW EXECUTE FUNCTION app.al_sobre_negativo();

-- N1 cerrado cuando el sobre vuelve a 0 o más
CREATE FUNCTION app.cerrar_n1_cubiertos(p_hogar uuid) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, app, plan, med AS $$
DECLARE r record; v_n int := 0;
BEGIN
  FOR r IN SELECT e.id, e.sobre_id, e.abierto_en FROM med.evento_recuperacion e JOIN plan.v_saldo_sobre v ON v.sobre_id = e.sobre_id
            WHERE e.hogar_id = p_hogar AND e.nivel = 'N1' AND e.estado IN ('abierto','en_curso') AND v.saldo >= 0 LOOP
    UPDATE med.evento_recuperacion SET estado = 'cerrado', cerrado_en = now() WHERE id = r.id;
    PERFORM app.emitir_evento(p_hogar, 'RecuperacionCerrada', app.integrante_actual(),
      jsonb_build_object('nivel', 'N1', 'sobre_id', r.sobre_id, 'dias', extract(day FROM now() - r.abierto_en)));
    v_n := v_n + 1;
  END LOOP;
  RETURN v_n;
END $$;

-- ---------------------------------------------------------------------
-- HU-009-2: cubrir un sobre moviendo dinero desde otro (N1)
CREATE FUNCTION app.reasignar(p_origen uuid, p_destino uuid, p_monto bigint, p_motivo text DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, app, plan, gob AS $$
DECLARE
  v_hogar uuid; v_yo uuid; o plan.v_sobre; d plan.v_sobre; v_pct numeric; v_id uuid; v_sol uuid; v_otro uuid;
  v_estado text; v_auto boolean;
BEGIN
  PERFORM app.exigir_admin();
  v_hogar := app.hogar_actual(); v_yo := app.integrante_actual();
  SELECT * INTO o FROM plan.v_sobre WHERE id = p_origen AND hogar_id = v_hogar;
  SELECT * INTO d FROM plan.v_sobre WHERE id = p_destino AND hogar_id = v_hogar;
  IF o.id IS NULL OR d.id IS NULL OR o.periodo_id <> d.periodo_id THEN
    RAISE EXCEPTION 'Los dos sobres deben ser del mismo mes de tu hogar' USING ERRCODE = 'foreign_key_violation';
  END IF;
  IF o.tipo IN ('por_asignar','pago_tarjeta') OR d.tipo IN ('por_asignar') THEN
    RAISE EXCEPTION 'Por asignar y el pago de tarjeta no se usan para reasignar; usa el reparto del ingreso'
      USING ERRCODE = 'check_violation';
  END IF;
  IF coalesce(p_monto, 0) <= 0 THEN
    RAISE EXCEPTION 'El monto debe ser mayor que cero' USING ERRCODE = 'check_violation';
  END IF;
  IF o.saldo < p_monto THEN
    RAISE EXCEPTION '% tiene % disponible; elige un monto menor u otro sobre', o.nombre, app.pesos_n(greatest(o.saldo, 0))
      USING ERRCODE = 'check_violation';
  END IF;

  IF o.tipo IN ('futuro','emergencia') THEN   -- R37: doble firma, también para quien la pide
    INSERT INTO plan.reasignacion(hogar_id, periodo_id, sobre_origen_id, sobre_destino_id, monto_clp, motivo, registrada_por)
    VALUES (v_hogar, o.periodo_id, o.id, d.id, p_monto, p_motivo, v_yo) RETURNING id INTO v_id;
    v_sol := app.crear_solicitud('retiro_futuro', 'plan.reasignacion', v_id, 2, NULL, 'R37');
    UPDATE plan.reasignacion SET solicitud_id = v_sol WHERE id = v_id;
    v_estado := 'pendiente';
  ELSE
    v_pct := app.parametro_num(v_hogar, 'autoaprobacion_n1_pct', 5);
    v_otro := app.otro_admin(v_hogar, v_yo);
    -- R38: bajo el umbral (% del disponible del sobre de origen) se aplica y queda registrada
    v_auto := p_monto <= floor(greatest(o.disponible, o.saldo) * v_pct / 100) OR v_otro IS NULL
              OR NOT EXISTS (SELECT 1 FROM gob.integrante WHERE id = v_otro AND usuario_auth_id IS NOT NULL);
    IF v_auto THEN
      INSERT INTO plan.reasignacion(hogar_id, periodo_id, sobre_origen_id, sobre_destino_id, monto_clp, motivo,
                                    autoaprobada, registrada_por, aplicada_en)
      VALUES (v_hogar, o.periodo_id, o.id, d.id, p_monto, p_motivo, true, v_yo, now()) RETURNING id INTO v_id;
      v_estado := 'aplicada';
      PERFORM app.cerrar_n1_cubiertos(v_hogar);
    ELSE
      INSERT INTO plan.reasignacion(hogar_id, periodo_id, sobre_origen_id, sobre_destino_id, monto_clp, motivo, registrada_por)
      VALUES (v_hogar, o.periodo_id, o.id, d.id, p_monto, p_motivo, v_yo) RETURNING id INTO v_id;
      v_sol := app.crear_solicitud('reasignacion', 'plan.reasignacion', v_id, 1, v_otro, 'R38');
      UPDATE plan.reasignacion SET solicitud_id = v_sol WHERE id = v_id;
      v_estado := 'pendiente';
      PERFORM app.emitir_alerta(v_hogar, v_otro, 'aprobacion_pendiente', 'info', 'R38', d.id,
        format('Hay una reasignación de %s desde %s a %s esperando tu aprobación.', app.pesos_n(p_monto), o.nombre, d.nombre),
        jsonb_build_object('solicitud_id', v_sol), 'solicitud:' || v_sol);
    END IF;
  END IF;
  RETURN jsonb_build_object('reasignacion_id', v_id, 'estado', v_estado, 'solicitud_id', v_sol);
END $$;

CREATE FUNCTION app.aplicar_reasignacion(p_solicitud uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, app, plan AS $$
DECLARE v_hogar uuid;
BEGIN
  UPDATE plan.reasignacion SET aplicada_en = now() WHERE solicitud_id = p_solicitud AND aplicada_en IS NULL
  RETURNING hogar_id INTO v_hogar;
  IF v_hogar IS NOT NULL THEN PERFORM app.cerrar_n1_cubiertos(v_hogar); END IF;
END $$;

CREATE FUNCTION app.aplicar_retiro_futuro(p_solicitud uuid) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = pg_catalog, app AS $$
  SELECT app.aplicar_reasignacion(p_solicitud)
$$;

-- ---------------------------------------------------------------------
-- Pronóstico de fin de mes (R12): por asignar + lo que quedaría en cada sobre al ritmo actual
CREATE FUNCTION app.balance_proyectado(p_periodo uuid, p_hoy date) RETURNS bigint
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, plan AS $$
  WITH p AS (SELECT mes, extract(day FROM (mes + interval '1 month - 1 day'))::numeric AS dias,
                    greatest(1, least(extract(day FROM p_hoy)::numeric,
                                      extract(day FROM (mes + interval '1 month - 1 day'))::numeric)) AS transcurridos
               FROM plan.periodo WHERE id = p_periodo)
  SELECT coalesce(sum(CASE WHEN v.tipo IN ('variable','mesada')
                           THEN v.disponible - round(v.gastado * p.dias / p.transcurridos)
                           ELSE v.saldo END), 0)::bigint
    FROM plan.v_saldo_sobre v, p
   WHERE v.periodo_id = p_periodo AND v.tipo <> 'pago_tarjeta'
$$;

CREATE FUNCTION app.control_hogar(p_hogar uuid, p_hoy date DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, app, plan, med, gob, fin AS $$
DECLARE
  v_hoy date := coalesce(p_hoy, (now() AT TIME ZONE 'America/Santiago')::date);
  v_periodo uuid; v_umbral numeric; r record; v_dest uuid; v_bal bigint; v_org uuid; v_n int := 0;
BEGIN
  -- R39: solicitudes vencidas pasan al suplente (siempre, también en línea base)
  FOR r IN SELECT s.id, s.hogar_id, s.aprobador_id, s.tipo FROM gob.solicitud_aprobacion s
            WHERE s.hogar_id = p_hogar AND s.estado = 'pendiente' AND s.vence_en <= now() AND NOT s.escalada_a_suplente
              AND s.firmas_requeridas = 1 LOOP
    UPDATE gob.solicitud_aprobacion SET escalada_a_suplente = true WHERE id = r.id;
    FOR v_dest IN SELECT x FROM app.admins(p_hogar) x WHERE x IS DISTINCT FROM r.aprobador_id LOOP
      PERFORM app.emitir_alerta(p_hogar, v_dest, 'aprobacion_pendiente', 'amarillo', 'R39', NULL,
        'Una aprobación lleva más de 48 horas sin respuesta. Según el Acuerdo, ahora puedes decidir como suplente (R39).',
        jsonb_build_object('solicitud_id', r.id, 'tipo', r.tipo), 'suplencia:' || r.id);
      v_n := v_n + 1;
    END LOOP;
  END LOOP;

  -- Transferencias pendientes a las 72 h: un recordatorio (spec 007)
  FOR r IN SELECT t.id, t.monto_clp, t.tipo FROM fin.transferencia t
            WHERE t.hogar_id = p_hogar AND t.estado = 'pendiente' AND t.vence_en <= now() LOOP
    FOR v_dest IN SELECT app.admins(p_hogar) LOOP
      PERFORM app.emitir_alerta(p_hogar, v_dest, 'transferencia_pendiente', 'info', NULL, NULL,
        format('Queda pendiente una transferencia de %s. Márcala como hecha cuando la hagas en tu banco.', app.pesos_n(r.monto_clp)),
        jsonb_build_object('transferencia_id', r.id), 'transferencia:' || r.id);
      v_n := v_n + 1;
    END LOOP;
  END LOOP;

  -- Pagos por vencer en 3 días: tarjetas y pagos fijos
  FOR r IN SELECT c.nombre, c.id, make_date(extract(year FROM v_hoy)::int, extract(month FROM v_hoy)::int,
                                           least(c.dia_pago, extract(day FROM (date_trunc('month', v_hoy) + interval '1 month - 1 day'))::int)) AS vence,
                  t.deuda, t.apartado
             FROM fin.cuenta c JOIN fin.v_tarjeta t ON t.cuenta_id = c.id
            WHERE c.hogar_id = p_hogar AND c.activa AND c.tipo = 'tarjeta_credito' LOOP
    IF r.vence - v_hoy BETWEEN 0 AND 3 AND r.deuda > 0 THEN
      FOR v_dest IN SELECT app.admins(p_hogar) LOOP
        PERFORM app.emitir_alerta(p_hogar, v_dest, 'pago_por_vencer', 'info', 'R44', NULL,
          format('La %s vence el %s: debes %s y tienes apartado %s.%s', r.nombre, to_char(r.vence, 'DD-MM'),
                 app.pesos_n(r.deuda), app.pesos_n(greatest(r.apartado, 0)),
                 CASE WHEN r.apartado < r.deuda THEN ' Lo apartado no alcanza; revisa de qué sobre cubrir la diferencia.' ELSE '' END),
          jsonb_build_object('cuenta_id', r.id, 'deuda', r.deuda, 'apartado', r.apartado), 'vence:' || r.id || ':' || r.vence);
        v_n := v_n + 1;
      END LOOP;
    END IF;
  END LOOP;
  FOR r IN SELECT f.id, f.nombre, f.monto, f.moneda,
                  make_date(extract(year FROM v_hoy)::int, extract(month FROM v_hoy)::int,
                            least(f.dia_vencimiento, extract(day FROM (date_trunc('month', v_hoy) + interval '1 month - 1 day'))::int)) AS vence
             FROM plan.pago_fijo f
            WHERE f.hogar_id = p_hogar AND f.vigente_desde <= v_hoy AND (f.vigente_hasta IS NULL OR f.vigente_hasta >= v_hoy) LOOP
    IF r.vence - v_hoy BETWEEN 0 AND 3 THEN
      FOR v_dest IN SELECT app.admins(p_hogar) LOOP
        PERFORM app.emitir_alerta(p_hogar, v_dest, 'pago_por_vencer', 'info', NULL, NULL,
          format('%s vence el %s.', r.nombre, to_char(r.vence, 'DD-MM')),
          jsonb_build_object('pago_fijo_id', r.id), 'fijo:' || r.id || ':' || r.vence);
        v_n := v_n + 1;
      END LOOP;
    END IF;
  END LOOP;

  -- Línea base: sin alertas de ritmo ni de balance (spec 009)
  IF date_trunc('month', v_hoy)::date < app.mes_primer_plan(p_hogar) THEN
    RETURN jsonb_build_object('alertas', v_n, 'linea_base', true);
  END IF;
  SELECT id INTO v_periodo FROM plan.periodo WHERE hogar_id = p_hogar AND mes = date_trunc('month', v_hoy)::date;
  IF v_periodo IS NULL THEN RETURN jsonb_build_object('alertas', v_n); END IF;

  -- R09: ritmo por sobre variable
  v_umbral := app.parametro_num(p_hogar, 'umbral_ritmo', 1.1);
  FOR r IN SELECT v.sobre_id, s.nombre, v.disponible, v.gastado,
                  round(v.gastado::numeric / (v.disponible * greatest(1, least(extract(day FROM v_hoy), v.dias_mes)) / v.dias_mes), 2) AS ritmo
             FROM plan.v_ritmo_sobre v JOIN plan.v_sobre s ON s.id = v.sobre_id
            WHERE v.periodo_id = v_periodo AND v.disponible > 0 LOOP
    IF r.ritmo > v_umbral THEN
      FOR v_dest IN SELECT app.admins(p_hogar) LOOP
        PERFORM app.emitir_alerta(p_hogar, v_dest, 'ritmo', 'amarillo', 'R09', r.sobre_id,
          format('%s va a ritmo %s: lleva %s de %s. Con un ritmo sobre %s, el método sugiere revisar (R09). Puedes moderar el gasto o cubrir desde otro sobre.',
                 r.nombre, replace(r.ritmo::text, '.', ','), app.pesos_n(r.gastado), app.pesos_n(r.disponible), replace(v_umbral::text, '.', ',')),
          jsonb_build_object('ritmo', r.ritmo), 'ritmo:' || r.sobre_id || ':' || v_hoy);
        v_n := v_n + 1;
      END LOOP;
      PERFORM app.emitir_evento(p_hogar, 'RitmoExcedido', NULL, jsonb_build_object('sobre_id', r.sobre_id, 'ritmo', r.ritmo));
    END IF;
  END LOOP;

  -- R12: balance proyectado negativo abre N2 para el ORG
  v_bal := app.balance_proyectado(v_periodo, v_hoy);
  IF v_bal < 0 THEN
    SELECT id INTO v_org FROM gob.integrante WHERE hogar_id = p_hogar AND rol = 'ORG' AND activo ORDER BY creado_en LIMIT 1;
    IF NOT EXISTS (SELECT 1 FROM med.evento_recuperacion WHERE periodo_id = v_periodo AND nivel = 'N2'
                     AND estado IN ('abierto','en_curso')) THEN
      INSERT INTO med.evento_recuperacion(hogar_id, periodo_id, nivel, regla_codigo, responsable_id, criterio_salida,
                                          vence_el, plan_accion)
      VALUES (p_hogar, v_periodo, 'N2', 'R12', v_org, '{"balance_min":0}',
              (date_trunc('month', v_hoy) + interval '1 month - 1 day')::date,
              'Recortar Vida y sin culpa; pausar aportes no críticos');
      PERFORM app.emitir_evento(p_hogar, 'DesvioDetectado', NULL, jsonb_build_object('nivel', 'N2', 'balance', v_bal, 'regla', 'R12'));
    END IF;
    PERFORM app.emitir_alerta(p_hogar, v_org, 'balance_proyectado', 'rojo', 'R12', NULL,
      format('Al ritmo actual, el mes cerraría en %s. Cuando el balance proyectado es negativo se revisa el mes (R12). Opción: recortar Vida y sin culpa, o pausar aportes no críticos.',
             app.pesos_n(v_bal)),
      jsonb_build_object('balance', v_bal), 'balance:' || v_hoy);
    v_n := v_n + 1;
  END IF;
  RETURN jsonb_build_object('alertas', v_n, 'balance_proyectado', v_bal);
END $$;

CREATE FUNCTION app.control_diario() RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, app, gob AS $$
DECLARE h uuid; v_n int := 0;
BEGIN
  FOR h IN SELECT id FROM gob.hogar WHERE eliminado_en IS NULL LOOP
    BEGIN
      PERFORM app.control_hogar(h);
      v_n := v_n + 1;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'control_diario: hogar % falló: %', h, SQLERRM;   -- sin montos ni glosas en el log
    END;
  END LOOP;
  RETURN v_n;
END $$;

-- Avisos de la persona: hoy (enviados) y el resumen (D33)
CREATE VIEW med.v_aviso WITH (security_invoker = true) AS
SELECT a.id, a.hogar_id, a.destinatario_id, a.tipo, a.severidad, a.regla_codigo, a.sobre_id, a.mensaje, a.dato, a.estado,
       a.fecha_local, a.creado_en, a.leida_en
  FROM med.alerta a
 WHERE a.destinatario_id = app.integrante_actual() AND a.estado IN ('enviada','en_resumen','leida');
GRANT SELECT ON med.v_aviso TO compas_app;

CREATE FUNCTION app.marcar_avisos_leidos(p_ids uuid[]) RETURNS integer
LANGUAGE sql SECURITY DEFINER SET search_path = pg_catalog, app, med AS $$
  WITH u AS (UPDATE med.alerta SET estado = 'leida', leida_en = now()
              WHERE id = ANY(p_ids) AND destinatario_id = app.integrante_actual() AND estado <> 'leida' RETURNING 1)
  SELECT count(*)::int FROM u
$$;

-- pg_cron (Supabase): 23:00 UTC = 20:00 de Santiago en horario de verano. En CI no existe y se omite.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pg_cron') THEN
    CREATE EXTENSION IF NOT EXISTS pg_cron;
    PERFORM cron.schedule('compas-control-diario', '0 23 * * *', 'SELECT app.control_diario()');
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'pg_cron no disponible: %', SQLERRM;
END $$;

REVOKE EXECUTE ON FUNCTION app.emitir_alerta(uuid, uuid, text, med.severidad, text, uuid, text, jsonb, text),
  app.admins(uuid), app.al_sobre_negativo(), app.cerrar_n1_cubiertos(uuid), app.reasignar(uuid, uuid, bigint, text),
  app.aplicar_reasignacion(uuid), app.aplicar_retiro_futuro(uuid), app.balance_proyectado(uuid, date),
  app.control_hogar(uuid, date), app.control_diario(), app.marcar_avisos_leidos(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.reasignar(uuid, uuid, bigint, text), app.marcar_avisos_leidos(uuid[]) TO compas_app;
GRANT EXECUTE ON FUNCTION app.control_diario(), app.control_hogar(uuid, date) TO compas_sistema;

COMMIT;
