-- =====================================================================
-- Compás — migración 0007: captura y clasificación de movimientos (spec 005)
-- Fecha: 25-10-2026
-- RPC transaccionales e idempotentes por cliente_op_id (D11):
--   registrar_gasto (cuotas D08/D32 y R26, duplicados R35, sobre cerrado R11),
--   registrar_ingreso (R33, R45), registrar_reembolso (R29),
--   confirmar_movimiento, descartar_movimiento, resolver_duplicado (bandeja del CAD).
-- El libro lo siguen escribiendo los triggers (I2); la RPC solo cambia estados.
-- Los avisos (SobreNegativo) se emiten como eventos; la spec 009 los convierte en alertas.
-- =====================================================================
BEGIN;

-- ---------------------------------------------------------------------
-- Reversos con el mismo tipo de asiento y signo contrario (I2): así "gastado" de un sobre
-- vuelve a cero al descartar un gasto, en vez de quedar compensado por un "ajuste".
CREATE OR REPLACE FUNCTION plan.contabilizar() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, plan, fin AS $$
DECLARE v_por_asignar uuid; v_tipo_cuenta fin.tipo_cuenta; v_periodo uuid; v_total bigint;
BEGIN
  IF TG_TABLE_NAME = 'asignacion' THEN
    SELECT s.id INTO v_por_asignar FROM plan.sobre s
      JOIN plan.sobre d ON d.id = NEW.sobre_id
     WHERE s.periodo_id = d.periodo_id AND s.tipo = 'por_asignar';
    INSERT INTO plan.libro_sobre(hogar_id, sobre_id, tipo, monto_clp, origen_tabla, origen_id, fecha_valor)
    VALUES (NEW.hogar_id, v_por_asignar, 'asignacion', -NEW.monto_clp, 'plan.asignacion', NEW.id, current_date),
           (NEW.hogar_id, NEW.sobre_id,  'asignacion',  NEW.monto_clp, 'plan.asignacion', NEW.id, current_date);
  ELSIF TG_TABLE_NAME = 'reasignacion' THEN
    IF NEW.aplicada_en IS NOT NULL AND (TG_OP = 'INSERT' OR OLD.aplicada_en IS NULL) THEN
      INSERT INTO plan.libro_sobre(hogar_id, sobre_id, tipo, monto_clp, origen_tabla, origen_id, fecha_valor)
      VALUES (NEW.hogar_id, NEW.sobre_origen_id,  'reasignacion', -NEW.monto_clp, 'plan.reasignacion', NEW.id, current_date),
             (NEW.hogar_id, NEW.sobre_destino_id, 'reasignacion',  NEW.monto_clp, 'plan.reasignacion', NEW.id, current_date);
    END IF;
  ELSIF TG_TABLE_NAME = 'movimiento' THEN
    IF NEW.estado = 'confirmado' AND OLD.estado IS DISTINCT FROM 'confirmado' AND OLD.estado <> 'conciliado' THEN
      IF NEW.tipo = 'ingreso' THEN
        SELECT id INTO v_por_asignar FROM plan.sobre WHERE periodo_id = NEW.periodo_id AND tipo = 'por_asignar';
        INSERT INTO plan.libro_sobre(hogar_id, sobre_id, tipo, monto_clp, origen_tabla, origen_id, fecha_valor)
        VALUES (NEW.hogar_id, v_por_asignar, 'ingreso', NEW.monto_clp, 'fin.movimiento', NEW.id, NEW.fecha_contable);
      ELSIF NEW.tipo IN ('gasto','reembolso','ajuste') THEN
        INSERT INTO plan.libro_sobre(hogar_id, sobre_id, tipo, monto_clp, origen_tabla, origen_id, fecha_valor)
        SELECT NEW.hogar_id, i.sobre_id,
               CASE NEW.tipo WHEN 'reembolso' THEN 'reembolso'::plan.tipo_libro
                             WHEN 'ajuste' THEN 'ajuste'::plan.tipo_libro
                             ELSE 'imputacion'::plan.tipo_libro END,
               CASE NEW.tipo WHEN 'reembolso' THEN i.monto_clp ELSE -i.monto_clp END,
               'fin.movimiento', NEW.id, NEW.fecha_contable
          FROM fin.imputacion i WHERE i.movimiento_id = NEW.id;
        SELECT tipo INTO v_tipo_cuenta FROM fin.cuenta WHERE id = NEW.cuenta_id;
        IF v_tipo_cuenta = 'tarjeta_credito' AND NEW.tipo IN ('gasto','reembolso') THEN   -- R44
          FOR v_periodo, v_total IN
            SELECT s.periodo_id, sum(i.monto_clp)
              FROM fin.imputacion i JOIN plan.sobre s ON s.id = i.sobre_id
             WHERE i.movimiento_id = NEW.id
             GROUP BY s.periodo_id
          LOOP
            INSERT INTO plan.libro_sobre(hogar_id, sobre_id, tipo, monto_clp, origen_tabla, origen_id, fecha_valor)
            VALUES (NEW.hogar_id, plan.sobre_pago_tarjeta(NEW.hogar_id, v_periodo, NEW.cuenta_id), 'reserva_tarjeta',
                    CASE NEW.tipo WHEN 'reembolso' THEN -v_total ELSE v_total END,
                    'fin.movimiento', NEW.id, NEW.fecha_contable);
          END LOOP;
        END IF;
      END IF;
    ELSIF NEW.estado = 'descartado' AND OLD.estado IN ('confirmado','conciliado') THEN
      INSERT INTO plan.libro_sobre(hogar_id, sobre_id, tipo, monto_clp, origen_tabla, origen_id, fecha_valor)
      SELECT hogar_id, sobre_id, tipo, -monto_clp, origen_tabla, origen_id, current_date
        FROM plan.libro_sobre WHERE origen_tabla = 'fin.movimiento' AND origen_id = NEW.id;
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION fin.contabilizar_pago_tarjeta() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, plan, fin AS $$
DECLARE v_periodo uuid; v_sobre uuid; v_tipo_destino fin.tipo_cuenta;
BEGIN
  IF NEW.tipo <> 'pago_tarjeta' THEN RETURN NEW; END IF;
  SELECT tipo INTO v_tipo_destino FROM fin.cuenta WHERE id = NEW.cuenta_destino_id;
  IF v_tipo_destino IS DISTINCT FROM 'tarjeta_credito' THEN
    RAISE EXCEPTION 'R27: el destino de un pago de tarjeta debe ser una cuenta tarjeta_credito'
      USING ERRCODE = 'check_violation';
  END IF;
  IF NEW.estado = 'hecha' AND (TG_OP = 'INSERT' OR OLD.estado IS DISTINCT FROM 'hecha') THEN
    SELECT id INTO v_periodo FROM plan.periodo
     WHERE hogar_id = NEW.hogar_id AND mes = date_trunc('month', NEW.fecha)::date;
    IF v_periodo IS NULL THEN
      RAISE EXCEPTION 'No existe el período % para registrar el pago', date_trunc('month', NEW.fecha)::date
        USING ERRCODE = 'foreign_key_violation';
    END IF;
    v_sobre := plan.sobre_pago_tarjeta(NEW.hogar_id, v_periodo, NEW.cuenta_destino_id);
    INSERT INTO plan.libro_sobre(hogar_id, sobre_id, tipo, monto_clp, origen_tabla, origen_id, fecha_valor)
    VALUES (NEW.hogar_id, v_sobre, 'pago_tarjeta', -NEW.monto_clp, 'fin.transferencia', NEW.id, NEW.fecha);
  ELSIF TG_OP = 'UPDATE' AND OLD.estado = 'hecha' AND NEW.estado = 'anulada' THEN
    INSERT INTO plan.libro_sobre(hogar_id, sobre_id, tipo, monto_clp, origen_tabla, origen_id, fecha_valor)
    SELECT hogar_id, sobre_id, tipo, -monto_clp, origen_tabla, origen_id, current_date
      FROM plan.libro_sobre WHERE origen_tabla = 'fin.transferencia' AND origen_id = NEW.id;
  END IF;
  RETURN NEW;
