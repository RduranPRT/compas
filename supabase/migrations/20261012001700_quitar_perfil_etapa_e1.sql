-- =====================================================================
-- Compás — migración 0017: se retira el análisis de cartolas (D35, specs 003, 004 y 010)
-- Fecha: 06-11-2026
-- * El hogar nace en E1; los hogares que siguen en el valor por defecto E0, sin etapa confirmada, pasan a E1.
-- * Los históricos ya no se revisan: dejan de frenar el cierre de una importación.
-- * fin.movimiento_historico y med.perfil_inicial se conservan sin uso; siguen en la exportación y el borrado.
-- =====================================================================
BEGIN;

ALTER TABLE gob.hogar ALTER COLUMN etapa_codigo SET DEFAULT 'E1';

UPDATE gob.hogar h SET etapa_codigo = 'E1'
 WHERE h.etapa_codigo = 'E0'
   AND NOT EXISTS (SELECT 1 FROM gob.historial_etapa e WHERE e.hogar_id = h.id AND e.estado = 'confirmada');

UPDATE ref.regla_metodo
   SET enunciado = 'Los movimientos anteriores al inicio del piloto no se importan; no tocan sobres ni libro'
 WHERE codigo = 'R41';

CREATE OR REPLACE FUNCTION app.cerrar_importaciones_revisadas(p_hogar uuid) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = pg_catalog, fin AS $$
  UPDATE fin.importacion i SET estado = 'importada'
   WHERE i.hogar_id = p_hogar AND i.estado = 'en_revision'
     AND NOT EXISTS (SELECT 1 FROM fin.movimiento m WHERE m.importacion_id = i.id AND m.estado = 'por_confirmar')
$$;

-- Importaciones que solo esperaban la revisión de sus históricos
SELECT app.cerrar_importaciones_revisadas(id) FROM gob.hogar;

COMMIT;
