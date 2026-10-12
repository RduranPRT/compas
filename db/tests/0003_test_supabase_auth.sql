-- Pruebas de la migración 0003: identidad por JWT (simula PostgREST con request.jwt.claims)
\set ON_ERROR_STOP 0
\set QUIET 1
INSERT INTO gob.hogar(id,nombre) VALUES ('11111111-1111-1111-1111-111111111111','Hogar A'),
                                       ('22222222-2222-2222-2222-222222222222','Hogar B');
INSERT INTO gob.integrante(id,hogar_id,usuario_auth_id,nombre,rol) VALUES
 ('a0000000-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','aaaaaaaa-0000-0000-0000-000000000001','Org A','ORG'),
 ('b0000000-0000-0000-0000-000000000001','22222222-2222-2222-2222-222222222222','bbbbbbbb-0000-0000-0000-000000000001','Org B','ORG');
INSERT INTO gob.integrante(id,hogar_id,usuario_auth_id,nombre,rol,es_menor) VALUES
 ('a0000000-0000-0000-0000-000000000003','11111111-1111-1111-1111-111111111111','aaaaaaaa-0000-0000-0000-000000000003','Menor A','MEN',true);
INSERT INTO fin.cuenta(hogar_id,nombre,tipo) VALUES ('11111111-1111-1111-1111-111111111111','Cuenta A','vista'),
                                                  ('22222222-2222-2222-2222-222222222222','Cuenta B','vista');

\echo '== S1 membresía sincronizada por trigger (esperado 3)'
SELECT count(*) AS membresias FROM app.membresia;

SET ROLE authenticated;
\echo '== S2 usuario A ve su hogar y su cuenta (esperado Hogar A, 1 cuenta, rol ORG)'
SELECT set_config('request.jwt.claims','{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}',false) \g /dev/null
SELECT nombre FROM gob.hogar;
SELECT count(*) AS cuentas FROM fin.cuenta;
SELECT app.rol_actual() AS rol;

\echo '== S3 usuario A no puede fijar app.hogar_id para saltar al hogar B (esperado 0 cuentas de B)'
SELECT set_config('app.hogar_id','22222222-2222-2222-2222-222222222222',false) \g /dev/null
SELECT count(*) AS cuentas_b FROM fin.cuenta WHERE hogar_id='22222222-2222-2222-2222-222222222222';

\echo '== S4 usuario A pide el hogar B por encabezado (esperado 0 cuentas)'
SELECT set_config('request.headers','{"x-hogar-id":"22222222-2222-2222-2222-222222222222"}',false) \g /dev/null
SELECT count(*) AS cuentas FROM fin.cuenta;
SELECT set_config('request.headers','',false) \g /dev/null

\echo '== S5 menor de A: rol MEN y no ve cuentas (esperado MEN, 0)'
SELECT set_config('request.jwt.claims','{"sub":"aaaaaaaa-0000-0000-0000-000000000003","role":"authenticated"}',false) \g /dev/null
SELECT app.rol_actual() AS rol;
SELECT count(*) AS cuentas FROM fin.cuenta;

\echo '== S6 usuario sin membresía no ve nada (esperado 0)'
SELECT set_config('request.jwt.claims','{"sub":"cccccccc-0000-0000-0000-000000000001","role":"authenticated"}',false) \g /dev/null
SELECT count(*) AS hogares FROM gob.hogar;
RESET ROLE;

\echo '== S7 desactivar al usuario A le quita acceso (esperado 0)'
UPDATE gob.integrante SET activo=false WHERE id='a0000000-0000-0000-0000-000000000001';
SET ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}',false) \g /dev/null
SELECT count(*) AS cuentas FROM fin.cuenta;
RESET ROLE;
