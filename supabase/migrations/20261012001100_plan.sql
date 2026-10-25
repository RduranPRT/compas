-- =====================================================================
-- Compás — migración 0011: plan mensual base cero (spec 006)
-- Fecha: 25-10-2026
-- * app.guardar_borrador_plan: borrador calculado por el dominio (generarBorrador); cada línea con regla (P8).
--   Con un plan aprobado vigente, el borrador es la versión siguiente (P2-A, R33).
-- * app.actualizar_linea_plan: ajustes de la CAD o el ORG antes de aprobar.
-- * app.enviar_plan: valida base cero (R01) y pide la aprobación del ORG (suplente a las 48 h, R39).
-- * app.aplicar_presupuesto: al aprobar, congela la versión y abre el período con el arrastre (R20).
-- =====================================================================
BEGIN;

CREATE FUNCTION app.presupuesto_del_hogar(p_presupuesto uuid) RETURNS plan.presupuesto_mensual
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, app, plan AS $$
DECLARE p plan.presupuesto_mensual;
BEGIN
  SELECT * INTO p FROM plan.presupuesto_mensual WHERE id = p_presupuesto AND hogar_id = app.hogar_actual();
  IF p.id IS NULL THEN
    RAISE EXCEPTION 'No encontramos ese plan en tu hogar' USING ERRCODE = 'no_data_found';
  END IF;
  RETURN p;
END $$;

-- p_lineas: [{sobre_id, monto, regla_codigo, explicacion, holgura_pct?, aporte_calculado?, monto_uf?}]
CREATE FUNCTION app.guardar_borrador_plan(p_mes date, p_ingreso bigint, p_lineas jsonb,
                                          p_generado_por sys.tipo_actor DEFAULT 'sistema', p_motivo text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, app, plan, gob AS $$
DECLARE v_hogar uuid; v_periodo uuid; v_id uuid; v_version int; v_estado plan.estado_periodo;
BEGIN
  PERFORM app.exigir_admin();
  v_hogar := app.hogar_actual();
  IF coalesce(p_ingreso, -1) < 0 THEN
    RAISE EXCEPTION 'El ingreso proyectado no puede ser negativo' USING ERRCODE = 'check_violation';
  END IF;
  v_periodo := app.periodo_de(v_hogar, p_mes);
  SELECT estado INTO v_estado FROM plan.periodo WHERE id = v_periodo;
  IF v_estado = 'cerrado' THEN
    RAISE EXCEPTION 'Ese mes está cerrado; reábrelo con motivo para planificarlo (D20)' USING ERRCODE = 'check_violation';
  END IF;
  SELECT id INTO v_id FROM plan.presupuesto_mensual WHERE periodo_id = v_periodo AND estado = 'borrador'
   ORDER BY version DESC LIMIT 1;
  IF v_id IS NULL THEN
    SELECT coalesce(max(version), 0) + 1 INTO v_version FROM plan.presupuesto_mensual WHERE periodo_id = v_periodo;
    INSERT INTO plan.presupuesto_mensual(hogar_id, periodo_id, version, estado, ingreso_proyectado, etapa_codigo,
                                         acuerdo_id, generado_por, motivo_version)
    VALUES (v_hogar, v_periodo, v_version, 'borrador', p_ingreso, (SELECT etapa_codigo FROM gob.hogar WHERE id = v_hogar),
            (SELECT id FROM gob.acuerdo_hogar WHERE hogar_id = v_hogar AND estado = 'vigente'),
            coalesce(p_generado_por, 'sistema'), p_motivo)
    RETURNING id INTO v_id;
  ELSE
    UPDATE plan.presupuesto_mensual SET ingreso_proyectado = p_ingreso, motivo_version = coalesce(p_motivo, motivo_version),
           etapa_codigo = (SELECT etapa_codigo FROM gob.hogar WHERE id = v_hogar), generado_por = coalesce(p_generado_por, 'sistema')
     WHERE id = v_id;
    DELETE FROM plan.linea_plan WHERE presupuesto_id = v_id;
  END IF;
  INSERT INTO plan.linea_plan(presupuesto_id, sobre_id, monto_proyectado, monto_uf, holgura_pct, aporte_calculado,
                              regla_codigo, explicacion)
  SELECT v_id, s.id, greatest((x ->> 'monto')::bigint, 0), nullif(x ->> 'monto_uf', '')::numeric,
         coalesce(nullif(x ->> 'holgura_pct', '')::numeric, 0), nullif(x ->> 'aporte_calculado', '')::bigint,
         (SELECT codigo FROM ref.regla_metodo WHERE codigo = x ->> 'regla_codigo'), left(x ->> 'explicacion', 500)
    FROM jsonb_array_elements(coalesce(p_lineas, '[]')) x
    JOIN plan.sobre s ON s.id = (x ->> 'sobre_id')::uuid AND s.periodo_id = v_periodo
                     AND s.tipo NOT IN ('por_asignar','proximo_mes');
  RETURN v_id;
END $$;

CREATE FUNCTION app.actualizar_linea_plan(p_presupuesto uuid, p_sobre uuid, p_monto bigint) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, app, plan AS $$
DECLARE p plan.presupuesto_mensual;
BEGIN
  PERFORM app.exigir_admin();
  p := app.presupuesto_del_hogar(p_presupuesto);
  IF p.estado <> 'borrador' THEN
    RAISE EXCEPTION 'Un plan aprobado no se edita; crea la versión siguiente' USING ERRCODE = 'check_violation';
  END IF;
  IF coalesce(p_monto, -1) < 0 THEN
    RAISE EXCEPTION 'El monto no puede ser negativo' USING ERRCODE = 'check_violation';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM plan.sobre WHERE id = p_sobre AND periodo_id = p.periodo_id
                   AND tipo NOT IN ('por_asignar','proximo_mes')) THEN
    RAISE EXCEPTION 'Ese sobre no es del mes del plan' USING ERRCODE = 'foreign_key_violation';
  END IF;
  INSERT INTO plan.linea_plan(presupuesto_id, sobre_id, monto_proyectado, regla_codigo, explicacion)
  VALUES (p.id, p_sobre, p_monto, NULL, 'Ajustado a mano')
  ON CONFLICT (presupuesto_id, sobre_id) DO UPDATE SET monto_proyectado = EXCLUDED.monto_proyectado;
