-- Pruebas de la migración 0009: perfil inicial, etapa y aprobaciones (spec 004)
\set ON_ERROR_STOP 0
\set QUIET 1
\set filas '[{"codigo":"inicio_piloto","valor":"2026-10-01","regla_codigo":"R41"},{"codigo":"plazo_suplencia_h","valor":48,"regla_codigo":"R39"}]'
\set rodrigo '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","email":"rodrigo@ejemplo.cl","role":"authenticated"}'
\set ana '{"sub":"aaaaaaaa-0000-0000-0000-000000000002","email":"ana@ejemplo.cl","role":"authenticated"}'
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', :'rodrigo', false) \g /dev/null
SELECT app.crear_hogar('Durán Damann', 'Rodrigo') \g /dev/null
SELECT app.invitar_integrante('ana@ejemplo.cl', 'Ana', 'CAD') \g /dev/null
SELECT set_config('request.jwt.claims', :'ana', false) \g /dev/null
SELECT app.aceptar_invitacion() \g /dev/null
SELECT set_config('request.jwt.claims', :'rodrigo', false) \g /dev/null
SELECT app.proponer_acuerdo(:'filas'::jsonb, false) \g /dev/null

\echo '== A1 la CAD firma el Acuerdo por la bandeja única y queda vigente (E1)'
SELECT set_config('request.jwt.claims', :'ana', false) \g /dev/null
SELECT app.resolver_solicitud((SELECT id FROM gob.solicitud_aprobacion WHERE tipo = 'acuerdo'), true) AS estado;
SELECT version, estado FROM gob.acuerdo_hogar;

\echo '== A2 quien propuso el Acuerdo no lo firma (debe FALLAR)'
SELECT set_config('request.jwt.claims', :'rodrigo', false) \g /dev/null
SELECT app.proponer_acuerdo(:'filas'::jsonb, false) \g /dev/null
SELECT app.resolver_solicitud((SELECT id FROM gob.solicitud_aprobacion WHERE tipo = 'acuerdo' AND estado = 'pendiente'), true);

\echo '== P1 generar el perfil: versión 1 presentada, hallazgos con regla como recomendaciones (P8)'
SELECT app.guardar_perfil('2026-07-01', '2026-09-30',
  '{"ingreso_base":2400000,"ingreso_variable":200000,"k4":58}',
  '[{"titulo":"Esenciales sobre el 50 %","explicacion":"Los esenciales son 58 % del ingreso.","cifra":"58 %","regla_codigo":"R06","fuente_codigo":"WARREN","accion":"Revisa los fijos"},{"titulo":"Sin regla","explicacion":"x","regla_codigo":"P8"}]',
  'E1', 'reglas') IS NOT NULL AS guardado;
SELECT version, estado, etapa_sugerida, perfil->>'ingreso_base' AS base FROM med.perfil_inicial;
SELECT tipo, titulo, regla_codigo, fuente_codigo, estado FROM ia.recomendacion;

\echo '== P2 otra versión deja la anterior descartada'
SELECT app.guardar_perfil('2026-07-01', '2026-09-30', '{}', '[]', 'E1') \g /dev/null
SELECT version, estado FROM med.perfil_inicial ORDER BY version;

\echo '== E1 etapa sugerida E1: requiere a ambos administradores (R23)'
SELECT app.proponer_etapa('E1', '{"k2":0.4}') IS NOT NULL AS propuesta;
SELECT h.etapa_codigo, h.direccion, h.estado, s.firmas_requeridas FROM gob.historial_etapa h JOIN gob.solicitud_aprobacion s ON s.id = h.solicitud_id;
SELECT app.resolver_solicitud((SELECT solicitud_id FROM gob.historial_etapa WHERE estado = 'propuesta'), true) AS tras_rodrigo;
SELECT etapa_codigo AS etapa_hogar FROM gob.hogar;
SELECT set_config('request.jwt.claims', :'ana', false) \g /dev/null
SELECT app.resolver_solicitud((SELECT solicitud_id FROM gob.historial_etapa WHERE estado = 'propuesta'), true) AS tras_ana;
SELECT h.etapa_codigo, h.estado, g.etapa_codigo AS etapa_hogar FROM gob.historial_etapa h JOIN gob.hogar g ON g.id = h.hogar_id;
RESET ROLE;
SELECT tipo FROM sys.evento_dominio WHERE tipo LIKE 'Etapa%' ORDER BY ocurrido_en;
SET ROLE authenticated;

\echo '== E2 una propuesta rechazada no cambia la etapa'
SELECT app.proponer_etapa('E2', '{}') \g /dev/null
SELECT app.resolver_solicitud((SELECT solicitud_id FROM gob.historial_etapa WHERE estado = 'propuesta'), false) AS estado;
SELECT etapa_codigo, estado FROM gob.historial_etapa ORDER BY propuesta_en;
SELECT etapa_codigo AS etapa_hogar FROM gob.hogar;

\echo '== S1 aprobación de una sola firma: otro administrador solo firma como suplente pasado el plazo (R39)'
SELECT set_config('request.jwt.claims', :'rodrigo', false) \g /dev/null
RESET ROLE;
SELECT app.crear_solicitud('reasignacion', 'plan.reasignacion', gen_random_uuid(), 1, app.integrante_actual(), 'R38') \g /dev/null
SELECT set_config('request.jwt.claims', :'ana', false) \g /dev/null
SET ROLE authenticated;
SELECT app.resolver_solicitud((SELECT id FROM gob.solicitud_aprobacion WHERE tipo = 'reasignacion'), true);
RESET ROLE;
UPDATE gob.solicitud_aprobacion SET vence_en = now() - interval '1 hour' WHERE tipo = 'reasignacion';
SET ROLE authenticated;
SELECT app.resolver_solicitud((SELECT id FROM gob.solicitud_aprobacion WHERE tipo = 'reasignacion'), true) AS estado;
SELECT f.como_suplente FROM gob.firma f JOIN gob.solicitud_aprobacion s ON s.id = f.solicitud_id WHERE s.tipo = 'reasignacion';
