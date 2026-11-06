-- Pruebas de la migración 0017: etapa inicial E1 y cartolas sin revisión de históricos (D35, R23, R41)
\set ON_ERROR_STOP 0
\set QUIET 1
\set filas '[{"codigo":"inicio_piloto","valor":"2026-10-01","regla_codigo":"R41"}]'
\set rodrigo '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","email":"rodrigo@ejemplo.cl","role":"authenticated"}'
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', :'rodrigo', false) \g /dev/null
SELECT app.crear_hogar('Durán Damann', 'Rodrigo') \g /dev/null
SELECT app.proponer_acuerdo(:'filas'::jsonb, true) \g /dev/null
SELECT app.aplicar_plantilla_categorias() \g /dev/null
INSERT INTO fin.cuenta(hogar_id, nombre, tipo, saldo_inicial) SELECT id, 'Cuenta corriente', 'vista', 0 FROM gob.hogar;

\echo '== E1 un hogar nuevo nace en E1, sin propuesta abierta (D35)'
SELECT etapa_codigo AS etapa_hogar FROM gob.hogar;
SELECT count(*) AS historial FROM gob.historial_etapa;

\echo '== I1 una importación con históricos sin revisar se cierra sin revisarlos y los conserva (D35)'
RESET ROLE;
INSERT INTO fin.importacion(id, hogar_id, cuenta_id, archivo_nombre, formato, sha256, estado, subida_por)
SELECT '99999999-0000-0000-0000-000000000001', h.id, c.id, 'antigua.xlsx', 'xlsx', 'sha', 'en_revision', i.id
  FROM gob.hogar h, fin.cuenta c, gob.integrante i;
INSERT INTO fin.movimiento_historico(hogar_id, importacion_id, cuenta_id, fecha, sentido, monto_clp, glosa, hash_linea)
SELECT h.id, '99999999-0000-0000-0000-000000000001', c.id, '2026-09-15', 'cargo', 1000, 'COMPRA', 'h1'
  FROM gob.hogar h, fin.cuenta c;
SELECT app.cerrar_importaciones_revisadas(id) FROM gob.hogar \g /dev/null
SELECT estado AS importacion, (SELECT count(*) FROM fin.movimiento_historico) AS historicos_conservados FROM fin.importacion;

\echo '== R41 enunciado vigente'
SELECT enunciado FROM ref.regla_metodo WHERE codigo = 'R41';
