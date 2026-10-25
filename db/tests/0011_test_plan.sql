-- Pruebas de la migración 0011: plan mensual base cero (spec 006)
\set ON_ERROR_STOP 0
\set QUIET 1
\set filas '[{"codigo":"inicio_piloto","valor":"2026-10-01","regla_codigo":"R41"},{"codigo":"mes_primer_plan","valor":"2026-12-01","regla_codigo":null},{"codigo":"plazo_suplencia_h","valor":48,"regla_codigo":"R39"}]'
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
CREATE TEMP VIEW sd AS SELECT id, nombre FROM plan.v_sobre WHERE mes = '2026-12-01';
\set lineas '[{"sobre_id":"ALIM","monto":600000,"regla_codigo":"R04","explicacion":"Promedio de 3 meses"},{"sobre_id":"VIV","monto":805000,"regla_codigo":"R08","explicacion":"Fijo con holgura 15 %","holgura_pct":15},{"sobre_id":"FUT","monto":995000,"regla_codigo":"R07","explicacion":"Resto a Futuro"}]'
CREATE TEMP TABLE l AS SELECT replace(replace(replace(:'lineas', 'ALIM', (SELECT id::text FROM sd WHERE nombre = 'Alimentación')),
  'VIV', (SELECT id::text FROM sd WHERE nombre = 'Arriendo o dividendo')), 'FUT', (SELECT id::text FROM sd WHERE nombre = 'Ahorro e inversión'))::jsonb AS j;

\echo '== B1 borrador de diciembre: líneas con regla y explicación (P8)'
SELECT app.guardar_borrador_plan('2026-12-01', 2400000, (SELECT j FROM l)) IS NOT NULL AS borrador;
SELECT version, estado, ingreso_proyectado, generado_por FROM plan.presupuesto_mensual;
SELECT nombre, monto_proyectado, regla_codigo, holgura_pct FROM plan.v_linea_plan ORDER BY nombre;

\echo '== B2 guardar otra vez reemplaza las líneas del mismo borrador (no crea versiones)'
SELECT app.guardar_borrador_plan('2026-12-01', 2400000, (SELECT j FROM l)) \g /dev/null
SELECT count(*) AS presupuestos, (SELECT count(*) FROM plan.linea_plan) AS lineas FROM plan.presupuesto_mensual;

\echo '== D1 descuadrado: no se envía e indica lo que falta en Por asignar (R01; debe FALLAR)'
SELECT app.actualizar_linea_plan((SELECT id FROM plan.presupuesto_mensual), (SELECT id FROM sd WHERE nombre = 'Alimentación'), 550000);
SELECT app.enviar_plan((SELECT id FROM plan.presupuesto_mensual));
SELECT app.actualizar_linea_plan((SELECT id FROM plan.presupuesto_mensual), (SELECT id FROM sd WHERE nombre = 'Ocio y salidas'), 50000);

\echo '== S1 la CAD envía; aprueba el ORG; la CAD no puede antes de 48 h (R39; debe FALLAR)'
SELECT set_config('request.jwt.claims', :'ana', false) \g /dev/null
SELECT app.enviar_plan((SELECT id FROM plan.presupuesto_mensual)) IS NOT NULL AS enviada;
SELECT tipo, estado, aprobador FROM gob.v_solicitud WHERE tipo = 'presupuesto';
SELECT app.resolver_solicitud((SELECT id FROM gob.solicitud_aprobacion WHERE tipo = 'presupuesto'), true);

\echo '== S2 pasado el plazo, la CAD aprueba como suplente (R39)'
RESET ROLE;
UPDATE gob.solicitud_aprobacion SET vence_en = now() - interval '1 minute' WHERE tipo = 'presupuesto';
SET ROLE authenticated;
SELECT app.resolver_solicitud((SELECT id FROM gob.solicitud_aprobacion WHERE tipo = 'presupuesto'), true) AS estado;
SELECT p.estado, i.nombre AS aprobado_por, f.como_suplente FROM plan.presupuesto_mensual p
  JOIN gob.integrante i ON i.id = p.aprobado_por JOIN gob.firma f ON f.solicitud_id = p.solicitud_id;
