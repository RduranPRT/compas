-- Pruebas de la migración 0004: RLS en tablas hijas sin hogar_id y permisos por rol (T005, spec 001)
-- Simula PostgREST con request.jwt.claims, como 0003. Los marcados "debe FALLAR" terminan en ERROR.
\set ON_ERROR_STOP 0
\set QUIET 1
INSERT INTO gob.hogar(id,nombre) VALUES ('11111111-1111-1111-1111-111111111111','Hogar A'),
                                       ('22222222-2222-2222-2222-222222222222','Hogar B');
INSERT INTO gob.integrante(id,hogar_id,usuario_auth_id,nombre,rol,tiene_ingresos) VALUES
 ('a0000000-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','aaaaaaaa-0000-0000-0000-000000000001','Org A','ORG',true),
 ('a0000000-0000-0000-0000-000000000004','11111111-1111-1111-1111-111111111111','aaaaaaaa-0000-0000-0000-000000000004','Ing A','ING',true),
 ('b0000000-0000-0000-0000-000000000001','22222222-2222-2222-2222-222222222222','bbbbbbbb-0000-0000-0000-000000000001','Org B','ORG',true);
INSERT INTO gob.acuerdo_hogar(id,hogar_id,version,vigencia_desde,creado_por) VALUES
 ('a1000000-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111',1,'2026-10-01','a0000000-0000-0000-0000-000000000001');
INSERT INTO gob.regla_hogar(acuerdo_id,codigo,valor,regla_codigo) VALUES
 ('a1000000-0000-0000-0000-000000000001','plazo_suplencia_h','48','R39');
INSERT INTO gob.solicitud_aprobacion(id,hogar_id,tipo,objeto_tabla,objeto_id,vence_en) VALUES
 ('a2000000-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','acuerdo','gob.acuerdo_hogar',
  'a1000000-0000-0000-0000-000000000001', now() + interval '48 hours'),
 ('a2000000-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111','acuerdo','gob.acuerdo_hogar',
  'a1000000-0000-0000-0000-000000000001', now() + interval '48 hours');
INSERT INTO gob.firma(solicitud_id,integrante_id,decision) VALUES
 ('a2000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000001','aprueba');
INSERT INTO plan.periodo(id,hogar_id,mes) VALUES ('c0000000-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','2026-10-01');
INSERT INTO plan.sobre(id,hogar_id,periodo_id,tipo) VALUES
 ('e0000000-0000-0000-0000-000000000000','11111111-1111-1111-1111-111111111111','c0000000-0000-0000-0000-000000000001','por_asignar');
INSERT INTO plan.presupuesto_mensual(id,hogar_id,periodo_id,version,ingreso_proyectado,etapa_codigo) VALUES
 ('a3000000-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','c0000000-0000-0000-0000-000000000001',1,2000000,'E0');
INSERT INTO plan.linea_plan(presupuesto_id,sobre_id,monto_proyectado) VALUES
 ('a3000000-0000-0000-0000-000000000001','e0000000-0000-0000-0000-000000000000',0);
INSERT INTO fin.cuenta(id,hogar_id,nombre,tipo) VALUES ('f0000000-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','Cuenta A','vista');
INSERT INTO fin.movimiento(id,hogar_id,periodo_id,cuenta_id,tipo,origen,fecha_contable,monto_clp,registrado_por) VALUES
 ('10000000-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','c0000000-0000-0000-0000-000000000001',
  'f0000000-0000-0000-0000-000000000001','ingreso','manual','2026-10-01',2000000,'a0000000-0000-0000-0000-000000000001');
INSERT INTO fin.ingreso(movimiento_id,integrante_id,tipo_ingreso) VALUES
 ('10000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000001','sueldo');
INSERT INTO fin.movimiento(id,hogar_id,periodo_id,cuenta_id,tipo,origen,fecha_contable,monto_clp,registrado_por) VALUES
 ('10000000-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111','c0000000-0000-0000-0000-000000000001',
  'f0000000-0000-0000-0000-000000000001','ingreso','manual','2026-10-15',300000,'a0000000-0000-0000-0000-000000000001');
INSERT INTO fin.deuda(id,hogar_id,tipo,acreedor,monto_original,saldo_actual) VALUES
 ('a4000000-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','consumo','Banco',600000,600000);
INSERT INTO fin.cuota_deuda(deuda_id,numero,mes_facturacion,monto_clp) VALUES
 ('a4000000-0000-0000-0000-000000000001',1,'2026-11-01',50000);

