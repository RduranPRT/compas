-- Pruebas de la migración 0015: privacidad, derechos y retención (spec 011)
\set ON_ERROR_STOP 0
\set QUIET 1
\set filas '[{"codigo":"inicio_piloto","valor":"2026-10-01","regla_codigo":"R41"},{"codigo":"mes_primer_plan","valor":"2026-11-01","regla_codigo":null}]'
\set rodrigo '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","email":"rodrigo@ejemplo.cl","role":"authenticated"}'
\set ana '{"sub":"aaaaaaaa-0000-0000-0000-000000000002","email":"ana@ejemplo.cl","role":"authenticated"}'
\set otra '{"sub":"cccccccc-0000-0000-0000-000000000001","email":"otra@ejemplo.cl","role":"authenticated"}'
SET ROLE authenticated;
-- Otro hogar que no debe verse afectado
SELECT set_config('request.jwt.claims', :'otra', false) \g /dev/null
SELECT app.crear_hogar('Hogar Otra', 'Otra') \g /dev/null
SELECT app.proponer_acuerdo(:'filas'::jsonb, true) \g /dev/null
SELECT app.aplicar_plantilla_categorias() \g /dev/null
-- Hogar completo con datos en casi todas las tablas
SELECT set_config('request.jwt.claims', :'rodrigo', false) \g /dev/null
SELECT app.crear_hogar('Durán Damann', 'Rodrigo') \g /dev/null
SELECT app.invitar_integrante('ana@ejemplo.cl', 'Ana', 'CAD') \g /dev/null
SELECT app.registrar_menor('Hijo 1', 'v1') \g /dev/null
SELECT set_config('request.jwt.claims', :'ana', false) \g /dev/null
SELECT app.aceptar_invitacion() \g /dev/null
INSERT INTO gob.consentimiento(hogar_id, titular_id, otorgado_por_id, finalidad, version_texto)
SELECT hogar_id, id, id, f, 'v1' FROM gob.integrante, unnest(ARRAY['uso_app','analitica_ia']::gob.finalidad_consent[]) f WHERE nombre = 'Ana';
SELECT set_config('request.jwt.claims', :'rodrigo', false) \g /dev/null
SELECT app.proponer_acuerdo(:'filas'::jsonb, true) \g /dev/null
SELECT app.aplicar_plantilla_categorias() \g /dev/null
INSERT INTO fin.cuenta(hogar_id, nombre, tipo, dia_facturacion, dia_pago) SELECT id, 'Visa', 'tarjeta_credito', 25, 5 FROM gob.hogar WHERE nombre = 'Durán Damann';
INSERT INTO fin.cuenta(hogar_id, nombre, tipo, saldo_inicial) SELECT id, 'Cuenta corriente', 'vista', 850000 FROM gob.hogar WHERE nombre = 'Durán Damann';
SELECT app.asegurar_mes('2026-11-01') \g /dev/null
\set cc '(SELECT id FROM fin.cuenta WHERE nombre = ''Cuenta corriente'')'
\set visa '(SELECT id FROM fin.cuenta WHERE nombre = ''Visa'')'
SELECT app.registrar_ingreso(NULL, :cc, 1000000, '2026-11-01', (SELECT id FROM gob.integrante WHERE rol = 'ORG')) \g /dev/null
SELECT app.confirmar_distribucion((SELECT ingreso_id FROM plan.v_ingreso_por_repartir), jsonb_build_array(
  jsonb_build_object('sobre_id', (SELECT id FROM plan.v_sobre WHERE nombre = 'Ocio y salidas'), 'monto', 10000),
  jsonb_build_object('sobre_id', (SELECT id FROM plan.v_sobre WHERE nombre = 'Sin culpa Rodrigo'), 'monto', 20000))) \g /dev/null
SELECT app.registrar_gasto(NULL, :visa, (SELECT id FROM plan.v_sobre WHERE nombre = 'Ocio y salidas'), 30000, '2026-11-03', NULL, NULL, NULL, 3) \g /dev/null
SELECT app.registrar_pago_tarjeta(NULL, :cc, :visa, 10000, '2026-11-05') \g /dev/null
SELECT app.importar_cartola(:cc, 'c.xlsx', 'xlsx', 'sha1', 'mapeo',
  '[{"fecha":"2026-09-10","monto":-5000,"glosa":"JUMBO","comercio":"JUMBO","clase":"gasto","hash":"x1"}]') \g /dev/null