END $$;

-- Base cero (R01): el mensaje dice cuánto falta o sobra en Por asignar
CREATE FUNCTION app.exigir_base_cero(p_presupuesto uuid) RETURNS void
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, app, plan AS $$
DECLARE v_ing bigint; v_suma bigint;
BEGIN
  SELECT ingreso_proyectado INTO v_ing FROM plan.presupuesto_mensual WHERE id = p_presupuesto;
  SELECT coalesce(sum(monto_proyectado), 0) INTO v_suma FROM plan.linea_plan WHERE presupuesto_id = p_presupuesto;
  IF v_suma < v_ing THEN
    RAISE EXCEPTION 'El plan no cuadra: quedan % en Por asignar. Asígnalos a algún sobre (R01)', app.pesos(v_ing - v_suma)
      USING ERRCODE = 'check_violation';
  ELSIF v_suma > v_ing THEN
    RAISE EXCEPTION 'El plan no cuadra: las líneas superan el ingreso en %. Por asignar queda en % (R01)',
      app.pesos(v_suma - v_ing), app.pesos(v_ing - v_suma) USING ERRCODE = 'check_violation';
  END IF;
END $$;

CREATE FUNCTION app.enviar_plan(p_presupuesto uuid) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, app, plan, gob AS $$
DECLARE p plan.presupuesto_mensual; v_sol uuid; v_org uuid;
BEGIN
  PERFORM app.exigir_admin();
  p := app.presupuesto_del_hogar(p_presupuesto);
  IF p.estado <> 'borrador' THEN
    RAISE EXCEPTION 'Ese plan ya está %', p.estado USING ERRCODE = 'check_violation';
  END IF;
  PERFORM app.exigir_base_cero(p.id);
  SELECT id INTO v_sol FROM gob.solicitud_aprobacion WHERE objeto_id = p.id AND tipo IN ('presupuesto','ajuste_plan')
     AND estado = 'pendiente';
  IF v_sol IS NOT NULL THEN RETURN v_sol; END IF;
  SELECT id INTO v_org FROM gob.integrante WHERE hogar_id = p.hogar_id AND rol = 'ORG' AND activo ORDER BY creado_en LIMIT 1;
  v_sol := app.crear_solicitud(CASE WHEN p.version > 1 THEN 'ajuste_plan'::gob.tipo_solicitud ELSE 'presupuesto' END,
                               'plan.presupuesto_mensual', p.id, 1, v_org, 'R39');
  UPDATE plan.presupuesto_mensual SET solicitud_id = v_sol WHERE id = p.id;
  RETURN v_sol;
END $$;

