-- Pruebas de la migración 0012: ingresos y distribución del día de pago (spec 007)
\set ON_ERROR_STOP 0
\set QUIET 1
\set filas '[{"codigo":"inicio_piloto","valor":"2026-10-01","regla_codigo":"R41"},{"codigo":"mes_primer_plan","valor":"2026-12-01","regla_codigo":null}]'
\set rodrigo '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","email":"rodrigo@ejemplo.cl","role":"authenticated"}'
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', :'rodrigo', false) \g /dev/null
SELECT app.crear_hogar('Durán Damann', 'Rodrigo') \g /dev/null
SELECT app.proponer_acuerdo(:'filas'::jsonb, true) \g /dev/null
SELECT app.aplicar_plantilla_categorias() \g /dev/null
INSERT INTO fin.cuenta(hogar_id, nombre, tipo, saldo_inicial) SELECT id, 'Cuenta corriente', 'vista', 850000 FROM gob.hogar;
INSERT INTO fin.cuenta(hogar_id, nombre, tipo) SELECT id, 'Ahorro', 'ahorro' FROM gob.hogar;
SELECT app.asegurar_mes('2026-12-01') \g /dev/null
CREATE TEMP VIEW sd AS SELECT id, nombre FROM plan.v_sobre WHERE mes = '2026-12-01';
\set cc '(SELECT id FROM fin.cuenta WHERE nombre = ''Cuenta corriente'')'
\set yo '(SELECT id FROM gob.integrante)'

\echo '== D1 sueldo del 30 de noviembre para diciembre: entra a Por asignar de diciembre (D01, D02)'
SELECT r->>'estado' AS estado FROM app.registrar_ingreso(NULL, :cc, 2400000, '2026-11-30', :yo, 'sueldo', false, true) r;
SELECT mes, monto_clp, por_repartir FROM plan.v_ingreso_por_repartir;
SELECT saldo FROM plan.v_sobre WHERE nombre = 'Por asignar' AND mes = '2026-12-01';

\echo '== D2 reparto confirmado: asignaciones reales, Por asignar en 0 y transferencias pendientes (R01, R02, D05)'
SELECT app.confirmar_distribucion((SELECT ingreso_id FROM plan.v_ingreso_por_repartir), jsonb_build_array(
  jsonb_build_object('sobre_id', (SELECT id FROM sd WHERE nombre = 'Alimentación'), 'monto', 600000),
  jsonb_build_object('sobre_id', (SELECT id FROM sd WHERE nombre = 'Arriendo o dividendo'), 'monto', 800000),
  jsonb_build_object('sobre_id', (SELECT id FROM sd WHERE nombre = 'Ahorro e inversión'), 'monto', 900000),
  jsonb_build_object('sobre_id', (SELECT id FROM sd WHERE nombre = 'Sin culpa Rodrigo'), 'monto', 100000)));
SELECT nombre, saldo FROM plan.v_sobre WHERE mes = '2026-12-01' AND saldo <> 0 OR (nombre = 'Por asignar' AND mes = '2026-12-01') ORDER BY nombre;
SELECT tipo, monto_clp, cuenta_origen, cuenta_destino, sobre FROM fin.v_transferencia_pendiente ORDER BY tipo;

\echo '== D3 asignar $1 más de lo recibido (R01; debe FALLAR)'
SELECT app.confirmar_distribucion((SELECT ingreso_id FROM plan.v_ingreso_por_repartir),
  jsonb_build_array(jsonb_build_object('sobre_id', (SELECT id FROM sd WHERE nombre = 'Ocio y salidas'), 'monto', 1)));

\echo '== D4 bono variable: se reparte en partes y queda lo pendiente (R45, D04)'
SELECT app.registrar_ingreso(NULL, :cc, 600000, '2026-12-15', :yo, 'bono', true) \g /dev/null
SELECT app.confirmar_distribucion((SELECT ingreso_id FROM plan.v_ingreso_por_repartir WHERE es_variable), jsonb_build_array(
  jsonb_build_object('sobre_id', (SELECT id FROM sd WHERE nombre = 'Ahorro e inversión'), 'monto', 300000)));
SELECT es_variable, por_repartir FROM plan.v_ingreso_por_repartir ORDER BY es_variable;

\echo '== T1 marcar transferencia hecha'
SELECT app.marcar_transferencia((SELECT id FROM fin.v_transferencia_pendiente WHERE tipo = 'a_personal'), true);
SELECT tipo, estado FROM fin.transferencia ORDER BY tipo, monto_clp;

\echo '== T2 un ingreso descartado tras repartirlo no se acepta (debe FALLAR)'
SELECT app.descartar_movimiento((SELECT ingreso_id FROM plan.v_ingreso_por_repartir WHERE NOT es_variable));
