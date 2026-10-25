-- =====================================================================
-- Compás — migración 0015: privacidad, derechos y retención (spec 011, Ley 21.719)
-- Fecha: 25-10-2026
-- * app.revocar_consentimiento: revocar datos_menor desactiva al hijo (R25); analitica_ia apaga la IA.
-- * app.registrar_exportacion: la exportación se arma en el dispositivo y queda registrada (D19).
-- * Borrado del hogar con la firma de los administradores; a los 30 días app.purgar_hogares borra todo.
--   El libro y los eventos son inmutables (I2): solo la purga del hogar, marcada en la sesión, los borra.
-- * Retención de cartolas (R43): no hay archivos guardados (D30); se marca cualquier importación antigua.
-- =====================================================================
BEGIN;
ALTER TYPE gob.tipo_solicitud ADD VALUE IF NOT EXISTS 'borrado_hogar';
COMMIT;

BEGIN;

CREATE OR REPLACE FUNCTION sys.bloquear_cambio() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  -- única excepción: la purga de un hogar con borrado aprobado hace 30 días (D19)
  IF TG_OP = 'DELETE' AND current_setting('app.purga_hogar', true) = OLD.hogar_id::text
     AND EXISTS (SELECT 1 FROM gob.hogar h WHERE h.id = OLD.hogar_id AND h.eliminado_en <= now() - interval '30 days') THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION '% es solo inserción', TG_TABLE_NAME USING ERRCODE = 'insufficient_privilege';
END $$;

CREATE FUNCTION app.revocar_consentimiento(p_finalidad gob.finalidad_consent, p_titular uuid DEFAULT NULL) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, app, gob AS $$
DECLARE v_titular uuid := coalesce(p_titular, app.integrante_actual()); v_n int;
BEGIN
  IF NOT app.puede_consentir_por(v_titular, app.integrante_actual()) THEN
    RAISE EXCEPTION 'Solo puedes revocar tus consentimientos o los de tus hijos' USING ERRCODE = 'insufficient_privilege';
  END IF;
  UPDATE gob.consentimiento SET revocado_en = now()
   WHERE titular_id = v_titular AND finalidad = p_finalidad AND revocado_en IS NULL;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF p_finalidad = 'datos_menor' AND v_n > 0 THEN   -- R25: sin consentimiento parental, el menor queda inactivo
    UPDATE gob.integrante SET activo = false WHERE id = v_titular AND es_menor;
  END IF;
  RETURN v_n;
END $$;

CREATE FUNCTION app.consentimiento_vigente(p_integrante uuid, p_finalidad gob.finalidad_consent) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, gob AS $$
  SELECT EXISTS (SELECT 1 FROM gob.consentimiento WHERE titular_id = p_integrante AND finalidad = p_finalidad
                   AND revocado_en IS NULL)
$$;

CREATE FUNCTION app.registrar_exportacion() RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, app, gob AS $$
DECLARE v_id uuid;
BEGIN
  IF app.integrante_actual() IS NULL THEN
    RAISE EXCEPTION 'Necesitas iniciar sesión en tu hogar' USING ERRCODE = 'insufficient_privilege';
  END IF;
  INSERT INTO gob.solicitud_derecho(hogar_id, titular_id, tipo, estado, plazo_legal, cumplida_en)
  VALUES (app.hogar_actual(), app.integrante_actual(), 'exportacion', 'cumplida', current_date, now())
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;

-- HU-011-3: el borrado lo confirman los administradores con cuenta (ORG y CAD)
CREATE FUNCTION app.solicitar_borrado_hogar() RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, app, gob AS $$
DECLARE v_hogar uuid; v_der uuid; v_sol uuid; v_admins int;
BEGIN
  PERFORM app.exigir_admin();
  v_hogar := app.hogar_actual();
  SELECT id INTO v_sol FROM gob.solicitud_aprobacion WHERE hogar_id = v_hogar AND tipo = 'borrado_hogar' AND estado = 'pendiente';
  IF v_sol IS NOT NULL THEN RETURN v_sol; END IF;
  INSERT INTO gob.solicitud_derecho(hogar_id, titular_id, tipo, plazo_legal)
  VALUES (v_hogar, app.integrante_actual(), 'borrado', current_date + 30) RETURNING id INTO v_der;
  SELECT count(*) INTO v_admins FROM gob.integrante WHERE hogar_id = v_hogar AND rol IN ('ORG','CAD') AND activo
     AND usuario_auth_id IS NOT NULL;
  v_sol := app.crear_solicitud('borrado_hogar', 'gob.solicitud_derecho', v_der, greatest(least(v_admins, 2), 1), NULL, 'R25');
  RETURN v_sol;
