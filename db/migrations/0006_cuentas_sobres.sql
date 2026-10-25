-- =====================================================================
-- Compás — migración 0006: cuentas, categorías y sobres del período (spec 002)
-- Fecha: 25-10-2026
-- * Plantilla: + Vestuario y Comisiones e intereses (15 categorías; decisión de la Beta).
-- * app.aplicar_plantilla_categorias(): crea las categorías sugeridas del hogar.
-- * app.crear_sobres_periodo(p_periodo): sobres por categoría activa, sin culpa por adulto,
--   mesada por hijo, fondo por fondo activo y pago de tarjeta por tarjeta (D06, D17, R44). Idempotente.
-- * app.periodo_de(p_hogar, p_fecha): período del mes de la fecha, creado con sus sobres.
-- * app.asegurar_mes(p_mes): cualquier integrante abre el mes con sus sobres antes de leerlo o registrar;
--   así una categoría, tarjeta o fondo nuevo aparece en el mes en curso.
-- * La configuración del hogar (cuentas, categorías, fondos, ingresos esperados, pagos fijos) solo la
--   escriben administradores.
-- * plan.v_sobre: sobres con nombre, bloque y saldo para la app.
-- =====================================================================
BEGIN;

INSERT INTO ref.categoria_plantilla VALUES
 ('vestuario','Vestuario','VIDA','variable',false,'deseo'),
 ('comisiones','Comisiones e intereses','ESENCIALES','variable',false,'imprevisto')
ON CONFLICT (codigo) DO NOTHING;

-- Varios fondos pueden compartir categoría (p. ej. Gastos anuales): el fondo distingue al sobre
DROP INDEX plan.ux_sobre_categoria;
CREATE UNIQUE INDEX ux_sobre_categoria ON plan.sobre(periodo_id, categoria_id,
  coalesce(integrante_id, '00000000-0000-0000-0000-000000000000'::uuid),
  coalesce(deuda_id, '00000000-0000-0000-0000-000000000000'::uuid),
  coalesce(fondo_id, '00000000-0000-0000-0000-000000000000'::uuid))
  WHERE categoria_id IS NOT NULL;

-- ---------------------------------------------------------------------
-- Sobres del período (idempotente)
CREATE FUNCTION app.crear_sobres_periodo_interno(p_periodo uuid) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, app, plan, gob, fin AS $$
DECLARE v_hogar uuid; v_n integer := 0; v_k integer;
BEGIN
  SELECT hogar_id INTO v_hogar FROM plan.periodo WHERE id = p_periodo;
  IF v_hogar IS NULL THEN
    RAISE EXCEPTION 'No existe ese período' USING ERRCODE = 'no_data_found';
  END IF;

  INSERT INTO plan.sobre(hogar_id, periodo_id, tipo) VALUES (v_hogar, p_periodo, 'por_asignar')
  ON CONFLICT (periodo_id, tipo) WHERE tipo IN ('por_asignar','proximo_mes') DO NOTHING;

  -- Un sobre por categoría activa de tipo fijo, variable, futuro o emergencia
  INSERT INTO plan.sobre(hogar_id, periodo_id, categoria_id, tipo, es_cuatro_paredes)
  SELECT v_hogar, p_periodo, c.id, c.tipo_sobre, c.es_cuatro_paredes
    FROM plan.categoria c
   WHERE c.hogar_id = v_hogar AND c.activa AND c.tipo_sobre IN ('fijo','variable','futuro','emergencia')
     AND NOT EXISTS (SELECT 1 FROM plan.sobre s WHERE s.periodo_id = p_periodo AND s.categoria_id = c.id
                       AND s.integrante_id IS NULL AND s.fondo_id IS NULL AND s.deuda_id IS NULL);
  GET DIAGNOSTICS v_k = ROW_COUNT; v_n := v_n + v_k;

  -- Sin culpa por adulto activo (D06) y mesada por hijo activo (D17)
  INSERT INTO plan.sobre(hogar_id, periodo_id, categoria_id, tipo, integrante_id)
  SELECT v_hogar, p_periodo, c.id, c.tipo_sobre, i.id
    FROM plan.categoria c
    JOIN gob.integrante i ON i.hogar_id = v_hogar AND i.activo
                         AND ((c.tipo_sobre = 'sin_culpa' AND NOT i.es_menor AND i.rol IN ('ORG','CAD','ING'))
                           OR (c.tipo_sobre = 'mesada' AND i.es_menor))
   WHERE c.hogar_id = v_hogar AND c.activa
     AND NOT EXISTS (SELECT 1 FROM plan.sobre s WHERE s.periodo_id = p_periodo AND s.categoria_id = c.id
                       AND s.integrante_id = i.id);
  GET DIAGNOSTICS v_k = ROW_COUNT; v_n := v_n + v_k;

  -- Un sobre por fondo activo (R03)
  INSERT INTO plan.sobre(hogar_id, periodo_id, categoria_id, tipo, fondo_id)
  SELECT v_hogar, p_periodo, f.categoria_id, 'fondo', f.id
    FROM plan.fondo f JOIN plan.categoria c ON c.id = f.categoria_id
   WHERE f.hogar_id = v_hogar AND f.activo AND c.activa
     AND NOT EXISTS (SELECT 1 FROM plan.sobre s WHERE s.periodo_id = p_periodo AND s.fondo_id = f.id);
  GET DIAGNOSTICS v_k = ROW_COUNT; v_n := v_n + v_k;

  -- Pago de tarjeta por tarjeta activa (R44)
  PERFORM plan.sobre_pago_tarjeta(v_hogar, p_periodo, c.id)
     FROM fin.cuenta c
    WHERE c.hogar_id = v_hogar AND c.activa AND c.tipo = 'tarjeta_credito'
      AND NOT EXISTS (SELECT 1 FROM plan.sobre s WHERE s.periodo_id = p_periodo AND s.cuenta_id = c.id);
  GET DIAGNOSTICS v_k = ROW_COUNT; v_n := v_n + v_k;
  RETURN v_n;
