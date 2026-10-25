-- =====================================================================
-- Compás — migración 0016: un aviso de sobre negativo se da por leído cuando el sobre se cubre (spec 009)
-- Fecha: 25-10-2026
-- Visto en la prueba de la Beta: después de cubrir el sobre (N1 cerrado), el aviso seguía en la portada.
-- =====================================================================
BEGIN;

CREATE OR REPLACE FUNCTION app.cerrar_n1_cubiertos(p_hogar uuid) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, app, plan, med AS $$
DECLARE r record; v_n int := 0;
BEGIN
  FOR r IN SELECT e.id, e.sobre_id, e.abierto_en FROM med.evento_recuperacion e JOIN plan.v_saldo_sobre v ON v.sobre_id = e.sobre_id
            WHERE e.hogar_id = p_hogar AND e.nivel = 'N1' AND e.estado IN ('abierto','en_curso') AND v.saldo >= 0 LOOP
    UPDATE med.evento_recuperacion SET estado = 'cerrado', cerrado_en = now() WHERE id = r.id;
    UPDATE med.alerta SET estado = 'leida', leida_en = now()
     WHERE sobre_id = r.sobre_id AND tipo = 'sobre_negativo' AND estado IN ('generada','enviada','en_resumen');
    PERFORM app.emitir_evento(p_hogar, 'RecuperacionCerrada', app.integrante_actual(),
      jsonb_build_object('nivel', 'N1', 'sobre_id', r.sobre_id, 'dias', extract(day FROM now() - r.abierto_en)));
    v_n := v_n + 1;
  END LOOP;
  RETURN v_n;
END $$;
REVOKE EXECUTE ON FUNCTION app.cerrar_n1_cubiertos(uuid) FROM PUBLIC;

COMMIT;