END $$;

CREATE FUNCTION app.aplicar_borrado_hogar(p_solicitud uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, app, gob AS $$
DECLARE s gob.solicitud_aprobacion;
BEGIN
  SELECT * INTO s FROM gob.solicitud_aprobacion WHERE id = p_solicitud;
  UPDATE gob.hogar SET eliminado_en = now() WHERE id = s.hogar_id AND eliminado_en IS NULL;
  UPDATE gob.solicitud_derecho SET estado = 'en_proceso', plazo_legal = current_date + 30 WHERE id = s.objeto_id;
END $$;

CREATE FUNCTION app.anular_borrado_hogar() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, app, gob AS $$
DECLARE v_hogar uuid;
BEGIN
  PERFORM app.exigir_admin();
  v_hogar := app.hogar_actual();
  UPDATE gob.hogar SET eliminado_en = NULL WHERE id = v_hogar;
  UPDATE gob.solicitud_derecho SET estado = 'rechazada' WHERE hogar_id = v_hogar AND tipo = 'borrado'
     AND estado IN ('recibida','en_proceso');
  UPDATE gob.solicitud_aprobacion SET estado = 'rechazada', resuelta_en = now()
   WHERE hogar_id = v_hogar AND tipo = 'borrado_hogar' AND estado = 'pendiente';
END $$;

-- Borrado definitivo de un hogar (D19): en orden de dependencias, todo lo que tiene su hogar_id
CREATE FUNCTION app.purgar_hogar(p_hogar uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, app AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM gob.hogar WHERE id = p_hogar AND eliminado_en <= now() - interval '30 days') THEN
    RAISE EXCEPTION 'El hogar no tiene un borrado aprobado hace 30 días' USING ERRCODE = 'check_violation';
  END IF;
  PERFORM set_config('app.purga_hogar', p_hogar::text, true);
  UPDATE plan.periodo SET estado = 'abierto' WHERE hogar_id = p_hogar AND estado = 'cerrado';
  DELETE FROM plan.libro_sobre WHERE hogar_id = p_hogar;
  DELETE FROM med.alerta WHERE hogar_id = p_hogar;
  DELETE FROM med.reflexion WHERE hogar_id = p_hogar;
  DELETE FROM med.cierre WHERE hogar_id = p_hogar;
  DELETE FROM med.medicion_kpi WHERE hogar_id = p_hogar;
  DELETE FROM plan.reasignacion WHERE hogar_id = p_hogar;
  DELETE FROM med.evento_recuperacion WHERE hogar_id = p_hogar;
  DELETE FROM plan.asignacion WHERE hogar_id = p_hogar;
  DELETE FROM plan.programacion_flujo WHERE hogar_id = p_hogar;
  DELETE FROM plan.linea_plan WHERE presupuesto_id IN (SELECT id FROM plan.presupuesto_mensual WHERE hogar_id = p_hogar);
  DELETE FROM gob.historial_etapa WHERE hogar_id = p_hogar;
  DELETE FROM plan.presupuesto_mensual WHERE hogar_id = p_hogar;
  DELETE FROM ia.recomendacion WHERE hogar_id = p_hogar;
  DELETE FROM ia.inferencia WHERE hogar_id = p_hogar;
  DELETE FROM fin.imputacion WHERE hogar_id = p_hogar;
  DELETE FROM fin.duplicado_candidato WHERE hogar_id = p_hogar;
  DELETE FROM fin.conciliacion WHERE hogar_id = p_hogar;
  DELETE FROM fin.por_cobrar WHERE hogar_id = p_hogar;
  DELETE FROM fin.cuota_deuda WHERE deuda_id IN (SELECT id FROM fin.deuda WHERE hogar_id = p_hogar);
  DELETE FROM fin.evidencia WHERE hogar_id = p_hogar;
  DELETE FROM fin.transferencia WHERE hogar_id = p_hogar;
  DELETE FROM plan.sobre WHERE hogar_id = p_hogar;
  DELETE FROM fin.deuda WHERE hogar_id = p_hogar;
  DELETE FROM fin.movimiento WHERE hogar_id = p_hogar AND movimiento_original_id IS NOT NULL;
  DELETE FROM fin.movimiento WHERE hogar_id = p_hogar;
  DELETE FROM fin.movimiento_historico WHERE hogar_id = p_hogar;
  DELETE FROM fin.importacion WHERE hogar_id = p_hogar;
  DELETE FROM fin.regla_comercio WHERE hogar_id = p_hogar;
  DELETE FROM plan.fondo WHERE hogar_id = p_hogar;
  DELETE FROM plan.pago_fijo WHERE hogar_id = p_hogar;
  DELETE FROM plan.ingreso_esperado WHERE hogar_id = p_hogar;
  DELETE FROM fin.activo WHERE hogar_id = p_hogar;
  DELETE FROM fin.cuenta WHERE hogar_id = p_hogar;
  UPDATE plan.categoria SET padre_id = NULL WHERE hogar_id = p_hogar;
  DELETE FROM plan.categoria WHERE hogar_id = p_hogar;
  DELETE FROM gob.reunion WHERE hogar_id = p_hogar;
  DELETE FROM plan.periodo WHERE hogar_id = p_hogar;
  DELETE FROM gob.solicitud_aprobacion WHERE hogar_id = p_hogar;
  DELETE FROM gob.consentimiento WHERE hogar_id = p_hogar;
  DELETE FROM gob.solicitud_derecho WHERE hogar_id = p_hogar;
  DELETE FROM gob.invitacion WHERE hogar_id = p_hogar;
  DELETE FROM gob.acuerdo_hogar WHERE hogar_id = p_hogar;
  DELETE FROM med.perfil_inicial WHERE hogar_id = p_hogar;
  DELETE FROM sys.dispositivo WHERE hogar_id = p_hogar;
  DELETE FROM sys.operacion_cliente WHERE hogar_id = p_hogar;
  DELETE FROM sys.evento_dominio WHERE hogar_id = p_hogar;
  UPDATE gob.integrante SET suplente_de_id = NULL WHERE hogar_id = p_hogar;
  DELETE FROM gob.integrante WHERE hogar_id = p_hogar;
  DELETE FROM gob.hogar WHERE id = p_hogar;
  DELETE FROM sys.auditoria WHERE hogar_id = p_hogar;
  PERFORM set_config('app.purga_hogar', '', true);
END $$;

CREATE FUNCTION app.purgar_hogares() RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, app AS $$
DECLARE h uuid; v_n int := 0;
BEGIN
  -- R43: ninguna importación conserva su documento más allá del plazo
  UPDATE fin.importacion SET storage_uri = NULL, purgada_en = now()
   WHERE purgada_en IS NULL AND expira_en <= now();
  FOR h IN SELECT id FROM gob.hogar WHERE eliminado_en <= now() - interval '30 days' LOOP
    PERFORM app.purgar_hogar(h);
    v_n := v_n + 1;
  END LOOP;
  RETURN v_n;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule('compas-retencion', '30 7 * * *', 'SELECT app.purgar_hogares()');
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'pg_cron no disponible: %', SQLERRM;
END $$;

GRANT SELECT ON gob.solicitud_derecho TO compas_app;
REVOKE EXECUTE ON FUNCTION app.revocar_consentimiento(gob.finalidad_consent, uuid),
  app.consentimiento_vigente(uuid, gob.finalidad_consent), app.registrar_exportacion(), app.solicitar_borrado_hogar(),
  app.aplicar_borrado_hogar(uuid), app.anular_borrado_hogar(), app.purgar_hogar(uuid), app.purgar_hogares() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.revocar_consentimiento(gob.finalidad_consent, uuid), app.registrar_exportacion(),
  app.solicitar_borrado_hogar(), app.anular_borrado_hogar() TO compas_app;
GRANT EXECUTE ON FUNCTION app.consentimiento_vigente(uuid, gob.finalidad_consent) TO compas_app, compas_ia, compas_sistema;
GRANT EXECUTE ON FUNCTION app.purgar_hogares() TO compas_sistema;

COMMIT;