END $$;

-- Período del mes de la fecha, con sus sobres (lo usan las RPC de captura e importación)
CREATE FUNCTION app.periodo_de(p_hogar uuid, p_fecha date) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, app, plan AS $$
DECLARE v_mes date := date_trunc('month', p_fecha)::date; v_periodo uuid;
BEGIN
  SELECT id INTO v_periodo FROM plan.periodo WHERE hogar_id = p_hogar AND mes = v_mes;
  IF v_periodo IS NULL THEN
    INSERT INTO plan.periodo(hogar_id, mes) VALUES (p_hogar, v_mes) ON CONFLICT (hogar_id, mes) DO NOTHING;
    SELECT id INTO v_periodo FROM plan.periodo WHERE hogar_id = p_hogar AND mes = v_mes;
  END IF;
  PERFORM app.crear_sobres_periodo_interno(v_periodo);
  RETURN v_periodo;
END $$;

-- ---------------------------------------------------------------------
-- RPC para la app
CREATE FUNCTION app.crear_sobres_periodo(p_periodo uuid) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, app, plan AS $$
BEGIN
  PERFORM app.exigir_admin();
  IF NOT EXISTS (SELECT 1 FROM plan.periodo WHERE id = p_periodo AND hogar_id = app.hogar_actual()) THEN
    RAISE EXCEPTION 'No encontramos ese período en tu hogar' USING ERRCODE = 'no_data_found';
  END IF;
  RETURN app.crear_sobres_periodo_interno(p_periodo);
END $$;

-- Mes con sus sobres, para cualquier integrante del hogar (idempotente)
CREATE FUNCTION app.asegurar_mes(p_mes date) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, app AS $$
BEGIN
  IF app.integrante_actual() IS NULL THEN
    RAISE EXCEPTION 'Necesitas iniciar sesión en tu hogar' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN app.periodo_de(app.hogar_actual(), p_mes);
END $$;

-- Reemplaza la de 0005: además del Por asignar, crea todos los sobres del mes
CREATE OR REPLACE FUNCTION app.crear_periodo(p_mes date) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, app, plan AS $$
BEGIN
  PERFORM app.exigir_admin();
  RETURN app.periodo_de(app.hogar_actual(), p_mes);
END $$;

