-- =====================================================================
-- Compás — migración 0009: perfil inicial, etapa y aprobaciones (spec 004; base para 006 y 009)
-- Fecha: 25-10-2026
-- * app.guardar_perfil: versión nueva del perfil, calculada en el dominio (las cifras no son de la IA).
-- * app.proponer_etapa: historial en "propuesta" + solicitud con la firma de cada administrador (R23).
-- * app.resolver_solicitud: firma única para todas las aprobaciones, con suplencia vencido el plazo (R39).
--   Al aprobarse, ejecuta app.aplicar_<tipo>(solicitud); al rechazarse, app.rechazar_<tipo> si existe.
--   Las specs siguientes agregan sus funciones aplicar_* sin tocar esta.
-- =====================================================================
BEGIN;

CREATE FUNCTION app.guardar_perfil(p_desde date, p_hasta date, p_perfil jsonb, p_retro jsonb, p_etapa text,
                                   p_modelo text DEFAULT 'reglas') RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, app, med, fin, ia AS $$
DECLARE v_hogar uuid; v_id uuid; v_version int; h record;
BEGIN
  PERFORM app.exigir_admin();
  v_hogar := app.hogar_actual();
  IF jsonb_typeof(p_retro) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Los hallazgos deben ser una lista' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  SELECT coalesce(max(version), 0) + 1 INTO v_version FROM med.perfil_inicial WHERE hogar_id = v_hogar;
  UPDATE med.perfil_inicial SET estado = 'descartado', revisado_por = app.integrante_actual(), revisado_en = now()
   WHERE hogar_id = v_hogar AND estado IN ('borrador','presentado');
  INSERT INTO med.perfil_inicial(hogar_id, version, desde, hasta, importaciones, perfil, retroalimentacion,
                                 etapa_sugerida, modelo, estado)
  VALUES (v_hogar, v_version, p_desde, p_hasta,
          coalesce((SELECT array_agg(id ORDER BY creado_en) FROM fin.importacion WHERE hogar_id = v_hogar), '{}'),
          p_perfil, p_retro, p_etapa, coalesce(p_modelo, 'reglas'), 'presentado')
  RETURNING id INTO v_id;
  -- Cada hallazgo cita su regla (P8); se guardan como recomendaciones para medir su aceptación (KP6)
  FOR h IN SELECT x ->> 'titulo' AS titulo, x ->> 'explicacion' AS explicacion, x ->> 'regla_codigo' AS regla,
                  x ->> 'fuente_codigo' AS fuente, x - 'titulo' - 'explicacion' AS resto
             FROM jsonb_array_elements(p_retro) x LOOP
    IF EXISTS (SELECT 1 FROM ref.regla_metodo WHERE codigo = h.regla) THEN
      INSERT INTO ia.recomendacion(hogar_id, proceso, tipo, titulo, contenido, propuesta, regla_codigo, fuente_codigo,
                                   objeto_tabla, objeto_id, modelo)
      VALUES (v_hogar, 'P1', 'perfil', left(h.titulo, 200), coalesce(h.explicacion, ''), h.resto, h.regla,
              (SELECT codigo FROM ref.fuente_metodologica WHERE codigo = h.fuente), 'med.perfil_inicial', v_id,
              coalesce(p_modelo, 'reglas'));
    END IF;
  END LOOP;
  PERFORM app.emitir_evento(v_hogar, 'PerfilInicialGenerado', app.integrante_actual(),
                            jsonb_build_object('perfil_id', v_id, 'etapa_sugerida', p_etapa));
  RETURN v_id;
END $$;

CREATE FUNCTION app.decidir_perfil(p_perfil uuid, p_aceptar boolean) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, app, med, ia AS $$
BEGIN
  PERFORM app.exigir_admin();
  UPDATE med.perfil_inicial SET estado = CASE WHEN p_aceptar THEN 'aceptado' ELSE 'descartado' END,
         revisado_por = app.integrante_actual(), revisado_en = now()
   WHERE id = p_perfil AND hogar_id = app.hogar_actual() AND estado = 'presentado';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ese perfil ya fue revisado o no es de tu hogar' USING ERRCODE = 'check_violation';
  END IF;
  UPDATE ia.recomendacion SET estado = CASE WHEN p_aceptar THEN 'aceptada'::ia.estado_recomendacion ELSE 'rechazada' END,
         decidida_por = app.integrante_actual(), decidida_en = now()
   WHERE objeto_id = p_perfil AND estado = 'propuesta';
END $$;

-- ---------------------------------------------------------------------
-- Aprobaciones: una sola puerta para firmar (R37, R39)
CREATE FUNCTION app.otro_admin(p_hogar uuid, p_yo uuid) RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, gob AS $$
  SELECT id FROM gob.integrante WHERE hogar_id = p_hogar AND rol IN ('ORG','CAD') AND activo AND id <> p_yo
   ORDER BY rol LIMIT 1
$$;

