-- =====================================================================
-- Compás — migración 0004: seguridad verificada en Supabase (T005, spec 001)
-- Fecha: 24-10-2026
-- Hallazgos al correr db/run_tests.sh contra `supabase start`:
--   1. En Supabase `postgres` no es superusuario. Desde PG16 quien crea un rol
--      recibe ADMIN pero no SET sobre él: SET ROLE compas_ia/compas_app falla.
--      (Tiene BYPASSRLS, así que las funciones SECURITY DEFINER sí ignoran la RLS.)
--   2. 0001 habilitó RLS solo en tablas con hogar_id. Cinco tablas hijas quedaron
--      legibles y escribibles por cualquier usuario de cualquier hogar:
--      gob.regla_hogar, gob.firma, plan.linea_plan, fin.ingreso, fin.cuota_deuda.
--   3. compas_app puede insertar y actualizar gob.integrante sin restricción de rol:
--      un ING podía cambiarse a ORG. Consentimientos: cualquiera podía otorgar el de otro.
-- =====================================================================
BEGIN;

-- 1. El dueño de la base puede asumir los roles de Compás (pruebas y tareas de mantención)
GRANT compas_app, compas_ia, compas_sistema TO CURRENT_USER WITH SET TRUE;

-- 2. Aislamiento por hogar en tablas hijas, a través de su tabla padre
ALTER TABLE gob.regla_hogar ENABLE ROW LEVEL SECURITY;
ALTER TABLE gob.regla_hogar FORCE ROW LEVEL SECURITY;
CREATE POLICY p_hogar ON gob.regla_hogar FOR ALL
  USING (EXISTS (SELECT 1 FROM gob.acuerdo_hogar a WHERE a.id = acuerdo_id AND a.hogar_id = app.hogar_actual()))
  WITH CHECK (EXISTS (SELECT 1 FROM gob.acuerdo_hogar a WHERE a.id = acuerdo_id AND a.hogar_id = app.hogar_actual()));

ALTER TABLE gob.firma ENABLE ROW LEVEL SECURITY;
ALTER TABLE gob.firma FORCE ROW LEVEL SECURITY;
CREATE POLICY p_hogar ON gob.firma FOR ALL
  USING (EXISTS (SELECT 1 FROM gob.solicitud_aprobacion s WHERE s.id = solicitud_id AND s.hogar_id = app.hogar_actual()))
  WITH CHECK (EXISTS (SELECT 1 FROM gob.solicitud_aprobacion s WHERE s.id = solicitud_id AND s.hogar_id = app.hogar_actual()));

ALTER TABLE plan.linea_plan ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan.linea_plan FORCE ROW LEVEL SECURITY;
CREATE POLICY p_hogar ON plan.linea_plan FOR ALL
  USING (EXISTS (SELECT 1 FROM plan.presupuesto_mensual p WHERE p.id = presupuesto_id AND p.hogar_id = app.hogar_actual()))
  WITH CHECK (EXISTS (SELECT 1 FROM plan.presupuesto_mensual p WHERE p.id = presupuesto_id AND p.hogar_id = app.hogar_actual()));

ALTER TABLE fin.ingreso ENABLE ROW LEVEL SECURITY;
ALTER TABLE fin.ingreso FORCE ROW LEVEL SECURITY;
CREATE POLICY p_hogar ON fin.ingreso FOR ALL
  USING (EXISTS (SELECT 1 FROM fin.movimiento m WHERE m.id = movimiento_id AND m.hogar_id = app.hogar_actual()))
  WITH CHECK (EXISTS (SELECT 1 FROM fin.movimiento m WHERE m.id = movimiento_id AND m.hogar_id = app.hogar_actual()));

ALTER TABLE fin.cuota_deuda ENABLE ROW LEVEL SECURITY;
ALTER TABLE fin.cuota_deuda FORCE ROW LEVEL SECURITY;
CREATE POLICY p_hogar ON fin.cuota_deuda FOR ALL
  USING (EXISTS (SELECT 1 FROM fin.deuda d WHERE d.id = deuda_id AND d.hogar_id = app.hogar_actual()))
  WITH CHECK (EXISTS (SELECT 1 FROM fin.deuda d WHERE d.id = deuda_id AND d.hogar_id = app.hogar_actual()));

-- Parámetros del Acuerdo: solo administradores y solo en un borrador (cambiar = nueva versión, E1)
CREATE POLICY r_admin_regla ON gob.regla_hogar AS RESTRICTIVE FOR INSERT TO compas_app
  WITH CHECK (app.es_admin() AND EXISTS (SELECT 1 FROM gob.acuerdo_hogar a WHERE a.id = acuerdo_id AND a.estado = 'borrador'));
CREATE POLICY r_admin_regla_upd ON gob.regla_hogar AS RESTRICTIVE FOR UPDATE TO compas_app
  USING (app.es_admin() AND EXISTS (SELECT 1 FROM gob.acuerdo_hogar a WHERE a.id = acuerdo_id AND a.estado = 'borrador'));

-- 3. Integrantes: solo administradores los agregan o modifican (R25, R39)
CREATE POLICY r_admin_integrante_ins ON gob.integrante AS RESTRICTIVE FOR INSERT TO compas_app
  WITH CHECK (app.es_admin());
CREATE POLICY r_admin_integrante_upd ON gob.integrante AS RESTRICTIVE FOR UPDATE TO compas_app
  USING (app.es_admin());

-- Consentimientos: cada adulto otorga o revoca el suyo; un administrador, el de un menor (R25, S5)
CREATE OR REPLACE FUNCTION app.puede_consentir_por(p_titular uuid, p_otorgante uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, app, gob AS $$
  SELECT p_otorgante = app.integrante_actual()
     AND (p_titular = p_otorgante
          OR (app.es_admin() AND EXISTS (SELECT 1 FROM gob.integrante i
                                          WHERE i.id = p_titular AND i.es_menor AND i.hogar_id = app.hogar_actual())))
$$;
GRANT EXECUTE ON FUNCTION app.puede_consentir_por(uuid, uuid) TO compas_app, compas_ia, compas_sistema;
CREATE POLICY r_consentimiento_ins ON gob.consentimiento AS RESTRICTIVE FOR INSERT TO compas_app
  WITH CHECK (app.puede_consentir_por(titular_id, otorgado_por_id));
CREATE POLICY r_consentimiento_upd ON gob.consentimiento AS RESTRICTIVE FOR UPDATE TO compas_app
  USING (titular_id = app.integrante_actual() OR app.puede_consentir_por(titular_id, app.integrante_actual()));

COMMIT;
