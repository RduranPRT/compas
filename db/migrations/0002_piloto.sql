-- =====================================================================
-- Compás — migración 0002: piloto Durán Damann
-- Fecha: 12-10-2026
-- Origen: decisiones del 12-10-2026 (docs/decisiones-hogar.md) y EP16
--   * Importación de cartolas y estados de cuenta (EP16, R41–R43)
--   * Perfil inicial generado por IA (EP16)
--   * Tarjeta de crédito como medio principal: sobre "pago de tarjeta" (R44)
--   * Compras en cuotas: tratamiento elegido en cada compra (D08 ajustada)
--   * Ingreso base vs. variable (R33 solo compara base; R45)
-- Requiere: 0001_esquema_v2.sql + seed/0001_catalogos.sql
-- =====================================================================

-- ---------------------------------------------------------------------
-- Parte A: valores nuevos de enumerados (deben confirmarse antes de usarse)
-- ---------------------------------------------------------------------
BEGIN;
ALTER TYPE fin.origen_movimiento ADD VALUE IF NOT EXISTS 'cartola';
ALTER TYPE fin.tipo_evidencia    ADD VALUE IF NOT EXISTS 'csv';
ALTER TYPE fin.tipo_evidencia    ADD VALUE IF NOT EXISTS 'xlsx';
ALTER TYPE plan.tipo_sobre       ADD VALUE IF NOT EXISTS 'pago_tarjeta';
ALTER TYPE plan.tipo_libro       ADD VALUE IF NOT EXISTS 'reserva_tarjeta';
ALTER TYPE plan.tipo_libro       ADD VALUE IF NOT EXISTS 'pago_tarjeta';
COMMIT;

-- ---------------------------------------------------------------------
-- Parte B: estructura
-- ---------------------------------------------------------------------
BEGIN;

-- Reglas nuevas del método
INSERT INTO ref.regla_metodo(codigo,enunciado,nivel_precedencia,procesos,fuente_codigo,estado) VALUES
 ('R41','Movimientos anteriores al inicio del piloto solo alimentan el perfil inicial; no tocan sobres ni libro',2,'{P1,P4}','COMPAS','nueva'),
 ('R42','Desde el inicio del piloto, los movimientos importados de cartola entran por confirmar hasta su revisión',2,'{P4}','COMPAS','nueva'),
 ('R43','El documento de cartola se elimina ≤ 30 días tras la extracción; a la IA solo van datos minimizados',1,'{P1,S5}','COMPAS','nueva'),
 ('R44','Gasto con tarjeta de crédito: sale del sobre de la categoría y se reserva en el sobre pago de tarjeta; el pago de la tarjeta consume esa reserva',2,'{P4,S1}','YNAB','nueva'),
 ('R45','El plan se proyecta con el ingreso base; el ingreso variable entra como extra y se reparte con su propia regla',4,'{P2,P3}','COMPAS','nueva')
ON CONFLICT (codigo) DO NOTHING;

-- Parámetros nuevos del Acuerdo del Hogar
ALTER TABLE gob.regla_hogar DROP CONSTRAINT regla_hogar_codigo_check;
ALTER TABLE gob.regla_hogar ADD CONSTRAINT regla_hogar_codigo_check CHECK (codigo IN (
  'dia_plan','dia_ingreso_mes_siguiente','umbral_ritmo','umbral_ajuste_ingreso_pct',
  'autoaprobacion_n1_pct','plazo_suplencia_h','max_alertas_dia','hora_resumen_diario',
  'confianza_ia_min','umbral_conciliacion_clp','holgura_fijos_pct','pct_reajuste_a_futuro',
  'pct_sin_culpa','estrategia_deuda','dias_vencimiento_asesor','dias_abandono',
  'monto_sin_culpa_clp',
  -- 0002
  'inicio_piloto',              -- fecha ISO; corte entre histórico (R41) y operación
  'mes_primer_plan',            -- primer mes con presupuesto aprobado (línea base antes)
  'tratamiento_cuotas_default', -- "por_cuota" | "total"
  'pct_variable_a_futuro',      -- R45: % del ingreso variable sugerido a Futuro
  'dias_retencion_cartola'      -- R43: por defecto 30
));

