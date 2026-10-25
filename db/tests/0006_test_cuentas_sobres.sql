-- Pruebas de la migración 0006: cuentas, categorías y sobres del período (spec 002)
-- Simula PostgREST con request.jwt.claims, como 0005. "debe FALLAR" = termina en ERROR.
\set ON_ERROR_STOP 0
\set QUIET 1
\set filas '[{"codigo":"inicio_piloto","valor":"2026-10-01","regla_codigo":"R41"},{"codigo":"mes_primer_plan","valor":"2026-12-01","regla_codigo":null},{"codigo":"plazo_suplencia_h","valor":48,"regla_codigo":"R39"}]'
\set rodrigo '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","email":"rodrigo@ejemplo.cl","role":"authenticated"}'
\set ana '{"sub":"aaaaaaaa-0000-0000-0000-000000000002","email":"ana@ejemplo.cl","role":"authenticated"}'
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', :'rodrigo', false) \g /dev/null
SELECT app.crear_hogar('Durán Damann', 'Rodrigo') IS NOT NULL AS hogar \g /dev/null
SELECT app.invitar_integrante('ana@ejemplo.cl', 'Ana', 'CAD') \g /dev/null
SELECT app.registrar_menor('Hijo 1', 'v1'), app.registrar_menor('Hijo 2', 'v1') \g /dev/null
SELECT app.proponer_acuerdo(:'filas'::jsonb, true) \g /dev/null
SELECT set_config('request.jwt.claims', :'ana', false) \g /dev/null
SELECT app.aceptar_invitacion() \g /dev/null
SELECT set_config('request.jwt.claims', :'rodrigo', false) \g /dev/null

\echo '== C1 registrar una tarjeta de crédito: tipo tarjeta_credito, fondo común y solo los últimos 4 (D23)'
INSERT INTO fin.cuenta(hogar_id, nombre, tipo, institucion, ultimos4, dia_facturacion, dia_pago, cupo, saldo_inicial, fecha_saldo_inicial)
SELECT id, 'Visa', 'tarjeta_credito', 'Santander', '4321', 25, 5, 3000000, -420000, '2026-10-01' FROM gob.hogar;
SELECT nombre, tipo, es_fondo_comun, ultimos4, saldo_inicial, fecha_saldo_inicial FROM fin.cuenta;

\echo '== C2 el número completo de la tarjeta no se acepta (debe FALLAR)'
INSERT INTO fin.cuenta(hogar_id, nombre, tipo, ultimos4, dia_facturacion, dia_pago)
SELECT id, 'Master', 'tarjeta_credito', '5555444433332222', 10, 20 FROM gob.hogar;

\echo '== C3 una tarjeta sin día de facturación ni de pago no se acepta (debe FALLAR)'
INSERT INTO fin.cuenta(hogar_id, nombre, tipo) SELECT id, 'Master', 'tarjeta_credito' FROM gob.hogar;

\echo '== C4 saldo inicial de cuenta corriente al inicio del piloto y efectivo como billetera (R31)'
INSERT INTO fin.cuenta(hogar_id, nombre, tipo, institucion, saldo_inicial, fecha_saldo_inicial)
SELECT id, 'Cuenta corriente', 'vista'::fin.tipo_cuenta, 'Santander', 850000, date '2026-10-01' FROM gob.hogar
UNION ALL SELECT id, 'Efectivo', 'billetera', NULL, 40000, '2026-10-01' FROM gob.hogar;
SELECT nombre, tipo, saldo_inicial, fecha_saldo_inicial FROM fin.cuenta WHERE tipo <> 'tarjeta_credito' ORDER BY nombre;

\echo '== K1 plantilla de categorías: 15, con Cuatro Paredes en Alimentación, Vivienda, Servicios y Transporte (R05)'
SELECT app.aplicar_plantilla_categorias() AS creadas;
SELECT count(*) AS categorias, count(*) FILTER (WHERE es_cuatro_paredes) AS cuatro_paredes FROM plan.categoria;
SELECT nombre, bloque_codigo, tipo_sobre, intencion_default FROM plan.categoria WHERE es_cuatro_paredes ORDER BY nombre;

