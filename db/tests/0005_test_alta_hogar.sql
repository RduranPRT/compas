-- Pruebas de la migración 0005: alta del hogar, integrantes, períodos y Acuerdo v1 (spec 001)
-- Simula PostgREST con request.jwt.claims (sub y email), como 0003. "debe FALLAR" = termina en ERROR.
\set ON_ERROR_STOP 0
\set QUIET 1
-- Parámetros por defecto del Acuerdo v1, generados con parametrosAFilas() de @compas/dominio
\set filas '[{"codigo":"inicio_piloto","valor":"2026-10-01","regla_codigo":"R41"},{"codigo":"mes_primer_plan","valor":"2026-12-01","regla_codigo":null},{"codigo":"dia_plan","valor":25,"regla_codigo":null},{"codigo":"dia_ingreso_mes_siguiente","valor":20,"regla_codigo":null},{"codigo":"umbral_ritmo","valor":1.1,"regla_codigo":"R09"},{"codigo":"umbral_ajuste_ingreso_pct","valor":5,"regla_codigo":"R33"},{"codigo":"autoaprobacion_n1_pct","valor":5,"regla_codigo":"R38"},{"codigo":"plazo_suplencia_h","valor":48,"regla_codigo":"R39"},{"codigo":"max_alertas_dia","valor":3,"regla_codigo":"R40"},{"codigo":"hora_resumen_diario","valor":"20:00","regla_codigo":null},{"codigo":"confianza_ia_min","valor":0.8,"regla_codigo":"R36"},{"codigo":"umbral_conciliacion_clp","valor":1000,"regla_codigo":"R34"},{"codigo":"holgura_fijos_pct","valor":15,"regla_codigo":"R08"},{"codigo":"pct_reajuste_a_futuro","valor":50,"regla_codigo":"R22"},{"codigo":"pct_variable_a_futuro","valor":50,"regla_codigo":"R45"},{"codigo":"pct_sin_culpa","valor":5,"regla_codigo":null},{"codigo":"modalidad_sin_culpa","valor":"igual","regla_codigo":null},{"codigo":"estrategia_deuda","valor":"avalancha","regla_codigo":"R21"},{"codigo":"dias_abandono","valor":14,"regla_codigo":null},{"codigo":"tratamiento_cuotas_default","valor":"por_cuota","regla_codigo":null},{"codigo":"dias_retencion_cartola","valor":30,"regla_codigo":"R43"}]'
\set rodrigo '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","email":"rodrigo@ejemplo.cl","role":"authenticated"}'
\set ana '{"sub":"aaaaaaaa-0000-0000-0000-000000000002","email":"Ana@Ejemplo.cl","role":"authenticated"}'
\set otra '{"sub":"cccccccc-0000-0000-0000-000000000001","email":"otra@ejemplo.cl","role":"authenticated"}'
SET ROLE authenticated;

\echo '== H1 crear el hogar: el usuario queda como ORG (spec: Crear el hogar)'
SELECT set_config('request.jwt.claims', :'rodrigo', false) \g /dev/null
SELECT app.crear_hogar('Durán Damann', 'Rodrigo') IS NOT NULL AS creado;
SELECT h.nombre, i.nombre AS integrante, i.rol, i.usuario_auth_id = app.jwt_sub() AS vinculado, app.rol_actual() AS rol_actual
  FROM gob.hogar h JOIN gob.integrante i ON i.hogar_id = h.id;
RESET ROLE;
SELECT tipo, actor_tipo FROM sys.evento_dominio;
SET ROLE authenticated;

\echo '== H2 quien ya tiene hogar no crea otro (debe FALLAR)'
SELECT app.crear_hogar('Otro', 'Rodrigo');

\echo '== I1 invitar a la co-administradora: queda CAD pendiente y suplente del ORG (R39)'
SELECT app.invitar_integrante('ana@ejemplo.cl', 'Ana', 'CAD') IS NOT NULL AS invitada;
SELECT i.correo, i.rol, i.estado, i.vence_en > now() AS vigente FROM gob.invitacion i;
SELECT c.nombre, c.rol, c.usuario_auth_id IS NULL AS sin_cuenta, o.rol AS suplente_de
  FROM gob.integrante c JOIN gob.integrante o ON o.id = c.suplente_de_id;