-- Eventos nuevos
ALTER TABLE sys.evento_dominio DROP CONSTRAINT evento_dominio_tipo_check;
ALTER TABLE sys.evento_dominio ADD CONSTRAINT evento_dominio_tipo_check CHECK (tipo IN (
  'HogarCreado','EtapaConfirmada','EtapaPropuesta','AcuerdoVersionado','PresupuestoAprobado',
  'IngresoRecibido','IngresoAsignado','TransferenciaPendiente','GastoRegistrado',
  'MovimientoPorConfirmar','DuplicadoCandidato','SobreNegativo','RitmoExcedido',
  'PagoPorVencer','DesvioDetectado','RecuperacionIniciada','NivelEscalado',
  'RecuperacionCerrada','AbandonoDetectado','SemanaCerrada','MesCerrado','ReinicioAprobado',
  -- 0002
  'CartolaCargada','CartolaImportada','PerfilInicialGenerado','PagoTarjetaRegistrado'));

-- Importaciones de cartola (EP16)
CREATE TABLE fin.importacion (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hogar_id         uuid NOT NULL REFERENCES gob.hogar(id),
  cuenta_id        uuid NOT NULL REFERENCES fin.cuenta(id),
  archivo_nombre   text NOT NULL,
  formato          text NOT NULL CHECK (formato IN ('pdf','csv','xlsx')),
  institucion      text,                            -- banco o emisor detectado
  lector           text,                            -- lector usado, p. ej. 'bancoestado_csv_v1' o 'ia_pdf'
  sha256           text NOT NULL,
  storage_uri      text,                            -- nulo una vez purgado el documento (R43)
  desde            date,
  hasta            date,
  estado           text NOT NULL DEFAULT 'cargada'
                   CHECK (estado IN ('cargada','extraida','en_revision','importada','fallida','anulada')),
  n_filas          integer,
  n_historicos     integer,                         -- antes del inicio del piloto (R41)
  n_movimientos    integer,                         -- desde el inicio del piloto (R42)
  n_duplicados     integer,
  error            text,
  expira_en        timestamptz NOT NULL DEFAULT now() + interval '30 days',   -- R43
  purgada_en       timestamptz,
  subida_por       uuid NOT NULL REFERENCES gob.integrante(id),
  creado_en        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (hogar_id, sha256),                        -- el mismo archivo no se importa dos veces
  CHECK (desde IS NULL OR hasta IS NULL OR desde <= hasta),
  CHECK (purgada_en IS NULL OR storage_uri IS NULL)
);
CREATE INDEX ix_importacion_purga ON fin.importacion(expira_en) WHERE purgada_en IS NULL;

-- Movimientos: vínculo con la importación, línea original y cuotas
ALTER TABLE fin.movimiento
  ADD COLUMN importacion_id     uuid REFERENCES fin.importacion(id),
  ADD COLUMN hash_linea         text,               -- huella de la línea de cartola (re-importación idempotente)
  ADD COLUMN n_cuotas           smallint CHECK (n_cuotas IS NULL OR n_cuotas >= 1),
  ADD COLUMN tratamiento_cuotas text CHECK (tratamiento_cuotas IN ('por_cuota','total')),
  ADD CONSTRAINT chk_mov_cuotas CHECK (coalesce(n_cuotas,1) = 1 OR tratamiento_cuotas IS NOT NULL),
  ADD CONSTRAINT chk_mov_cartola CHECK (origen <> 'cartola' OR importacion_id IS NOT NULL);
CREATE UNIQUE INDEX ux_mov_hash_linea ON fin.movimiento(hogar_id, hash_linea) WHERE hash_linea IS NOT NULL;

-- Histórico previo al piloto: alimenta el perfil, nunca el libro (R41)
CREATE TABLE fin.movimiento_historico (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hogar_id         uuid NOT NULL REFERENCES gob.hogar(id),
  importacion_id   uuid NOT NULL REFERENCES fin.importacion(id),
  cuenta_id        uuid NOT NULL REFERENCES fin.cuenta(id),
  fecha            date NOT NULL,
  sentido          text NOT NULL CHECK (sentido IN ('cargo','abono')),
  monto_clp        bigint NOT NULL CHECK (monto_clp > 0),
  glosa            text NOT NULL,                   -- ya minimizada (sin RUT ni números de cuenta)
  comercio         text,
  clase            text CHECK (clase IN ('gasto','ingreso','transferencia_interna','pago_tarjeta',
                                         'comision','interes','reembolso','otro')),
  categoria_id     uuid REFERENCES plan.categoria(id),
  bloque_codigo    text REFERENCES ref.bloque(codigo),
  intencion        fin.intencion,
  es_recurrente    boolean,
  confianza_ia     numeric(3,2) CHECK (confianza_ia BETWEEN 0 AND 1),
  revisado         boolean NOT NULL DEFAULT false,
  hash_linea       text NOT NULL,
  creado_en        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (hogar_id, hash_linea)
);
CREATE INDEX ix_hist_hogar_fecha ON fin.movimiento_historico(hogar_id, fecha);