SELECT app.guardar_perfil('2026-09-01', '2026-09-30', '{}', '[{"titulo":"t","explicacion":"e","regla_codigo":"R06"}]', 'E1') \g /dev/null
SELECT app.cerrar_semana('2026-11-08', jsonb_build_array(jsonb_build_object('cuenta_id', :cc, 'saldo_real', 0, 'motivo', 'prueba'))) \g /dev/null

\echo '== C1 revocar analitica_ia: queda revocado y la app sigue en modo manual'
SELECT set_config('request.jwt.claims', :'ana', false) \g /dev/null
SELECT app.revocar_consentimiento('analitica_ia') AS revocados;
SELECT app.consentimiento_vigente(app.integrante_actual(), 'analitica_ia') AS ia, app.consentimiento_vigente(app.integrante_actual(), 'uso_app') AS app;

\echo '== C2 revocar datos_menor desactiva al hijo (R25); una adulta no revoca por otro adulto (debe FALLAR)'
SELECT app.revocar_consentimiento('datos_menor', (SELECT id FROM gob.integrante WHERE es_menor)) AS revocados;
SELECT nombre, activo FROM gob.integrante WHERE es_menor;
SELECT app.revocar_consentimiento('uso_app', (SELECT id FROM gob.integrante WHERE rol = 'ORG'));

\echo '== E1 exportación registrada como derecho cumplido'
SELECT app.registrar_exportacion() IS NOT NULL AS registrada;
SELECT tipo, estado FROM gob.solicitud_derecho;

\echo '== B1 borrado del hogar: con una firma queda pendiente; con ambas, el hogar queda programado'
SELECT set_config('request.jwt.claims', :'rodrigo', false) \g /dev/null
SELECT app.resolver_solicitud(app.solicitar_borrado_hogar(), true) AS tras_rodrigo;
SELECT eliminado_en IS NULL AS sin_programar FROM gob.hogar;
SELECT set_config('request.jwt.claims', :'ana', false) \g /dev/null
SELECT app.resolver_solicitud((SELECT id FROM gob.solicitud_aprobacion WHERE tipo = 'borrado_hogar'), true) AS tras_ana;
SELECT eliminado_en IS NOT NULL AS programado FROM gob.hogar;

\echo '== B2 antes de 30 días no se purga (debe FALLAR) y el libro sigue inmutable (debe FALLAR)'
RESET ROLE;
SELECT app.purgar_hogar((SELECT id FROM gob.hogar WHERE nombre = 'Durán Damann'));
SELECT set_config('app.purga_hogar', (SELECT id::text FROM gob.hogar WHERE nombre = 'Durán Damann'), false) \g /dev/null
DELETE FROM plan.libro_sobre;
SELECT set_config('app.purga_hogar', '', false) \g /dev/null

\echo '== B3 a los 30 días se borran todos sus datos; el otro hogar queda intacto (D19)'
UPDATE gob.hogar SET eliminado_en = now() - interval '31 days' WHERE nombre = 'Durán Damann';
SELECT app.purgar_hogares() AS purgados;
SELECT nombre FROM gob.hogar;
SELECT t.tabla, t.filas FROM (
  SELECT 'gob.integrante' AS tabla, count(*) AS filas FROM gob.integrante
  UNION ALL SELECT 'plan.categoria', count(*) FROM plan.categoria
  UNION ALL SELECT 'plan.sobre', count(*) FROM plan.sobre
  UNION ALL SELECT 'plan.libro_sobre', count(*) FROM plan.libro_sobre
  UNION ALL SELECT 'fin.movimiento', count(*) FROM fin.movimiento
  UNION ALL SELECT 'fin.cuenta', count(*) FROM fin.cuenta
  UNION ALL SELECT 'sys.evento_dominio', count(*) FROM sys.evento_dominio
  UNION ALL SELECT 'app.membresia', count(*) FROM app.membresia) t ORDER BY t.tabla;
