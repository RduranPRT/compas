-- =====================================================================
-- Compás — migración 0010: ciclo de la tarjeta, saldo de cuentas y conciliación (specs 008 y 010)
-- Fecha: 25-10-2026
-- * fin.v_saldo_cuenta: saldo registrado = saldo inicial + movimientos no descartados + transferencias hechas.
--   Una tarjeta tiene saldo negativo cuando se le debe.
-- * fin.v_tarjeta: deuda, apartado (sobres de pago de tarjeta, R44) y días del ciclo.
-- * app.registrar_pago_tarjeta: transferencia hecha; la base consume la reserva (R27).
-- * app.conciliar_cuenta: saldo real contra registrado; la diferencia exige motivo (R34).
-- =====================================================================
BEGIN;

CREATE FUNCTION fin.saldo_cuenta(p_cuenta uuid, p_hasta date) RETURNS bigint
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, fin AS $$
  SELECT c.saldo_inicial
       + coalesce((SELECT sum(CASE WHEN m.tipo IN ('ingreso','reembolso') THEN m.monto_clp
                                   WHEN m.tipo = 'transferencia' AND m.sentido = 'abono' THEN m.monto_clp
                                   ELSE -m.monto_clp END)
                     FROM fin.movimiento m
                    WHERE m.cuenta_id = c.id AND m.estado <> 'descartado' AND m.tipo <> 'ajuste'
                      AND m.fecha_contable >= c.fecha_saldo_inicial AND m.fecha_contable <= p_hasta), 0)
       + coalesce((SELECT sum(CASE WHEN t.cuenta_destino_id = c.id THEN t.monto_clp ELSE -t.monto_clp END)
                     FROM fin.transferencia t
                    WHERE (t.cuenta_origen_id = c.id OR t.cuenta_destino_id = c.id) AND t.estado = 'hecha'
                      AND t.fecha >= c.fecha_saldo_inicial AND t.fecha <= p_hasta), 0)
    FROM fin.cuenta c WHERE c.id = p_cuenta
$$;

CREATE VIEW fin.v_saldo_cuenta WITH (security_invoker = true) AS
SELECT c.id AS cuenta_id, c.hogar_id, c.nombre, c.tipo, c.institucion, c.ultimos4, c.activa, c.saldo_inicial,
       c.fecha_saldo_inicial, fin.saldo_cuenta(c.id, 'infinity'::date) AS saldo,
       (SELECT max(k.fecha_corte) FROM fin.conciliacion k WHERE k.cuenta_id = c.id) AS conciliada_hasta
  FROM fin.cuenta c;

CREATE VIEW fin.v_tarjeta WITH (security_invoker = true) AS
SELECT c.id AS cuenta_id, c.hogar_id, c.nombre, c.ultimos4, c.dia_facturacion, c.dia_pago, c.cupo, c.activa,
       -fin.saldo_cuenta(c.id, 'infinity'::date) AS deuda,
       coalesce((SELECT sum(v.saldo) FROM plan.sobre s JOIN plan.v_saldo_sobre v ON v.sobre_id = s.id
                  WHERE s.cuenta_id = c.id AND s.tipo = 'pago_tarjeta'), 0) AS apartado
  FROM fin.cuenta c WHERE c.tipo = 'tarjeta_credito';