SELECT monto, pct_ingreso FROM plan.v_bloques_periodo WHERE bloque_codigo = 'ESENCIALES';

\echo '== S3 un plan aprobado no se edita (debe FALLAR)'
SELECT app.actualizar_linea_plan((SELECT id FROM plan.presupuesto_mensual), (SELECT id FROM sd WHERE nombre = 'Alimentación'), 1);

\echo '== V1 ajuste por ingreso distinto: la versión 2 reemplaza a la 1 al aprobarse (P2-A, R33)'
SELECT set_config('request.jwt.claims', :'rodrigo', false) \g /dev/null
SELECT app.guardar_borrador_plan('2026-12-01', 2200000, (SELECT j FROM l), 'sistema', 'P2-A ingreso -8,3 %') \g /dev/null
SELECT app.actualizar_linea_plan((SELECT id FROM plan.presupuesto_mensual WHERE version = 2), (SELECT id FROM sd WHERE nombre = 'Ahorro e inversión'), 795000);
SELECT app.resolver_solicitud(app.enviar_plan((SELECT id FROM plan.presupuesto_mensual WHERE version = 2)), true) AS estado;
SELECT version, estado, ingreso_proyectado, motivo_version FROM plan.presupuesto_mensual ORDER BY version;

\echo '== R1 arrastre al nuevo mes: positivo al mismo sobre, negativo descuenta Por asignar (R20)'
SELECT app.asegurar_mes('2027-01-01') \g /dev/null
RESET ROLE;
-- diciembre con dinero real: +30.000 sobrantes en Alimentación y Ocio en −10.000
SELECT set_config('request.jwt.claims', :'rodrigo', false) \g /dev/null
SELECT app.registrar_ingreso(NULL, (SELECT id FROM fin.cuenta), 640000, '2026-12-01', (SELECT id FROM gob.integrante WHERE rol = 'ORG')) \g /dev/null
INSERT INTO plan.asignacion(hogar_id, ingreso_id, sobre_id, monto_clp, confirmada_por)
SELECT m.hogar_id, m.id, (SELECT id FROM sd WHERE nombre = 'Alimentación'), 600000, (SELECT id FROM gob.integrante WHERE rol = 'ORG')
  FROM fin.movimiento m WHERE m.tipo = 'ingreso';
SET ROLE authenticated;
SELECT app.registrar_gasto(NULL, (SELECT id FROM fin.cuenta), (SELECT id FROM sd WHERE nombre = 'Alimentación'), 570000, '2026-12-10') \g /dev/null
SELECT app.registrar_gasto(NULL, (SELECT id FROM fin.cuenta), (SELECT id FROM sd WHERE nombre = 'Ocio y salidas'), 10000, '2026-12-11') \g /dev/null
SELECT nombre, saldo FROM plan.v_sobre WHERE mes = '2026-12-01' AND saldo <> 0 ORDER BY nombre;
SELECT app.guardar_borrador_plan('2027-01-01', 2400000, '[]') \g /dev/null
SELECT app.actualizar_linea_plan((SELECT id FROM plan.presupuesto_mensual WHERE periodo_id = (SELECT id FROM plan.periodo WHERE mes = '2027-01-01')),
  (SELECT id FROM plan.v_sobre WHERE mes = '2027-01-01' AND nombre = 'Ahorro e inversión'), 2400000);
SELECT app.resolver_solicitud(app.enviar_plan((SELECT id FROM plan.presupuesto_mensual WHERE periodo_id = (SELECT id FROM plan.periodo WHERE mes = '2027-01-01'))), true) AS estado;
SELECT nombre, saldo FROM plan.v_sobre WHERE mes = '2027-01-01' AND saldo <> 0 ORDER BY nombre;
SELECT nombre, saldo FROM plan.v_sobre WHERE mes = '2026-12-01' AND tipo <> 'por_asignar' AND saldo <> 0 ORDER BY nombre;

\echo '== R2 la línea base (noviembre, sin plan) no arrastra a diciembre'
SELECT count(*) AS arrastres_desde_noviembre FROM plan.libro_sobre l JOIN plan.periodo p ON p.id = l.origen_id
 WHERE l.tipo = 'arrastre' AND p.mes = '2026-12-01';
