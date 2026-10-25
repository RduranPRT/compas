-- Pruebas de la migración 0008: importación de cartolas (spec 003)
\set ON_ERROR_STOP 0
\set QUIET 1
\set filas '[{"codigo":"inicio_piloto","valor":"2026-10-01","regla_codigo":"R41"},{"codigo":"mes_primer_plan","valor":"2026-12-01","regla_codigo":null}]'
\set rodrigo '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","email":"rodrigo@ejemplo.cl","role":"authenticated"}'
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', :'rodrigo', false) \g /dev/null
SELECT app.crear_hogar('Durán Damann', 'Rodrigo') \g /dev/null
SELECT app.proponer_acuerdo(:'filas'::jsonb, true) \g /dev/null
SELECT app.aplicar_plantilla_categorias() \g /dev/null
INSERT INTO fin.cuenta(hogar_id, nombre, tipo, dia_facturacion, dia_pago, saldo_inicial) SELECT id, 'Visa', 'tarjeta_credito', 25, 5, -420000 FROM gob.hogar;
INSERT INTO fin.cuenta(hogar_id, nombre, tipo, saldo_inicial) SELECT id, 'Cuenta corriente', 'vista', 850000 FROM gob.hogar;
INSERT INTO fin.cuenta(hogar_id, nombre, tipo) SELECT id, 'Ahorro', 'ahorro' FROM gob.hogar;
\set visa '(SELECT id FROM fin.cuenta WHERE nombre = ''Visa'')'
\set cc '(SELECT id FROM fin.cuenta WHERE nombre = ''Cuenta corriente'')'
\set alim '(SELECT id FROM plan.categoria WHERE plantilla_codigo = ''alimentacion'')'
-- Gasto capturado a mano antes de importar
SELECT app.asegurar_mes('2026-10-01') \g /dev/null
SELECT app.registrar_gasto(NULL, :visa, (SELECT id FROM plan.v_sobre WHERE nombre = 'Alimentación' AND mes = '2026-10-01'), 12990, '2026-10-03', 'Feria') \g /dev/null

\set lineas_cc '[{"fecha":"2026-09-15","monto":-50000,"glosa":"COMPRA JUMBO","comercio":"JUMBO","clase":"gasto","hash":"h01"},{"fecha":"2026-09-30","monto":2400000,"glosa":"ABONO REMUNERACIONES","comercio":"REMUNERACIONES","clase":"ingreso","hash":"h02"},{"fecha":"2026-10-03","monto":-23000,"glosa":"COMPRA JUMBO","comercio":"JUMBO","clase":"gasto","hash":"h03"},{"fecha":"2026-10-05","monto":-420000,"glosa":"PAGO TARJETA VISA","comercio":"PAGO TARJETA","clase":"pago_tarjeta","hash":"h04"},{"fecha":"2026-10-06","monto":-100000,"glosa":"TRASPASO A CUENTA AHORRO","comercio":"TRASPASO","clase":"transferencia_interna","hash":"h05"},{"fecha":"2026-10-08","monto":-15000,"glosa":"COMPRA JUMBO","comercio":"JUMBO","clase":"gasto","hash":"h06"}]'

\echo '== I1 cartola de la cuenta corriente que cruza el inicio del piloto: históricos y movimientos por confirmar (R41, R42)'
SELECT r->>'n_filas' AS filas, r->>'n_historicos' AS historicos, r->>'n_movimientos' AS movimientos,
       r->>'n_duplicados' AS duplicados, r->>'n_transferencias' AS transferencias, r->>'estado' AS estado
  FROM app.importar_cartola(:cc, 'cartola_oct.xlsx', 'xlsx', 'sha-cc-1', 'mapeo_columnas', :'lineas_cc'::jsonb) r;
SELECT fecha, sentido, monto_clp, comercio, clase FROM fin.movimiento_historico ORDER BY fecha;
SELECT tipo, estado, origen, fecha_contable, monto_clp, comercio, sentido FROM fin.movimiento WHERE importacion_id IS NOT NULL ORDER BY fecha_contable;

\echo '== I2 el archivo no se guarda: la importación nace purgada y sin documento (D30, R43)'
SELECT estado, storage_uri IS NULL AS sin_archivo, purgada_en IS NOT NULL AS purgada, desde, hasta FROM fin.importacion;

\echo '== I3 pago de tarjeta: transferencia, no gasto; la deuda previa deja Pago Visa de octubre en -420.000 (R27, spec 008)'
SELECT tipo, estado, monto_clp, fecha FROM fin.transferencia;
SELECT nombre, saldo FROM plan.v_sobre WHERE nombre = 'Pago Visa' AND mes = '2026-10-01';

