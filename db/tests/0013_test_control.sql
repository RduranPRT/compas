-- Pruebas de la migración 0013: control, alertas y N1 (spec 009)
\set ON_ERROR_STOP 0
\set QUIET 1
\set filas '[{"codigo":"inicio_piloto","valor":"2026-10-01","regla_codigo":"R41"},{"codigo":"mes_primer_plan","valor":"2026-12-01","regla_codigo":null},{"codigo":"autoaprobacion_n1_pct","valor":5,"regla_codigo":"R38"},{"codigo":"umbral_ritmo","valor":1.1,"regla_codigo":"R09"},{"codigo":"max_alertas_dia","valor":3,"regla_codigo":"R40"}]'
\set rodrigo '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","email":"rodrigo@ejemplo.cl","role":"authenticated"}'
\set ana '{"sub":"aaaaaaaa-0000-0000-0000-000000000002","email":"ana@ejemplo.cl","role":"authenticated"}'
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', :'rodrigo', false) \g /dev/null
SELECT app.crear_hogar('Durán Damann', 'Rodrigo') \g /dev/null
SELECT app.invitar_integrante('ana@ejemplo.cl', 'Ana', 'CAD') \g /dev/null
SELECT set_config('request.jwt.claims', :'ana', false) \g /dev/null
SELECT app.aceptar_invitacion() \g /dev/null
SELECT set_config('request.jwt.claims', :'rodrigo', false) \g /dev/null
SELECT app.proponer_acuerdo(:'filas'::jsonb, true) \g /dev/null
SELECT app.aplicar_plantilla_categorias() \g /dev/null
INSERT INTO fin.cuenta(hogar_id, nombre, tipo, saldo_inicial) SELECT id, 'Cuenta corriente', 'vista', 850000 FROM gob.hogar;
SELECT app.asegurar_mes('2026-11-01'), app.asegurar_mes('2026-12-01') \g /dev/null
CREATE TEMP VIEW sd AS SELECT id, nombre, saldo FROM plan.v_sobre WHERE mes = '2026-12-01';
\set cc '(SELECT id FROM fin.cuenta)'
-- Diciembre con dinero real
SELECT app.registrar_ingreso(NULL, :cc, 1000000, '2026-12-01', (SELECT id FROM gob.integrante WHERE rol = 'ORG')) \g /dev/null
SELECT app.confirmar_distribucion((SELECT ingreso_id FROM plan.v_ingreso_por_repartir), jsonb_build_array(
  jsonb_build_object('sobre_id', (SELECT id FROM sd WHERE nombre = 'Alimentación'), 'monto', 400000),
  jsonb_build_object('sobre_id', (SELECT id FROM sd WHERE nombre = 'Ocio y salidas'), 'monto', 200000),
  jsonb_build_object('sobre_id', (SELECT id FROM sd WHERE nombre = 'Transporte'), 'monto', 100000),
  jsonb_build_object('sobre_id', (SELECT id FROM sd WHERE nombre = 'Ahorro e inversión'), 'monto', 300000))) \g /dev/null

\echo '== L1 línea base: un sobre negativo en noviembre no abre N1 ni avisa'
SELECT app.registrar_gasto(NULL, :cc, (SELECT id FROM plan.v_sobre WHERE nombre = 'Vestuario' AND mes = '2026-11-01'), 9000, '2026-11-05') \g /dev/null
SELECT count(*) AS alertas, (SELECT count(*) FROM med.evento_recuperacion) AS recuperaciones FROM med.alerta;

\echo '== N1 Vestuario de diciembre queda en −8.000: N1 abierto y aviso sin culpa a ambos administradores (R10, R16)'
SELECT app.registrar_gasto(NULL, :cc, (SELECT id FROM sd WHERE nombre = 'Vestuario'), 8000, '2026-12-05') \g /dev/null
SELECT nivel, regla_codigo, estado FROM med.evento_recuperacion;
SELECT i.nombre, a.tipo, a.estado, a.mensaje FROM med.alerta a JOIN gob.integrante i ON i.id = a.destinatario_id ORDER BY i.nombre;

