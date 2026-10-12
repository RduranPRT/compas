-- Pruebas de la migración 0002 (piloto): cartolas, corte del piloto, tarjeta de crédito, cuotas, perfil.
-- Ejecutar sobre una base con 0001 + seed + 0002, sin datos previos.
\set ON_ERROR_STOP 0
\set QUIET 1
-- Fixtures como superusuario
INSERT INTO gob.hogar(id,nombre,etapa_codigo) VALUES ('11111111-1111-1111-1111-111111111111','Hogar Piloto','E1');
INSERT INTO gob.integrante(id,hogar_id,nombre,rol) VALUES
 ('a0000000-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','Org','ORG'),
 ('a0000000-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111','Cad','CAD');
INSERT INTO gob.integrante(id,hogar_id,nombre,rol,es_menor) VALUES
 ('a0000000-0000-0000-0000-000000000003','11111111-1111-1111-1111-111111111111','Menor','MEN',true);
INSERT INTO gob.acuerdo_hogar(id,hogar_id,version,estado,vigencia_desde,creado_por)
VALUES ('90000000-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111',1,'vigente','2026-10-01','a0000000-0000-0000-0000-000000000001');
INSERT INTO gob.regla_hogar(acuerdo_id,codigo,valor) VALUES
 ('90000000-0000-0000-0000-000000000001','inicio_piloto','"2026-10-01"'),
 ('90000000-0000-0000-0000-000000000001','tratamiento_cuotas_default','"por_cuota"');
INSERT INTO plan.periodo(id,hogar_id,mes) VALUES ('c0000000-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','2026-10-01');
INSERT INTO plan.categoria(id,hogar_id,nombre,bloque_codigo,tipo_sobre,es_cuatro_paredes) VALUES
 ('d0000000-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','Alimentación','ESENCIALES','variable',true);
INSERT INTO plan.sobre(id,hogar_id,periodo_id,categoria_id,tipo) VALUES
 ('e0000000-0000-0000-0000-000000000000','11111111-1111-1111-1111-111111111111','c0000000-0000-0000-0000-000000000001',NULL,'por_asignar'),
 ('e0000000-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','c0000000-0000-0000-0000-000000000001','d0000000-0000-0000-0000-000000000001','variable');
INSERT INTO fin.cuenta(id,hogar_id,nombre,tipo) VALUES
 ('f0000000-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','Cuenta corriente','vista');
INSERT INTO fin.cuenta(id,hogar_id,nombre,tipo,dia_facturacion,dia_pago,cupo) VALUES
 ('f0000000-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111','Visa','tarjeta_credito',25,5,3000000);

SET ROLE compas_app;
SELECT set_config('app.hogar_id','11111111-1111-1111-1111-111111111111',false),
       set_config('app.integrante_id','a0000000-0000-0000-0000-000000000001',false) \g /dev/null

\echo '== P1 importación registrada (debe pasar) y mismo archivo dos veces (debe FALLAR)'
INSERT INTO fin.importacion(id,hogar_id,cuenta_id,archivo_nombre,formato,sha256,storage_uri,desde,hasta,subida_por)
VALUES ('80000000-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','f0000000-0000-0000-0000-000000000002',
        'estado_visa_sep.pdf','pdf','abc123','cartolas/abc123.pdf','2026-09-01','2026-10-15','a0000000-0000-0000-0000-000000000001');
SELECT estado, (expira_en::date - creado_en::date) AS dias_retencion FROM fin.importacion;
INSERT INTO fin.importacion(hogar_id,cuenta_id,archivo_nombre,formato,sha256,subida_por)
VALUES ('11111111-1111-1111-1111-111111111111','f0000000-0000-0000-0000-000000000002','copia.pdf','pdf','abc123','a0000000-0000-0000-0000-000000000001');

\echo '== P2 R41: histórico de septiembre (debe pasar); histórico de octubre (debe FALLAR)'
INSERT INTO fin.movimiento_historico(hogar_id,importacion_id,cuenta_id,fecha,sentido,monto_clp,glosa,hash_linea)
VALUES ('11111111-1111-1111-1111-111111111111','80000000-0000-0000-0000-000000000001','f0000000-0000-0000-0000-000000000002',
        '2026-09-12','cargo',45990,'SUPERMERCADO','h-sep-1');