\echo '== I4 el mismo archivo dos veces (debe FALLAR indicando la fecha anterior)'
SELECT app.importar_cartola(:cc, 'copia.xlsx', 'xlsx', 'sha-cc-1', 'mapeo_columnas', :'lineas_cc'::jsonb);

\echo '== I5 documento traslapado: solo entran las líneas nuevas (huella de línea)'
SELECT r->>'n_movimientos' AS movimientos, r->>'n_duplicados' AS duplicados, r->>'n_historicos' AS historicos
  FROM app.importar_cartola(:cc, 'cartola_oct_2.xlsx', 'xlsx', 'sha-cc-2', 'mapeo_columnas',
   '[{"fecha":"2026-10-03","monto":-23000,"glosa":"COMPRA JUMBO","comercio":"JUMBO","clase":"gasto","hash":"h03"},{"fecha":"2026-10-20","monto":-31000,"glosa":"COMPRA LIDER","comercio":"LIDER","clase":"gasto","hash":"h07"}]'::jsonb) r;

\echo '== I6 estado de cuenta de la Visa: la compra manual se calza y el abono del pago no se duplica (R35, R27)'
SELECT r->>'n_movimientos' AS movimientos, r->>'n_duplicados' AS duplicados
  FROM app.importar_cartola(:visa, 'visa_oct.xlsx', 'xlsx', 'sha-visa-1', 'ia',
   '[{"fecha":"2026-10-04","monto":-12990,"glosa":"FERIA LIBRE","comercio":"FERIA","clase":"gasto","hash":"v01"},{"fecha":"2026-10-06","monto":420000,"glosa":"PAGO RECIBIDO","comercio":"PAGO","clase":"pago_tarjeta","hash":"v02"},{"fecha":"2026-10-10","monto":-45990,"glosa":"FALABELLA","comercio":"FALABELLA","clase":"gasto","hash":"v03","categoria_id":null,"confianza":0.6}]'::jsonb) r;
SELECT origen, monto_clp, estado, calce_importacion_id IS NOT NULL AS calzado FROM fin.movimiento WHERE monto_clp = 12990;
SELECT count(*) AS pagos_tarjeta FROM fin.transferencia;

\echo '== S1 sugerencias de clasificación: nunca confirman ni imputan (R36, P8)'
SELECT app.guardar_sugerencias(jsonb_build_array(
  jsonb_build_object('tabla','movimiento','id',(SELECT id FROM fin.movimiento WHERE comercio = 'FALABELLA'),'categoria_id',
    (SELECT id FROM plan.categoria WHERE plantilla_codigo = 'vestuario'),'confianza',0.92,'modelo','claude-haiku'),
  jsonb_build_object('tabla','historico','id',(SELECT id FROM fin.movimiento_historico WHERE comercio = 'JUMBO'),'categoria_id',:alim,'confianza',0.9)
)) AS sugeridas;
SELECT m.estado, c.nombre AS sugerida, m.confianza_ia, (SELECT count(*) FROM fin.imputacion i WHERE i.movimiento_id = m.id) AS imputaciones
  FROM fin.movimiento m JOIN plan.categoria c ON c.id = m.categoria_sugerida_id WHERE m.comercio = 'FALABELLA';

\echo '== R1 revisión por comercio: confirmar el grupo JUMBO lo imputa a Alimentación y guarda la regla'
SELECT comercio, origen, n, monto, revisado FROM fin.v_revision_comercio WHERE comercio = 'JUMBO' ORDER BY origen;
SELECT app.clasificar_comercio(NULL, 'JUMBO', :alim);
SELECT comercio, origen, n, revisado FROM fin.v_revision_comercio WHERE comercio = 'JUMBO' ORDER BY origen;
SELECT patron, veces_usada FROM fin.regla_comercio;
SELECT gastado FROM plan.v_sobre WHERE nombre = 'Alimentación' AND mes = '2026-10-01';

\echo '== R2 confirmar con la categoría sugerida registra si la IA acertó (D10)'
SELECT app.confirmar_movimiento((SELECT id FROM fin.movimiento WHERE comercio = 'FALABELLA'));
SELECT campo, aceptada FROM ia.inferencia;
SELECT nombre, saldo FROM plan.v_sobre WHERE nombre IN ('Vestuario','Pago Visa') AND mes = '2026-10-01' ORDER BY nombre;

\echo '== R3 las transferencias internas no son ingreso ni gasto (R28)'
SELECT tipo, sentido, estado FROM fin.movimiento WHERE tipo = 'transferencia';
SELECT count(*) AS asientos_transferencia FROM plan.libro_sobre l JOIN fin.movimiento m ON m.id = l.origen_id WHERE m.tipo = 'transferencia';