END $$;

-- Gastado neto: compras menos devoluciones, pagos de tarjeta y ajustes (con sus reversos)
CREATE OR REPLACE VIEW plan.v_saldo_sobre WITH (security_invoker = true) AS
SELECT s.id AS sobre_id, s.hogar_id, s.periodo_id, s.tipo, s.categoria_id, s.integrante_id,
       coalesce(sum(l.monto_clp) FILTER (WHERE l.tipo IN ('asignacion','reasignacion','arrastre','ingreso','reserva_tarjeta')), 0) AS disponible,
       coalesce(-sum(l.monto_clp) FILTER (WHERE l.tipo IN ('imputacion','reembolso','pago_tarjeta','ajuste')), 0)            AS gastado,
       coalesce(sum(l.monto_clp), 0)                                                                                          AS saldo
  FROM plan.sobre s LEFT JOIN plan.libro_sobre l ON l.sobre_id = s.id
 GROUP BY s.id;

-- ---------------------------------------------------------------------
-- Ayudas internas
CREATE FUNCTION app.exigir_integrante() RETURNS gob.rol_integrante
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, app AS $$
DECLARE v_rol gob.rol_integrante := app.rol_actual();
BEGIN
  IF v_rol IS NULL THEN
    RAISE EXCEPTION 'Necesitas iniciar sesión en tu hogar' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF v_rol NOT IN ('ORG','CAD','ING') THEN
    RAISE EXCEPTION 'Tu rol no permite registrar movimientos' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN v_rol;
END $$;