-- Perfil inicial y retroalimentación (EP16)
CREATE TABLE med.perfil_inicial (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hogar_id         uuid NOT NULL REFERENCES gob.hogar(id),
  version          integer NOT NULL CHECK (version > 0),
  desde            date NOT NULL,
  hasta            date NOT NULL,
  importaciones    uuid[] NOT NULL,
  perfil           jsonb NOT NULL,                  -- métricas calculadas (ver specs/004)
  retroalimentacion jsonb NOT NULL,                 -- hallazgos con regla y fuente (P8)
  etapa_sugerida   text REFERENCES ref.etapa(codigo),
  modelo           text NOT NULL,
  estado           text NOT NULL DEFAULT 'borrador' CHECK (estado IN ('borrador','presentado','aceptado','descartado')),
  generado_en      timestamptz NOT NULL DEFAULT now(),
  revisado_por     uuid REFERENCES gob.integrante(id),
  revisado_en      timestamptz,
  UNIQUE (hogar_id, version),
  CHECK (desde <= hasta),
  CHECK (estado NOT IN ('aceptado','descartado') OR revisado_por IS NOT NULL)
);

-- Ingreso base vs. variable (R45)
ALTER TABLE plan.ingreso_esperado ADD COLUMN es_base boolean NOT NULL DEFAULT true;
ALTER TABLE fin.ingreso          ADD COLUMN es_variable boolean NOT NULL DEFAULT false;

-- Sobre "pago de tarjeta" por tarjeta y período (R44)
ALTER TABLE plan.sobre ADD COLUMN cuenta_id uuid REFERENCES fin.cuenta(id);
ALTER TABLE plan.sobre DROP CONSTRAINT sobre_check;
ALTER TABLE plan.sobre ADD CONSTRAINT sobre_check
  CHECK ((tipo IN ('por_asignar','proximo_mes','pago_tarjeta')) = (categoria_id IS NULL));
ALTER TABLE plan.sobre ADD CONSTRAINT chk_sobre_pago_tarjeta
  CHECK ((tipo = 'pago_tarjeta') = (cuenta_id IS NOT NULL));
CREATE UNIQUE INDEX ux_sobre_pago_tarjeta ON plan.sobre(periodo_id, cuenta_id) WHERE tipo = 'pago_tarjeta';