-- Categorías sugeridas (HU-002-2): crea las que falten; devuelve cuántas creó
CREATE FUNCTION app.aplicar_plantilla_categorias() RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, app, plan, ref AS $$
DECLARE v_hogar uuid; v_n integer;
BEGIN
  PERFORM app.exigir_admin();
  v_hogar := app.hogar_actual();
  INSERT INTO plan.categoria(hogar_id, nombre, bloque_codigo, tipo_sobre, es_cuatro_paredes, intencion_default, plantilla_codigo)
  SELECT v_hogar, p.nombre, p.bloque_codigo, p.tipo_sobre, p.es_cuatro_paredes, p.intencion_default, p.codigo
    FROM ref.categoria_plantilla p
   WHERE NOT EXISTS (SELECT 1 FROM plan.categoria c
                      WHERE c.hogar_id = v_hogar AND (c.plantilla_codigo = p.codigo OR lower(c.nombre) = lower(p.nombre)));
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END $$;

-- ---------------------------------------------------------------------
-- Configuración del hogar: solo administradores (HU-002-1, HU-002-4)
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['fin.cuenta','plan.categoria','plan.fondo','plan.ingreso_esperado','plan.pago_fijo'] LOOP
    EXECUTE format($p$CREATE POLICY r_admin_config_ins ON %s AS RESTRICTIVE FOR INSERT TO compas_app
                     WITH CHECK (app.es_admin())$p$, t);
    EXECUTE format($p$CREATE POLICY r_admin_config_upd ON %s AS RESTRICTIVE FOR UPDATE TO compas_app
                     USING (app.es_admin())$p$, t);
  END LOOP;
END $$;

-- La tarjeta nunca guarda el número completo: solo los últimos 4 (ya en 0001); el saldo inicial
-- de una tarjeta es la deuda facturada pendiente al inicio del piloto (≤ 0)
ALTER TABLE fin.cuenta ADD CONSTRAINT chk_tarjeta_saldo CHECK (tipo <> 'tarjeta_credito' OR saldo_inicial <= 0);

-- ---------------------------------------------------------------------
-- Sobres con nombre y saldo, para la app (la RLS de cada tabla sigue aplicando)
CREATE VIEW plan.v_sobre WITH (security_invoker = true) AS
SELECT s.id, s.hogar_id, s.periodo_id, p.mes, s.tipo, s.categoria_id, s.integrante_id, s.fondo_id, s.cuenta_id,
       s.cerrado, s.es_cuatro_paredes,
       CASE s.tipo
         WHEN 'por_asignar'  THEN 'Por asignar'
         WHEN 'proximo_mes'  THEN 'Próximo mes'
         WHEN 'pago_tarjeta' THEN 'Pago ' || cu.nombre
         WHEN 'sin_culpa'    THEN 'Sin culpa ' || coalesce(i.nombre, '')
         WHEN 'mesada'       THEN 'Mesada ' || coalesce(i.nombre, '')
         WHEN 'fondo'        THEN coalesce(f.nombre, c.nombre)
         ELSE c.nombre
       END AS nombre,
       c.bloque_codigo, c.intencion_default,
       coalesce(v.disponible, 0) AS disponible, coalesce(v.gastado, 0) AS gastado, coalesce(v.saldo, 0) AS saldo
  FROM plan.sobre s
  JOIN plan.periodo p ON p.id = s.periodo_id
  LEFT JOIN plan.categoria c ON c.id = s.categoria_id
  LEFT JOIN gob.integrante i ON i.id = s.integrante_id
  LEFT JOIN plan.fondo f ON f.id = s.fondo_id
  LEFT JOIN fin.cuenta cu ON cu.id = s.cuenta_id
  LEFT JOIN plan.v_saldo_sobre v ON v.sobre_id = s.id;
GRANT SELECT ON plan.v_sobre, plan.v_saldo_sobre, plan.v_ritmo_sobre, plan.v_bloques_periodo TO compas_app, compas_ia, compas_sistema;

-- ---------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION app.crear_sobres_periodo_interno(uuid), app.periodo_de(uuid, date),
  app.asegurar_mes(date), app.crear_sobres_periodo(uuid), app.aplicar_plantilla_categorias() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION app.crear_sobres_periodo_interno(uuid), app.periodo_de(uuid, date) FROM compas_app, compas_ia;
GRANT EXECUTE ON FUNCTION app.asegurar_mes(date), app.crear_sobres_periodo(uuid), app.aplicar_plantilla_categorias() TO compas_app;
GRANT EXECUTE ON FUNCTION app.crear_sobres_periodo_interno(uuid), app.periodo_de(uuid, date) TO compas_sistema;

COMMIT;
