-- Pruebas de humo de invariantes y RLS (ejecutar sobre una base recién creada con 0001 + seed)
-- Cada bloque imprime "== Tn ..." y su resultado; los marcados "debe FALLAR" deben terminar en ERROR.
\set ON_ERROR_STOP 0
\set QUIET 1
-- Fixtures como superusuario
INSERT INTO gob.hogar(id,nombre,etapa_codigo) VALUES ('11111111-1111-1111-1111-111111111111','Hogar Prueba','E3'),
                                                    ('22222222-2222-2222-2222-222222222222','Otro hogar','E1');
INSERT INTO gob.integrante(id,hogar_id,nombre,rol) VALUES
 ('a0000000-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','Org','ORG'),
 ('a0000000-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111','Cad','CAD'),
 ('b0000000-0000-0000-0000-000000000001','22222222-2222-2222-2222-222222222222','Otro','ORG');
INSERT INTO gob.integrante(id,hogar_id,nombre,rol,es_menor) VALUES
 ('a0000000-0000-0000-0000-000000000003','11111111-1111-1111-1111-111111111111','Menor','MEN',true);
INSERT INTO plan.periodo(id,hogar_id,mes) VALUES ('c0000000-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','2026-10-01'),
                                              ('c0000000-0000-0000-0000-000000000009','22222222-2222-2222-2222-222222222222','2026-10-01');
INSERT INTO plan.categoria(id,hogar_id,nombre,bloque_codigo,tipo_sobre,es_cuatro_paredes) VALUES
 ('d0000000-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','Alimentación','ESENCIALES','variable',true),
 ('d0000000-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111','Futuro','FUTURO','futuro',false),
 ('d0000000-0000-0000-0000-000000000003','11111111-1111-1111-1111-111111111111','Mesada','VIDA','mesada',false);
INSERT INTO plan.sobre(id,hogar_id,periodo_id,categoria_id,tipo,integrante_id) VALUES
 ('e0000000-0000-0000-0000-000000000000','11111111-1111-1111-1111-111111111111','c0000000-0000-0000-0000-000000000001',NULL,'por_asignar',NULL),
 ('e0000000-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','c0000000-0000-0000-0000-000000000001','d0000000-0000-0000-0000-000000000001','variable',NULL),
 ('e0000000-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111','c0000000-0000-0000-0000-000000000001','d0000000-0000-0000-0000-000000000002','futuro',NULL),
 ('e0000000-0000-0000-0000-000000000003','11111111-1111-1111-1111-111111111111','c0000000-0000-0000-0000-000000000001','d0000000-0000-0000-0000-000000000003','mesada','a0000000-0000-0000-0000-000000000003');
INSERT INTO fin.cuenta(id,hogar_id,nombre,tipo) VALUES
 ('f0000000-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','Cuenta corriente','vista'),
 ('f0000000-0000-0000-0000-000000000009','22222222-2222-2222-2222-222222222222','Cuenta otro','vista');
INSERT INTO fin.movimiento(hogar_id,periodo_id,cuenta_id,tipo,origen,fecha_contable,monto_clp,registrado_por)
VALUES ('22222222-2222-2222-2222-222222222222','c0000000-0000-0000-0000-000000000009','f0000000-0000-0000-0000-000000000009','gasto','manual','2026-10-02',9999,'b0000000-0000-0000-0000-000000000001');

-- Sesión como ORG del hogar 1
SET ROLE compas_app;
SELECT set_config('app.hogar_id','11111111-1111-1111-1111-111111111111',false),
       set_config('app.integrante_id','a0000000-0000-0000-0000-000000000001',false) \g /dev/null

\echo '== T1 ingreso confirmado entra a Por asignar'
BEGIN;
INSERT INTO fin.movimiento(id,hogar_id,periodo_id,cuenta_id,tipo,origen,fecha_contable,monto_clp,registrado_por)
VALUES ('10000000-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','c0000000-0000-0000-0000-000000000001',
        'f0000000-0000-0000-0000-000000000001','ingreso','manual','2026-10-01',2000000,'a0000000-0000-0000-0000-000000000001');
INSERT INTO fin.ingreso(movimiento_id,integrante_id,tipo_ingreso) VALUES ('10000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000001','sueldo');
UPDATE fin.movimiento SET estado='confirmado', confirmado_en=now(), confirmado_por='a0000000-0000-0000-0000-000000000001'
 WHERE id='10000000-0000-0000-0000-000000000001';
