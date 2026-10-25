-- Pruebas de la migración 0014: cierres semanal y mensual (spec 010)
\set ON_ERROR_STOP 0
\set QUIET 1
\set filas '[{"codigo":"inicio_piloto","valor":"2026-10-01","regla_codigo":"R41"},{"codigo":"mes_primer_plan","valor":"2026-12-01","regla_codigo":null}]'
\set rodrigo '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","email":"rodrigo@ejemplo.cl","role":"authenticated"}'
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', :'rodrigo', false) \g /dev/null
SELECT app.crear_hogar('Durán Damann', 'Rodrigo') \g /dev/null
SELECT app.proponer_acuerdo(:'filas'::jsonb, true) \g /dev/null
SELECT app.aplicar_plantilla_categorias() \g /dev/null
INSERT INTO fin.cuenta(hogar_id, nombre, tipo, saldo_inicial, fecha_saldo_inicial) SELECT id, 'Cuenta corriente', 'vista', 850000, date '2026-10-01' FROM gob.hogar;
INSERT INTO fin.cuenta(hogar_id, nombre, tipo, dia_facturacion, dia_pago) SELECT id, 'Visa', 'tarjeta_credito', 25, 5 FROM gob.hogar;
SELECT app.asegurar_mes('2026-10-01') \g /dev/null
\set cc '(SELECT id FROM fin.cuenta WHERE nombre = ''Cuenta corriente'')'
\set oct '(SELECT id FROM plan.periodo WHERE mes = ''2026-10-01'')'
SELECT app.registrar_gasto(NULL, :cc, (SELECT id FROM plan.v_sobre WHERE nombre = 'Alimentación' AND mes = '2026-10-01'), 50000, '2026-10-03') \g /dev/null
SELECT app.registrar_gasto(NULL, :cc, (SELECT id FROM plan.v_sobre WHERE nombre = 'Ocio y salidas' AND mes = '2026-10-01'), 20000, '2026-10-20') \g /dev/null

\echo '== W1 cierre semanal: saldo real igual al registrado concilia los movimientos hasta el corte (R34)'
SELECT r->>'conciliados' AS conciliados, r->>'diferencia_total' AS diferencia
  FROM app.cerrar_semana('2026-10-11', jsonb_build_array(jsonb_build_object('cuenta_id', :cc, 'saldo_real', 800000))) r;
SELECT fecha_contable, estado FROM fin.movimiento ORDER BY fecha_contable;
SELECT tipo, fecha_programada, estado FROM med.cierre;

\echo '== W2 con diferencia y sin motivo (debe FALLAR); con motivo queda registrada'
SELECT app.cerrar_semana('2026-10-25', jsonb_build_array(jsonb_build_object('cuenta_id', :cc, 'saldo_real', 778000)));
SELECT r->>'diferencia_total' AS diferencia FROM app.cerrar_semana('2026-10-25',
  jsonb_build_array(jsonb_build_object('cuenta_id', :cc, 'saldo_real', 778000, 'motivo', 'Comisión no registrada'))) r;

\echo '== M1 cierre de octubre (línea base): pide el estado de cuenta de la Visa o una justificación (ADR-08; debe FALLAR)'
SELECT app.cerrar_mes(:oct, '[]');

\echo '== M2 valoración de la familia y cierre con KPI de partida: octubre queda cerrado (R19, D21)'
SELECT app.valorar(app.iniciar_cierre_mes(:oct), (SELECT id FROM plan.categoria WHERE plantilla_codigo = 'alimentacion'), '+') \g /dev/null
SELECT app.valorar(app.iniciar_cierre_mes(:oct), (SELECT id FROM plan.categoria WHERE plantilla_codigo = 'ocio'), '-', '¿Qué cambiarías?', 'Menos delivery') \g /dev/null
SELECT valoracion, pregunta, respuesta FROM med.reflexion ORDER BY valoracion;
SELECT r->>'kpis' AS kpis FROM app.cerrar_mes(:oct,
  '[{"codigo":"K4","valor":0.58,"semaforo":"rojo"},{"codigo":"K6","valor":-70000,"semaforo":"rojo"},{"codigo":"KP1","valor":0.92},{"codigo":"XX","valor":1}]',
  'Octubre: línea base', 'La Visa no tuvo movimientos en octubre') r;
SELECT estado, version_cierre FROM plan.periodo WHERE mes = '2026-10-01';
SELECT kpi_codigo, valor, semaforo, version_cierre FROM med.medicion_kpi ORDER BY kpi_codigo;

\echo '== M3 un mes cerrado no admite movimientos (I1; debe FALLAR)'
SELECT app.registrar_gasto(NULL, :cc, (SELECT id FROM plan.v_sobre WHERE nombre = 'Alimentación' AND mes = '2026-10-01'), 1000, '2026-10-30');

\echo '== R1 reabrir con motivo y volver a cerrar: KPI versión 1 y se conserva la 0 (D20)'
SELECT app.reabrir_periodo(:oct, '');
SELECT app.reabrir_periodo(:oct, 'Faltó una compra en efectivo') AS version;
SELECT app.registrar_gasto(NULL, :cc, (SELECT id FROM plan.v_sobre WHERE nombre = 'Alimentación' AND mes = '2026-10-01'), 1000, '2026-10-30') \g /dev/null
SELECT app.cerrar_mes(:oct, '[{"codigo":"K6","valor":-71000}]', NULL, 'Sin estado de cuenta') \g /dev/null
SELECT kpi_codigo, valor, version_cierre FROM med.medicion_kpi WHERE kpi_codigo = 'K6' ORDER BY version_cierre;

\echo '== P1 pronóstico del mes para la portada (sin período, nulo)'
SELECT app.pronostico_mes('2030-01-01') IS NULL AS sin_periodo;
