-- =====================================================================
-- Compás — migración 0008: importación de cartolas (spec 003, D30, D34)
-- Fecha: 25-10-2026
-- * El archivo se procesa en el dispositivo y no se sube (D30): la importación nace purgada.
-- * fin.movimiento tipo 'transferencia' (D34): no toca el libro ni los KPI (R28).
-- * fin.regla_comercio: "JUMBO → Alimentación" para próximas importaciones.
-- * app.importar_cartola: históricos (R41), movimientos por confirmar (R42), huella de línea,
--   calce con captura manual (R35) y pagos de tarjeta (R27) en una transacción.
-- * app.clasificar_comercio y app.guardar_sugerencias: revisión en lote y sugerencias (R36, P8).
-- =====================================================================

-- Parte A: valores nuevos de enumerados (se confirman antes de usarse)
BEGIN;
ALTER TYPE fin.tipo_movimiento ADD VALUE IF NOT EXISTS 'transferencia';
COMMIT;

BEGIN;

ALTER TABLE fin.movimiento
  ADD COLUMN sentido text CHECK (sentido IN ('cargo','abono')),
  ADD COLUMN categoria_sugerida_id uuid REFERENCES plan.categoria(id),
  ADD COLUMN calce_importacion_id uuid REFERENCES fin.importacion(id),
  ADD CONSTRAINT chk_mov_transferencia CHECK (tipo <> 'transferencia' OR sentido IS NOT NULL);

ALTER TABLE fin.transferencia
  ADD COLUMN importacion_id uuid REFERENCES fin.importacion(id),
  ADD COLUMN hash_linea text;
CREATE UNIQUE INDEX ux_transf_hash_linea ON fin.transferencia(hogar_id, hash_linea) WHERE hash_linea IS NOT NULL;

-- Reglas de comercio del hogar (HU-003-2)
CREATE TABLE fin.regla_comercio (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hogar_id      uuid NOT NULL REFERENCES gob.hogar(id),
  patron        text NOT NULL CHECK (patron = upper(patron) AND patron <> ''),
  categoria_id  uuid NOT NULL REFERENCES plan.categoria(id),
  integrante_id uuid REFERENCES gob.integrante(id),
  intencion     fin.intencion,
  creada_por    uuid NOT NULL REFERENCES gob.integrante(id),
  veces_usada   integer NOT NULL DEFAULT 0,
  creado_en     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (hogar_id, patron)
);
ALTER TABLE fin.regla_comercio ENABLE ROW LEVEL SECURITY;
ALTER TABLE fin.regla_comercio FORCE ROW LEVEL SECURITY;
CREATE POLICY p_hogar ON fin.regla_comercio FOR ALL
  USING (hogar_id = app.hogar_actual()) WITH CHECK (hogar_id = app.hogar_actual());
CREATE POLICY r_solo_admin ON fin.regla_comercio AS RESTRICTIVE FOR ALL TO compas_app
  USING (app.es_admin()) WITH CHECK (app.es_admin());
GRANT SELECT, INSERT, UPDATE, DELETE ON fin.regla_comercio TO compas_app;
GRANT SELECT ON fin.regla_comercio TO compas_ia, compas_sistema;

-- ---------------------------------------------------------------------
-- Sobre de una categoría en un período (sin culpa y mesada por integrante; fondo: el primero)
CREATE FUNCTION app.sobre_categoria(p_periodo uuid, p_categoria uuid, p_integrante uuid) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, app, plan AS $$
DECLARE v_id uuid;
BEGIN
  PERFORM app.crear_sobres_periodo_interno(p_periodo);
  SELECT id INTO v_id FROM plan.sobre
   WHERE periodo_id = p_periodo AND categoria_id = p_categoria
     AND (p_integrante IS NULL OR integrante_id = p_integrante)
   ORDER BY integrante_id NULLS FIRST, creado_en LIMIT 1;
  IF v_id IS NULL THEN
    RAISE EXCEPTION 'Esa categoría no tiene sobre en el mes (¿está desactivada o le falta el integrante?)'
      USING ERRCODE = 'no_data_found';
  END IF;
  RETURN v_id;
