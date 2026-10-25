-- =====================================================================
-- Compás — migración 0012: ingresos y distribución del día de pago (spec 007)
-- Fecha: 25-10-2026
-- * app.confirmar_distribucion: asignaciones reales desde Por asignar (R01 lo valida la base) y
--   transferencias pendientes: sin culpa a la cuenta personal, aportes a la cuenta de ahorro (D05).
--   La app no mueve dinero: las transferencias son tareas que el hogar marca como hechas.
-- * app.marcar_transferencia: hecha o anulada.
-- * plan.v_ingreso_por_repartir: lo que queda de cada ingreso por asignar.
-- =====================================================================
BEGIN;

-- p_asignaciones: [{sobre_id, monto}]
CREATE FUNCTION app.confirmar_distribucion(p_ingreso uuid, p_asignaciones jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, app, plan, fin AS $$
DECLARE
  v_hogar uuid; v_yo uuid; m fin.movimiento; v_ya bigint; v_total bigint; x record; s plan.sobre; v_asig uuid;
  v_transf uuid; v_ahorro uuid; v_n_t int := 0;
BEGIN
  PERFORM app.exigir_admin();
  v_hogar := app.hogar_actual(); v_yo := app.integrante_actual();
  SELECT * INTO m FROM fin.movimiento WHERE id = p_ingreso AND hogar_id = v_hogar AND tipo = 'ingreso'
                                         AND estado IN ('confirmado','conciliado');
  IF m.id IS NULL THEN
    RAISE EXCEPTION 'El ingreso debe estar confirmado para repartirlo' USING ERRCODE = 'check_violation';
  END IF;
  SELECT coalesce(sum(monto_clp), 0) INTO v_ya FROM plan.asignacion WHERE ingreso_id = m.id;
  SELECT coalesce(sum((a ->> 'monto')::bigint), 0) INTO v_total
    FROM jsonb_array_elements(p_asignaciones) a WHERE (a ->> 'monto')::bigint > 0;
  IF v_total > m.monto_clp - v_ya THEN   -- R01 por ingreso; la base además valida Por asignar
    RAISE EXCEPTION 'Estás repartiendo % y de este ingreso quedan % (R01)', app.pesos(v_total), app.pesos(m.monto_clp - v_ya)
      USING ERRCODE = 'check_violation';
  END IF;
  SELECT id INTO v_ahorro FROM fin.cuenta WHERE hogar_id = v_hogar AND activa AND tipo IN ('ahorro','inversion')
   ORDER BY (tipo = 'ahorro') DESC, creado_en LIMIT 1;

  FOR x IN SELECT (a ->> 'sobre_id')::uuid AS sobre_id, (a ->> 'monto')::bigint AS monto
             FROM jsonb_array_elements(p_asignaciones) a WHERE (a ->> 'monto')::bigint > 0 LOOP
    SELECT * INTO s FROM plan.sobre WHERE id = x.sobre_id AND periodo_id = m.periodo_id;
    IF s.id IS NULL OR s.tipo IN ('por_asignar','proximo_mes') THEN
      RAISE EXCEPTION 'Cada asignación va a un sobre del mes del ingreso' USING ERRCODE = 'foreign_key_violation';
    END IF;
    v_transf := NULL;
    IF s.tipo = 'sin_culpa' THEN   -- D05: el sin culpa se transfiere a la cuenta personal
      INSERT INTO fin.transferencia(hogar_id, cuenta_origen_id, tipo, monto_clp, fecha, estado, vence_en, sobre_id)
      VALUES (v_hogar, m.cuenta_id, 'a_personal', x.monto, (now() AT TIME ZONE 'America/Santiago')::date, 'pendiente',
              now() + interval '72 hours', s.id)
      RETURNING id INTO v_transf;
    ELSIF s.tipo IN ('futuro','emergencia','fondo') AND v_ahorro IS NOT NULL AND v_ahorro <> m.cuenta_id THEN
      INSERT INTO fin.transferencia(hogar_id, cuenta_origen_id, cuenta_destino_id, tipo, monto_clp, fecha, estado, vence_en, sobre_id)
      VALUES (v_hogar, m.cuenta_id, v_ahorro, 'aporte_fondo', x.monto, (now() AT TIME ZONE 'America/Santiago')::date,
              'pendiente', now() + interval '72 hours', s.id)
      RETURNING id INTO v_transf;
    END IF;
    IF v_transf IS NOT NULL THEN v_n_t := v_n_t + 1; END IF;
    INSERT INTO plan.asignacion(hogar_id, ingreso_id, sobre_id, monto_clp, orden_flujo, propuesta_por, confirmada_por,
                                transferencia_id)
    VALUES (v_hogar, m.id, s.id, x.monto, s.orden_flujo, 'sistema', v_yo, v_transf)
    RETURNING id INTO v_asig;
  END LOOP;

  PERFORM app.emitir_evento(v_hogar, 'IngresoAsignado', v_yo,
    jsonb_build_object('ingreso_id', m.id, 'asignado', v_total, 'pendiente', m.monto_clp - v_ya - v_total));
  IF v_n_t > 0 THEN
    PERFORM app.emitir_evento(v_hogar, 'TransferenciaPendiente', v_yo,
      jsonb_build_object('ingreso_id', m.id, 'transferencias', v_n_t));
  END IF;
  RETURN jsonb_build_object('asignado', v_total, 'pendiente', m.monto_clp - v_ya - v_total, 'transferencias', v_n_t);
END $$;

CREATE FUNCTION app.marcar_transferencia(p_transferencia uuid, p_hecha boolean) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, app, fin AS $$
BEGIN
  PERFORM app.exigir_integrante();
  UPDATE fin.transferencia SET estado = CASE WHEN p_hecha THEN 'hecha'::fin.estado_transferencia ELSE 'anulada' END,
         hecha_por = app.integrante_actual(), hecha_en = now()
   WHERE id = p_transferencia AND hogar_id = app.hogar_actual() AND estado = 'pendiente' AND tipo <> 'pago_tarjeta';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Esa transferencia ya no está pendiente' USING ERRCODE = 'check_violation';
  END IF;
END $$;

CREATE VIEW plan.v_ingreso_por_repartir WITH (security_invoker = true) AS
SELECT m.id AS ingreso_id, m.hogar_id, m.periodo_id, p.mes, m.cuenta_id, m.fecha_contable, m.monto_clp, m.comercio,
       i.integrante_id, i.tipo_ingreso, i.es_variable, i.diferencia_pct,
       m.monto_clp - coalesce((SELECT sum(a.monto_clp) FROM plan.asignacion a WHERE a.ingreso_id = m.id), 0) AS por_repartir
  FROM fin.movimiento m
  JOIN fin.ingreso i ON i.movimiento_id = m.id
  JOIN plan.periodo p ON p.id = m.periodo_id
 WHERE m.tipo = 'ingreso' AND m.estado IN ('confirmado','conciliado');

CREATE VIEW fin.v_transferencia_pendiente WITH (security_invoker = true) AS
SELECT t.id, t.hogar_id, t.tipo, t.monto_clp, t.fecha, t.vence_en, o.nombre AS cuenta_origen, d.nombre AS cuenta_destino,
       s.nombre AS sobre, s.integrante_id
  FROM fin.transferencia t
  JOIN fin.cuenta o ON o.id = t.cuenta_origen_id
  LEFT JOIN fin.cuenta d ON d.id = t.cuenta_destino_id
  LEFT JOIN plan.v_sobre s ON s.id = t.sobre_id
 WHERE t.estado = 'pendiente';
GRANT SELECT ON plan.v_ingreso_por_repartir, fin.v_transferencia_pendiente TO compas_app, compas_ia;

REVOKE EXECUTE ON FUNCTION app.confirmar_distribucion(uuid, jsonb), app.marcar_transferencia(uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.confirmar_distribucion(uuid, jsonb), app.marcar_transferencia(uuid, boolean) TO compas_app;

COMMIT;
