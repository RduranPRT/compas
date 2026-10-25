-- Pruebas de la migración 0010: ciclo de la tarjeta, saldos de cuenta y conciliación (specs 008 y 010)
\set ON_ERROR_STOP 0
\set QUIET 1
\set filas '[{"codigo":"inicio_piloto","valor":"2026-10-01","regla_codigo":"R41"},{"codigo":"mes_primer_plan","valor":"2026-12-01","regla_codigo":null}]'
\set rodrigo '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","email":"rodrigo@ejemplo.cl","role":"authenticated"}'
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', :'rodrigo', false) \g /dev/null
SELECT app.crear_hogar('Durán Damann', 'Rodrigo') \g /dev/null
SELECT app.proponer_acuerdo(:'filas'::jsonb, true) \g /dev/null
SELECT app.aplicar_plantilla_categorias() \g /dev/null
INSERT INTO fin.cuenta(hogar_id, nombre, tipo, dia_facturacion, dia_pago, saldo_inicial, fecha_saldo_inicial)
SELECT id, 'Visa', 'tarjeta_credito', 25, 5, -420000, date '2026-10-01' FROM gob.hogar;
INSERT INTO fin.cuenta(hogar_id, nombre, tipo, saldo_inicial, fecha_saldo_inicial)
SELECT id, 'Cuenta corriente', 'vista', 850000, date '2026-10-01' FROM gob.hogar;
SELECT app.asegurar_mes('2026-10-01'), app.asegurar_mes('2026-11-01') \g /dev/null
\set visa '(SELECT id FROM fin.cuenta WHERE nombre = ''Visa'')'
\set cc '(SELECT id FROM fin.cuenta WHERE nombre = ''Cuenta corriente'')'

\echo '== T1 deuda previa al piloto: Visa debe 420.000 y no hay nada apartado'
SELECT nombre, deuda, apartado FROM fin.v_tarjeta;

\echo '== T2 compra de $100.000 con la Visa: sale de Alimentación y queda apartada en Pago Visa (R44)'
SELECT app.registrar_gasto(NULL, :visa, (SELECT id FROM plan.v_sobre WHERE nombre = 'Alimentación' AND mes = '2026-11-01'), 100000, '2026-11-02') \g /dev/null
SELECT nombre, saldo FROM plan.v_sobre WHERE nombre IN ('Alimentación','Pago Visa') AND mes = '2026-11-01' ORDER BY nombre;
SELECT deuda, apartado FROM fin.v_tarjeta;

\echo '== T3 pago de la deuda previa en octubre: Pago Visa de octubre queda en -420.000 (deuda previa al piloto)'
SELECT app.registrar_pago_tarjeta(NULL, :cc, :visa, 420000, '2026-10-05') IS NOT NULL AS pagado;
SELECT mes, saldo FROM plan.v_sobre WHERE nombre = 'Pago Visa' ORDER BY mes;
SELECT deuda, apartado FROM fin.v_tarjeta;

\echo '== T4 pago de $100.000: Pago Visa de noviembre baja a 0 y ningún sobre de categoría cambia (R27)'
SELECT app.registrar_pago_tarjeta('22222222-0000-0000-0000-000000000001', :cc, :visa, 100000, '2026-11-20') \g /dev/null
SELECT app.registrar_pago_tarjeta('22222222-0000-0000-0000-000000000001', :cc, :visa, 100000, '2026-11-20') \g /dev/null
SELECT nombre, saldo FROM plan.v_sobre WHERE nombre IN ('Alimentación','Pago Visa') AND mes = '2026-11-01' ORDER BY nombre;
SELECT count(*) AS pagos FROM fin.transferencia;

\echo '== T5 pagar una tarjeta con otra tarjeta (debe FALLAR)'
SELECT app.registrar_pago_tarjeta(NULL, :visa, :visa, 1000, '2026-11-20');

\echo '== S1 saldos registrados: la corriente bajó por los pagos; la Visa no debe nada'
SELECT nombre, tipo, saldo FROM fin.v_saldo_cuenta ORDER BY nombre;

\echo '== C1 conciliar con diferencia exige motivo (R34; debe FALLAR) y con motivo queda registrada'
SELECT app.conciliar_cuenta(:cc, 'semanal', '2026-11-22', 327500);
SELECT r->>'saldo_registrado' AS registrado, r->>'diferencia' AS diferencia
  FROM app.conciliar_cuenta(:cc, 'semanal', '2026-11-22', 327500, 'Comisión de mantención sin registrar') r;
SELECT tipo, fecha_corte, saldo_real, saldo_registrado, diferencia, motivo FROM fin.conciliacion;

\echo '== C2 montos en mensajes'
SELECT app.pesos(12345) AS a, app.pesos(-8000) AS b, app.pesos(0) AS c, app.pesos(1234567) AS d;
