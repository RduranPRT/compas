-- =====================================================================
-- Compás — migración 0003: identidad con Supabase Auth (ADR-09)
-- Fecha: 12-10-2026
-- Problema: 0001 obtiene hogar e integrante desde variables de sesión
--   (app.hogar_id, app.integrante_id) que fija el backend. Con Supabase,
--   la app llama a PostgREST con un JWT y no puede fijar esas variables.
-- Solución:
--   * app.membresia: espejo sin RLS de gob.integrante (rol, hogar, usuario),
--     mantenido por trigger. Evita recursión de RLS al resolver el rol.
--   * app.hogar_actual() / app.integrante_actual() leen primero el JWT
--     (claim "sub" y, si hay varios hogares, el encabezado x-hogar-id);
--     si no hay JWT, usan las variables de sesión (jobs del sistema y tests).
--   * El rol "authenticated" de Supabase hereda los permisos de compas_app.
-- =====================================================================
BEGIN;

CREATE TABLE app.membresia (
  integrante_id    uuid PRIMARY KEY REFERENCES gob.integrante(id) ON DELETE CASCADE,
  hogar_id         uuid NOT NULL REFERENCES gob.hogar(id),
  usuario_auth_id  uuid,
  rol              gob.rol_integrante NOT NULL,
  activo           boolean NOT NULL,
  acceso_vence_en  timestamptz
);
CREATE INDEX ix_membresia_usuario ON app.membresia(usuario_auth_id) WHERE usuario_auth_id IS NOT NULL;
REVOKE ALL ON app.membresia FROM PUBLIC;

INSERT INTO app.membresia(integrante_id, hogar_id, usuario_auth_id, rol, activo, acceso_vence_en)
SELECT id, hogar_id, usuario_auth_id, rol, activo, acceso_vence_en FROM gob.integrante
ON CONFLICT (integrante_id) DO NOTHING;

CREATE OR REPLACE FUNCTION app.sincronizar_membresia() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, app, gob AS $$
BEGIN
  INSERT INTO app.membresia(integrante_id, hogar_id, usuario_auth_id, rol, activo, acceso_vence_en)
  VALUES (NEW.id, NEW.hogar_id, NEW.usuario_auth_id, NEW.rol, NEW.activo, NEW.acceso_vence_en)
  ON CONFLICT (integrante_id) DO UPDATE
     SET hogar_id = EXCLUDED.hogar_id, usuario_auth_id = EXCLUDED.usuario_auth_id, rol = EXCLUDED.rol,
         activo = EXCLUDED.activo, acceso_vence_en = EXCLUDED.acceso_vence_en;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_integrante_membresia AFTER INSERT OR UPDATE ON gob.integrante
  FOR EACH ROW EXECUTE FUNCTION app.sincronizar_membresia();

-- Claims del JWT que PostgREST deja en la sesión
CREATE OR REPLACE FUNCTION app.jwt_sub() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT nullif(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub', '')::uuid
$$;

CREATE OR REPLACE FUNCTION app.hogar_solicitado() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT nullif(nullif(current_setting('request.headers', true), '')::jsonb ->> 'x-hogar-id', '')::uuid
$$;

-- Hogar de la sesión: JWT (validado contra la membresía) o variable de sesión
CREATE OR REPLACE FUNCTION app.hogar_actual() RETURNS uuid
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, app AS $$
DECLARE v_sub uuid := app.jwt_sub(); v_pedido uuid; v_hogar uuid;
BEGIN
  IF v_sub IS NULL THEN
    RETURN nullif(current_setting('app.hogar_id', true), '')::uuid;
  END IF;
  v_pedido := app.hogar_solicitado();
  SELECT m.hogar_id INTO v_hogar FROM app.membresia m
   WHERE m.usuario_auth_id = v_sub AND m.activo
     AND (m.acceso_vence_en IS NULL OR m.acceso_vence_en > now())
     AND (v_pedido IS NULL OR m.hogar_id = v_pedido)
   ORDER BY m.hogar_id LIMIT 1;
  RETURN v_hogar;   -- nulo si el usuario no pertenece al hogar pedido: RLS no devuelve filas
END $$;

CREATE OR REPLACE FUNCTION app.integrante_actual() RETURNS uuid
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, app AS $$
DECLARE v_sub uuid := app.jwt_sub(); v_id uuid;
BEGIN
  IF v_sub IS NULL THEN
    RETURN nullif(current_setting('app.integrante_id', true), '')::uuid;
  END IF;
  SELECT m.integrante_id INTO v_id FROM app.membresia m
   WHERE m.usuario_auth_id = v_sub AND m.hogar_id = app.hogar_actual() AND m.activo;
  RETURN v_id;
END $$;

-- El rol se resuelve desde la membresía (sin pasar por la RLS de gob.integrante)
CREATE OR REPLACE FUNCTION app.rol_actual() RETURNS gob.rol_integrante
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, app, gob AS $$
  SELECT m.rol FROM app.membresia m
   WHERE m.integrante_id = app.integrante_actual() AND m.hogar_id = app.hogar_actual() AND m.activo
     AND (m.acceso_vence_en IS NULL OR m.acceso_vence_en > now())
$$;

-- Rol de Supabase para usuarios autenticados (se crea si no existe, p. ej. en CI)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')          THEN CREATE ROLE anon NOLOGIN; END IF;
END $$;
GRANT compas_app TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA app TO compas_app, compas_ia, compas_sistema;
REVOKE ALL ON ALL TABLES IN SCHEMA gob, fin, plan, med, ia, sys FROM anon;

COMMIT;