CREATE FUNCTION app.crear_solicitud(p_tipo gob.tipo_solicitud, p_tabla text, p_objeto uuid, p_firmas int,
                                    p_aprobador uuid, p_regla text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, app, gob AS $$
DECLARE v_hogar uuid := app.hogar_actual(); v_id uuid;
BEGIN
  INSERT INTO gob.solicitud_aprobacion(hogar_id, tipo, objeto_tabla, objeto_id, firmas_requeridas, aprobador_id,
                                       solicitada_por, vence_en, regla_codigo)
  VALUES (v_hogar, p_tipo, p_tabla, p_objeto, p_firmas, p_aprobador, app.integrante_actual(),
          now() + make_interval(hours => app.parametro_num(v_hogar, 'plazo_suplencia_h', 48)::int), p_regla)
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;

CREATE FUNCTION app.resolver_solicitud(p_solicitud uuid, p_aprueba boolean, p_comentario text DEFAULT NULL)
RETURNS gob.estado_solicitud
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, app, gob AS $$
DECLARE s gob.solicitud_aprobacion; v_yo uuid; v_suplente boolean := false; v_estado gob.estado_solicitud; v_fn text;
BEGIN
  PERFORM app.exigir_admin();
  v_yo := app.integrante_actual();
  SELECT * INTO s FROM gob.solicitud_aprobacion WHERE id = p_solicitud AND hogar_id = app.hogar_actual() FOR UPDATE;
  IF s.id IS NULL THEN
    RAISE EXCEPTION 'No encontramos esa solicitud en tu hogar' USING ERRCODE = 'no_data_found';
  END IF;
  IF s.estado <> 'pendiente' THEN
    RAISE EXCEPTION 'Esa solicitud ya está %', s.estado USING ERRCODE = 'check_violation';
  END IF;
  IF s.tipo = 'acuerdo' AND s.solicitada_por = v_yo THEN
    RAISE EXCEPTION 'El Acuerdo lo firma el otro administrador, no quien lo propuso' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF s.firmas_requeridas = 1 AND s.aprobador_id IS NOT NULL AND s.aprobador_id <> v_yo THEN
    -- R39: vencido el plazo, decide el suplente (el otro administrador)
    IF s.vence_en > now() AND NOT s.escalada_a_suplente THEN
      RAISE EXCEPTION 'Esta aprobación le corresponde a %; si no responde en el plazo, podrás decidir como suplente (R39)',
        (SELECT nombre FROM gob.integrante WHERE id = s.aprobador_id)
        USING ERRCODE = 'insufficient_privilege';
    END IF;
    v_suplente := true;
  END IF;
  INSERT INTO gob.firma(solicitud_id, integrante_id, decision, como_suplente, comentario)
  VALUES (s.id, v_yo, CASE WHEN p_aprueba THEN 'aprueba'::gob.decision_firma ELSE 'rechaza' END, v_suplente, p_comentario);
  SELECT estado INTO v_estado FROM gob.solicitud_aprobacion WHERE id = s.id;
  IF v_estado = 'aprobada' THEN
    v_fn := 'app.aplicar_' || s.tipo::text;
  ELSIF v_estado = 'rechazada' THEN
    v_fn := 'app.rechazar_' || s.tipo::text;
  END IF;
  IF v_fn IS NOT NULL AND to_regprocedure(v_fn || '(uuid)') IS NOT NULL THEN
    EXECUTE format('SELECT %s($1)', v_fn) USING s.id;
  END IF;
  RETURN v_estado;
END $$;

-- El Acuerdo aprobado queda vigente (E1)
CREATE FUNCTION app.aplicar_acuerdo(p_solicitud uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, app, gob AS $$
DECLARE v_acuerdo uuid;
BEGIN
  SELECT objeto_id INTO v_acuerdo FROM gob.solicitud_aprobacion WHERE id = p_solicitud;
  IF EXISTS (SELECT 1 FROM gob.acuerdo_hogar WHERE id = v_acuerdo AND estado = 'borrador') THEN
    PERFORM app.poner_vigente(v_acuerdo, app.integrante_actual());
  END IF;
END $$;

-- ---------------------------------------------------------------------
-- Etapa: la IA o el sistema sugieren; ambos administradores confirman (R23, HU-004-4)
CREATE FUNCTION app.proponer_etapa(p_etapa text, p_evidencia jsonb, p_origen sys.tipo_actor DEFAULT 'humano')
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, app, gob AS $$
DECLARE
  v_hogar uuid; v_actual text; v_confirmadas int; v_dir gob.direccion_etapa; v_hist uuid; v_sol uuid; v_admins int;
BEGIN
  PERFORM app.exigir_admin();
  v_hogar := app.hogar_actual();
  IF NOT EXISTS (SELECT 1 FROM ref.etapa WHERE codigo = p_etapa) THEN
    RAISE EXCEPTION 'Etapa desconocida: %', p_etapa USING ERRCODE = 'invalid_parameter_value';
  END IF;
  -- una sola propuesta abierta: la anterior se retira
  UPDATE gob.solicitud_aprobacion SET estado = 'vencida', resuelta_en = now()
   WHERE id IN (SELECT solicitud_id FROM gob.historial_etapa WHERE hogar_id = v_hogar AND estado = 'propuesta');
  UPDATE gob.historial_etapa SET estado = 'rechazada', resuelta_en = now() WHERE hogar_id = v_hogar AND estado = 'propuesta';

  SELECT etapa_codigo INTO v_actual FROM gob.hogar WHERE id = v_hogar;
  SELECT count(*) INTO v_confirmadas FROM gob.historial_etapa WHERE hogar_id = v_hogar AND estado = 'confirmada';
  v_dir := CASE WHEN v_confirmadas = 0 THEN 'inicial'
                WHEN (SELECT orden FROM ref.etapa WHERE codigo = p_etapa) >= (SELECT orden FROM ref.etapa WHERE codigo = v_actual)
                THEN 'avance' ELSE 'retroceso' END;
  SELECT count(*) INTO v_admins FROM gob.integrante WHERE hogar_id = v_hogar AND rol IN ('ORG','CAD') AND activo
     AND usuario_auth_id IS NOT NULL;
  INSERT INTO gob.historial_etapa(hogar_id, etapa_codigo, etapa_anterior, direccion, origen, evidencia)
  VALUES (v_hogar, p_etapa, CASE WHEN v_confirmadas > 0 THEN v_actual END, v_dir, coalesce(p_origen, 'humano'),
          coalesce(p_evidencia, '{}'))
  RETURNING id INTO v_hist;
  v_sol := app.crear_solicitud('etapa', 'gob.historial_etapa', v_hist, greatest(least(v_admins, 2), 1), NULL, 'R23');
  UPDATE gob.historial_etapa SET solicitud_id = v_sol WHERE id = v_hist;
  PERFORM app.emitir_evento(v_hogar, 'EtapaPropuesta', app.integrante_actual(),
                            jsonb_build_object('etapa_actual', v_actual, 'propuesta', p_etapa, 'evidencia', p_evidencia));
  RETURN v_sol;
END $$;

CREATE FUNCTION app.aplicar_etapa(p_solicitud uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, app, gob AS $$
DECLARE h gob.historial_etapa;
BEGIN
  UPDATE gob.historial_etapa SET estado = 'confirmada', resuelta_en = now()
   WHERE solicitud_id = p_solicitud AND estado = 'propuesta' RETURNING * INTO h;
  IF h.id IS NULL THEN RETURN; END IF;
  UPDATE gob.hogar SET etapa_codigo = h.etapa_codigo WHERE id = h.hogar_id;
  PERFORM app.emitir_evento(h.hogar_id, 'EtapaConfirmada', app.integrante_actual(),
                            jsonb_build_object('etapa', h.etapa_codigo, 'direccion', h.direccion, 'criterios', h.evidencia));
END $$;

CREATE FUNCTION app.rechazar_etapa(p_solicitud uuid) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = pg_catalog, gob AS $$
  UPDATE gob.historial_etapa SET estado = 'rechazada', resuelta_en = now()
   WHERE solicitud_id = p_solicitud AND estado = 'propuesta'
$$;

-- Bandeja de aprobaciones con lo necesario para decidir
CREATE VIEW gob.v_solicitud WITH (security_invoker = true) AS
SELECT s.id, s.hogar_id, s.tipo, s.estado, s.objeto_tabla, s.objeto_id, s.firmas_requeridas, s.aprobador_id,
       a.nombre AS aprobador, s.solicitada_por, p.nombre AS solicitada_por_nombre, s.vence_en, s.escalada_a_suplente,
       s.regla_codigo, s.creado_en,
       (SELECT coalesce(jsonb_agg(jsonb_build_object('integrante_id', f.integrante_id, 'decision', f.decision,
                                                     'como_suplente', f.como_suplente)), '[]')
          FROM gob.firma f WHERE f.solicitud_id = s.id) AS firmas
  FROM gob.solicitud_aprobacion s
  LEFT JOIN gob.integrante a ON a.id = s.aprobador_id
  LEFT JOIN gob.integrante p ON p.id = s.solicitada_por;
GRANT SELECT ON gob.v_solicitud TO compas_app;
GRANT SELECT, INSERT ON gob.historial_etapa TO compas_app;

REVOKE EXECUTE ON FUNCTION app.guardar_perfil(date, date, jsonb, jsonb, text, text), app.decidir_perfil(uuid, boolean),
  app.otro_admin(uuid, uuid), app.crear_solicitud(gob.tipo_solicitud, text, uuid, int, uuid, text),
  app.resolver_solicitud(uuid, boolean, text), app.aplicar_acuerdo(uuid),
  app.proponer_etapa(text, jsonb, sys.tipo_actor), app.aplicar_etapa(uuid), app.rechazar_etapa(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.guardar_perfil(date, date, jsonb, jsonb, text, text), app.decidir_perfil(uuid, boolean),
  app.resolver_solicitud(uuid, boolean, text), app.proponer_etapa(text, jsonb, sys.tipo_actor) TO compas_app;

COMMIT;
