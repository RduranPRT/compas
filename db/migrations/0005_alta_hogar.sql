-- =====================================================================
-- Compás — migración 0005: alta del hogar (spec 001, T007)
-- Fecha: 24-10-2026
-- * gob.invitacion: el ORG invita adultos por correo; el integrante se crea al invitar
--   (sin usuario_auth_id) para que pueda recibir solicitudes de firma antes de ingresar.
-- * RPC SECURITY DEFINER que validan el JWT y el rol: crear_hogar, invitar_integrante,
--   aceptar_invitacion, registrar_menor (hijos sin cuenta, D26), crear_periodo,
--   proponer_acuerdo y activar_acuerdo (E1: ORG propone, el otro administrador firma).
-- * Parámetro modalidad_sin_culpa en gob.regla_hogar (ADR-10, D25).
-- =====================================================================
BEGIN;

-- Parámetro nuevo del Acuerdo (ADR-10)
ALTER TABLE gob.regla_hogar DROP CONSTRAINT regla_hogar_codigo_check;
ALTER TABLE gob.regla_hogar ADD CONSTRAINT regla_hogar_codigo_check CHECK (codigo IN (
  'dia_plan','dia_ingreso_mes_siguiente','umbral_ritmo','umbral_ajuste_ingreso_pct',
  'autoaprobacion_n1_pct','plazo_suplencia_h','max_alertas_dia','hora_resumen_diario',
  'confianza_ia_min','umbral_conciliacion_clp','holgura_fijos_pct','pct_reajuste_a_futuro',
  'pct_sin_culpa','estrategia_deuda','dias_vencimiento_asesor','dias_abandono',
  'monto_sin_culpa_clp',
  'inicio_piloto','mes_primer_plan','tratamiento_cuotas_default','pct_variable_a_futuro',
  'dias_retencion_cartola',
  -- 0005
  'modalidad_sin_culpa'          -- "igual" | "proporcional_ingreso" | "manual_por_adulto" (D25)
));