INSERT INTO fin.movimiento_historico(hogar_id,importacion_id,cuenta_id,fecha,sentido,monto_clp,glosa,hash_linea)
VALUES ('11111111-1111-1111-1111-111111111111','80000000-0000-0000-0000-000000000001','f0000000-0000-0000-0000-000000000002',
        '2026-10-03','cargo',12000,'FARMACIA','h-oct-1');

\echo '== P3 R41/R42: movimiento de cartola de septiembre (debe FALLAR); de octubre confirmado directo (debe FALLAR); por confirmar (debe pasar)'
INSERT INTO fin.movimiento(hogar_id,periodo_id,cuenta_id,tipo,origen,importacion_id,fecha_contable,monto_clp,registrado_por,hash_linea)
VALUES ('11111111-1111-1111-1111-111111111111','c0000000-0000-0000-0000-000000000001','f0000000-0000-0000-0000-000000000002',
        'gasto','cartola','80000000-0000-0000-0000-000000000001','2026-09-28',8000,'a0000000-0000-0000-0000-000000000001','h-sep-2');
INSERT INTO fin.movimiento(hogar_id,periodo_id,cuenta_id,tipo,origen,importacion_id,fecha_contable,monto_clp,registrado_por,hash_linea,estado,confirmado_en)
VALUES ('11111111-1111-1111-1111-111111111111','c0000000-0000-0000-0000-000000000001','f0000000-0000-0000-0000-000000000002',
        'gasto','cartola','80000000-0000-0000-0000-000000000001','2026-10-03',12000,'a0000000-0000-0000-0000-000000000001','h-oct-1','confirmado',now());
INSERT INTO fin.movimiento(id,hogar_id,periodo_id,cuenta_id,tipo,origen,importacion_id,fecha_contable,monto_clp,registrado_por,hash_linea,estado)
VALUES ('10000000-0000-0000-0000-000000000010','11111111-1111-1111-1111-111111111111','c0000000-0000-0000-0000-000000000001','f0000000-0000-0000-0000-000000000002',
        'gasto','cartola','80000000-0000-0000-0000-000000000001','2026-10-03',12000,'a0000000-0000-0000-0000-000000000001','h-oct-1','por_confirmar');
SELECT estado, origen FROM fin.movimiento WHERE id='10000000-0000-0000-0000-000000000010';

\echo '== P4 re-importar la misma línea de cartola (debe FALLAR)'
INSERT INTO fin.movimiento(hogar_id,periodo_id,cuenta_id,tipo,origen,importacion_id,fecha_contable,monto_clp,registrado_por,hash_linea,estado)
VALUES ('11111111-1111-1111-1111-111111111111','c0000000-0000-0000-0000-000000000001','f0000000-0000-0000-0000-000000000002',
        'gasto','cartola','80000000-0000-0000-0000-000000000001','2026-10-03',12000,'a0000000-0000-0000-0000-000000000001','h-oct-1','por_confirmar');

\echo '== P5 ingreso de 1.000.000 y asignación de 300.000 a Alimentación'
BEGIN;
INSERT INTO fin.movimiento(id,hogar_id,periodo_id,cuenta_id,tipo,origen,fecha_contable,monto_clp,registrado_por)
VALUES ('10000000-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','c0000000-0000-0000-0000-000000000001',
        'f0000000-0000-0000-0000-000000000001','ingreso','manual','2026-10-01',1000000,'a0000000-0000-0000-0000-000000000001');
INSERT INTO fin.ingreso(movimiento_id,integrante_id,tipo_ingreso) VALUES ('10000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000001','sueldo');
UPDATE fin.movimiento SET estado='confirmado', confirmado_en=now() WHERE id='10000000-0000-0000-0000-000000000001';
COMMIT;
INSERT INTO plan.asignacion(hogar_id,ingreso_id,sobre_id,monto_clp,confirmada_por) VALUES
 ('11111111-1111-1111-1111-111111111111','10000000-0000-0000-0000-000000000001','e0000000-0000-0000-0000-000000000001',300000,'a0000000-0000-0000-0000-000000000001');