\echo '== R1 cubrir desde Ocio $8.000 (4 % de 200.000): se autoaprueba y cierra el N1 (R38)'
SELECT r->>'estado' AS estado FROM app.reasignar((SELECT id FROM sd WHERE nombre = 'Ocio y salidas'), (SELECT id FROM sd WHERE nombre = 'Vestuario'), 8000) r;
SELECT nombre, saldo FROM sd WHERE nombre IN ('Ocio y salidas','Vestuario') ORDER BY nombre;
SELECT autoaprobada, aplicada_en IS NOT NULL AS aplicada FROM plan.reasignacion;
SELECT nivel, estado FROM med.evento_recuperacion;

\echo '== R2 sobre el umbral ($30.000 de 192.000): queda pendiente de la CAD; al aprobar se aplica'
SELECT r->>'estado' AS estado FROM app.reasignar((SELECT id FROM sd WHERE nombre = 'Ocio y salidas'), (SELECT id FROM sd WHERE nombre = 'Transporte'), 30000) r;
SELECT nombre, saldo FROM sd WHERE nombre = 'Transporte';
SELECT set_config('request.jwt.claims', :'ana', false) \g /dev/null
SELECT app.resolver_solicitud((SELECT id FROM gob.solicitud_aprobacion WHERE tipo = 'reasignacion'), true) AS estado;
SELECT nombre, saldo FROM sd WHERE nombre = 'Transporte';

\echo '== R3 tomar de Futuro exige doble firma (R37): con una firma no se aplica; con dos, sí'
SELECT r->>'estado' AS estado FROM app.reasignar((SELECT id FROM sd WHERE nombre = 'Ahorro e inversión'), (SELECT id FROM sd WHERE nombre = 'Alimentación'), 50000) r;
SELECT app.resolver_solicitud((SELECT id FROM gob.solicitud_aprobacion WHERE tipo = 'retiro_futuro'), true) AS tras_ana;
SELECT nombre, saldo FROM sd WHERE nombre = 'Ahorro e inversión';
SELECT set_config('request.jwt.claims', :'rodrigo', false) \g /dev/null
SELECT app.resolver_solicitud((SELECT id FROM gob.solicitud_aprobacion WHERE tipo = 'retiro_futuro'), true) AS tras_rodrigo;
SELECT nombre, saldo FROM sd WHERE nombre = 'Ahorro e inversión';

\echo '== R4 mover más de lo que tiene el sobre (debe FALLAR)'
SELECT app.reasignar((SELECT id FROM sd WHERE nombre = 'Ocio y salidas'), (SELECT id FROM sd WHERE nombre = 'Transporte'), 999999);

\echo '== C1 ritmo excedido el 12 de diciembre: Alimentación con 400.000 y 200.000 gastados (R09)'
SELECT app.registrar_gasto(NULL, :cc, (SELECT id FROM sd WHERE nombre = 'Alimentación'), 200000, '2026-12-10') \g /dev/null
RESET ROLE;
DELETE FROM med.alerta;
SELECT app.control_hogar((SELECT id FROM gob.hogar), '2026-12-12')->>'alertas' AS alertas;
SELECT tipo, regla_codigo, estado, mensaje FROM med.alerta WHERE destinatario_id = (SELECT id FROM gob.integrante WHERE rol = 'ORG') ORDER BY tipo, mensaje;

\echo '== C2 balance proyectado negativo abre N2 para el ORG (R12)'
SELECT app.registrar_gasto(NULL, (SELECT id FROM fin.cuenta), (SELECT id FROM plan.v_sobre WHERE nombre = 'Transporte' AND mes = '2026-12-01'), 300000, '2026-12-12') \g /dev/null
SELECT (app.control_hogar((SELECT id FROM gob.hogar), '2026-12-13')->>'balance_proyectado')::bigint < 0 AS negativo;
SELECT nivel, regla_codigo, estado FROM med.evento_recuperacion WHERE nivel = 'N2';

\echo '== T1 tope diario (R40): pasadas 3 alertas, el resto va al resumen'
DELETE FROM med.alerta;
SELECT app.emitir_alerta(h.id, i.id, 'ritmo', 'info', NULL, NULL, 'aviso ' || n, NULL, 'prueba' || n) IS NOT NULL
  FROM gob.hogar h, gob.integrante i, generate_series(1, 5) n WHERE i.rol = 'ORG' \g /dev/null
SELECT estado, count(*) FROM med.alerta GROUP BY estado ORDER BY estado;

\echo '== T2 línea base: el control de noviembre no emite ritmo ni balance'
DELETE FROM med.alerta;
SELECT app.control_hogar((SELECT id FROM gob.hogar), '2026-11-20') AS resultado;