-- ---------------------------------------------------------------------
-- Funciones de apoyo
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app.inicio_piloto(p_hogar uuid) RETURNS date
LANGUAGE sql STABLE AS $$ SELECT (app.parametro(p_hogar, 'inicio_piloto') #>> '{}')::date $$;

-- Sobre de pago de tarjeta del período (lo crea si no existe)
CREATE OR REPLACE FUNCTION plan.sobre_pago_tarjeta(p_hogar uuid, p_periodo uuid, p_cuenta uuid) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, plan AS $$
DECLARE v_id uuid;
BEGIN
  SELECT id INTO v_id FROM plan.sobre WHERE periodo_id = p_periodo AND cuenta_id = p_cuenta AND tipo = 'pago_tarjeta';
  IF v_id IS NULL THEN
    INSERT INTO plan.sobre(hogar_id, periodo_id, tipo, cuenta_id)
    VALUES (p_hogar, p_periodo, 'pago_tarjeta', p_cuenta)
    ON CONFLICT DO NOTHING RETURNING id INTO v_id;
    IF v_id IS NULL THEN
      SELECT id INTO v_id FROM plan.sobre WHERE periodo_id = p_periodo AND cuenta_id = p_cuenta AND tipo = 'pago_tarjeta';
    END IF;
  END IF;
  RETURN v_id;
END $$;

-- ---------------------------------------------------------------------
-- Invariantes nuevas
-- ---------------------------------------------------------------------

-- I12. Corte del piloto (R41, R42). Dos funciones: plpgsql no corta la evaluación de NEW.campo
CREATE OR REPLACE FUNCTION fin.chk_corte_historico() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE v_inicio date;
BEGIN
  v_inicio := app.inicio_piloto(NEW.hogar_id);
  IF v_inicio IS NOT NULL AND NEW.fecha >= v_inicio THEN
    RAISE EXCEPTION 'R41: % es posterior al inicio del piloto (%); debe importarse como movimiento', NEW.fecha, v_inicio
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION fin.chk_corte_movimiento() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE v_inicio date;
BEGIN
  IF NEW.origen <> 'cartola' THEN RETURN NEW; END IF;
  v_inicio := app.inicio_piloto(NEW.hogar_id);
  IF v_inicio IS NOT NULL AND NEW.fecha_contable < v_inicio THEN
    RAISE EXCEPTION 'R41: % es anterior al inicio del piloto (%); va a movimiento_historico', NEW.fecha_contable, v_inicio
      USING ERRCODE = 'check_violation';
  END IF;
  IF TG_OP = 'INSERT' AND NEW.estado NOT IN ('capturado','por_confirmar') THEN
    RAISE EXCEPTION 'R42: un movimiento de cartola entra por confirmar' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_hist_corte BEFORE INSERT OR UPDATE OF fecha ON fin.movimiento_historico
  FOR EACH ROW EXECUTE FUNCTION fin.chk_corte_historico();
CREATE TRIGGER trg_mov_corte  BEFORE INSERT OR UPDATE OF fecha_contable ON fin.movimiento
  FOR EACH ROW EXECUTE FUNCTION fin.chk_corte_movimiento();

-- I4 ampliado. Contabilizar con reserva de tarjeta (R44)
CREATE OR REPLACE FUNCTION plan.contabilizar() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, plan, fin AS $$
DECLARE v_por_asignar uuid; v_tipo_cuenta fin.tipo_cuenta; v_periodo uuid; v_total bigint;
BEGIN
  IF TG_TABLE_NAME = 'asignacion' THEN
    SELECT s.id INTO v_por_asignar FROM plan.sobre s
      JOIN plan.sobre d ON d.id = NEW.sobre_id
     WHERE s.periodo_id = d.periodo_id AND s.tipo = 'por_asignar';
    INSERT INTO plan.libro_sobre(hogar_id, sobre_id, tipo, monto_clp, origen_tabla, origen_id, fecha_valor)
    VALUES (NEW.hogar_id, v_por_asignar, 'asignacion', -NEW.monto_clp, 'plan.asignacion', NEW.id, current_date),
           (NEW.hogar_id, NEW.sobre_id,  'asignacion',  NEW.monto_clp, 'plan.asignacion', NEW.id, current_date);
  ELSIF TG_TABLE_NAME = 'reasignacion' THEN
    IF NEW.aplicada_en IS NOT NULL AND (TG_OP = 'INSERT' OR OLD.aplicada_en IS NULL) THEN
      INSERT INTO plan.libro_sobre(hogar_id, sobre_id, tipo, monto_clp, origen_tabla, origen_id, fecha_valor)
      VALUES (NEW.hogar_id, NEW.sobre_origen_id,  'reasignacion', -NEW.monto_clp, 'plan.reasignacion', NEW.id, current_date),
             (NEW.hogar_id, NEW.sobre_destino_id, 'reasignacion',  NEW.monto_clp, 'plan.reasignacion', NEW.id, current_date);
    END IF;
  ELSIF TG_TABLE_NAME = 'movimiento' THEN
    IF NEW.estado = 'confirmado' AND OLD.estado IS DISTINCT FROM 'confirmado' AND OLD.estado <> 'conciliado' THEN
      IF NEW.tipo = 'ingreso' THEN
        SELECT id INTO v_por_asignar FROM plan.sobre WHERE periodo_id = NEW.periodo_id AND tipo = 'por_asignar';
        INSERT INTO plan.libro_sobre(hogar_id, sobre_id, tipo, monto_clp, origen_tabla, origen_id, fecha_valor)
        VALUES (NEW.hogar_id, v_por_asignar, 'ingreso', NEW.monto_clp, 'fin.movimiento', NEW.id, NEW.fecha_contable);
      ELSIF NEW.tipo IN ('gasto','reembolso','ajuste') THEN
        INSERT INTO plan.libro_sobre(hogar_id, sobre_id, tipo, monto_clp, origen_tabla, origen_id, fecha_valor)
        SELECT NEW.hogar_id, i.sobre_id,
               CASE NEW.tipo WHEN 'reembolso' THEN 'reembolso'::plan.tipo_libro
                             WHEN 'ajuste' THEN 'ajuste'::plan.tipo_libro
                             ELSE 'imputacion'::plan.tipo_libro END,
               CASE NEW.tipo WHEN 'reembolso' THEN i.monto_clp ELSE -i.monto_clp END,
               'fin.movimiento', NEW.id, NEW.fecha_contable
          FROM fin.imputacion i WHERE i.movimiento_id = NEW.id;
        -- R44: si el medio es tarjeta de crédito, el dinero queda reservado para pagarla.
        -- La reserva va al sobre de pago de tarjeta del MISMO período de cada imputación:
        -- una compra en cuotas "por_cuota" imputa cada cuota al sobre de su mes de facturación (D08)
        -- y la reserva sigue a cada cuota.
        SELECT tipo INTO v_tipo_cuenta FROM fin.cuenta WHERE id = NEW.cuenta_id;
        IF v_tipo_cuenta = 'tarjeta_credito' AND NEW.tipo IN ('gasto','reembolso') THEN
          FOR v_periodo, v_total IN
            SELECT s.periodo_id, sum(i.monto_clp)
              FROM fin.imputacion i JOIN plan.sobre s ON s.id = i.sobre_id
             WHERE i.movimiento_id = NEW.id
             GROUP BY s.periodo_id
          LOOP
            INSERT INTO plan.libro_sobre(hogar_id, sobre_id, tipo, monto_clp, origen_tabla, origen_id, fecha_valor)
            VALUES (NEW.hogar_id, plan.sobre_pago_tarjeta(NEW.hogar_id, v_periodo, NEW.cuenta_id), 'reserva_tarjeta',
                    CASE NEW.tipo WHEN 'reembolso' THEN -v_total ELSE v_total END,
                    'fin.movimiento', NEW.id, NEW.fecha_contable);
          END LOOP;
        END IF;
      END IF;
    ELSIF NEW.estado = 'descartado' AND OLD.estado IN ('confirmado','conciliado') THEN
      -- reverso: asientos de signo contrario, nunca DELETE (incluye la reserva de tarjeta)
      INSERT INTO plan.libro_sobre(hogar_id, sobre_id, tipo, monto_clp, origen_tabla, origen_id, fecha_valor)
      SELECT hogar_id, sobre_id, 'ajuste', -monto_clp, origen_tabla, origen_id, current_date
        FROM plan.libro_sobre WHERE origen_tabla = 'fin.movimiento' AND origen_id = NEW.id;
    END IF;
  END IF;
  RETURN NEW;
END $$;

-- I13. Pago de tarjeta: consume la reserva (R27, R44)
CREATE OR REPLACE FUNCTION fin.contabilizar_pago_tarjeta() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, plan, fin AS $$
DECLARE v_periodo uuid; v_sobre uuid; v_tipo_destino fin.tipo_cuenta;
BEGIN
  IF NEW.tipo <> 'pago_tarjeta' THEN RETURN NEW; END IF;
  SELECT tipo INTO v_tipo_destino FROM fin.cuenta WHERE id = NEW.cuenta_destino_id;
  IF v_tipo_destino IS DISTINCT FROM 'tarjeta_credito' THEN
    RAISE EXCEPTION 'R27: el destino de un pago de tarjeta debe ser una cuenta tarjeta_credito'
      USING ERRCODE = 'check_violation';
  END IF;
  IF NEW.estado = 'hecha' AND (TG_OP = 'INSERT' OR OLD.estado IS DISTINCT FROM 'hecha') THEN
    SELECT id INTO v_periodo FROM plan.periodo
     WHERE hogar_id = NEW.hogar_id AND mes = date_trunc('month', NEW.fecha)::date;
    IF v_periodo IS NULL THEN
      RAISE EXCEPTION 'No existe el período % para registrar el pago', date_trunc('month', NEW.fecha)::date
        USING ERRCODE = 'foreign_key_violation';
    END IF;
    v_sobre := plan.sobre_pago_tarjeta(NEW.hogar_id, v_periodo, NEW.cuenta_destino_id);
    INSERT INTO plan.libro_sobre(hogar_id, sobre_id, tipo, monto_clp, origen_tabla, origen_id, fecha_valor)
    VALUES (NEW.hogar_id, v_sobre, 'pago_tarjeta', -NEW.monto_clp, 'fin.transferencia', NEW.id, NEW.fecha);
  ELSIF TG_OP = 'UPDATE' AND OLD.estado = 'hecha' AND NEW.estado = 'anulada' THEN
    INSERT INTO plan.libro_sobre(hogar_id, sobre_id, tipo, monto_clp, origen_tabla, origen_id, fecha_valor)
    SELECT hogar_id, sobre_id, 'ajuste', -monto_clp, origen_tabla, origen_id, current_date
      FROM plan.libro_sobre WHERE origen_tabla = 'fin.transferencia' AND origen_id = NEW.id;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_transf_tarjeta AFTER INSERT OR UPDATE OF estado ON fin.transferencia
  FOR EACH ROW EXECUTE FUNCTION fin.contabilizar_pago_tarjeta();

-- Vista de saldos con reserva y pago de tarjeta
CREATE OR REPLACE VIEW plan.v_saldo_sobre WITH (security_invoker = true) AS
SELECT s.id AS sobre_id, s.hogar_id, s.periodo_id, s.tipo, s.categoria_id, s.integrante_id,
       coalesce(sum(l.monto_clp) FILTER (WHERE l.tipo IN ('asignacion','reasignacion','arrastre','ingreso','reserva_tarjeta')), 0) AS disponible,
       coalesce(-sum(l.monto_clp) FILTER (WHERE l.tipo IN ('imputacion','pago_tarjeta')), 0)                              AS gastado,
       coalesce(sum(l.monto_clp), 0)                                                                                        AS saldo
  FROM plan.sobre s LEFT JOIN plan.libro_sobre l ON l.sobre_id = s.id
 GROUP BY s.id;

-- Documentos por purgar (R43): lo consume el job de retención
CREATE VIEW fin.v_importacion_por_purgar WITH (security_invoker = true) AS
SELECT id, hogar_id, storage_uri, expira_en FROM fin.importacion
 WHERE purgada_en IS NULL AND storage_uri IS NOT NULL AND expira_en <= now();

-- ---------------------------------------------------------------------
-- Seguridad de las tablas nuevas
-- ---------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE ON fin.importacion, fin.movimiento_historico, med.perfil_inicial TO compas_app;
GRANT SELECT ON fin.importacion, fin.movimiento_historico TO compas_ia;
GRANT UPDATE (clase, categoria_id, bloque_codigo, intencion, es_recurrente, confianza_ia, comercio)
  ON fin.movimiento_historico TO compas_ia;
GRANT SELECT, INSERT ON med.perfil_inicial TO compas_ia;
GRANT SELECT, INSERT, UPDATE ON fin.importacion, fin.movimiento_historico, med.perfil_inicial TO compas_sistema;
GRANT SELECT ON fin.v_importacion_por_purgar TO compas_sistema;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['fin.importacion','fin.movimiento_historico','med.perfil_inicial'] LOOP
    EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %s FORCE ROW LEVEL SECURITY', t);
    EXECUTE format($p$CREATE POLICY p_hogar ON %s AS PERMISSIVE FOR ALL
                     USING (hogar_id = app.hogar_actual()) WITH CHECK (hogar_id = app.hogar_actual())$p$, t);
    -- Cartolas y perfil son información del hogar: solo administradores (R25 por analogía, D06)
    EXECUTE format($p$CREATE POLICY r_solo_admin ON %s AS RESTRICTIVE FOR ALL TO compas_app
                     USING (app.es_admin()) WITH CHECK (app.es_admin())$p$, t);
  END LOOP;
END $$;

CREATE TRIGGER trg_aud_importacion AFTER INSERT OR UPDATE OR DELETE ON fin.importacion
  FOR EACH ROW EXECUTE FUNCTION sys.auditar();
CREATE TRIGGER trg_aud_perfil AFTER INSERT OR UPDATE OR DELETE ON med.perfil_inicial
  FOR EACH ROW EXECUTE FUNCTION sys.auditar();

COMMIT;