\echo '== P6 R44: gasto 100.000 con tarjeta → Alimentación 200.000 y Pago Visa 100.000'
BEGIN;
INSERT INTO fin.movimiento(id,hogar_id,periodo_id,cuenta_id,tipo,origen,fecha_contable,monto_clp,registrado_por)
VALUES ('10000000-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111','c0000000-0000-0000-0000-000000000001',
        'f0000000-0000-0000-0000-000000000002','gasto','manual','2026-10-05',100000,'a0000000-0000-0000-0000-000000000001');
INSERT INTO fin.imputacion(hogar_id,movimiento_id,sobre_id,monto_clp) VALUES
 ('11111111-1111-1111-1111-111111111111','10000000-0000-0000-0000-000000000002','e0000000-0000-0000-0000-000000000001',100000);
UPDATE fin.movimiento SET estado='confirmado', confirmado_en=now() WHERE id='10000000-0000-0000-0000-000000000002';
COMMIT;
SELECT tipo, disponible, gastado, saldo FROM plan.v_saldo_sobre ORDER BY tipo;

\echo '== P7 R27/R44: pago de 100.000 a la Visa → Pago Visa queda en 0'
INSERT INTO fin.transferencia(id,hogar_id,cuenta_origen_id,cuenta_destino_id,tipo,monto_clp,fecha,estado,hecha_por,hecha_en)
VALUES ('60000000-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','f0000000-0000-0000-0000-000000000001',
        'f0000000-0000-0000-0000-000000000002','pago_tarjeta',100000,'2026-10-06','hecha','a0000000-0000-0000-0000-000000000001',now());
SELECT tipo, saldo FROM plan.v_saldo_sobre WHERE tipo='pago_tarjeta';

\echo '== P8 pago de tarjeta hacia cuenta que no es tarjeta (debe FALLAR)'
INSERT INTO fin.transferencia(hogar_id,cuenta_origen_id,cuenta_destino_id,tipo,monto_clp,fecha,estado)
VALUES ('11111111-1111-1111-1111-111111111111','f0000000-0000-0000-0000-000000000002','f0000000-0000-0000-0000-000000000001',
        'pago_tarjeta',5000,'2026-10-06','hecha');

\echo '== P9 descartar el gasto con tarjeta revierte categoría y reserva (Alimentación 300.000, Pago Visa -100.000)'
UPDATE fin.movimiento SET estado='descartado' WHERE id='10000000-0000-0000-0000-000000000002';
SELECT tipo, saldo FROM plan.v_saldo_sobre WHERE tipo IN ('variable','pago_tarjeta') ORDER BY tipo;

\echo '== P10 cuotas: 3 cuotas sin tratamiento (debe FALLAR); con tratamiento por_cuota (debe pasar)'
INSERT INTO fin.movimiento(hogar_id,periodo_id,cuenta_id,tipo,origen,fecha_contable,monto_clp,registrado_por,n_cuotas)
VALUES ('11111111-1111-1111-1111-111111111111','c0000000-0000-0000-0000-000000000001','f0000000-0000-0000-0000-000000000002',
        'gasto','manual','2026-10-07',90000,'a0000000-0000-0000-0000-000000000001',3);
INSERT INTO fin.movimiento(hogar_id,periodo_id,cuenta_id,tipo,origen,fecha_contable,monto_clp,registrado_por,n_cuotas,tratamiento_cuotas)
VALUES ('11111111-1111-1111-1111-111111111111','c0000000-0000-0000-0000-000000000001','f0000000-0000-0000-0000-000000000002',
        'gasto','manual','2026-10-07',90000,'a0000000-0000-0000-0000-000000000001',3,'por_cuota');
SELECT count(*) AS compras_en_cuotas FROM fin.movimiento WHERE n_cuotas = 3;

\echo '== P11 perfil inicial (debe pasar) y aceptar sin revisor (debe FALLAR)'
INSERT INTO med.perfil_inicial(id,hogar_id,version,desde,hasta,importaciones,perfil,retroalimentacion,etapa_sugerida,modelo)
VALUES ('b1000000-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111',1,'2026-07-01','2026-09-30',
        ARRAY['80000000-0000-0000-0000-000000000001']::uuid[],'{"ingreso_base":1000000}','[]','E1','claude-haiku-5-5');
