-- =====================================================================
-- Compás — migración 0014: cierres semanal y mensual, KPI y reapertura (spec 010)
-- Fecha: 25-10-2026
-- * app.cerrar_semana: conciliación de cada cuenta (R34), movimientos a conciliados, SemanaCerrada.
-- * app.iniciar_cierre_mes: abre el cierre para registrar valoraciones (R19).
-- * app.cerrar_mes: guarda KPI calculados en el dominio con su versión, cierra el período (MesCerrado).
--   Una tarjeta sin estado de cuenta importado en el mes pide justificar la omisión (ADR-08).
-- * app.reabrir_periodo: con motivo; la versión de cierre sube y los KPI anteriores se conservan (D20).
-- * app.pronostico_mes: balance proyectado del mes para la portada (R12).
-- =====================================================================
BEGIN;

-- p_saldos: [{cuenta_id, saldo_real, motivo?}]
CREATE FUNCTION app.cerrar_semana(p_fecha_corte date, p_saldos jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, app, fin, med, plan AS $$
DECLARE v_hogar uuid; v_yo uuid; x record; r jsonb; v_res jsonb := '[]'; v_conc int; v_dif bigint := 0;
BEGIN
  PERFORM app.exigir_admin();
  v_hogar := app.hogar_actual(); v_yo := app.integrante_actual();
  FOR x IN SELECT (s ->> 'cuenta_id')::uuid AS cuenta, (s ->> 'saldo_real')::bigint AS saldo, s ->> 'motivo' AS motivo
             FROM jsonb_array_elements(p_saldos) s LOOP
    r := app.conciliar_cuenta(x.cuenta, 'semanal', p_fecha_corte, x.saldo, x.motivo);
    v_res := v_res || r;
    v_dif := v_dif + abs((r ->> 'diferencia')::bigint);
  END LOOP;
  UPDATE fin.movimiento m SET estado = 'conciliado'
    FROM plan.periodo p
   WHERE p.id = m.periodo_id AND p.estado <> 'cerrado' AND m.hogar_id = v_hogar AND m.estado = 'confirmado'
     AND m.fecha_contable <= p_fecha_corte AND m.cuenta_id IN (SELECT (s ->> 'cuenta_id')::uuid FROM jsonb_array_elements(p_saldos) s);
  GET DIAGNOSTICS v_conc = ROW_COUNT;
  INSERT INTO med.cierre(hogar_id, periodo_id, tipo, fecha_programada, estado, responsable_id, realizado_por, realizado_en)
  VALUES (v_hogar, app.periodo_de(v_hogar, p_fecha_corte), 'semanal', p_fecha_corte, 'hecho', v_yo, v_yo, now())
  ON CONFLICT (hogar_id, tipo, fecha_programada) DO UPDATE
     SET estado = 'hecho', realizado_por = EXCLUDED.realizado_por, realizado_en = now();
  PERFORM app.emitir_evento(v_hogar, 'SemanaCerrada', v_yo,
                            jsonb_build_object('fecha_corte', p_fecha_corte, 'diferencia', v_dif, 'conciliados', v_conc));
  RETURN jsonb_build_object('cuentas', v_res, 'conciliados', v_conc, 'diferencia_total', v_dif);
END $$;

CREATE FUNCTION app.iniciar_cierre_mes(p_periodo uuid) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, app, med, plan AS $$
DECLARE v_hogar uuid; per plan.periodo; v_id uuid;
BEGIN
  PERFORM app.exigir_admin();
  v_hogar := app.hogar_actual();
  SELECT * INTO per FROM plan.periodo WHERE id = p_periodo AND hogar_id = v_hogar;
  IF per.id IS NULL THEN
    RAISE EXCEPTION 'No encontramos ese mes en tu hogar' USING ERRCODE = 'no_data_found';
  END IF;
  INSERT INTO med.cierre(hogar_id, periodo_id, tipo, fecha_programada, responsable_id)
  VALUES (v_hogar, per.id, 'mensual', (per.mes + interval '1 month')::date,
          (SELECT id FROM gob.integrante WHERE hogar_id = v_hogar AND rol = 'ORG' AND activo ORDER BY creado_en LIMIT 1))
  ON CONFLICT (hogar_id, tipo, fecha_programada) DO NOTHING;
  SELECT id INTO v_id FROM med.cierre WHERE hogar_id = v_hogar AND tipo = 'mensual'
     AND fecha_programada = (per.mes + interval '1 month')::date;
  IF per.estado = 'abierto' OR per.estado = 'reabierto' THEN
    UPDATE plan.periodo SET estado = 'en_cierre' WHERE id = per.id AND estado = 'abierto';
  END IF;
  RETURN v_id;
END $$;

-- p_kpis: [{codigo, valor, semaforo?, detalle?}]
CREATE FUNCTION app.cerrar_mes(p_periodo uuid, p_kpis jsonb, p_resumen text DEFAULT NULL,
                               p_justificacion text DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, app, med, plan, fin AS $$
DECLARE
  v_hogar uuid; v_yo uuid; per plan.periodo; v_cierre uuid; v_pend int; v_sin_estado text; v_fin date; v_n int;
BEGIN
  PERFORM app.exigir_admin();
  v_hogar := app.hogar_actual(); v_yo := app.integrante_actual();
  SELECT * INTO per FROM plan.periodo WHERE id = p_periodo AND hogar_id = v_hogar FOR UPDATE;
  IF per.id IS NULL THEN
    RAISE EXCEPTION 'No encontramos ese mes en tu hogar' USING ERRCODE = 'no_data_found';
  END IF;
  IF per.estado = 'cerrado' THEN
    RAISE EXCEPTION 'Ese mes ya está cerrado' USING ERRCODE = 'check_violation';
  END IF;
  v_fin := (per.mes + interval '1 month - 1 day')::date;
  SELECT count(*) INTO v_pend FROM fin.movimiento WHERE periodo_id = per.id AND estado IN ('capturado','por_confirmar');
  IF v_pend > 0 THEN
    RAISE EXCEPTION 'Quedan % movimientos por confirmar del mes; revísalos en la bandeja antes de cerrar', v_pend
      USING ERRCODE = 'check_violation';
  END IF;
  SELECT string_agg(c.nombre, ', ' ORDER BY c.nombre) INTO v_sin_estado
    FROM fin.cuenta c
   WHERE c.hogar_id = v_hogar AND c.activa AND c.tipo = 'tarjeta_credito'
     AND NOT EXISTS (SELECT 1 FROM fin.importacion i WHERE i.cuenta_id = c.id AND i.desde <= v_fin AND i.hasta >= per.mes);
  IF v_sin_estado IS NOT NULL AND btrim(coalesce(p_justificacion, '')) = '' THEN
    RAISE EXCEPTION 'Falta el estado de cuenta de % para este mes: impórtalo o escribe por qué se omite', v_sin_estado
      USING ERRCODE = 'check_violation';
  END IF;

  v_cierre := app.iniciar_cierre_mes(per.id);
  INSERT INTO med.medicion_kpi(hogar_id, periodo_id, kpi_codigo, version_cierre, valor, semaforo, detalle)
  SELECT v_hogar, per.id, k ->> 'codigo', per.version_cierre, (k ->> 'valor')::numeric,
         nullif(k ->> 'semaforo', '')::med.severidad, k -> 'detalle'
    FROM jsonb_array_elements(coalesce(p_kpis, '[]')) k
   WHERE EXISTS (SELECT 1 FROM ref.definicion_kpi d WHERE d.codigo = k ->> 'codigo')
  ON CONFLICT (periodo_id, kpi_codigo, version_cierre) DO UPDATE
     SET valor = EXCLUDED.valor, semaforo = EXCLUDED.semaforo, detalle = EXCLUDED.detalle, calculado_en = now();
  GET DIAGNOSTICS v_n = ROW_COUNT;
  UPDATE med.cierre SET estado = 'hecho', realizado_por = v_yo, realizado_en = now(),
         resumen_ia = coalesce(p_resumen, resumen_ia)
   WHERE id = v_cierre;
  UPDATE plan.presupuesto_mensual SET estado = 'cerrado'
   WHERE periodo_id = per.id AND estado IN ('aprobado','en_ejecucion','en_cierre');
  UPDATE plan.periodo SET estado = 'cerrado', cerrado_en = now() WHERE id = per.id;
  PERFORM app.emitir_evento(v_hogar, 'MesCerrado', v_yo,
    jsonb_build_object('periodo_id', per.id, 'mes', per.mes, 'version', per.version_cierre, 'kpi', p_kpis,
                       'linea_base', per.mes < app.mes_primer_plan(v_hogar), 'omision_estado_cuenta', p_justificacion));
  RETURN jsonb_build_object('cierre_id', v_cierre, 'kpis', v_n, 'version_cierre', per.version_cierre);
END $$;

-- D20: reabrir con motivo; al volver a cerrar se recalcula con la versión siguiente
CREATE FUNCTION app.reabrir_periodo(p_periodo uuid, p_motivo text) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, app, plan, med AS $$
DECLARE per plan.periodo;
BEGIN
  PERFORM app.exigir_admin();
  IF btrim(coalesce(p_motivo, '')) = '' THEN
    RAISE EXCEPTION 'Escribe el motivo para reabrir el mes (D20)' USING ERRCODE = 'check_violation';
  END IF;
  UPDATE plan.periodo SET estado = 'reabierto', reabierto_motivo = btrim(p_motivo), version_cierre = version_cierre + 1,
         cerrado_en = NULL
   WHERE id = p_periodo AND hogar_id = app.hogar_actual() AND estado = 'cerrado'
  RETURNING * INTO per;
  IF per.id IS NULL THEN
    RAISE EXCEPTION 'Solo se reabre un mes cerrado de tu hogar' USING ERRCODE = 'check_violation';
  END IF;
  UPDATE plan.presupuesto_mensual SET estado = 'en_cierre' WHERE periodo_id = per.id AND estado = 'cerrado';
  UPDATE med.cierre SET estado = 'pendiente' WHERE periodo_id = per.id AND tipo = 'mensual';
  RETURN per.version_cierre;
END $$;

-- Valoración +/0/− por categoría y respuestas Kakeibo (R19): cada integrante escribe la suya
CREATE FUNCTION app.valorar(p_cierre uuid, p_categoria uuid, p_valoracion med.valoracion, p_pregunta text DEFAULT NULL,
                            p_respuesta text DEFAULT NULL) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, app, med AS $$
DECLARE v_hogar uuid := app.hogar_actual(); v_yo uuid := app.integrante_actual();
BEGIN
  PERFORM app.exigir_integrante();
  IF NOT EXISTS (SELECT 1 FROM med.cierre WHERE id = p_cierre AND hogar_id = v_hogar) THEN
    RAISE EXCEPTION 'No encontramos ese cierre en tu hogar' USING ERRCODE = 'no_data_found';
  END IF;
  IF p_valoracion IS NOT NULL THEN
    DELETE FROM med.reflexion WHERE cierre_id = p_cierre AND integrante_id = v_yo AND categoria_id = p_categoria
       AND valoracion IS NOT NULL;
  END IF;
  INSERT INTO med.reflexion(hogar_id, cierre_id, integrante_id, categoria_id, valoracion, pregunta, respuesta)
  VALUES (v_hogar, p_cierre, v_yo, p_categoria, p_valoracion, p_pregunta, nullif(btrim(p_respuesta), ''));
END $$;

CREATE FUNCTION app.pronostico_mes(p_mes date) RETURNS bigint
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, app, plan AS $$
DECLARE v_periodo uuid;
BEGIN
  SELECT id INTO v_periodo FROM plan.periodo WHERE hogar_id = app.hogar_actual() AND mes = date_trunc('month', p_mes)::date;
  IF v_periodo IS NULL THEN RETURN NULL; END IF;
  RETURN app.balance_proyectado(v_periodo, (now() AT TIME ZONE 'America/Santiago')::date);
END $$;

GRANT SELECT, INSERT ON med.reflexion, med.cierre, med.medicion_kpi TO compas_app;

REVOKE EXECUTE ON FUNCTION app.cerrar_semana(date, jsonb), app.iniciar_cierre_mes(uuid),
  app.cerrar_mes(uuid, jsonb, text, text), app.reabrir_periodo(uuid, text),
  app.valorar(uuid, uuid, med.valoracion, text, text), app.pronostico_mes(date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.cerrar_semana(date, jsonb), app.iniciar_cierre_mes(uuid),
  app.cerrar_mes(uuid, jsonb, text, text), app.reabrir_periodo(uuid, text),
  app.valorar(uuid, uuid, med.valoracion, text, text), app.pronostico_mes(date) TO compas_app;

COMMIT;