\echo '== I2 no se invita a menores (D26) ni a un segundo CAD (ambos deben FALLAR)'
SELECT app.invitar_integrante('hijo@ejemplo.cl', 'Hijo', 'MEN');
SELECT app.invitar_integrante('otro@ejemplo.cl', 'Otro', 'CAD');

\echo '== I3 al iniciar sesión con ese correo (sin importar mayúsculas) queda como CAD del mismo hogar'
SELECT set_config('request.jwt.claims', :'ana', false) \g /dev/null
SELECT app.aceptar_invitacion() IS NOT NULL AS aceptada;
SELECT app.rol_actual() AS rol, (SELECT nombre FROM gob.hogar) AS hogar;
SELECT estado FROM gob.invitacion;

\echo '== I4 sin invitación, aceptar no vincula nada (esperado nulo y sin hogar)'
SELECT set_config('request.jwt.claims', :'otra', false) \g /dev/null
SELECT app.aceptar_invitacion() IS NULL AS sin_invitacion, (SELECT count(*) FROM gob.hogar) AS hogares;

\echo '== M1 registrar 2 hijos sin cuenta, con consentimiento datos_menor otorgado por el ORG (R25, D26)'
SELECT set_config('request.jwt.claims', :'rodrigo', false) \g /dev/null
SELECT app.registrar_menor('Hijo 1', 'v1') IS NOT NULL AS h1, app.registrar_menor('Hijo 2', 'v1') IS NOT NULL AS h2;
SELECT i.nombre, i.rol, i.es_menor, i.usuario_auth_id IS NULL AS sin_cuenta, c.finalidad, c.version_texto, o.rol AS otorgado_por
  FROM gob.integrante i JOIN gob.consentimiento c ON c.titular_id = i.id JOIN gob.integrante o ON o.id = c.otorgado_por_id
 WHERE i.rol = 'MEN' ORDER BY i.nombre;

\echo '== M2 sin consentimiento no se registra al menor (debe FALLAR)'
SELECT app.registrar_menor('Hijo 3', NULL);

\echo '== M3 tampoco por inserción directa, sin pasar por el consentimiento (debe FALLAR)'
INSERT INTO gob.integrante(hogar_id, nombre, rol, es_menor) SELECT id, 'Hijo 4', 'MEN', true FROM gob.hogar;

\echo '== M4 la cantidad de hijos cambia desactivando integrantes MEN (esperado 1 activo)'
UPDATE gob.integrante SET activo = false WHERE nombre = 'Hijo 2';
SELECT count(*) AS hijos_activos FROM gob.integrante WHERE rol = 'MEN' AND activo;

\echo '== M5 quien no administra un hogar no registra menores (debe FALLAR)'
SELECT set_config('request.jwt.claims', :'otra', false) \g /dev/null
SELECT app.registrar_menor('Hijo X', 'v1');
SELECT set_config('request.jwt.claims', :'rodrigo', false) \g /dev/null

\echo '== P1 crear período es idempotente y crea el sobre Por asignar'
SELECT app.crear_periodo('2026-10-15') = app.crear_periodo('2026-10-01') AS mismo_periodo;
SELECT p.mes, s.tipo, count(*) AS sobres FROM plan.periodo p JOIN plan.sobre s ON s.periodo_id = p.id GROUP BY 1, 2;

\echo '== A1 el ORG propone el Acuerdo v1: queda en borrador con solicitud de firma al CAD'
SELECT app.proponer_acuerdo(:'filas'::jsonb, false) IS NOT NULL AS propuesto;
SELECT a.version, a.estado, a.urgente, a.vigencia_desde, (SELECT count(*) FROM gob.regla_hogar) AS parametros FROM gob.acuerdo_hogar a;
SELECT s.tipo, s.estado, s.firmas_requeridas, i.rol AS aprobador, round(extract(epoch FROM s.vence_en - now()) / 3600) AS horas
  FROM gob.solicitud_aprobacion s JOIN gob.integrante i ON i.id = s.aprobador_id;