COMMIT;
SELECT tipo, saldo FROM plan.v_saldo_sobre WHERE tipo='por_asignar';

\echo '== T2 asignar 1.800.000 + 200.000 (debe pasar)'
BEGIN;
INSERT INTO plan.asignacion(hogar_id,ingreso_id,sobre_id,monto_clp,confirmada_por) VALUES
 ('11111111-1111-1111-1111-111111111111','10000000-0000-0000-0000-000000000001','e0000000-0000-0000-0000-000000000001',1800000,'a0000000-0000-0000-0000-000000000001'),
 ('11111111-1111-1111-1111-111111111111','10000000-0000-0000-0000-000000000001','e0000000-0000-0000-0000-000000000002',200000,'a0000000-0000-0000-0000-000000000001');
COMMIT;
SELECT tipo, saldo FROM plan.v_saldo_sobre ORDER BY tipo;

\echo '== T3 R01: asignar 1 peso más debe FALLAR'
BEGIN;
INSERT INTO plan.asignacion(hogar_id,ingreso_id,sobre_id,monto_clp,confirmada_por) VALUES
 ('11111111-1111-1111-1111-111111111111','10000000-0000-0000-0000-000000000001','e0000000-0000-0000-0000-000000000003',1,'a0000000-0000-0000-0000-000000000001');
COMMIT;

\echo '== T4 gasto 50.000 con imputación (debe pasar) y sin imputación (debe FALLAR)'
BEGIN;
INSERT INTO fin.movimiento(id,hogar_id,periodo_id,cuenta_id,tipo,origen,fecha_contable,monto_clp,registrado_por)
VALUES ('10000000-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111','c0000000-0000-0000-0000-000000000001',
        'f0000000-0000-0000-0000-000000000001','gasto','chat','2026-10-03',50000,'a0000000-0000-0000-0000-000000000001');
INSERT INTO fin.imputacion(hogar_id,movimiento_id,sobre_id,monto_clp) VALUES
 ('11111111-1111-1111-1111-111111111111','10000000-0000-0000-0000-000000000002','e0000000-0000-0000-0000-000000000001',50000);
UPDATE fin.movimiento SET estado='confirmado', confirmado_en=now() WHERE id='10000000-0000-0000-0000-000000000002';
COMMIT;
SELECT tipo, disponible, gastado, saldo FROM plan.v_saldo_sobre WHERE tipo='variable';
BEGIN;
INSERT INTO fin.movimiento(id,hogar_id,periodo_id,cuenta_id,tipo,origen,fecha_contable,monto_clp,registrado_por)
VALUES ('10000000-0000-0000-0000-000000000003','11111111-1111-1111-1111-111111111111','c0000000-0000-0000-0000-000000000001',
        'f0000000-0000-0000-0000-000000000001','gasto','chat','2026-10-03',30000,'a0000000-0000-0000-0000-000000000001');
UPDATE fin.movimiento SET estado='confirmado', confirmado_en=now() WHERE id='10000000-0000-0000-0000-000000000003';
COMMIT;

\echo '== T5 R37: reasignar desde Futuro sin doble firma debe FALLAR'
INSERT INTO plan.reasignacion(hogar_id,periodo_id,sobre_origen_id,sobre_destino_id,monto_clp,registrada_por,autoaprobada,aplicada_en)
VALUES ('11111111-1111-1111-1111-111111111111','c0000000-0000-0000-0000-000000000001','e0000000-0000-0000-0000-000000000002',
        'e0000000-0000-0000-0000-000000000001',10000,'a0000000-0000-0000-0000-000000000001',true,now());

\echo '== T6 R37: con doble firma (ORG + CAD) debe pasar'
INSERT INTO gob.solicitud_aprobacion(id,hogar_id,tipo,objeto_tabla,objeto_id,firmas_requeridas,vence_en,solicitada_por)
VALUES ('50000000-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','retiro_futuro','plan.reasignacion',
        gen_random_uuid(),2,now()+interval '48 hours','a0000000-0000-0000-0000-000000000001');