-- Invitaciones de adultos (los hijos no se invitan: D26)
CREATE TABLE gob.invitacion (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hogar_id       uuid NOT NULL REFERENCES gob.hogar(id),
  integrante_id  uuid NOT NULL,
  correo         text NOT NULL CHECK (correo = lower(correo) AND correo ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  rol            gob.rol_integrante NOT NULL CHECK (rol IN ('CAD','ING')),
  estado         text NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente','aceptada','anulada')),
  vence_en       timestamptz NOT NULL DEFAULT now() + interval '7 days',
  creado_por     uuid NOT NULL REFERENCES gob.integrante(id),
  creado_en      timestamptz NOT NULL DEFAULT now(),
  aceptada_en    timestamptz,
  FOREIGN KEY (integrante_id, hogar_id) REFERENCES gob.integrante(id, hogar_id)
);
CREATE UNIQUE INDEX ux_invitacion_pendiente ON gob.invitacion(hogar_id, correo) WHERE estado = 'pendiente';
CREATE INDEX ix_invitacion_correo ON gob.invitacion(correo) WHERE estado = 'pendiente';

ALTER TABLE gob.invitacion ENABLE ROW LEVEL SECURITY;
ALTER TABLE gob.invitacion FORCE ROW LEVEL SECURITY;
CREATE POLICY p_hogar ON gob.invitacion FOR ALL
  USING (hogar_id = app.hogar_actual()) WITH CHECK (hogar_id = app.hogar_actual());
CREATE POLICY r_admin_invitacion ON gob.invitacion AS RESTRICTIVE FOR ALL TO compas_app
  USING (app.es_admin()) WITH CHECK (app.es_admin());
GRANT SELECT ON gob.invitacion TO compas_app;           -- escritura solo por RPC
GRANT SELECT, UPDATE ON gob.invitacion TO compas_sistema;

-- Los menores se registran solo con app.registrar_menor, que exige su consentimiento (R25)
CREATE POLICY r_menor_via_rpc ON gob.integrante AS RESTRICTIVE FOR INSERT TO compas_app
  WITH CHECK (rol <> 'MEN');

-- El Acuerdo lo firma otro administrador, no quien lo propuso (E1)
CREATE POLICY r_firma_acuerdo_ajena ON gob.firma AS RESTRICTIVE FOR INSERT TO compas_app
  WITH CHECK (NOT EXISTS (SELECT 1 FROM gob.solicitud_aprobacion s
                           WHERE s.id = solicitud_id AND s.tipo = 'acuerdo' AND s.solicitada_por = integrante_id));

-- ---------------------------------------------------------------------
-- Funciones internas (sin EXECUTE para la app)
CREATE FUNCTION app.emitir_evento(p_hogar uuid, p_tipo text, p_actor uuid, p_carga jsonb) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = pg_catalog, sys AS $$
  INSERT INTO sys.evento_dominio(hogar_id, tipo, actor_tipo, actor_id, carga, correlacion_id)
  VALUES (p_hogar, p_tipo, 'humano', p_actor, p_carga, gen_random_uuid())
$$;

CREATE FUNCTION app.poner_vigente(p_acuerdo uuid, p_actor uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, app, gob AS $$
DECLARE v gob.acuerdo_hogar;
BEGIN
  SELECT * INTO v FROM gob.acuerdo_hogar WHERE id = p_acuerdo FOR UPDATE;
  UPDATE gob.acuerdo_hogar SET estado = 'reemplazado' WHERE hogar_id = v.hogar_id AND estado = 'vigente';
  UPDATE gob.acuerdo_hogar SET estado = 'vigente' WHERE id = p_acuerdo;
  PERFORM app.emitir_evento(v.hogar_id, 'AcuerdoVersionado', p_actor,
                            jsonb_build_object('acuerdo_id', v.id, 'version', v.version, 'urgente', v.urgente));
END $$;

CREATE FUNCTION app.exigir_admin() RETURNS void
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, app AS $$
BEGIN
  IF app.jwt_sub() IS NULL AND current_setting('app.integrante_id', true) IS NULL THEN
    RAISE EXCEPTION 'Necesitas iniciar sesión' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF NOT app.es_admin() THEN
    RAISE EXCEPTION 'Solo los administradores del hogar (ORG o CAD) pueden hacer esto' USING ERRCODE = 'insufficient_privilege';
  END IF;
END $$;

-- ---------------------------------------------------------------------
-- RPC de alta

CREATE FUNCTION app.crear_hogar(p_nombre_hogar text, p_nombre text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, app, gob AS $$
DECLARE v_sub uuid := app.jwt_sub(); v_hogar uuid; v_org uuid;
BEGIN
  IF v_sub IS NULL THEN
    RAISE EXCEPTION 'Necesitas iniciar sesión' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF EXISTS (SELECT 1 FROM app.membresia WHERE usuario_auth_id = v_sub AND activo) THEN
    RAISE EXCEPTION 'Ya perteneces a un hogar' USING ERRCODE = 'unique_violation';
  END IF;
  IF btrim(coalesce(p_nombre_hogar, '')) = '' OR btrim(coalesce(p_nombre, '')) = '' THEN
    RAISE EXCEPTION 'Falta el nombre del hogar o el tuyo' USING ERRCODE = 'check_violation';
  END IF;
  INSERT INTO gob.hogar(nombre) VALUES (btrim(p_nombre_hogar)) RETURNING id INTO v_hogar;
  INSERT INTO gob.integrante(hogar_id, usuario_auth_id, nombre, rol)
  VALUES (v_hogar, v_sub, btrim(p_nombre), 'ORG') RETURNING id INTO v_org;
  PERFORM app.emitir_evento(v_hogar, 'HogarCreado', v_org, jsonb_build_object('hogar_id', v_hogar));
  RETURN v_hogar;
END $$;

CREATE FUNCTION app.invitar_integrante(p_correo text, p_nombre text, p_rol gob.rol_integrante) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, app, gob AS $$
DECLARE v_hogar uuid; v_correo text := lower(btrim(coalesce(p_correo, ''))); v_org uuid; v_integrante uuid; v_id uuid;
BEGIN
  PERFORM app.exigir_admin();
  v_hogar := app.hogar_actual();
  IF p_rol NOT IN ('CAD','ING') THEN
    RAISE EXCEPTION 'Solo se invita a adultos (CAD o ING); los hijos se registran sin cuenta (D26)'
      USING ERRCODE = 'check_violation';
  END IF;
  IF btrim(coalesce(p_nombre, '')) = '' THEN
    RAISE EXCEPTION 'Falta el nombre de la persona invitada' USING ERRCODE = 'check_violation';
  END IF;
  IF p_rol = 'CAD' AND EXISTS (SELECT 1 FROM gob.integrante WHERE hogar_id = v_hogar AND rol = 'CAD' AND activo) THEN
    RAISE EXCEPTION 'El hogar ya tiene co-administrador' USING ERRCODE = 'unique_violation';
  END IF;
  SELECT id INTO v_org FROM gob.integrante WHERE hogar_id = v_hogar AND rol = 'ORG' AND activo ORDER BY creado_en LIMIT 1;
  INSERT INTO gob.integrante(hogar_id, nombre, rol, suplente_de_id)
  VALUES (v_hogar, btrim(p_nombre), p_rol, CASE WHEN p_rol = 'CAD' THEN v_org END)   -- R39: el CAD suple al ORG
  RETURNING id INTO v_integrante;
  INSERT INTO gob.invitacion(hogar_id, integrante_id, correo, rol, creado_por)
  VALUES (v_hogar, v_integrante, v_correo, p_rol, app.integrante_actual()) RETURNING id INTO v_id;
  RETURN v_id;
END $$;

CREATE FUNCTION app.aceptar_invitacion() RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, app, gob AS $$
DECLARE
  v_sub uuid := app.jwt_sub();
  v_correo text := lower(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'email');
  v_inv gob.invitacion;
BEGIN
  IF v_sub IS NULL THEN
    RAISE EXCEPTION 'Necesitas iniciar sesión' USING ERRCODE = 'insufficient_privilege';
  END IF;
  SELECT * INTO v_inv FROM gob.invitacion
   WHERE correo = v_correo AND estado = 'pendiente' AND vence_en > now()
   ORDER BY creado_en DESC LIMIT 1 FOR UPDATE;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;
  UPDATE gob.integrante SET usuario_auth_id = v_sub WHERE id = v_inv.integrante_id;
  UPDATE gob.invitacion SET estado = 'aceptada', aceptada_en = now() WHERE id = v_inv.id;
  RETURN v_inv.integrante_id;
END $$;

CREATE FUNCTION app.registrar_menor(p_nombre text, p_version_consentimiento text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, app, gob AS $$
DECLARE v_hogar uuid; v_id uuid;
BEGIN
  PERFORM app.exigir_admin();
  IF btrim(coalesce(p_version_consentimiento, '')) = '' THEN
    RAISE EXCEPTION 'Para registrar a un menor se necesita el consentimiento datos_menor (R25)'
      USING ERRCODE = 'check_violation';
  END IF;
  IF btrim(coalesce(p_nombre, '')) = '' THEN
    RAISE EXCEPTION 'Falta el nombre o apodo' USING ERRCODE = 'check_violation';
  END IF;
  v_hogar := app.hogar_actual();
  INSERT INTO gob.integrante(hogar_id, nombre, rol, es_menor)
  VALUES (v_hogar, btrim(p_nombre), 'MEN', true) RETURNING id INTO v_id;
  INSERT INTO gob.consentimiento(hogar_id, titular_id, otorgado_por_id, finalidad, version_texto)
  VALUES (v_hogar, v_id, app.integrante_actual(), 'datos_menor', btrim(p_version_consentimiento));
  RETURN v_id;
END $$;

CREATE FUNCTION app.crear_periodo(p_mes date) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, app, plan AS $$
DECLARE v_hogar uuid; v_mes date := date_trunc('month', p_mes)::date; v_periodo uuid;
BEGIN
  PERFORM app.exigir_admin();
  v_hogar := app.hogar_actual();
  INSERT INTO plan.periodo(hogar_id, mes) VALUES (v_hogar, v_mes) ON CONFLICT (hogar_id, mes) DO NOTHING;
  SELECT id INTO v_periodo FROM plan.periodo WHERE hogar_id = v_hogar AND mes = v_mes;
  INSERT INTO plan.sobre(hogar_id, periodo_id, tipo) VALUES (v_hogar, v_periodo, 'por_asignar')
  ON CONFLICT (periodo_id, tipo) WHERE tipo IN ('por_asignar','proximo_mes') DO NOTHING;
  RETURN v_periodo;
END $$;

-- p_reglas: [{codigo, valor, regla_codigo}] (parametrosAFilas() de @compas/dominio)
CREATE FUNCTION app.proponer_acuerdo(p_reglas jsonb, p_urgente boolean) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, app, gob AS $$
DECLARE
  v_hogar uuid; v_yo uuid; v_aprobador uuid; v_version int; v_desde date; v_plazo int; v_acuerdo uuid;
BEGIN
  PERFORM app.exigir_admin();
  v_hogar := app.hogar_actual();
  v_yo := app.integrante_actual();
  IF jsonb_typeof(p_reglas) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Los parámetros del Acuerdo deben ser una lista' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF EXISTS (SELECT 1 FROM gob.acuerdo_hogar WHERE hogar_id = v_hogar AND estado = 'borrador') THEN
    RAISE EXCEPTION 'Ya hay un Acuerdo propuesto esperando firma' USING ERRCODE = 'unique_violation';
  END IF;
  SELECT id INTO v_aprobador FROM gob.integrante
   WHERE hogar_id = v_hogar AND rol IN ('ORG','CAD') AND activo AND id <> v_yo ORDER BY rol LIMIT 1;
  IF v_aprobador IS NULL AND NOT coalesce(p_urgente, false) THEN
    RAISE EXCEPTION 'Falta otro administrador que firme; puedes activar el Acuerdo de inmediato'
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT coalesce(max(version), 0) + 1 INTO v_version FROM gob.acuerdo_hogar WHERE hogar_id = v_hogar;
  IF v_version = 1 THEN   -- v1 rige desde el inicio del piloto (D21)
    SELECT (r ->> 'valor')::date INTO v_desde FROM jsonb_array_elements(p_reglas) r WHERE r ->> 'codigo' = 'inicio_piloto';
  END IF;
  v_desde := coalesce(v_desde, (now() AT TIME ZONE 'America/Santiago')::date);
  SELECT (r ->> 'valor')::int INTO v_plazo FROM jsonb_array_elements(p_reglas) r WHERE r ->> 'codigo' = 'plazo_suplencia_h';

  INSERT INTO gob.acuerdo_hogar(hogar_id, version, estado, vigencia_desde, urgente, creado_por)
  VALUES (v_hogar, v_version, 'borrador', v_desde, coalesce(p_urgente, false), v_yo) RETURNING id INTO v_acuerdo;
  INSERT INTO gob.regla_hogar(acuerdo_id, codigo, valor, regla_codigo)
  SELECT v_acuerdo, r.codigo, r.valor, r.regla_codigo
    FROM jsonb_to_recordset(p_reglas) AS r(codigo text, valor jsonb, regla_codigo text);

  IF v_aprobador IS NOT NULL THEN
    INSERT INTO gob.solicitud_aprobacion(hogar_id, tipo, objeto_tabla, objeto_id, firmas_requeridas,
                                         aprobador_id, solicitada_por, vence_en)
    VALUES (v_hogar, 'acuerdo', 'gob.acuerdo_hogar', v_acuerdo, 1, v_aprobador, v_yo,
            now() + make_interval(hours => coalesce(v_plazo, 48)));
  END IF;
  IF coalesce(p_urgente, false) THEN   -- vigencia inmediata; la firma queda pendiente
    PERFORM app.poner_vigente(v_acuerdo, v_yo);
  END IF;
  RETURN v_acuerdo;
END $$;

CREATE FUNCTION app.activar_acuerdo(p_acuerdo uuid) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, app, gob AS $$
DECLARE v gob.acuerdo_hogar;
BEGIN
  PERFORM app.exigir_admin();
  SELECT * INTO v FROM gob.acuerdo_hogar WHERE id = p_acuerdo AND hogar_id = app.hogar_actual() FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No encontramos ese Acuerdo en tu hogar' USING ERRCODE = 'no_data_found';
  END IF;
  IF v.estado = 'vigente' THEN
    RETURN v.id;
  END IF;
  IF v.estado <> 'borrador' THEN
    RAISE EXCEPTION 'Ese Acuerdo ya fue reemplazado' USING ERRCODE = 'check_violation';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM gob.solicitud_aprobacion
                  WHERE objeto_id = v.id AND tipo = 'acuerdo' AND estado IN ('aprobada','autoaprobada')) THEN
    RAISE EXCEPTION 'El Acuerdo necesita la firma del otro administrador' USING ERRCODE = 'check_violation';
  END IF;
  PERFORM app.poner_vigente(v.id, app.integrante_actual());
  RETURN v.id;
END $$;

-- Permisos: solo la app autenticada llama a las RPC; las internas no se exponen
REVOKE EXECUTE ON FUNCTION app.emitir_evento(uuid, text, uuid, jsonb), app.poner_vigente(uuid, uuid),
  app.exigir_admin(), app.crear_hogar(text, text), app.invitar_integrante(text, text, gob.rol_integrante),
  app.aceptar_invitacion(), app.registrar_menor(text, text), app.crear_periodo(date),
  app.proponer_acuerdo(jsonb, boolean), app.activar_acuerdo(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.crear_hogar(text, text), app.invitar_integrante(text, text, gob.rol_integrante),
  app.aceptar_invitacion(), app.registrar_menor(text, text), app.crear_periodo(date),
  app.proponer_acuerdo(jsonb, boolean), app.activar_acuerdo(uuid) TO compas_app;

COMMIT;