\echo '== A2 sin la firma del CAD no se activa, y el ORG no firma lo que propuso (ambos deben FALLAR)'
SELECT app.activar_acuerdo((SELECT id FROM gob.acuerdo_hogar));
INSERT INTO gob.firma(solicitud_id, integrante_id, decision)
SELECT s.id, app.integrante_actual(), 'aprueba' FROM gob.solicitud_aprobacion s;

\echo '== A3 el CAD firma: vigente desde 2026-10-01 con inicio_piloto y mes_primer_plan; evento AcuerdoVersionado'
SELECT set_config('request.jwt.claims', :'ana', false) \g /dev/null
INSERT INTO gob.firma(solicitud_id, integrante_id, decision)
SELECT s.id, app.integrante_actual(), 'aprueba' FROM gob.solicitud_aprobacion s;
SELECT app.activar_acuerdo((SELECT id FROM gob.acuerdo_hogar)) IS NOT NULL AS activado;
SELECT a.version, a.estado, a.vigencia_desde, s.estado AS solicitud
  FROM gob.acuerdo_hogar a JOIN gob.solicitud_aprobacion s ON s.objeto_id = a.id;
SELECT app.parametro(app.hogar_actual(), 'inicio_piloto') AS inicio_piloto,
       app.parametro(app.hogar_actual(), 'mes_primer_plan') AS mes_primer_plan,
       app.parametro(app.hogar_actual(), 'modalidad_sin_culpa') AS modalidad_sin_culpa;
RESET ROLE;
SELECT tipo, count(*) FROM sys.evento_dominio GROUP BY tipo ORDER BY tipo;
SET ROLE authenticated;

\echo '== A4 activar de nuevo no duplica (idempotente) y un Acuerdo vigente no se edita (esperado UPDATE 0)'
SELECT app.activar_acuerdo((SELECT id FROM gob.acuerdo_hogar)) IS NOT NULL AS activado;
\set QUIET 0
UPDATE gob.regla_hogar SET valor = '1' WHERE codigo = 'dias_abandono';
\set QUIET 1
RESET ROLE;
SELECT count(*) AS eventos_acuerdo FROM sys.evento_dominio WHERE tipo = 'AcuerdoVersionado';
SET ROLE authenticated;

\echo '== A5 hogar sin CAD: sin urgente no se puede proponer (debe FALLAR); con urgente queda vigente de inmediato'
SELECT set_config('request.jwt.claims', :'otra', false) \g /dev/null
SELECT app.crear_hogar('Hogar Otra', 'Otra') IS NOT NULL AS creado;
SELECT app.proponer_acuerdo(:'filas'::jsonb, false);
SELECT app.proponer_acuerdo(:'filas'::jsonb, true) IS NOT NULL AS propuesto;
SELECT a.estado, a.urgente, a.vigencia_desde, (SELECT count(*) FROM gob.solicitud_aprobacion) AS solicitudes FROM gob.acuerdo_hogar a;

\echo '== A6 aislamiento: el otro hogar no ve invitaciones, integrantes ni parámetros del primero'
SELECT (SELECT count(*) FROM gob.invitacion) AS invitaciones,
       (SELECT count(*) FROM gob.integrante) AS integrantes,
       (SELECT count(DISTINCT acuerdo_id) FROM gob.regla_hogar) AS acuerdos;

\echo '== A7 modalidad_sin_culpa queda guardado en gob.regla_hogar (ADR-10; esperado 2, uno por hogar)'
RESET ROLE;
SELECT count(*) AS con_modalidad FROM gob.regla_hogar WHERE codigo = 'modalidad_sin_culpa';

\echo '== X1 sin JWT no se crea hogar (debe FALLAR)'
SET ROLE anon;
SELECT app.crear_hogar('Anónimo', 'Nadie');
RESET ROLE;