END $$;

-- Pago de tarjeta de una línea de cartola: se calza con uno ya registrado o se crea (R27)
CREATE FUNCTION app.pago_tarjeta_de_linea(p_hogar uuid, p_imp uuid, p_origen uuid, p_tarjeta uuid, p_monto bigint,
                                          p_fecha date, p_hash text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, app, fin AS $$
DECLARE v_id uuid;
BEGIN
  SELECT id INTO v_id FROM fin.transferencia
   WHERE hogar_id = p_hogar AND tipo = 'pago_tarjeta' AND cuenta_destino_id = p_tarjeta AND monto_clp = p_monto
     AND abs(fecha - p_fecha) <= 3 AND estado = 'hecha'
     AND (hash_linea IS NULL OR hash_linea <> p_hash)
     AND (importacion_id IS NULL OR importacion_id <> p_imp)
   ORDER BY abs(fecha - p_fecha) LIMIT 1;
  IF v_id IS NOT NULL THEN
    RETURN false;   -- el otro lado ya lo registró (cuenta corriente o estado de cuenta)
  END IF;
  PERFORM app.periodo_de(p_hogar, p_fecha);
  INSERT INTO fin.transferencia(hogar_id, cuenta_origen_id, cuenta_destino_id, tipo, monto_clp, fecha, estado,
                                hecha_por, hecha_en, importacion_id, hash_linea)
  VALUES (p_hogar, p_origen, p_tarjeta, 'pago_tarjeta', p_monto, p_fecha, 'hecha', app.integrante_actual(), now(),
          p_imp, p_hash);
  PERFORM app.emitir_evento(p_hogar, 'PagoTarjetaRegistrado', app.integrante_actual(),
                            jsonb_build_object('tarjeta_id', p_tarjeta, 'monto', p_monto, 'origen', 'cartola'));
  RETURN true;
END $$;

-- p_lineas: [{fecha, monto (con signo: cargo < 0), glosa (minimizada), comercio, clase, hash,
--             categoria_id?, intencion?, confianza?, tarjeta_id?}]
CREATE FUNCTION app.importar_cartola(p_cuenta uuid, p_archivo text, p_formato text, p_sha256 text, p_lector text,
                                     p_lineas jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, app, plan, fin AS $$
DECLARE
  v_hogar uuid; v_yo uuid; c fin.cuenta; v_prev fin.importacion; v_imp uuid; v_inicio date; l record;
  v_hist int := 0; v_movs int := 0; v_dups int := 0; v_transf int := 0; v_calces int := 0; v_filas int := 0;
  v_id uuid; v_monto bigint; v_sentido text; v_periodo uuid; v_cands int; v_tarjeta uuid; v_origen uuid;
  v_bloque text; v_estado text;
BEGIN
  PERFORM app.exigir_admin();
  v_hogar := app.hogar_actual(); v_yo := app.integrante_actual();
  c := app.cuenta_del_hogar(p_cuenta);
  SELECT * INTO v_prev FROM fin.importacion WHERE hogar_id = v_hogar AND sha256 = p_sha256;
  IF v_prev.id IS NOT NULL THEN
    RAISE EXCEPTION 'Este archivo ya se importó el %', to_char(v_prev.creado_en AT TIME ZONE 'America/Santiago', 'DD-MM-YYYY')
      USING ERRCODE = 'unique_violation';
  END IF;
  IF jsonb_typeof(p_lineas) IS DISTINCT FROM 'array' OR jsonb_array_length(p_lineas) = 0 THEN
    RAISE EXCEPTION 'La cartola no trae movimientos que importar' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  v_inicio := coalesce(app.inicio_piloto(v_hogar), '2026-10-01');

  INSERT INTO fin.importacion(hogar_id, cuenta_id, archivo_nombre, formato, institucion, lector, sha256, storage_uri,
                              estado, purgada_en, subida_por, desde, hasta)
  SELECT v_hogar, p_cuenta, left(p_archivo, 200), p_formato, c.institucion, p_lector, p_sha256, NULL,
         'extraida', now(), v_yo, min((x ->> 'fecha')::date), max((x ->> 'fecha')::date)
    FROM jsonb_array_elements(p_lineas) x
  RETURNING id INTO v_imp;
  PERFORM app.emitir_evento(v_hogar, 'CartolaCargada', v_yo, jsonb_build_object('importacion_id', v_imp, 'cuenta_id', p_cuenta));

  FOR l IN SELECT (x ->> 'fecha')::date AS fecha, (x ->> 'monto')::bigint AS monto, x ->> 'glosa' AS glosa,
                  nullif(x ->> 'comercio', '') AS comercio, coalesce(x ->> 'clase', 'otro') AS clase, x ->> 'hash' AS hash,
                  nullif(x ->> 'categoria_id', '')::uuid AS categoria_id, nullif(x ->> 'intencion', '')::fin.intencion AS intencion,
                  nullif(x ->> 'confianza', '')::numeric AS confianza, nullif(x ->> 'tarjeta_id', '')::uuid AS tarjeta_id
             FROM jsonb_array_elements(p_lineas) x ORDER BY (x ->> 'fecha')::date LOOP
    v_filas := v_filas + 1;
    IF l.monto IS NULL OR l.monto = 0 OR l.hash IS NULL OR l.fecha IS NULL THEN
      RAISE EXCEPTION 'Línea % incompleta: fecha, monto y huella son obligatorios', v_filas USING ERRCODE = 'invalid_parameter_value';
    END IF;
    v_monto := abs(l.monto);
    v_sentido := CASE WHEN l.monto < 0 THEN 'cargo' ELSE 'abono' END;

    -- R41: antes del inicio del piloto, solo alimenta el perfil
    IF l.fecha < v_inicio THEN
      SELECT bloque_codigo INTO v_bloque FROM plan.categoria WHERE id = l.categoria_id AND hogar_id = v_hogar;
      INSERT INTO fin.movimiento_historico(hogar_id, importacion_id, cuenta_id, fecha, sentido, monto_clp, glosa, comercio,
                                           clase, categoria_id, bloque_codigo, intencion, confianza_ia, hash_linea)
      VALUES (v_hogar, v_imp, p_cuenta, l.fecha, v_sentido, v_monto, left(coalesce(l.glosa, ''), 300), l.comercio,
              l.clase, CASE WHEN v_bloque IS NOT NULL THEN l.categoria_id END, v_bloque, l.intencion, l.confianza, l.hash)
      ON CONFLICT (hogar_id, hash_linea) DO NOTHING;
      IF FOUND THEN v_hist := v_hist + 1; ELSE v_dups := v_dups + 1; END IF;
      CONTINUE;
    END IF;

    -- Huella ya importada (documentos traslapados)
    IF EXISTS (SELECT 1 FROM fin.movimiento WHERE hogar_id = v_hogar AND hash_linea = l.hash)
       OR EXISTS (SELECT 1 FROM fin.transferencia WHERE hogar_id = v_hogar AND hash_linea = l.hash) THEN
      v_dups := v_dups + 1;
      CONTINUE;
    END IF;
    v_periodo := app.periodo_de(v_hogar, l.fecha);

    -- R27: pago de tarjeta (cargo en la cuenta corriente o abono en el estado de cuenta)
    IF l.clase = 'pago_tarjeta' THEN
      IF c.tipo = 'tarjeta_credito' THEN
        v_tarjeta := c.id;
        SELECT id INTO v_origen FROM fin.cuenta WHERE hogar_id = v_hogar AND activa AND tipo = 'vista' ORDER BY creado_en LIMIT 1;
      ELSE
        v_origen := c.id;
        v_tarjeta := l.tarjeta_id;
        IF v_tarjeta IS NULL THEN
          SELECT id INTO v_tarjeta FROM fin.cuenta WHERE hogar_id = v_hogar AND activa AND tipo = 'tarjeta_credito'
           ORDER BY creado_en LIMIT 1;
        END IF;
      END IF;
      IF v_tarjeta IS NOT NULL AND v_origen IS NOT NULL THEN
        IF app.pago_tarjeta_de_linea(v_hogar, v_imp, v_origen, v_tarjeta, v_monto, l.fecha, l.hash) THEN
          v_transf := v_transf + 1;
        ELSE
          v_dups := v_dups + 1;
        END IF;
        CONTINUE;
      END IF;
    END IF;

    -- D34: transferencias internas y abonos en la tarjeta que no son pago
    IF l.clase IN ('pago_tarjeta','transferencia_interna') OR (c.tipo = 'tarjeta_credito' AND v_sentido = 'abono') THEN
      INSERT INTO fin.movimiento(hogar_id, periodo_id, cuenta_id, tipo, estado, origen, fecha_contable, monto_clp, comercio,
                                 nota, sentido, registrado_por, importacion_id, hash_linea)
      VALUES (v_hogar, v_periodo, p_cuenta, 'transferencia', 'por_confirmar', 'cartola', l.fecha, v_monto,
              coalesce(l.comercio, left(l.glosa, 80)),
              CASE WHEN c.tipo = 'tarjeta_credito' AND l.clase NOT IN ('pago_tarjeta','transferencia_interna')
                   THEN 'Abono en la tarjeta: revisa si es una devolución' END,
              v_sentido, v_yo, v_imp, l.hash)
      RETURNING id INTO v_id;
      UPDATE fin.movimiento SET estado = 'confirmado', confirmado_en = now(), confirmado_por = v_yo WHERE id = v_id;
      v_transf := v_transf + 1;
      CONTINUE;
    END IF;

    -- R35: lo capturado a mano se calza con la línea (un solo candidato) en vez de duplicarse
    SELECT count(*), min(id::text)::uuid INTO v_cands, v_id FROM fin.movimiento
     WHERE hogar_id = v_hogar AND cuenta_id = p_cuenta AND monto_clp = v_monto AND hash_linea IS NULL
       AND tipo = CASE v_sentido WHEN 'cargo' THEN 'gasto'::fin.tipo_movimiento ELSE 'ingreso'::fin.tipo_movimiento END
       AND origen IN ('manual','chat') AND estado <> 'descartado' AND abs(fecha_contable - l.fecha) <= 2;
    IF v_cands = 1 THEN
      UPDATE fin.movimiento SET hash_linea = l.hash, calce_importacion_id = v_imp WHERE id = v_id;
      v_calces := v_calces + 1;
      CONTINUE;
    END IF;

    -- R42: desde el inicio del piloto, entra por confirmar con la categoría sugerida
    INSERT INTO fin.movimiento(hogar_id, periodo_id, cuenta_id, tipo, estado, origen, fecha_contable, monto_clp, comercio,
                               nota, sentido, intencion, confianza_ia, categoria_sugerida_id, registrado_por,
                               registrado_por_tipo, importacion_id, hash_linea)
    VALUES (v_hogar, v_periodo, p_cuenta,
            CASE v_sentido WHEN 'cargo' THEN 'gasto'::fin.tipo_movimiento ELSE 'ingreso'::fin.tipo_movimiento END,
            'por_confirmar', 'cartola', l.fecha, v_monto, coalesce(l.comercio, left(l.glosa, 80)), left(l.glosa, 300),
            v_sentido, l.intencion, l.confianza,
            (SELECT id FROM plan.categoria WHERE id = l.categoria_id AND hogar_id = v_hogar), v_yo, 'sistema', v_imp, l.hash)
    RETURNING id INTO v_id;
    IF v_sentido = 'abono' THEN
      INSERT INTO fin.ingreso(movimiento_id, tipo_ingreso) VALUES (v_id, 'otro');
    END IF;
    IF v_cands > 1 THEN
      PERFORM app.marcar_duplicados(v_id);
    END IF;
    v_movs := v_movs + 1;
  END LOOP;

  v_estado := CASE WHEN v_movs > 0 OR v_hist > 0 THEN 'en_revision' ELSE 'importada' END;
  UPDATE fin.importacion SET estado = v_estado, n_filas = v_filas, n_historicos = v_hist, n_movimientos = v_movs,
         n_duplicados = v_dups
   WHERE id = v_imp;
  PERFORM app.emitir_evento(v_hogar, 'CartolaImportada', v_yo,
    jsonb_build_object('importacion_id', v_imp, 'historicos', v_hist, 'movimientos', v_movs, 'duplicados', v_dups,
                       'transferencias', v_transf, 'calzados', v_calces));
  RETURN jsonb_build_object('importacion_id', v_imp, 'n_filas', v_filas, 'n_historicos', v_hist,
                            'n_movimientos', v_movs, 'n_duplicados', v_dups, 'n_transferencias', v_transf,
                            'n_calzados', v_calces, 'estado', v_estado);
END $$;

-- Revisión en lote por comercio (HU-003-2): clasifica históricos, confirma movimientos y guarda la regla
CREATE FUNCTION app.clasificar_comercio(p_importacion uuid, p_comercio text, p_categoria uuid,
                                        p_integrante uuid DEFAULT NULL, p_intencion fin.intencion DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, app, plan, fin AS $$
DECLARE
  v_hogar uuid; v_yo uuid; cat plan.categoria; m record; v_hist int; v_conf int := 0; v_pend int := 0;
BEGIN
  PERFORM app.exigir_admin();
  v_hogar := app.hogar_actual(); v_yo := app.integrante_actual();
  SELECT * INTO cat FROM plan.categoria WHERE id = p_categoria AND hogar_id = v_hogar;
  IF cat.id IS NULL THEN
    RAISE EXCEPTION 'Esa categoría no es de tu hogar' USING ERRCODE = 'foreign_key_violation';
  END IF;
  IF cat.tipo_sobre IN ('sin_culpa','mesada') AND p_integrante IS NULL THEN
    RAISE EXCEPTION 'Indica de quién es el sobre %', cat.nombre USING ERRCODE = 'check_violation';
  END IF;

  UPDATE fin.movimiento_historico
     SET categoria_id = cat.id, bloque_codigo = cat.bloque_codigo,
         intencion = coalesce(p_intencion, cat.intencion_default), revisado = true,
         clase = CASE WHEN clase IN ('otro','comision','interes') OR clase IS NULL THEN coalesce(clase, 'gasto') ELSE clase END
   WHERE hogar_id = v_hogar AND (p_importacion IS NULL OR importacion_id = p_importacion)
     AND upper(coalesce(comercio, glosa)) = upper(p_comercio) AND sentido = 'cargo';
  GET DIAGNOSTICS v_hist = ROW_COUNT;

  FOR m IN SELECT id, periodo_id FROM fin.movimiento
            WHERE hogar_id = v_hogar AND (p_importacion IS NULL OR importacion_id = p_importacion)
              AND upper(comercio) = upper(p_comercio) AND tipo = 'gasto' AND estado = 'por_confirmar' LOOP
    UPDATE fin.movimiento SET intencion = coalesce(p_intencion, cat.intencion_default), categoria_sugerida_id = cat.id
     WHERE id = m.id;
    IF EXISTS (SELECT 1 FROM fin.duplicado_candidato d WHERE d.estado = 'abierto'
                AND (d.movimiento_a_id = m.id OR d.movimiento_b_id = m.id)) THEN
      v_pend := v_pend + 1;   -- un posible duplicado lo resuelve una persona en la bandeja (R35)
      CONTINUE;
    END IF;
    PERFORM app.imputar(m.id, app.sobre_categoria(m.periodo_id, cat.id, p_integrante), 'humano');
    PERFORM app.confirmar_interno(m.id);
    v_conf := v_conf + 1;
  END LOOP;

  INSERT INTO fin.regla_comercio(hogar_id, patron, categoria_id, integrante_id, intencion, creada_por, veces_usada)
  VALUES (v_hogar, upper(btrim(p_comercio)), cat.id, p_integrante, p_intencion, v_yo, 1)
  ON CONFLICT (hogar_id, patron) DO UPDATE
     SET categoria_id = EXCLUDED.categoria_id, integrante_id = EXCLUDED.integrante_id,
         intencion = EXCLUDED.intencion, veces_usada = fin.regla_comercio.veces_usada + 1;

  PERFORM app.cerrar_importaciones_revisadas(v_hogar);
  RETURN jsonb_build_object('historicos', v_hist, 'confirmados', v_conf, 'pendientes', v_pend);
END $$;

-- Una importación sin pendientes pasa a importada
CREATE FUNCTION app.cerrar_importaciones_revisadas(p_hogar uuid) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = pg_catalog, fin AS $$
  UPDATE fin.importacion i SET estado = 'importada'
   WHERE i.hogar_id = p_hogar AND i.estado = 'en_revision'
     AND NOT EXISTS (SELECT 1 FROM fin.movimiento m WHERE m.importacion_id = i.id AND m.estado = 'por_confirmar')
     AND NOT EXISTS (SELECT 1 FROM fin.movimiento_historico h WHERE h.importacion_id = i.id AND NOT h.revisado
                       AND h.sentido = 'cargo' AND coalesce(h.clase, 'gasto') NOT IN ('transferencia_interna','pago_tarjeta'))
$$;

-- Sugerencias de reglas o de la IA (R36): nunca confirman ni imputan
-- p_items: [{tabla: "movimiento"|"historico", id, categoria_id, intencion?, confianza?, clase?, modelo?}]
CREATE FUNCTION app.guardar_sugerencias(p_items jsonb) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, app, plan, fin, ia AS $$
DECLARE v_hogar uuid; x record; v_n int := 0;
BEGIN
  PERFORM app.exigir_admin();
  v_hogar := app.hogar_actual();
  FOR x IN SELECT r ->> 'tabla' AS tabla, (r ->> 'id')::uuid AS id, nullif(r ->> 'categoria_id', '')::uuid AS categoria_id,
                  nullif(r ->> 'intencion', '')::fin.intencion AS intencion,
                  least(greatest(coalesce((r ->> 'confianza')::numeric, 0), 0), 1) AS confianza,
                  nullif(r ->> 'clase', '') AS clase, coalesce(r ->> 'modelo', 'reglas') AS modelo
             FROM jsonb_array_elements(p_items) r LOOP
    IF x.categoria_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM plan.categoria WHERE id = x.categoria_id AND hogar_id = v_hogar) THEN
      CONTINUE;
    END IF;
    IF x.tabla = 'historico' THEN
      UPDATE fin.movimiento_historico
         SET categoria_id = coalesce(x.categoria_id, categoria_id),
             bloque_codigo = coalesce((SELECT bloque_codigo FROM plan.categoria WHERE id = x.categoria_id), bloque_codigo),
             intencion = coalesce(x.intencion, intencion), confianza_ia = x.confianza, clase = coalesce(x.clase, clase)
       WHERE id = x.id AND hogar_id = v_hogar AND NOT revisado;
    ELSE
      UPDATE fin.movimiento SET categoria_sugerida_id = x.categoria_id, intencion = coalesce(x.intencion, intencion),
             confianza_ia = x.confianza
       WHERE id = x.id AND hogar_id = v_hogar AND estado = 'por_confirmar';
      IF FOUND AND x.categoria_id IS NOT NULL THEN
        INSERT INTO ia.inferencia(hogar_id, movimiento_id, campo, valor_propuesto, confianza, modelo)
        VALUES (v_hogar, x.id, 'categoria', x.categoria_id::text, x.confianza, x.modelo)
        ON CONFLICT (movimiento_id, campo) DO UPDATE
           SET valor_propuesto = EXCLUDED.valor_propuesto, confianza = EXCLUDED.confianza, modelo = EXCLUDED.modelo;
      END IF;
    END IF;
    IF FOUND THEN v_n := v_n + 1; END IF;
  END LOOP;
  RETURN v_n;
END $$;

-- Al confirmar o corregir, la inferencia registra si se aceptó (mide la precisión de la IA, D10)
CREATE FUNCTION ia.registrar_aceptacion() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, ia, plan, fin AS $$
DECLARE v_cat uuid;
BEGIN
  IF NEW.estado IN ('confirmado','descartado') AND OLD.estado = 'por_confirmar' THEN
    SELECT s.categoria_id INTO v_cat FROM fin.imputacion i JOIN plan.sobre s ON s.id = i.sobre_id
     WHERE i.movimiento_id = NEW.id ORDER BY i.monto_clp DESC LIMIT 1;
    UPDATE ia.inferencia SET aceptada = (NEW.estado = 'confirmado' AND valor_propuesto = v_cat::text),
           valor_final = v_cat::text
     WHERE movimiento_id = NEW.id AND campo = 'categoria';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_mov_inferencia AFTER UPDATE OF estado ON fin.movimiento
  FOR EACH ROW EXECUTE FUNCTION ia.registrar_aceptacion();

-- Confirmar un movimiento de cartola con su categoría sugerida usa la regla del comercio
CREATE OR REPLACE FUNCTION app.confirmar_movimiento(p_mov uuid, p_sobre uuid DEFAULT NULL, p_intencion fin.intencion DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, app, fin AS $$
DECLARE m fin.movimiento; v_sobre uuid := p_sobre;
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
    IF v_sobre IS NULL AND NOT EXISTS (SELECT 1 FROM fin.imputacion WHERE movimiento_id = p_mov)
       AND m.categoria_sugerida_id IS NOT NULL THEN
      v_sobre := app.sobre_categoria(m.periodo_id, m.categoria_sugerida_id, NULL);
    END IF;
    IF v_sobre IS NOT NULL THEN
      PERFORM app.imputar(p_mov, v_sobre, 'humano');
    ELSIF NOT EXISTS (SELECT 1 FROM fin.imputacion WHERE movimiento_id = p_mov) THEN
      RAISE EXCEPTION 'Elige el sobre del gasto antes de confirmarlo' USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  UPDATE fin.duplicado_candidato SET estado = 'resuelto', es_duplicado = false, resuelto_por = app.integrante_actual(),
         resuelto_en = now()
   WHERE estado = 'abierto' AND (movimiento_a_id = p_mov OR movimiento_b_id = p_mov);
  PERFORM app.confirmar_interno(p_mov);
  PERFORM app.cerrar_importaciones_revisadas(m.hogar_id);
END $$;

-- Lo revisado por comercio: grupos de una importación, para la pantalla de revisión
CREATE VIEW fin.v_revision_comercio WITH (security_invoker = true) AS
SELECT importacion_id, hogar_id, comercio, 'historico'::text AS origen, count(*) AS n, sum(monto_clp) AS monto,
       min(categoria_id::text)::uuid AS categoria_sugerida_id, max(confianza_ia) AS confianza, bool_and(revisado) AS revisado
  FROM (SELECT importacion_id, hogar_id, upper(coalesce(comercio, glosa)) AS comercio, monto_clp, categoria_id, confianza_ia,
               revisado FROM fin.movimiento_historico
         WHERE sentido = 'cargo' AND coalesce(clase, 'gasto') NOT IN ('transferencia_interna','pago_tarjeta')) h
 GROUP BY importacion_id, hogar_id, comercio
UNION ALL
SELECT importacion_id, hogar_id, upper(comercio), 'movimiento', count(*), sum(monto_clp),
       min(categoria_sugerida_id::text)::uuid, max(confianza_ia), bool_and(estado <> 'por_confirmar')
  FROM fin.movimiento WHERE importacion_id IS NOT NULL AND tipo = 'gasto' AND estado <> 'descartado'
 GROUP BY importacion_id, hogar_id, upper(comercio);
GRANT SELECT ON fin.v_revision_comercio TO compas_app, compas_ia;

-- ---------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION app.sobre_categoria(uuid, uuid, uuid),
  app.pago_tarjeta_de_linea(uuid, uuid, uuid, uuid, bigint, date, text),
  app.importar_cartola(uuid, text, text, text, text, jsonb), app.clasificar_comercio(uuid, text, uuid, uuid, fin.intencion),
  app.cerrar_importaciones_revisadas(uuid), app.guardar_sugerencias(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.importar_cartola(uuid, text, text, text, text, jsonb),
  app.clasificar_comercio(uuid, text, uuid, uuid, fin.intencion), app.guardar_sugerencias(jsonb) TO compas_app;

COMMIT;
