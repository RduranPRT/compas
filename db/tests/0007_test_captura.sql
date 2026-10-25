-- Pruebas de la migración 0007: captura y clasificación de movimientos (spec 005)
\set ON_ERROR_STOP 0
\set QUIET 1
\set filas '[{"codigo":"inicio_piloto","valor":"2026-10-01","regla_codigo":"R41"},{"codigo":"mes_primer_plan","valor":"2026-12-01","regla_codigo":null},{"codigo":"confianza_ia_min","valor":0.8,"regla_codigo":"R36"},{"codigo":"umbral_ajuste_ingreso_pct","valor":5,"regla_codigo":"R33"},{"codigo":"tratamiento_cuotas_default","valor":"por_cuota","regla_codigo":null}]'
\set rodrigo '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","email":"rodrigo@ejemplo.cl","role":"authenticated"}'
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', :'rodrigo', false) \g /dev/null
SELECT app.crear_hogar('Durán Damann', 'Rodrigo') \g /dev/null
SELECT app.proponer_acuerdo(:'filas'::jsonb, true) \g /dev/null
SELECT app.aplicar_plantilla_categorias() \g /dev/null
INSERT INTO fin.cuenta(hogar_id, nombre, tipo, dia_facturacion, dia_pago) SELECT id, 'Visa', 'tarjeta_credito', 25, 5 FROM gob.hogar;
INSERT INTO fin.cuenta(hogar_id, nombre, tipo, saldo_inicial) SELECT id, 'Cuenta corriente', 'vista', 850000 FROM gob.hogar;
INSERT INTO plan.ingreso_esperado(hogar_id, integrante_id, descripcion, tipo_ingreso, monto, vigente_desde)
SELECT hogar_id, id, 'Sueldo', 'sueldo', 2400000, '2026-10-01' FROM gob.integrante;
SELECT app.asegurar_mes('2026-11-01') \g /dev/null
-- atajos
CREATE TEMP VIEW s AS SELECT v.id, v.nombre, v.mes, v.saldo, v.gastado FROM plan.v_sobre v;
\set visa '(SELECT id FROM fin.cuenta WHERE nombre = ''Visa'')'
\set cc '(SELECT id FROM fin.cuenta WHERE nombre = ''Cuenta corriente'')'
\set alim '(SELECT id FROM s WHERE nombre = ''Alimentación'' AND mes = ''2026-11-01'')'
\set vest '(SELECT id FROM s WHERE nombre = ''Vestuario'' AND mes = ''2026-11-01'')'

\echo '== G1 captura rápida: $12.990 en Alimentación con la Visa queda confirmada con la intención de la categoría (R17)'
SELECT r->>'estado' AS estado, r->>'duplicado' AS duplicado
  FROM app.registrar_gasto('11111111-0000-0000-0000-000000000001', :visa, :alim, 12990, '2026-11-03') r;
SELECT tipo, estado, origen, fecha_contable, monto_clp, intencion, sobre FROM fin.v_movimiento;
SELECT nombre, gastado, saldo FROM s WHERE nombre IN ('Alimentación','Pago Visa') AND mes = '2026-11-01' ORDER BY nombre;

\echo '== G2 la cola reenvía la misma captura: se responde la ya registrada (D11)'
SELECT r->>'repetida' AS repetida FROM app.registrar_gasto('11111111-0000-0000-0000-000000000001', :visa, :alim, 12990, '2026-11-03') r;
SELECT count(*) AS movimientos FROM fin.movimiento;

\echo '== G3 duplicado candidato: mismo monto, misma tarjeta, al día siguiente (R35)'
SELECT r->>'estado' AS estado, r->>'duplicado' AS duplicado FROM app.registrar_gasto(NULL, :visa, :alim, 12990, '2026-11-04') r;
SELECT estado, count(*) FROM fin.duplicado_candidato GROUP BY estado;
RESET ROLE;
SELECT tipo FROM sys.evento_dominio WHERE tipo IN ('DuplicadoCandidato','MovimientoPorConfirmar') ORDER BY tipo;
SET ROLE authenticated;

\echo '== G4 compra de $300.000 en 3 cuotas por_cuota: $100.000 en Vestuario de nov, dic y ene, y reserva en Pago Visa de cada mes (R26, D32, R44)'
SELECT r->>'estado' AS estado FROM app.registrar_gasto(NULL, :visa, :vest, 300000, '2026-11-08', 'Tienda', NULL, NULL, 3, 'por_cuota') r;
SELECT nombre, mes, gastado, saldo FROM s WHERE nombre IN ('Vestuario','Pago Visa') AND gastado <> 0 OR (nombre = 'Pago Visa' AND saldo <> 0)
 ORDER BY nombre, mes;
SELECT d.tipo, d.n_cuotas, d.cuota_monto, d.saldo_actual, count(c.*) AS cuotas, min(c.mes_facturacion) AS primera, max(c.mes_facturacion) AS ultima
  FROM fin.deuda d JOIN fin.cuota_deuda c ON c.deuda_id = d.id GROUP BY d.id;

\echo '== G5 la misma compra con tratamiento total: $300.000 en el mes de compra y sin deuda (D08)'
SELECT r->>'estado' AS estado FROM app.registrar_gasto(NULL, :visa, :vest, 300001, '2026-11-09', 'Tienda', NULL, NULL, 3, 'total') r;
SELECT count(*) AS imputaciones, sum(i.monto_clp) FROM fin.imputacion i JOIN fin.movimiento m ON m.id = i.movimiento_id WHERE m.monto_clp = 300001;
SELECT count(*) AS deudas FROM fin.deuda;