CREATE FUNCTION app.parametro_num(p_hogar uuid, p_codigo text, p_defecto numeric) RETURNS numeric
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, app AS $$
  SELECT coalesce((app.parametro(p_hogar, p_codigo) #>> '{}')::numeric, p_defecto)
$$;

CREATE FUNCTION app.mes_primer_plan(p_hogar uuid) RETURNS date
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, app AS $$
  SELECT coalesce((app.parametro(p_hogar, 'mes_primer_plan') #>> '{}')::date, '2026-12-01'::date)
$$;

-- Sobre equivalente en otro período: misma categoría, integrante, fondo o tarjeta (lo crea si falta)
CREATE FUNCTION app.sobre_en_periodo(p_sobre uuid, p_periodo uuid) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, app, plan AS $$
DECLARE s plan.sobre; v_id uuid;
BEGIN
  SELECT * INTO s FROM plan.sobre WHERE id = p_sobre;
  IF s.periodo_id = p_periodo THEN RETURN s.id; END IF;
  PERFORM app.crear_sobres_periodo_interno(p_periodo);
  SELECT id INTO v_id FROM plan.sobre
   WHERE periodo_id = p_periodo AND tipo = s.tipo
     AND categoria_id IS NOT DISTINCT FROM s.categoria_id AND integrante_id IS NOT DISTINCT FROM s.integrante_id
     AND fondo_id IS NOT DISTINCT FROM s.fondo_id AND deuda_id IS NOT DISTINCT FROM s.deuda_id
     AND cuenta_id IS NOT DISTINCT FROM s.cuenta_id;
  IF v_id IS NULL THEN   -- categoría desactivada después: el sobre se crea igual para no perder el gasto
    INSERT INTO plan.sobre(hogar_id, periodo_id, categoria_id, tipo, fondo_id, deuda_id, integrante_id, cuenta_id, es_cuatro_paredes)
    VALUES (s.hogar_id, p_periodo, s.categoria_id, s.tipo, s.fondo_id, s.deuda_id, s.integrante_id, s.cuenta_id, s.es_cuatro_paredes)
    RETURNING id INTO v_id;
  END IF;
  RETURN v_id;
END $$;

-- Rehace las imputaciones de un movimiento no confirmado; reparte cuotas por mes (R26, D08, D32)
CREATE FUNCTION app.imputar(p_mov uuid, p_sobre uuid, p_actor sys.tipo_actor) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, app, plan, fin AS $$
DECLARE
  m fin.movimiento; v_tipo plan.tipo_sobre; v_n int; v_cuota bigint; v_k int; v_periodo uuid; v_sobre uuid;
  v_monto bigint; v_deuda uuid; v_mes date; v_cuenta text;
BEGIN
  SELECT * INTO m FROM fin.movimiento WHERE id = p_mov;
  IF m.estado IN ('confirmado','conciliado') THEN
    RAISE EXCEPTION 'Un movimiento confirmado no se reimputa; descártalo y regístralo de nuevo'
      USING ERRCODE = 'check_violation';
  END IF;
  SELECT tipo INTO v_tipo FROM plan.sobre WHERE id = p_sobre AND hogar_id = m.hogar_id;
  IF v_tipo IS NULL THEN
    RAISE EXCEPTION 'Ese sobre no es de tu hogar' USING ERRCODE = 'foreign_key_violation';
  END IF;
  IF v_tipo IN ('por_asignar','proximo_mes','pago_tarjeta','cuota') THEN
    RAISE EXCEPTION 'Un gasto no se imputa al sobre %; elige el sobre de la categoría', v_tipo
      USING ERRCODE = 'check_violation';
  END IF;
  DELETE FROM fin.imputacion WHERE movimiento_id = p_mov;
  DELETE FROM fin.cuota_deuda WHERE deuda_id IN (SELECT id FROM fin.deuda WHERE movimiento_origen_id = p_mov);
  DELETE FROM fin.deuda WHERE movimiento_origen_id = p_mov;

  v_n := CASE WHEN coalesce(m.n_cuotas, 1) > 1 AND m.tratamiento_cuotas = 'por_cuota' THEN m.n_cuotas ELSE 1 END;
  IF v_n = 1 THEN
    INSERT INTO fin.imputacion(hogar_id, movimiento_id, sobre_id, monto_clp, creada_por_tipo)
    VALUES (m.hogar_id, m.id, app.sobre_en_periodo(p_sobre, m.periodo_id), m.monto_clp, p_actor);
    RETURN;
  END IF;

  -- Cada cuota en su mes: la 1 en el mes de compra, la k en el mes k − 1 siguiente (D32)
  v_cuota := m.monto_clp / v_n;
  SELECT nombre INTO v_cuenta FROM fin.cuenta WHERE id = m.cuenta_id;
  INSERT INTO fin.deuda(hogar_id, tipo, acreedor, cuenta_id, movimiento_origen_id, monto_original, saldo_actual,
                        cuota_monto, n_cuotas, es_consumo)
  VALUES (m.hogar_id, 'compra_cuotas', coalesce(m.comercio, v_cuenta), m.cuenta_id, m.id, m.monto_clp, m.monto_clp,
          v_cuota, v_n, true)
  RETURNING id INTO v_deuda;
  FOR v_k IN 1..v_n LOOP
    v_mes := (date_trunc('month', m.fecha_contable) + make_interval(months => v_k - 1))::date;
    v_periodo := app.periodo_de(m.hogar_id, v_mes);
    v_sobre := app.sobre_en_periodo(p_sobre, v_periodo);
    v_monto := CASE WHEN v_k = v_n THEN m.monto_clp - v_cuota * (v_n - 1) ELSE v_cuota END;
    INSERT INTO fin.imputacion(hogar_id, movimiento_id, sobre_id, monto_clp, creada_por_tipo)
    VALUES (m.hogar_id, m.id, v_sobre, v_monto, p_actor);
    INSERT INTO fin.cuota_deuda(deuda_id, numero, mes_facturacion, monto_clp, sobre_id)
    VALUES (v_deuda, v_k, v_mes, v_monto, v_sobre);
  END LOOP;
END $$;

-- Pasa a confirmado (los triggers contabilizan y validan la cuadratura) y avisa si el sobre quedó negativo
CREATE FUNCTION app.confirmar_interno(p_mov uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, app, plan, fin AS $$
DECLARE m fin.movimiento; r record; v_desde date;
BEGIN
  UPDATE fin.movimiento SET estado = 'confirmado', confirmado_en = now(), confirmado_por = app.integrante_actual()
   WHERE id = p_mov AND estado IN ('capturado','por_confirmar')
  RETURNING * INTO m;
  IF m.id IS NULL OR m.tipo NOT IN ('gasto','ajuste') THEN RETURN; END IF;
  v_desde := app.mes_primer_plan(m.hogar_id);
  -- Línea base (antes del primer plan): se muestra lo gastado, sin avisos (spec 005)
  FOR r IN SELECT s.id, s.periodo_id, s.cerrado, v.saldo, p.mes
             FROM fin.imputacion i JOIN plan.sobre s ON s.id = i.sobre_id
             JOIN plan.periodo p ON p.id = s.periodo_id
             JOIN plan.v_saldo_sobre v ON v.sobre_id = s.id
            WHERE i.movimiento_id = m.id AND p.mes >= v_desde LOOP
    IF r.cerrado THEN   -- R11: se imputa igual y abre N1
      INSERT INTO med.evento_recuperacion(hogar_id, periodo_id, nivel, regla_codigo, sobre_id, responsable_id,
                                          criterio_salida, vence_el)
      SELECT m.hogar_id, r.periodo_id, 'N1', 'R11', r.id, i.id, '{"saldo_min":0}', current_date + 3
        FROM gob.integrante i WHERE i.hogar_id = m.hogar_id AND i.activo AND i.rol IN ('CAD','ORG')
       ORDER BY i.rol LIMIT 1;
    END IF;
    IF r.saldo < 0 THEN
      PERFORM app.emitir_evento(m.hogar_id, 'SobreNegativo', app.integrante_actual(),
                                jsonb_build_object('sobre_id', r.id, 'saldo', r.saldo, 'movimiento_id', m.id));
    END IF;
  END LOOP;
END $$;

-- Candidatos a duplicado: mismo medio, mismo monto, fecha ±2 días (R35, D12)
CREATE FUNCTION app.marcar_duplicados(p_mov uuid) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, app, fin AS $$
DECLARE m fin.movimiento; v_n integer;
BEGIN
  SELECT * INTO m FROM fin.movimiento WHERE id = p_mov;
  INSERT INTO fin.duplicado_candidato(hogar_id, movimiento_a_id, movimiento_b_id)
  SELECT m.hogar_id, least(m.id, o.id), greatest(m.id, o.id)
    FROM fin.movimiento o
   WHERE o.hogar_id = m.hogar_id AND o.id <> m.id AND o.cuenta_id = m.cuenta_id AND o.tipo = m.tipo
     AND o.monto_clp = m.monto_clp AND abs(o.fecha_contable - m.fecha_contable) <= 2 AND o.estado <> 'descartado'
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n > 0 THEN
    PERFORM app.emitir_evento(m.hogar_id, 'DuplicadoCandidato', app.integrante_actual(), jsonb_build_object('movimiento_id', m.id));
  END IF;
  RETURN v_n;
END $$;

CREATE FUNCTION app.cuenta_del_hogar(p_cuenta uuid) RETURNS fin.cuenta
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, app, fin AS $$
DECLARE c fin.cuenta;
BEGIN
  SELECT * INTO c FROM fin.cuenta WHERE id = p_cuenta AND hogar_id = app.hogar_actual();
  IF c.id IS NULL THEN
    RAISE EXCEPTION 'Esa cuenta no es de tu hogar' USING ERRCODE = 'foreign_key_violation';
  END IF;
  RETURN c;
END $$;

-- ---------------------------------------------------------------------
-- RPC de captura (HU-005-1, HU-005-5, HU-005-6)
CREATE FUNCTION app.registrar_gasto(
  p_cliente_op uuid, p_cuenta uuid, p_sobre uuid, p_monto bigint, p_fecha date,
  p_comercio text DEFAULT NULL, p_nota text DEFAULT NULL, p_intencion fin.intencion DEFAULT NULL,
  p_n_cuotas integer DEFAULT 1, p_tratamiento text DEFAULT NULL,
  p_origen fin.origen_movimiento DEFAULT 'manual', p_confianza numeric DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, app, plan, fin AS $$
DECLARE
  v_hogar uuid; v_yo uuid; v_id uuid; v_periodo uuid; v_intencion fin.intencion; v_dups int;
  v_por_confirmar boolean; v_estado fin.estado_movimiento; v_tratamiento text; c fin.cuenta;
BEGIN
  PERFORM app.exigir_integrante();
  v_hogar := app.hogar_actual(); v_yo := app.integrante_actual();
  IF p_cliente_op IS NOT NULL THEN   -- D11: la cola reenvía; se responde lo ya registrado
    SELECT id, estado INTO v_id, v_estado FROM fin.movimiento WHERE hogar_id = v_hogar AND cliente_op_id = p_cliente_op;
    IF v_id IS NOT NULL THEN
      RETURN jsonb_build_object('movimiento_id', v_id, 'estado', v_estado, 'repetida', true);
    END IF;
  END IF;
  IF coalesce(p_monto, 0) <= 0 THEN
    RAISE EXCEPTION 'El monto debe ser mayor que cero' USING ERRCODE = 'check_violation';
  END IF;
  IF p_origen IN ('cartola','sistema') THEN
    RAISE EXCEPTION 'Origen % no se registra por captura', p_origen USING ERRCODE = 'check_violation';
  END IF;
  c := app.cuenta_del_hogar(p_cuenta);
  IF coalesce(p_n_cuotas, 1) > 1 AND c.tipo <> 'tarjeta_credito' THEN
    RAISE EXCEPTION 'Las compras en cuotas se registran con tarjeta de crédito' USING ERRCODE = 'check_violation';
  END IF;
  v_tratamiento := CASE WHEN coalesce(p_n_cuotas, 1) > 1 THEN
    coalesce(p_tratamiento, app.parametro(v_hogar, 'tratamiento_cuotas_default') #>> '{}', 'por_cuota') END;

  v_periodo := app.periodo_de(v_hogar, coalesce(p_fecha, (now() AT TIME ZONE 'America/Santiago')::date));
  SELECT coalesce(p_intencion, c2.intencion_default) INTO v_intencion
    FROM plan.sobre s LEFT JOIN plan.categoria c2 ON c2.id = s.categoria_id WHERE s.id = p_sobre;

  INSERT INTO fin.movimiento(hogar_id, periodo_id, cuenta_id, tipo, estado, origen, fecha_contable, monto_clp,
                             comercio, nota, intencion, confianza_ia, cliente_op_id, registrado_por,
                             registrado_por_tipo, n_cuotas, tratamiento_cuotas)
  VALUES (v_hogar, v_periodo, p_cuenta, 'gasto', 'capturado', p_origen,
          coalesce(p_fecha, (now() AT TIME ZONE 'America/Santiago')::date), p_monto,
          nullif(btrim(p_comercio), ''), nullif(btrim(p_nota), ''), v_intencion, p_confianza, p_cliente_op, v_yo,
          'humano', CASE WHEN coalesce(p_n_cuotas, 1) > 1 THEN p_n_cuotas END, v_tratamiento)
  RETURNING id INTO v_id;
  PERFORM app.imputar(v_id, p_sobre, 'humano');

  v_dups := app.marcar_duplicados(v_id);
  -- R36: lo que propone la IA bajo el umbral queda por confirmar; la captura manual no tiene confianza
  v_por_confirmar := v_dups > 0
    OR (p_confianza IS NOT NULL AND p_confianza < app.parametro_num(v_hogar, 'confianza_ia_min', 0.8));
  IF v_por_confirmar THEN
    UPDATE fin.movimiento SET estado = 'por_confirmar' WHERE id = v_id;
    PERFORM app.emitir_evento(v_hogar, 'MovimientoPorConfirmar', v_yo,
                              jsonb_build_object('movimiento_id', v_id, 'confianza', p_confianza, 'duplicado', v_dups > 0));
  ELSE
    PERFORM app.confirmar_interno(v_id);
  END IF;
  PERFORM app.emitir_evento(v_hogar, 'GastoRegistrado', v_yo,
                            jsonb_build_object('movimiento_id', v_id, 'origen', p_origen));
  SELECT estado INTO v_estado FROM fin.movimiento WHERE id = v_id;
  RETURN jsonb_build_object('movimiento_id', v_id, 'estado', v_estado, 'duplicado', v_dups > 0, 'repetida', false);
END $$;

CREATE FUNCTION app.registrar_ingreso(
  p_cliente_op uuid, p_cuenta uuid, p_monto bigint, p_fecha date, p_integrante uuid,
  p_tipo_ingreso fin.tipo_ingreso DEFAULT 'sueldo', p_es_variable boolean DEFAULT false,
  p_para_mes_siguiente boolean DEFAULT false, p_descripcion text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, app, plan, fin AS $$
DECLARE
  v_hogar uuid; v_yo uuid; v_id uuid; v_periodo uuid; v_fecha date; v_esperado plan.ingreso_esperado;
  v_dif numeric; v_ajuste boolean := false; v_estado fin.estado_movimiento;
BEGIN
  PERFORM app.exigir_integrante();
  v_hogar := app.hogar_actual(); v_yo := app.integrante_actual();
  IF p_cliente_op IS NOT NULL THEN
    SELECT id, estado INTO v_id, v_estado FROM fin.movimiento WHERE hogar_id = v_hogar AND cliente_op_id = p_cliente_op;
    IF v_id IS NOT NULL THEN
      RETURN jsonb_build_object('movimiento_id', v_id, 'estado', v_estado, 'repetida', true);
    END IF;
  END IF;
  IF coalesce(p_monto, 0) <= 0 THEN
    RAISE EXCEPTION 'El monto debe ser mayor que cero' USING ERRCODE = 'check_violation';
  END IF;
  PERFORM app.cuenta_del_hogar(p_cuenta);
  IF NOT EXISTS (SELECT 1 FROM gob.integrante WHERE id = p_integrante AND hogar_id = v_hogar AND NOT es_menor) THEN
    RAISE EXCEPTION 'Elige un adulto del hogar como receptor del ingreso' USING ERRCODE = 'foreign_key_violation';
  END IF;
  v_fecha := coalesce(p_fecha, (now() AT TIME ZONE 'America/Santiago')::date);
  -- D01: desde el día 20 puede ir al mes siguiente
  v_periodo := app.periodo_de(v_hogar, CASE WHEN p_para_mes_siguiente
                                         THEN (date_trunc('month', v_fecha) + interval '1 month')::date ELSE v_fecha END);

  INSERT INTO fin.movimiento(hogar_id, periodo_id, cuenta_id, tipo, estado, origen, fecha_contable, monto_clp, comercio,
                             cliente_op_id, registrado_por)
  VALUES (v_hogar, v_periodo, p_cuenta, 'ingreso', 'capturado', 'manual', v_fecha, p_monto,
          nullif(btrim(p_descripcion), ''), p_cliente_op, v_yo)
  RETURNING id INTO v_id;

  IF NOT p_es_variable THEN   -- R33 compara solo el ingreso base (R45)
    SELECT * INTO v_esperado FROM plan.ingreso_esperado
     WHERE hogar_id = v_hogar AND integrante_id = p_integrante AND es_base
       AND vigente_desde <= v_fecha AND (vigente_hasta IS NULL OR vigente_hasta >= v_fecha)
     ORDER BY monto DESC LIMIT 1;
    IF v_esperado.id IS NOT NULL THEN
      v_dif := round(100.0 * (p_monto - v_esperado.monto) / v_esperado.monto, 2);
      v_ajuste := abs(v_dif) > app.parametro_num(v_hogar, 'umbral_ajuste_ingreso_pct', 5)
        AND EXISTS (SELECT 1 FROM plan.presupuesto_mensual WHERE periodo_id = v_periodo
                     AND estado IN ('aprobado','en_ejecucion'));
    END IF;
  END IF;
  INSERT INTO fin.ingreso(movimiento_id, integrante_id, tipo_ingreso, ingreso_esperado_id, diferencia_pct,
                          para_mes_siguiente, es_variable)
  VALUES (v_id, p_integrante, p_tipo_ingreso, v_esperado.id, v_dif, coalesce(p_para_mes_siguiente, false),
          coalesce(p_es_variable, false));

  PERFORM app.confirmar_interno(v_id);
  PERFORM app.emitir_evento(v_hogar, 'IngresoRecibido', v_yo,
    jsonb_build_object('movimiento_id', v_id, 'monto', p_monto, 'es_variable', p_es_variable, 'diferencia_pct', v_dif));
  RETURN jsonb_build_object('movimiento_id', v_id, 'estado', 'confirmado', 'diferencia_pct', v_dif,
                            'ajuste_sugerido', v_ajuste, 'repetida', false);
END $$;

-- R29: la devolución vuelve al sobre de la compra (y libera la reserva de la tarjeta, R44)
CREATE FUNCTION app.registrar_reembolso(p_cliente_op uuid, p_original uuid, p_monto bigint, p_fecha date)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, app, plan, fin AS $$
DECLARE
  v_hogar uuid; v_yo uuid; o fin.movimiento; v_id uuid; v_devuelto bigint; v_sobre uuid; v_fecha date;
BEGIN
  PERFORM app.exigir_integrante();
  v_hogar := app.hogar_actual(); v_yo := app.integrante_actual();
  IF p_cliente_op IS NOT NULL THEN
    SELECT id INTO v_id FROM fin.movimiento WHERE hogar_id = v_hogar AND cliente_op_id = p_cliente_op;
    IF v_id IS NOT NULL THEN RETURN jsonb_build_object('movimiento_id', v_id, 'repetida', true); END IF;
  END IF;
  SELECT * INTO o FROM fin.movimiento WHERE id = p_original AND hogar_id = v_hogar AND tipo = 'gasto'
                                         AND estado IN ('confirmado','conciliado');
  IF o.id IS NULL THEN
    RAISE EXCEPTION 'La compra original debe ser un gasto confirmado de tu hogar' USING ERRCODE = 'foreign_key_violation';
  END IF;
  SELECT coalesce(sum(monto_clp), 0) INTO v_devuelto FROM fin.movimiento
   WHERE movimiento_original_id = o.id AND tipo = 'reembolso' AND estado <> 'descartado';
  IF coalesce(p_monto, 0) <= 0 OR p_monto > o.monto_clp - v_devuelto THEN
    RAISE EXCEPTION 'La devolución puede ser de hasta %', o.monto_clp - v_devuelto USING ERRCODE = 'check_violation';
  END IF;
  SELECT sobre_id INTO v_sobre FROM fin.imputacion WHERE movimiento_id = o.id ORDER BY monto_clp DESC, creado_en LIMIT 1;
  v_fecha := coalesce(p_fecha, (now() AT TIME ZONE 'America/Santiago')::date);
  INSERT INTO fin.movimiento(hogar_id, periodo_id, cuenta_id, tipo, estado, origen, fecha_contable, monto_clp, comercio,
                             movimiento_original_id, cliente_op_id, registrado_por)
  VALUES (v_hogar, app.periodo_de(v_hogar, v_fecha), o.cuenta_id, 'reembolso', 'capturado', 'manual', v_fecha, p_monto,
          o.comercio, o.id, p_cliente_op, v_yo)
  RETURNING id INTO v_id;
  INSERT INTO fin.imputacion(hogar_id, movimiento_id, sobre_id, monto_clp) VALUES (v_hogar, v_id, v_sobre, p_monto);
  PERFORM app.confirmar_interno(v_id);
  RETURN jsonb_build_object('movimiento_id', v_id, 'estado', 'confirmado', 'repetida', false);
END $$;

-- ---------------------------------------------------------------------
-- Bandeja del CAD (HU-005-3): confirmar, corregir o descartar
CREATE FUNCTION app.confirmar_movimiento(p_mov uuid, p_sobre uuid DEFAULT NULL, p_intencion fin.intencion DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, app, fin AS $$
DECLARE m fin.movimiento;
BEGIN
  PERFORM app.exigir_admin();
  SELECT * INTO m FROM fin.movimiento WHERE id = p_mov AND hogar_id = app.hogar_actual() FOR UPDATE;
  IF m.id IS NULL THEN
    RAISE EXCEPTION 'No encontramos ese movimiento en tu hogar' USING ERRCODE = 'no_data_found';
  END IF;
  IF m.estado NOT IN ('capturado','por_confirmar') THEN
    RAISE EXCEPTION 'Ese movimiento ya está %', m.estado USING ERRCODE = 'check_violation';
  END IF;
  IF p_intencion IS NOT NULL THEN
    UPDATE fin.movimiento SET intencion = p_intencion WHERE id = p_mov;
  END IF;
  IF m.tipo = 'gasto' THEN
    IF p_sobre IS NOT NULL THEN
      PERFORM app.imputar(p_mov, p_sobre, 'humano');
    ELSIF NOT EXISTS (SELECT 1 FROM fin.imputacion WHERE movimiento_id = p_mov) THEN
      RAISE EXCEPTION 'Elige el sobre del gasto antes de confirmarlo' USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  UPDATE fin.duplicado_candidato SET estado = 'resuelto', es_duplicado = false, resuelto_por = app.integrante_actual(),
         resuelto_en = now()
   WHERE estado = 'abierto' AND (movimiento_a_id = p_mov OR movimiento_b_id = p_mov);
  PERFORM app.confirmar_interno(p_mov);
END $$;

CREATE FUNCTION app.descartar_movimiento(p_mov uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, app, fin AS $$
DECLARE m fin.movimiento;
BEGIN
  PERFORM app.exigir_admin();
  SELECT * INTO m FROM fin.movimiento WHERE id = p_mov AND hogar_id = app.hogar_actual() FOR UPDATE;
  IF m.id IS NULL THEN
    RAISE EXCEPTION 'No encontramos ese movimiento en tu hogar' USING ERRCODE = 'no_data_found';
  END IF;
  IF m.estado = 'descartado' THEN RETURN; END IF;
  IF m.tipo = 'ingreso' AND EXISTS (SELECT 1 FROM plan.asignacion WHERE ingreso_id = p_mov) THEN
    RAISE EXCEPTION 'Ese ingreso ya se repartió; no se puede descartar' USING ERRCODE = 'check_violation';
  END IF;
  -- el trigger del libro registra los asientos de signo contrario (I2)
  UPDATE fin.movimiento SET estado = 'descartado' WHERE id = p_mov;
  UPDATE fin.deuda SET estado = 'castigada', saldo_actual = 0 WHERE movimiento_origen_id = p_mov;
  UPDATE fin.duplicado_candidato SET estado = 'resuelto', es_duplicado = true, resuelto_por = app.integrante_actual(),
         resuelto_en = now()
   WHERE estado = 'abierto' AND (movimiento_a_id = p_mov OR movimiento_b_id = p_mov);
END $$;

-- Duplicado: se descarta el registrado después; si no lo es, el pendiente con sobre se confirma
CREATE FUNCTION app.resolver_duplicado(p_dup uuid, p_es_duplicado boolean) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, app, fin AS $$
DECLARE d fin.duplicado_candidato; v_tarde uuid; v_mov uuid;
BEGIN
  PERFORM app.exigir_admin();
  SELECT * INTO d FROM fin.duplicado_candidato WHERE id = p_dup AND hogar_id = app.hogar_actual() FOR UPDATE;
  IF d.id IS NULL THEN
    RAISE EXCEPTION 'No encontramos ese posible duplicado' USING ERRCODE = 'no_data_found';
  END IF;
  IF d.estado <> 'abierto' THEN RETURN; END IF;
  UPDATE fin.duplicado_candidato SET estado = 'resuelto', es_duplicado = p_es_duplicado,
         resuelto_por = app.integrante_actual(), resuelto_en = now() WHERE id = p_dup;
  IF p_es_duplicado THEN
    SELECT id INTO v_tarde FROM fin.movimiento WHERE id IN (d.movimiento_a_id, d.movimiento_b_id)
     ORDER BY creado_en DESC, id DESC LIMIT 1;
    PERFORM app.descartar_movimiento(v_tarde);
  ELSE
    FOR v_mov IN SELECT m.id FROM fin.movimiento m
                  WHERE m.id IN (d.movimiento_a_id, d.movimiento_b_id) AND m.estado = 'por_confirmar'
                    AND (m.tipo <> 'gasto' OR EXISTS (SELECT 1 FROM fin.imputacion i WHERE i.movimiento_id = m.id))
                    AND NOT EXISTS (SELECT 1 FROM fin.duplicado_candidato o WHERE o.estado = 'abierto'
                                     AND (o.movimiento_a_id = m.id OR o.movimiento_b_id = m.id))
                    AND (m.confianza_ia IS NULL OR m.confianza_ia >= app.parametro_num(m.hogar_id, 'confianza_ia_min', 0.8))
                    AND m.origen <> 'cartola' LOOP
      PERFORM app.confirmar_interno(v_mov);
    END LOOP;
  END IF;
END $$;

-- Movimientos con su sobre principal, para listas y bandeja
CREATE VIEW fin.v_movimiento WITH (security_invoker = true) AS
SELECT m.id, m.hogar_id, m.periodo_id, m.cuenta_id, cu.nombre AS cuenta, cu.tipo AS tipo_cuenta, m.tipo, m.estado,
       m.origen, m.fecha_contable, m.monto_clp, m.comercio, m.nota, m.intencion, m.confianza_ia, m.n_cuotas,
       m.tratamiento_cuotas, m.registrado_por, m.creado_en, m.movimiento_original_id, m.importacion_id,
       imp.sobre_id, s.nombre AS sobre, s.categoria_id, s.bloque_codigo
  FROM fin.movimiento m
  JOIN fin.cuenta cu ON cu.id = m.cuenta_id
  LEFT JOIN LATERAL (SELECT i.sobre_id FROM fin.imputacion i WHERE i.movimiento_id = m.id
                      ORDER BY i.creado_en, i.monto_clp DESC LIMIT 1) imp ON true
  LEFT JOIN plan.v_sobre s ON s.id = imp.sobre_id;
GRANT SELECT ON fin.v_movimiento TO compas_app, compas_ia, compas_sistema;

-- ---------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION app.exigir_integrante(), app.parametro_num(uuid, text, numeric), app.mes_primer_plan(uuid),
  app.sobre_en_periodo(uuid, uuid), app.imputar(uuid, uuid, sys.tipo_actor), app.confirmar_interno(uuid),
  app.marcar_duplicados(uuid), app.cuenta_del_hogar(uuid),
  app.registrar_gasto(uuid, uuid, uuid, bigint, date, text, text, fin.intencion, integer, text, fin.origen_movimiento, numeric),
  app.registrar_ingreso(uuid, uuid, bigint, date, uuid, fin.tipo_ingreso, boolean, boolean, text),
  app.registrar_reembolso(uuid, uuid, bigint, date), app.confirmar_movimiento(uuid, uuid, fin.intencion),
  app.descartar_movimiento(uuid), app.resolver_duplicado(uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION
  app.registrar_gasto(uuid, uuid, uuid, bigint, date, text, text, fin.intencion, integer, text, fin.origen_movimiento, numeric),
  app.registrar_ingreso(uuid, uuid, bigint, date, uuid, fin.tipo_ingreso, boolean, boolean, text),
  app.registrar_reembolso(uuid, uuid, bigint, date), app.confirmar_movimiento(uuid, uuid, fin.intencion),
  app.descartar_movimiento(uuid), app.resolver_duplicado(uuid, boolean) TO compas_app;
GRANT EXECUTE ON FUNCTION app.parametro_num(uuid, text, numeric), app.mes_primer_plan(uuid) TO compas_app, compas_ia, compas_sistema;

COMMIT;