UPDATE med.perfil_inicial SET estado='aceptado' WHERE id='b1000000-0000-0000-0000-000000000001';

\echo '== P12 RLS menor: no ve importaciones ni perfil (esperado 0 y 0)'
SELECT set_config('app.integrante_id','a0000000-0000-0000-0000-000000000003',false) \g /dev/null
SELECT count(*) AS importaciones_visibles FROM fin.importacion;
SELECT count(*) AS perfiles_visibles FROM med.perfil_inicial;
RESET ROLE;

\echo '== P13 IA: clasifica el histórico (debe pasar) pero no puede cambiar su monto (debe FALLAR)'
SET ROLE compas_ia;
SELECT set_config('app.integrante_id','',false) \g /dev/null
UPDATE fin.movimiento_historico SET clase='gasto', bloque_codigo='ESENCIALES', confianza_ia=0.93 WHERE hash_linea='h-sep-1';
SELECT clase, bloque_codigo, confianza_ia FROM fin.movimiento_historico;
UPDATE fin.movimiento_historico SET monto_clp=1 WHERE hash_linea='h-sep-1';
RESET ROLE;

\echo '== P14 libro cuadra: suma de todos los sobres = ingresos − gastos imputados − pagos de tarjeta (esperado 0)'
SELECT (SELECT coalesce(sum(saldo),0) FROM plan.v_saldo_sobre)
     - (1000000 - 0 - 100000 + 0) AS diferencia_libro;

\echo '== P15 compra de 300.000 en 3 cuotas por_cuota: 100.000 a Alimentación de oct, nov y dic, y reserva de 100.000 en el pago de Visa de cada mes (D08, R44)'
INSERT INTO plan.periodo(id,hogar_id,mes) VALUES
 ('c0000000-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111','2026-11-01'),
 ('c0000000-0000-0000-0000-000000000003','11111111-1111-1111-1111-111111111111','2026-12-01');
INSERT INTO plan.sobre(id,hogar_id,periodo_id,categoria_id,tipo) VALUES
 ('e0000000-0000-0000-0000-000000000011','11111111-1111-1111-1111-111111111111','c0000000-0000-0000-0000-000000000002','d0000000-0000-0000-0000-000000000001','variable'),
 ('e0000000-0000-0000-0000-000000000021','11111111-1111-1111-1111-111111111111','c0000000-0000-0000-0000-000000000003','d0000000-0000-0000-0000-000000000001','variable');
SET ROLE compas_app;
SELECT set_config('app.integrante_id','a0000000-0000-0000-0000-000000000001',false) \g /dev/null
BEGIN;
INSERT INTO fin.movimiento(id,hogar_id,periodo_id,cuenta_id,tipo,origen,fecha_contable,monto_clp,registrado_por,n_cuotas,tratamiento_cuotas)
VALUES ('10000000-0000-0000-0000-000000000003','11111111-1111-1111-1111-111111111111','c0000000-0000-0000-0000-000000000001',
        'f0000000-0000-0000-0000-000000000002','gasto','manual','2026-10-08',300000,'a0000000-0000-0000-0000-000000000001',3,'por_cuota');
INSERT INTO fin.imputacion(hogar_id,movimiento_id,sobre_id,monto_clp) VALUES
 ('11111111-1111-1111-1111-111111111111','10000000-0000-0000-0000-000000000003','e0000000-0000-0000-0000-000000000001',100000),
 ('11111111-1111-1111-1111-111111111111','10000000-0000-0000-0000-000000000003','e0000000-0000-0000-0000-000000000011',100000),
 ('11111111-1111-1111-1111-111111111111','10000000-0000-0000-0000-000000000003','e0000000-0000-0000-0000-000000000021',100000);
UPDATE fin.movimiento SET estado='confirmado', confirmado_en=now() WHERE id='10000000-0000-0000-0000-000000000003';
COMMIT;
SELECT p.mes, s.tipo, v.saldo FROM plan.v_saldo_sobre v JOIN plan.sobre s ON s.id=v.sobre_id JOIN plan.periodo p ON p.id=s.periodo_id
 WHERE s.tipo IN ('variable','pago_tarjeta') ORDER BY p.mes, s.tipo;
RESET ROLE;