\echo '== G6 cuotas con cuenta corriente (debe FALLAR)'
SELECT app.registrar_gasto(NULL, :cc, :vest, 90000, '2026-11-09', NULL, NULL, NULL, 3);

\echo '== G7 devolución de $15.000 de la compra total: vuelve a Vestuario y libera la reserva de Visa (R29, R44)'
SELECT nombre, saldo FROM s WHERE nombre IN ('Vestuario','Pago Visa') AND mes = '2026-11-01' ORDER BY nombre;
SELECT r->>'estado' AS estado FROM app.registrar_reembolso(NULL, (SELECT id FROM fin.movimiento WHERE monto_clp = 300001), 15000, '2026-11-12') r;
SELECT nombre, saldo FROM s WHERE nombre IN ('Vestuario','Pago Visa') AND mes = '2026-11-01' ORDER BY nombre;

\echo '== G8 devolver más de lo comprado (debe FALLAR)'
SELECT app.registrar_reembolso(NULL, (SELECT id FROM fin.movimiento WHERE monto_clp = 300001), 300000, '2026-11-12');

\echo '== G9 propuesta de la IA con confianza 0,5: queda por confirmar (R36)'
SELECT r->>'estado' AS estado FROM app.registrar_gasto(NULL, :cc, :alim, 8000, '2026-11-10', 'Feria', NULL, NULL, 1, NULL, 'chat', 0.5) r;

\echo '== B1 bandeja: pendientes por antigüedad'
SELECT monto_clp, estado, origen FROM fin.v_movimiento WHERE estado = 'por_confirmar' ORDER BY creado_en;

\echo '== B2 la CAD corrige el sobre del chat y confirma; resuelve el duplicado como duplicado'
SELECT app.confirmar_movimiento((SELECT id FROM fin.movimiento WHERE origen = 'chat'), :vest, 'deseo');
SELECT estado, intencion, sobre FROM fin.v_movimiento WHERE origen = 'chat';
SELECT app.resolver_duplicado((SELECT id FROM fin.duplicado_candidato), true);
SELECT monto_clp, estado FROM fin.movimiento WHERE monto_clp = 12990 ORDER BY creado_en;
SELECT gastado, saldo FROM s WHERE id = :alim;

\echo '== B3 descartar un gasto confirmado deja asientos de signo contrario (I2)'
SELECT app.descartar_movimiento((SELECT id FROM fin.movimiento WHERE monto_clp = 12990 AND estado = 'confirmado'));
SELECT gastado, saldo FROM s WHERE id = :alim;
SELECT count(*) AS asientos, sum(l.monto_clp) AS neto FROM plan.libro_sobre l JOIN fin.movimiento m ON m.id = l.origen_id WHERE m.estado = 'descartado';

\echo '== N1 ingreso base menor al esperado: diferencia -8,33 % y entra a Por asignar (R33, R45)'
SELECT r->>'diferencia_pct' AS dif, r->>'ajuste_sugerido' AS ajuste
  FROM app.registrar_ingreso(NULL, :cc, 2200000, '2026-11-28', (SELECT id FROM gob.integrante), 'sueldo') r;
SELECT saldo FROM s WHERE nombre = 'Por asignar' AND mes = '2026-11-01';

\echo '== N2 bono variable desde el día 20 para el mes siguiente: no se compara con el base (D01, R45)'
SELECT r->>'diferencia_pct' AS dif FROM app.registrar_ingreso(NULL, :cc, 600000, '2026-11-25', (SELECT id FROM gob.integrante), 'bono', true, true) r;
SELECT mes, saldo FROM s WHERE nombre = 'Por asignar' ORDER BY mes;

\echo '== L1 línea base: los sobres negativos de noviembre no avisan; los de diciembre en adelante sí, incluidas las cuotas (spec 005)'
RESET ROLE;
SELECT p.mes, count(*) AS avisos FROM sys.evento_dominio e JOIN plan.sobre so ON so.id = (e.carga->>'sobre_id')::uuid JOIN plan.periodo p ON p.id = so.periodo_id WHERE e.tipo = 'SobreNegativo' GROUP BY p.mes ORDER BY p.mes;
SET ROLE authenticated;
SELECT app.registrar_gasto(NULL, :cc, (SELECT id FROM s WHERE nombre = 'Ocio y salidas' AND mes = '2026-11-01'), 5000, '2026-12-02') \g /dev/null
RESET ROLE;
SELECT p.mes, count(*) AS avisos FROM sys.evento_dominio e JOIN plan.sobre so ON so.id = (e.carga->>'sobre_id')::uuid JOIN plan.periodo p ON p.id = so.periodo_id WHERE e.tipo = 'SobreNegativo' GROUP BY p.mes ORDER BY p.mes;
SET ROLE authenticated;

\echo '== L2 gasto en sobre cerrado: se imputa igual y abre N1 (R11)'
RESET ROLE;
UPDATE plan.sobre SET cerrado = true WHERE id = (SELECT id FROM plan.v_sobre WHERE nombre = 'Ocio y salidas' AND mes = '2026-12-01');
SET ROLE authenticated;
SELECT r->>'estado' AS estado FROM app.registrar_gasto(NULL, :cc, (SELECT id FROM s WHERE nombre = 'Ocio y salidas' AND mes = '2026-11-01'), 3000, '2026-12-03') r;
SELECT nivel, regla_codigo, estado FROM med.evento_recuperacion;

\echo '== P1 un sobre de Por asignar no recibe gastos (debe FALLAR)'
SELECT app.registrar_gasto(NULL, :cc, (SELECT id FROM s WHERE nombre = 'Por asignar' AND mes = '2026-11-01'), 1000, '2026-11-03');