GRANT SELECT ON fin.v_saldo_cuenta, fin.v_tarjeta TO compas_app, compas_ia, compas_sistema;
REVOKE EXECUTE ON FUNCTION fin.saldo_cuenta(uuid, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION fin.saldo_cuenta(uuid, date) TO compas_app, compas_ia, compas_sistema;

-- HU-008-2: pago de la tarjeta, no es gasto (R27); consume lo apartado (R44)
CREATE FUNCTION app.registrar_pago_tarjeta(p_cliente_op uuid, p_origen uuid, p_tarjeta uuid, p_monto bigint, p_fecha date)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, app, fin AS $$
DECLARE v_hogar uuid; v_id uuid; o fin.cuenta; t fin.cuenta; v_fecha date;
BEGIN
  PERFORM app.exigir_integrante();
  v_hogar := app.hogar_actual();
  IF p_cliente_op IS NOT NULL THEN
    SELECT id INTO v_id FROM fin.transferencia WHERE hogar_id = v_hogar AND cliente_op_id = p_cliente_op;
    IF v_id IS NOT NULL THEN RETURN v_id; END IF;
  END IF;
  o := app.cuenta_del_hogar(p_origen);
  t := app.cuenta_del_hogar(p_tarjeta);
  IF t.tipo <> 'tarjeta_credito' THEN
    RAISE EXCEPTION 'El destino del pago debe ser una tarjeta de crédito' USING ERRCODE = 'check_violation';
  END IF;
  IF o.tipo = 'tarjeta_credito' THEN
    RAISE EXCEPTION 'Paga la tarjeta desde una cuenta corriente, vista, de ahorro o efectivo' USING ERRCODE = 'check_violation';
  END IF;
  IF coalesce(p_monto, 0) <= 0 THEN
    RAISE EXCEPTION 'El monto debe ser mayor que cero' USING ERRCODE = 'check_violation';
  END IF;
  v_fecha := coalesce(p_fecha, (now() AT TIME ZONE 'America/Santiago')::date);
  PERFORM app.periodo_de(v_hogar, v_fecha);
  INSERT INTO fin.transferencia(hogar_id, cuenta_origen_id, cuenta_destino_id, tipo, monto_clp, fecha, estado,
                                hecha_por, hecha_en, cliente_op_id)
  VALUES (v_hogar, p_origen, p_tarjeta, 'pago_tarjeta', p_monto, v_fecha, 'hecha', app.integrante_actual(), now(), p_cliente_op)
  RETURNING id INTO v_id;
  PERFORM app.emitir_evento(v_hogar, 'PagoTarjetaRegistrado', app.integrante_actual(),
    jsonb_build_object('tarjeta_id', p_tarjeta, 'monto', p_monto,
                       'apartado', (SELECT apartado FROM fin.v_tarjeta WHERE cuenta_id = p_tarjeta)));
  RETURN v_id;
END $$;

-- R34: conciliación de una cuenta a una fecha de corte (semanal o mensual)
CREATE FUNCTION app.conciliar_cuenta(p_cuenta uuid, p_tipo text, p_fecha_corte date, p_saldo_real bigint,
                                     p_motivo text DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, app, fin AS $$
DECLARE v_hogar uuid; c fin.cuenta; v_reg bigint; v_dif bigint;
BEGIN
  PERFORM app.exigir_admin();
  v_hogar := app.hogar_actual();
  c := app.cuenta_del_hogar(p_cuenta);
  v_reg := fin.saldo_cuenta(c.id, p_fecha_corte);
  v_dif := p_saldo_real - v_reg;
  IF v_dif <> 0 AND btrim(coalesce(p_motivo, '')) = '' THEN
    RAISE EXCEPTION 'En % hay una diferencia de %; escribe el motivo para registrarla (R34)', c.nombre, app.pesos(v_dif)
      USING ERRCODE = 'check_violation';
  END IF;
  INSERT INTO fin.conciliacion(hogar_id, cuenta_id, periodo_id, tipo, fecha_corte, saldo_real, saldo_registrado, motivo,
                               realizada_por)
  VALUES (v_hogar, c.id, app.periodo_de(v_hogar, p_fecha_corte), p_tipo, p_fecha_corte, p_saldo_real, v_reg,
          nullif(btrim(p_motivo), ''), app.integrante_actual())
  ON CONFLICT (cuenta_id, tipo, fecha_corte) DO UPDATE
     SET saldo_real = EXCLUDED.saldo_real, saldo_registrado = EXCLUDED.saldo_registrado, motivo = EXCLUDED.motivo,
         realizada_por = EXCLUDED.realizada_por, realizada_en = now();
  RETURN jsonb_build_object('cuenta_id', c.id, 'saldo_registrado', v_reg, 'saldo_real', p_saldo_real, 'diferencia', v_dif);
END $$;

-- Montos para mensajes: $12.345 y −$8.000 (CLAUDE.md, R16)
CREATE FUNCTION app.pesos(p_monto bigint) RETURNS text
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN p_monto < 0 THEN '−' ELSE '' END || '$' ||
         replace(to_char(abs(p_monto), 'FM999G999G999G999G999'), ',', '.')
$$;

REVOKE EXECUTE ON FUNCTION app.registrar_pago_tarjeta(uuid, uuid, uuid, bigint, date),
  app.conciliar_cuenta(uuid, text, date, bigint, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.registrar_pago_tarjeta(uuid, uuid, uuid, bigint, date),
  app.conciliar_cuenta(uuid, text, date, bigint, text), app.pesos(bigint) TO compas_app;
GRANT EXECUTE ON FUNCTION app.pesos(bigint) TO compas_ia, compas_sistema;

COMMIT;