\echo '== R1 SET ROLE a los roles de Compás funciona con el dueño de la base (Supabase: postgres no es superusuario)'
SET ROLE compas_ia;
SELECT current_user;
RESET ROLE;

SET ROLE authenticated;
\echo '== R2 ORG de A ve sus filas hijas (esperado 1 en cada tabla)'
SELECT set_config('request.jwt.claims','{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}',false) \g /dev/null
SELECT (SELECT count(*) FROM gob.regla_hogar) AS reglas, (SELECT count(*) FROM gob.firma) AS firmas,
       (SELECT count(*) FROM plan.linea_plan) AS lineas, (SELECT count(*) FROM fin.ingreso) AS ingresos,
       (SELECT count(*) FROM fin.cuota_deuda) AS cuotas;

\echo '== R3 aislamiento: ORG de B no ve filas hijas de A (esperado 0 en cada tabla)'
SELECT set_config('request.jwt.claims','{"sub":"bbbbbbbb-0000-0000-0000-000000000001","role":"authenticated"}',false) \g /dev/null
SELECT (SELECT count(*) FROM gob.regla_hogar) AS reglas, (SELECT count(*) FROM gob.firma) AS firmas,
       (SELECT count(*) FROM plan.linea_plan) AS lineas, (SELECT count(*) FROM fin.ingreso) AS ingresos,
       (SELECT count(*) FROM fin.cuota_deuda) AS cuotas;

\echo '== R4 ORG de B no cambia parámetros del Acuerdo de A (esperado UPDATE 0) ni agrega uno (debe FALLAR)'
\set QUIET 0
UPDATE gob.regla_hogar SET valor = '1' WHERE codigo = 'plazo_suplencia_h';
\set QUIET 1
INSERT INTO gob.regla_hogar(acuerdo_id,codigo,valor) VALUES ('a1000000-0000-0000-0000-000000000001','dias_abandono','1');

\echo '== R5 ORG de B no firma solicitudes de A (debe FALLAR)'
INSERT INTO gob.firma(solicitud_id,integrante_id,decision) VALUES
 ('a2000000-0000-0000-0000-000000000002','b0000000-0000-0000-0000-000000000001','aprueba');

\echo '== R6 ORG de B no registra ingresos sobre movimientos de A (debe FALLAR)'
INSERT INTO fin.ingreso(movimiento_id,integrante_id,tipo_ingreso) VALUES
 ('10000000-0000-0000-0000-000000000002','b0000000-0000-0000-0000-000000000001','bono');

\echo '== R7 ING de A no puede cambiarse el rol a ORG (esperado UPDATE 0)'
SELECT set_config('request.jwt.claims','{"sub":"aaaaaaaa-0000-0000-0000-000000000004","role":"authenticated"}',false) \g /dev/null
\set QUIET 0
UPDATE gob.integrante SET rol = 'ORG' WHERE id = 'a0000000-0000-0000-0000-000000000004';
\set QUIET 1
SELECT app.rol_actual() AS rol;

\echo '== R8 ING de A no agrega integrantes (debe FALLAR)'
INSERT INTO gob.integrante(hogar_id,nombre,rol) VALUES ('11111111-1111-1111-1111-111111111111','Intruso','CAD');

\echo '== R9 ING de A da su propio consentimiento (esperado 1) pero no el de otro (debe FALLAR)'
INSERT INTO gob.consentimiento(hogar_id,titular_id,otorgado_por_id,finalidad,version_texto) VALUES
 ('11111111-1111-1111-1111-111111111111','a0000000-0000-0000-0000-000000000004','a0000000-0000-0000-0000-000000000004','uso_app','v1');
SELECT count(*) AS consentimientos FROM gob.consentimiento;
INSERT INTO gob.consentimiento(hogar_id,titular_id,otorgado_por_id,finalidad,version_texto) VALUES
 ('11111111-1111-1111-1111-111111111111','a0000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000004','analitica_ia','v1');

\echo '== R10 ningún rol de la app quedó sin RLS en tablas que puede leer (esperado 0 filas)'
RESET ROLE;
SELECT n.nspname || '.' || c.relname AS tabla_sin_rls
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
 WHERE c.relkind IN ('r','p') AND n.nspname IN ('gob','fin','plan','med','ia','sys')
   AND NOT c.relrowsecurity AND c.relispartition = false
   AND has_table_privilege('compas_app', c.oid, 'SELECT')
 ORDER BY 1;