-- R20: al abrir un mes con plan, se arrastran los saldos del mes anterior si ese mes tuvo plan
CREATE FUNCTION app.abrir_periodo(p_periodo uuid) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, app, plan AS $$
DECLARE per plan.periodo; v_prev uuid; v_pa uuid; r record; v_n int := 0; v_dest uuid;
BEGIN
  SELECT * INTO per FROM plan.periodo WHERE id = p_periodo;
  SELECT id INTO v_prev FROM plan.periodo WHERE hogar_id = per.hogar_id AND mes = (per.mes - interval '1 month')::date;
  IF v_prev IS NULL
     OR NOT EXISTS (SELECT 1 FROM plan.presupuesto_mensual WHERE periodo_id = v_prev
                     AND estado IN ('aprobado','en_ejecucion','en_cierre','cerrado'))
     OR EXISTS (SELECT 1 FROM plan.libro_sobre WHERE origen_tabla = 'plan.periodo' AND origen_id = p_periodo) THEN
    RETURN 0;   -- la línea base no arrastra saldos y el arrastre se hace una sola vez
  END IF;
  SELECT id INTO v_pa FROM plan.sobre WHERE periodo_id = p_periodo AND tipo = 'por_asignar';
  FOR r IN SELECT s.id, s.tipo, v.saldo FROM plan.sobre s JOIN plan.v_saldo_sobre v ON v.sobre_id = s.id
            WHERE s.periodo_id = v_prev AND (s.categoria_id IS NOT NULL OR s.tipo = 'por_asignar') AND v.saldo <> 0 LOOP
    IF r.saldo > 0 AND r.tipo <> 'por_asignar' THEN
      v_dest := app.sobre_en_periodo(r.id, p_periodo);
    ELSE
      v_dest := v_pa;
    END IF;
    INSERT INTO plan.libro_sobre(hogar_id, sobre_id, tipo, monto_clp, origen_tabla, origen_id, fecha_valor)
    VALUES (per.hogar_id, r.id, 'arrastre', -r.saldo, 'plan.periodo', p_periodo, per.mes),
           (per.hogar_id, v_dest, 'arrastre', r.saldo, 'plan.periodo', p_periodo, per.mes);
    v_n := v_n + 1;
  END LOOP;
  RETURN v_n;
END $$;

CREATE FUNCTION app.aplicar_presupuesto(p_solicitud uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, app, plan, gob AS $$
DECLARE p plan.presupuesto_mensual; v_firma gob.firma;
BEGIN
  SELECT * INTO v_firma FROM gob.firma WHERE solicitud_id = p_solicitud AND decision = 'aprueba'
   ORDER BY firmado_en DESC LIMIT 1;
  UPDATE plan.presupuesto_mensual SET estado = 'aprobado', aprobado_por = v_firma.integrante_id, aprobado_en = now()
   WHERE id = (SELECT objeto_id FROM gob.solicitud_aprobacion WHERE id = p_solicitud) AND estado = 'borrador'
  RETURNING * INTO p;
  IF p.id IS NULL THEN RETURN; END IF;
  PERFORM app.abrir_periodo(p.periodo_id);
  PERFORM app.emitir_evento(p.hogar_id, 'PresupuestoAprobado', v_firma.integrante_id,
    jsonb_build_object('presupuesto_id', p.id, 'mes', (SELECT mes FROM plan.periodo WHERE id = p.periodo_id),
                       'version', p.version, 'como_suplente', v_firma.como_suplente));
END $$;

CREATE FUNCTION app.aplicar_ajuste_plan(p_solicitud uuid) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = pg_catalog, app AS $$
  SELECT app.aplicar_presupuesto(p_solicitud)
$$;

-- Líneas del plan con el sobre, su bloque y lo real del mes
CREATE VIEW plan.v_linea_plan WITH (security_invoker = true) AS
SELECT lp.presupuesto_id, pm.periodo_id, pm.hogar_id, pm.version, pm.estado AS estado_plan, lp.sobre_id, s.nombre,
       s.tipo, s.bloque_codigo, s.es_cuatro_paredes, s.integrante_id, s.fondo_id, s.cuenta_id, lp.monto_proyectado,
       lp.monto_uf, lp.holgura_pct, lp.aporte_calculado, lp.regla_codigo, lp.explicacion, s.disponible, s.gastado, s.saldo
  FROM plan.linea_plan lp
  JOIN plan.presupuesto_mensual pm ON pm.id = lp.presupuesto_id
  JOIN plan.v_sobre s ON s.id = lp.sobre_id;
GRANT SELECT ON plan.v_linea_plan TO compas_app, compas_ia;

REVOKE EXECUTE ON FUNCTION app.presupuesto_del_hogar(uuid),
  app.guardar_borrador_plan(date, bigint, jsonb, sys.tipo_actor, text), app.actualizar_linea_plan(uuid, uuid, bigint),
  app.exigir_base_cero(uuid), app.enviar_plan(uuid), app.abrir_periodo(uuid), app.aplicar_presupuesto(uuid),
  app.aplicar_ajuste_plan(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.guardar_borrador_plan(date, bigint, jsonb, sys.tipo_actor, text),
  app.actualizar_linea_plan(uuid, uuid, bigint), app.enviar_plan(uuid) TO compas_app;
GRANT EXECUTE ON FUNCTION app.abrir_periodo(uuid) TO compas_sistema;

COMMIT;