INSERT INTO gob.firma(solicitud_id,integrante_id,decision) VALUES ('50000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000001','aprueba');
SELECT set_config('app.integrante_id','a0000000-0000-0000-0000-000000000002',false) \g /dev/null
INSERT INTO gob.firma(solicitud_id,integrante_id,decision) VALUES ('50000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000002','aprueba');
SELECT estado FROM gob.solicitud_aprobacion WHERE id='50000000-0000-0000-0000-000000000001';
INSERT INTO plan.reasignacion(hogar_id,periodo_id,sobre_origen_id,sobre_destino_id,monto_clp,registrada_por,solicitud_id,aplicada_en)
VALUES ('11111111-1111-1111-1111-111111111111','c0000000-0000-0000-0000-000000000001','e0000000-0000-0000-0000-000000000002',
        'e0000000-0000-0000-0000-000000000001',10000,'a0000000-0000-0000-0000-000000000002','50000000-0000-0000-0000-000000000001',now());
SELECT tipo, saldo FROM plan.v_saldo_sobre WHERE tipo IN ('futuro','variable') ORDER BY tipo;

\echo '== T7 RLS: el otro hogar es invisible (esperado 0)'
SELECT count(*) AS movimientos_otro_hogar FROM fin.movimiento WHERE hogar_id='22222222-2222-2222-2222-222222222222';
\echo '== T8 RLS: insertar en otro hogar debe FALLAR'
INSERT INTO fin.cuenta(hogar_id,nombre,tipo) VALUES ('22222222-2222-2222-2222-222222222222','intrusa','vista');

\echo '== T9 RLS menor: solo ve su sobre (esperado 1) y ninguna cuenta (esperado 0)'
SELECT set_config('app.integrante_id','a0000000-0000-0000-0000-000000000003',false) \g /dev/null
SELECT count(*) AS sobres_visibles FROM plan.sobre;
SELECT count(*) AS cuentas_visibles FROM fin.cuenta;
\echo '== T10 libro inmutable: el app no puede escribir el libro'
INSERT INTO plan.libro_sobre(hogar_id,sobre_id,tipo,monto_clp,origen_tabla,fecha_valor)
VALUES ('11111111-1111-1111-1111-111111111111','e0000000-0000-0000-0000-000000000003','ajuste',999999,'manual',current_date);
RESET ROLE;

\echo '== T11 IA: imputar a Futuro debe FALLAR; firmar debe FALLAR'
SET ROLE compas_ia;
SELECT set_config('app.integrante_id','',false) \g /dev/null
INSERT INTO fin.imputacion(hogar_id,movimiento_id,sobre_id,monto_clp,creada_por_tipo) VALUES
 ('11111111-1111-1111-1111-111111111111','10000000-0000-0000-0000-000000000002','e0000000-0000-0000-0000-000000000002',1000,'ia');
INSERT INTO gob.firma(solicitud_id,integrante_id,decision) VALUES ('50000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000001','aprueba');
RESET ROLE;

\echo '== T12 período cerrado: modificar movimiento debe FALLAR'
UPDATE plan.periodo SET estado='cerrado', cerrado_en=now() WHERE id='c0000000-0000-0000-0000-000000000001';
UPDATE fin.movimiento SET nota='cambio' WHERE id='10000000-0000-0000-0000-000000000002';

\echo '== T13 auditoría registrada (esperado > 0)'
SELECT count(*) AS filas_auditoria FROM sys.auditoria;

\echo '== T14 base cero: aprobar con líneas ≠ ingreso proyectado debe FALLAR; cuadrado debe pasar'
UPDATE plan.periodo SET estado='abierto' WHERE id='c0000000-0000-0000-0000-000000000001';
INSERT INTO plan.presupuesto_mensual(id,hogar_id,periodo_id,version,ingreso_proyectado,etapa_codigo)
VALUES ('70000000-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','c0000000-0000-0000-0000-000000000001',1,2000000,'E3');
INSERT INTO plan.linea_plan(presupuesto_id,sobre_id,monto_proyectado) VALUES
 ('70000000-0000-0000-0000-000000000001','e0000000-0000-0000-0000-000000000001',1700000),
 ('70000000-0000-0000-0000-000000000001','e0000000-0000-0000-0000-000000000002',200000);
UPDATE plan.presupuesto_mensual SET estado='aprobado', aprobado_en=now() WHERE id='70000000-0000-0000-0000-000000000001';
INSERT INTO plan.linea_plan(presupuesto_id,sobre_id,monto_proyectado) VALUES
 ('70000000-0000-0000-0000-000000000001','e0000000-0000-0000-0000-000000000003',100000);
UPDATE plan.presupuesto_mensual SET estado='aprobado', aprobado_en=now() WHERE id='70000000-0000-0000-0000-000000000001';
SELECT estado FROM plan.presupuesto_mensual WHERE id='70000000-0000-0000-0000-000000000001';