\echo '== K2 aplicarla dos veces no duplica; renombrar, desactivar y agregar categorías'
SELECT app.aplicar_plantilla_categorias() AS creadas_otra_vez;
UPDATE plan.categoria SET nombre = 'Supermercado y feria' WHERE plantilla_codigo = 'alimentacion';
UPDATE plan.categoria SET activa = false WHERE plantilla_codigo = 'educacion';
INSERT INTO plan.categoria(hogar_id, nombre, bloque_codigo, tipo_sobre, intencion_default)
SELECT id, 'Mascotas', 'VIDA', 'variable', 'deseo' FROM gob.hogar;
SELECT count(*) FILTER (WHERE activa) AS activas FROM plan.categoria;

\echo '== K3 un fondo de gastos anuales'
INSERT INTO plan.fondo(hogar_id, categoria_id, tipo, nombre, monto_objetivo, fecha_objetivo)
SELECT c.hogar_id, c.id, 'gasto_verdadero', 'Permiso de circulación', 180000, '2027-03-31'
  FROM plan.categoria c WHERE c.plantilla_codigo = 'gastos_anuales';

\echo '== S1 sobres de noviembre: por categoría activa, sin culpa por adulto, mesada por hijo y pago de tarjeta (D06, D17, R44)'
SELECT app.crear_periodo('2026-11-01') IS NOT NULL AS periodo;
SELECT tipo, count(*) AS sobres FROM plan.sobre GROUP BY tipo ORDER BY tipo;
SELECT nombre FROM plan.v_sobre WHERE tipo IN ('sin_culpa','mesada','pago_tarjeta','fondo') ORDER BY nombre;

\echo '== S2 crear los sobres otra vez no los duplica'
SELECT app.crear_sobres_periodo((SELECT id FROM plan.periodo)) AS nuevos, (SELECT count(*) FROM plan.sobre) AS total;

\echo '== S3 una tarjeta nueva aparece en el mes al asegurarlo (asegurar_mes es idempotente)'
INSERT INTO fin.cuenta(hogar_id, nombre, tipo, dia_facturacion, dia_pago) SELECT id, 'Master', 'tarjeta_credito', 10, 20 FROM gob.hogar;
SELECT app.asegurar_mes('2026-11-15') = (SELECT id FROM plan.periodo) AS mismo_periodo;
SELECT count(*) AS pagos_tarjeta FROM plan.sobre WHERE tipo = 'pago_tarjeta';

\echo '== I1 ingresos típicos: base y variable (R45)'
INSERT INTO plan.ingreso_esperado(hogar_id, integrante_id, descripcion, tipo_ingreso, monto, dia_esperado, vigente_desde, es_base)
SELECT hogar_id, id, 'Sueldo Rodrigo', 'sueldo'::fin.tipo_ingreso, 2400000, 30, date '2026-10-01', true FROM gob.integrante WHERE rol = 'ORG'
UNION ALL SELECT hogar_id, id, 'Bono variable', 'bono', 600000, NULL, '2026-10-01', false FROM gob.integrante WHERE rol = 'ORG';
SELECT sum(monto) FILTER (WHERE es_base) AS base_para_el_plan, sum(monto) FILTER (WHERE NOT es_base) AS variable FROM plan.ingreso_esperado;

\echo '== I2 pago fijo en UF'
INSERT INTO plan.pago_fijo(hogar_id, categoria_id, nombre, moneda, monto, dia_vencimiento, vigente_desde)
SELECT c.hogar_id, c.id, 'Dividendo', 'UF', 18.5, 5, '2026-10-01' FROM plan.categoria c WHERE plantilla_codigo = 'vivienda';
SELECT nombre, moneda, monto, dia_vencimiento FROM plan.pago_fijo;

\echo '== R1 la co-administradora ve las cuentas; un integrante con ingresos no configura (debe FALLAR)'
SELECT set_config('request.jwt.claims', :'ana', false) \g /dev/null
SELECT count(*) AS cuentas_visibles FROM fin.cuenta;
RESET ROLE;
INSERT INTO gob.integrante(id, hogar_id, usuario_auth_id, nombre, rol)
SELECT 'bbbbbbbb-0000-0000-0000-000000000009', id, 'aaaaaaaa-0000-0000-0000-000000000009', 'Tío', 'ING' FROM gob.hogar;
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000009","role":"authenticated"}', false) \g /dev/null
INSERT INTO fin.cuenta(hogar_id, nombre, tipo) SELECT id, 'Intrusa', 'vista' FROM gob.hogar;
SELECT app.aplicar_plantilla_categorias();
