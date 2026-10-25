-- Pruebas de la migración 0016: el aviso de sobre negativo se da por leído al cubrir el sobre (spec 009)
\set ON_ERROR_STOP 0
\set QUIET 1
\set filas '[{"codigo":"inicio_piloto","valor":"2026-10-01","regla_codigo":"R41"},{"codigo":"mes_primer_plan","valor":"2026-12-01","regla_codigo":null},{"codigo":"autoaprobacion_n1_pct","valor":5,"regla_codigo":"R38"}]'
\set rodrigo '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","email":"rodrigo@ejemplo.cl","role":"authenticated"}'
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', :'rodrigo', false) \g /dev/null
SELECT app.crear_hogar('Durán Damann', 'Rodrigo') \g /dev/null
SELECT app.proponer_acuerdo(:'filas'::jsonb, true) \g /dev/null
SELECT app.aplicar_plantilla_categorias() \g /dev/null
INSERT INTO fin.cuenta(hogar_id, nombre, tipo, saldo_inicial) SELECT id, 'Cuenta corriente', 'vista', 850000 FROM gob.hogar;
SELECT app.asegurar_mes('2026-12-01') \g /dev/null
CREATE TEMP VIEW sd AS SELECT id, nombre, saldo FROM plan.v_sobre WHERE mes = '2026-12-01';
SELECT app.registrar_ingreso(NULL, (SELECT id FROM fin.cuenta), 400000, '2026-12-01', (SELECT id FROM gob.integrante)) \g /dev/null
SELECT app.confirmar_distribucion((SELECT ingreso_id FROM plan.v_ingreso_por_repartir), jsonb_build_array(
  jsonb_build_object('sobre_id', (SELECT id FROM sd WHERE nombre = 'Ocio y salidas'), 'monto', 200000))) \g /dev/null

\echo '== A1 Vestuario queda negativo: aviso enviado y N1 abierto'
SELECT app.registrar_gasto(NULL, (SELECT id FROM fin.cuenta), (SELECT id FROM sd WHERE nombre = 'Vestuario'), 8000, '2026-12-05') \g /dev/null
SELECT tipo, estado FROM med.alerta;

\echo '== A2 al cubrirlo, el N1 se cierra y el aviso queda leído'
SELECT r->>'estado' AS estado FROM app.reasignar((SELECT id FROM sd WHERE nombre = 'Ocio y salidas'), (SELECT id FROM sd WHERE nombre = 'Vestuario'), 8000) r;
SELECT tipo, estado, leida_en IS NOT NULL AS leida FROM med.alerta;
SELECT nivel, estado FROM med.evento_recuperacion;
