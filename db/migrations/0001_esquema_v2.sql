-- =====================================================================
-- Compás — Modelo de base de datos v2 (migración 0001)
-- Motor: PostgreSQL 16
-- Fuente: "Diseño del proceso ajustado — Método Compás v2" (30-09-2026)
-- Convenciones:
--   * snake_case en español, singular; PK uuid (gen_random_uuid)
--   * Montos en CLP como bigint (pesos enteros). UF/moneda extranjera:
--     monto original + valor de conversión usado (R24, R32)
--   * Toda tabla de negocio lleva hogar_id y RLS (DB02)
--   * creado_en / actualizado_en en timestamptz
-- =====================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE SCHEMA IF NOT EXISTS ref;   -- catálogos globales del método
CREATE SCHEMA IF NOT EXISTS gob;   -- gobierno, roles, acuerdos, privacidad
CREATE SCHEMA IF NOT EXISTS fin;   -- dinero: cuentas, movimientos, deudas
CREATE SCHEMA IF NOT EXISTS plan;  -- períodos, presupuestos, sobres, fondos
CREATE SCHEMA IF NOT EXISTS med;   -- medición, alertas, recuperación, cierres
CREATE SCHEMA IF NOT EXISTS ia;    -- propuestas e inferencias de la IA
CREATE SCHEMA IF NOT EXISTS sys;   -- eventos, auditoría, offline, dispositivos
CREATE SCHEMA IF NOT EXISTS app;   -- funciones de contexto y seguridad

-- ---------------------------------------------------------------------
-- Tipos enumerados
-- ---------------------------------------------------------------------
CREATE TYPE gob.rol_integrante      AS ENUM ('ORG','CAD','ING','MEN','ASE');
CREATE TYPE gob.estado_acuerdo      AS ENUM ('borrador','vigente','reemplazado');
CREATE TYPE gob.tipo_solicitud      AS ENUM ('presupuesto','ajuste_plan','reasignacion','retiro_futuro',
                                             'etapa','acuerdo','recuperacion','reapertura','duplicado');
CREATE TYPE gob.estado_solicitud    AS ENUM ('pendiente','aprobada','rechazada','vencida','autoaprobada');
CREATE TYPE gob.decision_firma      AS ENUM ('aprueba','rechaza');
CREATE TYPE gob.finalidad_consent   AS ENUM ('uso_app','datos_menor','lectura_correo','banca_abierta',
                                             'asesor_externo','analitica_ia');
CREATE TYPE gob.tipo_derecho        AS ENUM ('acceso','exportacion','rectificacion','borrado','oposicion');
CREATE TYPE gob.estado_etapa        AS ENUM ('propuesta','confirmada','rechazada');
CREATE TYPE gob.direccion_etapa     AS ENUM ('inicial','avance','retroceso','reinicio');

CREATE TYPE fin.tipo_cuenta         AS ENUM ('vista','ahorro','billetera','tarjeta_credito','inversion');
CREATE TYPE fin.tipo_movimiento     AS ENUM ('gasto','ingreso','reembolso','ajuste');
CREATE TYPE fin.estado_movimiento   AS ENUM ('capturado','por_confirmar','confirmado','conciliado','descartado');
CREATE TYPE fin.origen_movimiento   AS ENUM ('manual','chat','foto','correo','banco','sistema');
CREATE TYPE fin.tipo_ingreso        AS ENUM ('sueldo','honorarios_liquido','bono','gratificacion','reajuste','otro');
CREATE TYPE fin.intencion           AS ENUM ('supervivencia','deseo','cultura','imprevisto');
CREATE TYPE fin.tipo_transferencia  AS ENUM ('interna','pago_tarjeta','a_personal','aporte_fondo');
CREATE TYPE fin.estado_transferencia AS ENUM ('pendiente','hecha','anulada');
CREATE TYPE fin.tipo_deuda          AS ENUM ('consumo','tarjeta','compra_cuotas','automotriz','hipotecario',
                                             'educacion','informal','otra');
CREATE TYPE fin.estado_simple       AS ENUM ('abierto','resuelto','anulado');
CREATE TYPE fin.tipo_evidencia      AS ENUM ('foto','correo','chat','pdf');
CREATE TYPE fin.moneda              AS ENUM ('CLP','UF','USD','EUR');

CREATE TYPE plan.estado_periodo     AS ENUM ('abierto','en_cierre','cerrado','reabierto');
CREATE TYPE plan.estado_presupuesto AS ENUM ('borrador','aprobado','en_ejecucion','en_cierre','cerrado','reemplazado');
CREATE TYPE plan.tipo_sobre         AS ENUM ('por_asignar','proximo_mes','fijo','variable','fondo','futuro',
                                             'emergencia','cuota','sin_culpa','mesada');
CREATE TYPE plan.tipo_fondo         AS ENUM ('gasto_verdadero','meta','emergencia','futuro_largo_plazo');
CREATE TYPE plan.tipo_libro         AS ENUM ('ingreso','asignacion','reasignacion','imputacion','reembolso',
                                             'arrastre','ajuste');
CREATE TYPE plan.periodicidad       AS ENUM ('mensual','quincenal','semanal','anual','irregular');

CREATE TYPE med.tipo_cierre         AS ENUM ('semanal','mensual');
CREATE TYPE med.estado_cierre       AS ENUM ('pendiente','hecho','atrasado','omitido');
CREATE TYPE med.valoracion          AS ENUM ('+','0','-');
CREATE TYPE med.severidad           AS ENUM ('info','amarillo','rojo');
CREATE TYPE med.estado_alerta       AS ENUM ('generada','enviada','en_resumen','leida','descartada');
CREATE TYPE med.nivel_recuperacion  AS ENUM ('N1','N2','N3','N4');
CREATE TYPE med.estado_recuperacion AS ENUM ('abierto','en_curso','cerrado','escalado');
CREATE TYPE med.causa_raiz          AS ENUM ('imprevisto','estacional','subestimacion','impulso','ingreso_menor','otra');

CREATE TYPE ia.estado_recomendacion AS ENUM ('propuesta','aceptada','rechazada','expirada');
CREATE TYPE sys.tipo_actor          AS ENUM ('humano','ia','sistema','externo');

-- ---------------------------------------------------------------------
-- Funciones utilitarias
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION sys.tocar_actualizado() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN NEW.actualizado_en := now(); RETURN NEW; END $$;

-- =====================================================================
-- REF — catálogos globales (sin hogar_id; lectura para todos)
-- =====================================================================
CREATE TABLE ref.fuente_metodologica (
  codigo        text PRIMARY KEY,                -- YNAB, RAMSEY, YMOYL, SETHI, WARREN, KAKEIBO, BCCH, FINHEALTH
  titulo        text NOT NULL,
  autor         text,
  anio          smallint,
  referencia    text
);

CREATE TABLE ref.regla_metodo (
  codigo             text PRIMARY KEY CHECK (codigo ~ '^R[0-9]{2}$'),  -- R01..R40
  version            smallint NOT NULL DEFAULT 2,
  enunciado          text NOT NULL,
  nivel_precedencia  smallint NOT NULL CHECK (nivel_precedencia BETWEEN 1 AND 6),
  procesos           text[] NOT NULL,            -- {P3,P5}
  fuente_codigo      text REFERENCES ref.fuente_metodologica(codigo),
  estado             text NOT NULL DEFAULT 'vigente' CHECK (estado IN ('vigente','ajustada','nueva','retirada'))
);

CREATE TABLE ref.bloque (
  codigo        text PRIMARY KEY CHECK (codigo IN ('ESENCIALES','FUTURO','VIDA')),
  nombre        text NOT NULL,
  pct_limite    numeric(5,2) NOT NULL,           -- 50 / 20 / 30
  sentido       text NOT NULL CHECK (sentido IN ('max','min'))
);

CREATE TABLE ref.etapa (
  codigo            text PRIMARY KEY CHECK (codigo ~ '^E[0-5]$'),
  orden             smallint NOT NULL UNIQUE,
  nombre            text NOT NULL,
  criterio_entrada  jsonb NOT NULL,              -- expresión evaluable por el motor de reglas
  criterio_salida   jsonb NOT NULL,
  futuro_min_pct    numeric(5,2),                 -- mínimo a Futuro de la etapa (R07); nulo = igual a emergencia
  descripcion       text
);

CREATE TABLE ref.flujo_etapa (                    -- orden de destinos del día de pago por etapa (R04)
  etapa_codigo   text NOT NULL REFERENCES ref.etapa(codigo),
  orden          smallint NOT NULL CHECK (orden BETWEEN 1 AND 9),
  destino        text NOT NULL CHECK (destino IN ('cuatro_paredes','pagos_fijos','deudas_minimos',
                   'deuda_objetivo','emergencia','futuro','fondos','sobres','sin_culpa')),
  pct_sugerido   numeric(5,2),
  nota           text,
  PRIMARY KEY (etapa_codigo, orden)
);

CREATE TABLE ref.definicion_kpi (
  codigo        text PRIMARY KEY,                -- K1..K10, ICF, KP1..KP6
  nombre        text NOT NULL,
  grupo         text NOT NULL CHECK (grupo IN ('salud','proceso','compuesto')),
  formula       text NOT NULL,
  unidad        text NOT NULL,
  meta          text,
  en_mvp        boolean NOT NULL DEFAULT true,
  fuente_codigo text REFERENCES ref.fuente_metodologica(codigo)
);

CREATE TABLE ref.indicador_economico (           -- S4: UF, IPC, USD, EUR, UTM (R24, R32)
  codigo        text NOT NULL CHECK (codigo IN ('UF','IPC','USD','EUR','UTM')),
  fecha         date NOT NULL,
  valor         numeric(14,4) NOT NULL CHECK (valor > 0),
  fuente        text NOT NULL,
  obtenido_en   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (codigo, fecha)
);

CREATE TABLE ref.feriado (
  fecha         date PRIMARY KEY,
  nombre        text NOT NULL,
  irrenunciable boolean NOT NULL DEFAULT false
);

CREATE TABLE ref.categoria_plantilla (           -- categorías sugeridas en P1
  codigo             text PRIMARY KEY,
  nombre             text NOT NULL,
  bloque_codigo      text NOT NULL REFERENCES ref.bloque(codigo),
  tipo_sobre         plan.tipo_sobre NOT NULL,
  es_cuatro_paredes  boolean NOT NULL DEFAULT false,
  intencion_default  fin.intencion
);

-- =====================================================================
-- GOB — gobierno del hogar
-- =====================================================================
CREATE TABLE gob.hogar (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre          text NOT NULL,
  zona_horaria    text NOT NULL DEFAULT 'America/Santiago',
  moneda_base     fin.moneda NOT NULL DEFAULT 'CLP' CHECK (moneda_base = 'CLP'),
  etapa_codigo    text NOT NULL DEFAULT 'E0' REFERENCES ref.etapa(codigo),  -- etapa vigente (cache de historial_etapa)
  creado_en       timestamptz NOT NULL DEFAULT now(),
  actualizado_en  timestamptz NOT NULL DEFAULT now(),
  eliminado_en    timestamptz                      -- borrado lógico previo al borrado definitivo (D19)
);

CREATE TABLE gob.integrante (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hogar_id           uuid NOT NULL REFERENCES gob.hogar(id),
  usuario_auth_id    uuid,                         -- id del proveedor de identidad; nulo para menor sin cuenta
  nombre             text NOT NULL,
  alias              text,
  rol                gob.rol_integrante NOT NULL,
  suplente_de_id     uuid REFERENCES gob.integrante(id),   -- R39: suplencia del A
  es_menor           boolean NOT NULL DEFAULT false,
  tiene_ingresos     boolean NOT NULL DEFAULT false,
  horas_mes          numeric(6,1),                 -- para K10 salario real por hora (R18)
  acceso_vence_en    timestamptz,                  -- ASE: 90 días (D18)
  activo             boolean NOT NULL DEFAULT true,
  creado_en          timestamptz NOT NULL DEFAULT now(),
  actualizado_en     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (hogar_id, usuario_auth_id),
  UNIQUE (id, hogar_id),
  CHECK (rol <> 'MEN' OR es_menor),
  CHECK (rol <> 'ASE' OR acceso_vence_en IS NOT NULL),
  CHECK (suplente_de_id IS NULL OR suplente_de_id <> id)
);

CREATE TABLE gob.acuerdo_hogar (                  -- E1: Acuerdo versionado
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hogar_id         uuid NOT NULL REFERENCES gob.hogar(id),
  version          integer NOT NULL CHECK (version > 0),
  estado           gob.estado_acuerdo NOT NULL DEFAULT 'borrador',
  vigencia_desde   date NOT NULL,
  urgente          boolean NOT NULL DEFAULT false, -- vigencia inmediata acordada por ambos
  resumen_cambios  text,
  creado_por       uuid NOT NULL REFERENCES gob.integrante(id),
  creado_en        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (hogar_id, version)
);
CREATE UNIQUE INDEX ux_acuerdo_un_vigente ON gob.acuerdo_hogar(hogar_id) WHERE estado = 'vigente';

CREATE TABLE gob.regla_hogar (                    -- parámetros del Acuerdo (valores tipados en jsonb)
  acuerdo_id     uuid NOT NULL REFERENCES gob.acuerdo_hogar(id) ON DELETE CASCADE,
  codigo         text NOT NULL CHECK (codigo IN (
                   'dia_plan','dia_ingreso_mes_siguiente','umbral_ritmo','umbral_ajuste_ingreso_pct',
                   'autoaprobacion_n1_pct','plazo_suplencia_h','max_alertas_dia','hora_resumen_diario',
                   'confianza_ia_min','umbral_conciliacion_clp','holgura_fijos_pct','pct_reajuste_a_futuro',
                   'pct_sin_culpa','estrategia_deuda','dias_vencimiento_asesor','dias_abandono',
                   'monto_sin_culpa_clp')),
  valor          jsonb NOT NULL,
  regla_codigo   text REFERENCES ref.regla_metodo(codigo),   -- regla del método que parametriza
  PRIMARY KEY (acuerdo_id, codigo)
);

CREATE TABLE gob.solicitud_aprobacion (           -- DB06: workflow único de aprobaciones
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hogar_id          uuid NOT NULL REFERENCES gob.hogar(id),
  tipo              gob.tipo_solicitud NOT NULL,
  objeto_tabla      text NOT NULL,                -- p. ej. 'plan.presupuesto_mensual'
  objeto_id         uuid NOT NULL,
  firmas_requeridas smallint NOT NULL DEFAULT 1 CHECK (firmas_requeridas IN (1,2)),  -- 2 = doble firma (R37)
  aprobador_id      uuid REFERENCES gob.integrante(id),   -- A del proceso
  estado            gob.estado_solicitud NOT NULL DEFAULT 'pendiente',
  solicitada_por    uuid REFERENCES gob.integrante(id),   -- nulo si la propone la IA o el sistema
  solicitada_por_tipo sys.tipo_actor NOT NULL DEFAULT 'humano',
  vence_en          timestamptz NOT NULL,           -- plazo; a las 48 h pasa al suplente (R39)
  escalada_a_suplente boolean NOT NULL DEFAULT false,
  regla_codigo      text REFERENCES ref.regla_metodo(codigo),
  resuelta_en       timestamptz,
  creado_en         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_solicitud_pendiente ON gob.solicitud_aprobacion(hogar_id, vence_en) WHERE estado = 'pendiente';
CREATE INDEX ix_solicitud_objeto ON gob.solicitud_aprobacion(objeto_tabla, objeto_id);

CREATE TABLE gob.firma (
  solicitud_id   uuid NOT NULL REFERENCES gob.solicitud_aprobacion(id) ON DELETE CASCADE,
  integrante_id  uuid NOT NULL REFERENCES gob.integrante(id),
  decision       gob.decision_firma NOT NULL,
  como_suplente  boolean NOT NULL DEFAULT false,
  comentario     text,
  firmado_en     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (solicitud_id, integrante_id)
);

CREATE TABLE gob.consentimiento (                 -- S5, Ley 21.719, R25
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hogar_id          uuid NOT NULL REFERENCES gob.hogar(id),
  titular_id        uuid NOT NULL REFERENCES gob.integrante(id),
  otorgado_por_id   uuid NOT NULL REFERENCES gob.integrante(id),  -- distinto del titular si es parental
  finalidad         gob.finalidad_consent NOT NULL,
  version_texto     text NOT NULL,
  otorgado_en       timestamptz NOT NULL DEFAULT now(),
  revocado_en       timestamptz,
  CHECK (revocado_en IS NULL OR revocado_en >= otorgado_en)
);
CREATE UNIQUE INDEX ux_consent_vigente ON gob.consentimiento(titular_id, finalidad) WHERE revocado_en IS NULL;

CREATE TABLE gob.solicitud_derecho (              -- D19: exportación y borrado
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hogar_id        uuid NOT NULL REFERENCES gob.hogar(id),
  titular_id      uuid NOT NULL REFERENCES gob.integrante(id),
  tipo            gob.tipo_derecho NOT NULL,
  estado          text NOT NULL DEFAULT 'recibida' CHECK (estado IN ('recibida','en_proceso','cumplida','rechazada')),
  plazo_legal     date NOT NULL,
  resultado_uri   text,                            -- archivo de exportación (expira)
  creado_en       timestamptz NOT NULL DEFAULT now(),
  cumplida_en     timestamptz
);

CREATE TABLE gob.historial_etapa (                -- EtapaHogar + HistorialEtapa (R23, D15)
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hogar_id        uuid NOT NULL REFERENCES gob.hogar(id),
  etapa_codigo    text NOT NULL REFERENCES ref.etapa(codigo),
  etapa_anterior  text REFERENCES ref.etapa(codigo),
  direccion       gob.direccion_etapa NOT NULL,
  estado          gob.estado_etapa NOT NULL DEFAULT 'propuesta',
  origen          sys.tipo_actor NOT NULL,            -- ia (propuesta) o humano (manual)
  evidencia       jsonb NOT NULL DEFAULT '{}',        -- criterios evaluados y KPI usados
  solicitud_id    uuid REFERENCES gob.solicitud_aprobacion(id),
  propuesta_en    timestamptz NOT NULL DEFAULT now(),
  resuelta_en     timestamptz
);
CREATE UNIQUE INDEX ux_etapa_una_propuesta ON gob.historial_etapa(hogar_id) WHERE estado = 'propuesta';

CREATE TABLE gob.reunion (                        -- D16
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hogar_id        uuid NOT NULL REFERENCES gob.hogar(id),
  periodo_id      uuid,                            -- FK agregada tras crear plan.periodo
  realizada_en    timestamptz NOT NULL,
  quorum          boolean NOT NULL,
  agenda          jsonb NOT NULL DEFAULT '["resultados","valoracion","desvios","etapa","proximo_plan"]',
  acuerdos        text,
  asistentes      uuid[] NOT NULL
);

-- =====================================================================
-- PLAN — períodos, categorías, presupuestos, sobres
-- =====================================================================
CREATE TABLE plan.periodo (                       -- D01: mes presupuestario = mes calendario
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hogar_id        uuid NOT NULL REFERENCES gob.hogar(id),
  mes             date NOT NULL CHECK (extract(day FROM mes) = 1),
  estado          plan.estado_periodo NOT NULL DEFAULT 'abierto',
  cerrado_en      timestamptz,
  reabierto_motivo text,                           -- D20
  version_cierre  integer NOT NULL DEFAULT 0,
  UNIQUE (hogar_id, mes),
  UNIQUE (id, hogar_id)
);
ALTER TABLE gob.reunion ADD CONSTRAINT fk_reunion_periodo FOREIGN KEY (periodo_id) REFERENCES plan.periodo(id);

CREATE TABLE plan.categoria (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hogar_id           uuid NOT NULL REFERENCES gob.hogar(id),
  nombre             text NOT NULL,
  bloque_codigo      text NOT NULL REFERENCES ref.bloque(codigo),
  tipo_sobre         plan.tipo_sobre NOT NULL,
  es_cuatro_paredes  boolean NOT NULL DEFAULT false,      -- comida, vivienda, servicios, transporte (R05)
  intencion_default  fin.intencion,
  padre_id           uuid REFERENCES plan.categoria(id),
  plantilla_codigo   text REFERENCES ref.categoria_plantilla(codigo),
  activa             boolean NOT NULL DEFAULT true,
  UNIQUE (hogar_id, nombre),
  UNIQUE (id, hogar_id)
);

CREATE TABLE plan.fondo (                         -- S3: fondos prorrateados y metas (R03, R13)
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hogar_id         uuid NOT NULL REFERENCES gob.hogar(id),
  categoria_id     uuid NOT NULL REFERENCES plan.categoria(id),
  tipo             plan.tipo_fondo NOT NULL,
  nombre           text NOT NULL,
  monto_objetivo   bigint NOT NULL CHECK (monto_objetivo > 0),
  fecha_objetivo   date,
  integrante_id    uuid REFERENCES gob.integrante(id),    -- meta propia del menor (D17)
  cuenta_id        uuid,                                    -- cuenta donde se guarda (FK abajo)
  prioridad        smallint NOT NULL DEFAULT 5,
  activo           boolean NOT NULL DEFAULT true,
  creado_en        timestamptz NOT NULL DEFAULT now(),
  CHECK (tipo IN ('emergencia','futuro_largo_plazo') OR fecha_objetivo IS NOT NULL)
);

CREATE TABLE plan.presupuesto_mensual (           -- versión del plan del período
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hogar_id           uuid NOT NULL REFERENCES gob.hogar(id),
  periodo_id         uuid NOT NULL REFERENCES plan.periodo(id),
  version            integer NOT NULL CHECK (version > 0),
  estado             plan.estado_presupuesto NOT NULL DEFAULT 'borrador',
  ingreso_proyectado bigint NOT NULL CHECK (ingreso_proyectado >= 0),
  uf_proyectada      numeric(14,4),                -- D09
  etapa_codigo       text NOT NULL REFERENCES ref.etapa(codigo),
  acuerdo_id         uuid REFERENCES gob.acuerdo_hogar(id),   -- parámetros vigentes al aprobar
  generado_por       sys.tipo_actor NOT NULL DEFAULT 'ia',
  solicitud_id       uuid REFERENCES gob.solicitud_aprobacion(id),
  aprobado_por       uuid REFERENCES gob.integrante(id),
  aprobado_en        timestamptz,
  motivo_version     text,                          -- p. ej. 'P2-A ingreso -8%'
  creado_en          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (periodo_id, version),
  CHECK (estado IN ('borrador','reemplazado') OR aprobado_en IS NOT NULL)
);
CREATE UNIQUE INDEX ux_presupuesto_vigente ON plan.presupuesto_mensual(periodo_id)
  WHERE estado IN ('aprobado','en_ejecucion','en_cierre','cerrado');

CREATE TABLE plan.sobre (                         -- DB03: identidad estable del sobre en el período
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hogar_id         uuid NOT NULL REFERENCES gob.hogar(id),
  periodo_id       uuid NOT NULL REFERENCES plan.periodo(id),
  categoria_id     uuid REFERENCES plan.categoria(id),       -- nulo para por_asignar / proximo_mes
  tipo             plan.tipo_sobre NOT NULL,
  fondo_id         uuid REFERENCES plan.fondo(id),
  deuda_id         uuid,                                      -- FK abajo (sobre de cuota)
  integrante_id    uuid REFERENCES gob.integrante(id),       -- sin_culpa / mesada (D06, D17)
  orden_flujo      smallint CHECK (orden_flujo BETWEEN 1 AND 9),   -- destino 1..5 del día de pago
  cerrado          boolean NOT NULL DEFAULT false,            -- R11
  es_cuatro_paredes boolean NOT NULL DEFAULT false,
  creado_en        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, hogar_id),
  CHECK ((tipo IN ('por_asignar','proximo_mes')) = (categoria_id IS NULL)),
  CHECK (tipo NOT IN ('sin_culpa','mesada') OR integrante_id IS NOT NULL),
  CHECK (tipo <> 'fondo' OR fondo_id IS NOT NULL),
  CHECK (tipo <> 'cuota' OR deuda_id IS NOT NULL)
);
CREATE UNIQUE INDEX ux_sobre_especial ON plan.sobre(periodo_id, tipo) WHERE tipo IN ('por_asignar','proximo_mes');
CREATE UNIQUE INDEX ux_sobre_categoria ON plan.sobre(periodo_id, categoria_id, coalesce(integrante_id, '00000000-0000-0000-0000-000000000000'::uuid), coalesce(deuda_id, '00000000-0000-0000-0000-000000000000'::uuid))
  WHERE categoria_id IS NOT NULL;

CREATE TABLE plan.linea_plan (                    -- monto proyectado por sobre y versión (estado "proyectado")
  presupuesto_id    uuid NOT NULL REFERENCES plan.presupuesto_mensual(id) ON DELETE CASCADE,
  sobre_id          uuid NOT NULL REFERENCES plan.sobre(id),
  monto_proyectado  bigint NOT NULL CHECK (monto_proyectado >= 0),
  monto_uf          numeric(14,4),                  -- pagos fijos en UF (D09)
  holgura_pct       numeric(5,2) NOT NULL DEFAULT 0, -- R08
  aporte_calculado  bigint,                          -- R03 para fondos
  regla_codigo      text REFERENCES ref.regla_metodo(codigo),  -- explicación de la propuesta (P8)
  explicacion       text,
  PRIMARY KEY (presupuesto_id, sobre_id)
);

CREATE TABLE plan.pago_fijo (                     -- obligaciones recurrentes (P1, P2, PagoPorVencer)
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hogar_id         uuid NOT NULL REFERENCES gob.hogar(id),
  categoria_id     uuid NOT NULL REFERENCES plan.categoria(id),
  nombre           text NOT NULL,
  moneda           fin.moneda NOT NULL DEFAULT 'CLP' CHECK (moneda IN ('CLP','UF')),
  monto            numeric(14,4) NOT NULL CHECK (monto > 0),
  dia_vencimiento  smallint NOT NULL CHECK (dia_vencimiento BETWEEN 1 AND 31),
  cuenta_id        uuid,                             -- FK abajo
  vigente_desde    date NOT NULL,
  vigente_hasta    date,
  CHECK (vigente_hasta IS NULL OR vigente_hasta >= vigente_desde)
);

CREATE TABLE plan.ingreso_esperado (              -- ingresos típicos declarados en P1
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hogar_id         uuid NOT NULL REFERENCES gob.hogar(id),
  integrante_id    uuid NOT NULL REFERENCES gob.integrante(id),
  descripcion      text NOT NULL,
  tipo_ingreso     fin.tipo_ingreso NOT NULL,
  monto            bigint NOT NULL CHECK (monto > 0),
  dia_esperado     smallint CHECK (dia_esperado BETWEEN 1 AND 31),
  periodicidad     plan.periodicidad NOT NULL DEFAULT 'mensual',
  cuenta_id        uuid,                             -- FK abajo
  vigente_desde    date NOT NULL,
  vigente_hasta    date
);

-- =====================================================================
-- FIN — cuentas, movimientos, deudas
-- =====================================================================
CREATE TABLE fin.cuenta (                         -- S1 (D05)
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hogar_id         uuid NOT NULL REFERENCES gob.hogar(id),
  nombre           text NOT NULL,
  tipo             fin.tipo_cuenta NOT NULL,
  institucion      text,
  ultimos4         char(4) CHECK (ultimos4 ~ '^[0-9]{4}$'),  -- nunca el número completo
  moneda           fin.moneda NOT NULL DEFAULT 'CLP',
  titular_id       uuid REFERENCES gob.integrante(id),
  es_fondo_comun   boolean NOT NULL DEFAULT true,
  saldo_inicial    bigint NOT NULL DEFAULT 0,
  fecha_saldo_inicial date NOT NULL DEFAULT current_date,
  dia_facturacion  smallint CHECK (dia_facturacion BETWEEN 1 AND 31),
  dia_pago         smallint CHECK (dia_pago BETWEEN 1 AND 31),
  cupo             bigint CHECK (cupo >= 0),
  activa           boolean NOT NULL DEFAULT true,
  creado_en        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, hogar_id),
  CHECK ((tipo = 'tarjeta_credito') = (dia_facturacion IS NOT NULL AND dia_pago IS NOT NULL))
);
ALTER TABLE plan.fondo            ADD CONSTRAINT fk_fondo_cuenta   FOREIGN KEY (cuenta_id) REFERENCES fin.cuenta(id);
ALTER TABLE plan.pago_fijo        ADD CONSTRAINT fk_pfijo_cuenta   FOREIGN KEY (cuenta_id) REFERENCES fin.cuenta(id);
ALTER TABLE plan.ingreso_esperado ADD CONSTRAINT fk_ingesp_cuenta  FOREIGN KEY (cuenta_id) REFERENCES fin.cuenta(id);

CREATE TABLE fin.movimiento (                     -- gasto, ingreso, reembolso o ajuste
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hogar_id          uuid NOT NULL REFERENCES gob.hogar(id),
  periodo_id        uuid NOT NULL REFERENCES plan.periodo(id),
  cuenta_id         uuid NOT NULL REFERENCES fin.cuenta(id),
  tipo              fin.tipo_movimiento NOT NULL,
  estado            fin.estado_movimiento NOT NULL DEFAULT 'capturado',
  origen            fin.origen_movimiento NOT NULL,
  fecha_contable    date NOT NULL,                  -- D07: fecha de compra
  monto_clp         bigint NOT NULL CHECK (monto_clp > 0),
  moneda_original   fin.moneda NOT NULL DEFAULT 'CLP',
  monto_original    numeric(14,4),
  valor_conversion  numeric(14,4),                  -- UF o tipo de cambio usado (R24, R32)
  comercio          text,
  nota              text,
  intencion         fin.intencion,                  -- eje 3 (R17)
  confianza_ia      numeric(3,2) CHECK (confianza_ia BETWEEN 0 AND 1),   -- R36
  hash_dedup        text GENERATED ALWAYS AS (md5(cuenta_id::text || '|' || monto_clp::text)) STORED,
  cliente_op_id     uuid,                           -- D11: idempotencia de la cola offline
  movimiento_original_id uuid REFERENCES fin.movimiento(id),   -- reembolso → compra (R29)
  registrado_por    uuid REFERENCES gob.integrante(id),
  registrado_por_tipo sys.tipo_actor NOT NULL DEFAULT 'humano',
  confirmado_por    uuid REFERENCES gob.integrante(id),
  confirmado_en     timestamptz,
  creado_en         timestamptz NOT NULL DEFAULT now(),
  actualizado_en    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, hogar_id),
  UNIQUE (hogar_id, cliente_op_id),
  CHECK (moneda_original = 'CLP' OR (monto_original IS NOT NULL AND valor_conversion IS NOT NULL)),
  CHECK (tipo <> 'reembolso' OR movimiento_original_id IS NOT NULL),
  CHECK (estado NOT IN ('confirmado','conciliado') OR confirmado_en IS NOT NULL)
);
CREATE INDEX ix_mov_hogar_fecha   ON fin.movimiento(hogar_id, fecha_contable DESC);
CREATE INDEX ix_mov_periodo       ON fin.movimiento(periodo_id, tipo) WHERE estado IN ('confirmado','conciliado');
CREATE INDEX ix_mov_pendientes    ON fin.movimiento(hogar_id, creado_en) WHERE estado IN ('capturado','por_confirmar');
CREATE INDEX ix_mov_dedup         ON fin.movimiento(hogar_id, hash_dedup, fecha_contable) WHERE estado <> 'descartado';

CREATE TABLE fin.ingreso (                        -- subtipo 1:1 de movimiento (tipo = ingreso)
  movimiento_id       uuid PRIMARY KEY REFERENCES fin.movimiento(id) ON DELETE CASCADE,
  integrante_id       uuid REFERENCES gob.integrante(id),
  tipo_ingreso        fin.tipo_ingreso NOT NULL,
  ingreso_esperado_id uuid REFERENCES plan.ingreso_esperado(id),
  diferencia_pct      numeric(6,2),                 -- vs proyectado; > ±5% abre P2-A (R33)
  para_mes_siguiente  boolean NOT NULL DEFAULT false   -- D01: desde el día 20
);

CREATE TABLE fin.evidencia (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hogar_id        uuid NOT NULL REFERENCES gob.hogar(id),
  movimiento_id   uuid REFERENCES fin.movimiento(id) ON DELETE CASCADE,
  tipo            fin.tipo_evidencia NOT NULL,
  storage_uri     text NOT NULL,                     -- objeto cifrado fuera de la BD
  sha256          text NOT NULL,
  expira_en       timestamptz,                       -- correo crudo ≤ 30 días (D19)
  creado_en       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE fin.duplicado_candidato (            -- R35, D12
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hogar_id         uuid NOT NULL REFERENCES gob.hogar(id),
  movimiento_a_id  uuid NOT NULL REFERENCES fin.movimiento(id),
  movimiento_b_id  uuid NOT NULL REFERENCES fin.movimiento(id),
  estado           fin.estado_simple NOT NULL DEFAULT 'abierto',
  es_duplicado     boolean,
  resuelto_por     uuid REFERENCES gob.integrante(id),
  resuelto_en      timestamptz,
  CHECK (movimiento_a_id < movimiento_b_id),
  UNIQUE (movimiento_a_id, movimiento_b_id)
);

CREATE TABLE fin.transferencia (                  -- R27, R28; tareas de transferencia de P3
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hogar_id          uuid NOT NULL REFERENCES gob.hogar(id),
  cuenta_origen_id  uuid NOT NULL REFERENCES fin.cuenta(id),
  cuenta_destino_id uuid REFERENCES fin.cuenta(id),     -- nulo si va a cuenta personal externa
  tipo              fin.tipo_transferencia NOT NULL,
  monto_clp         bigint NOT NULL CHECK (monto_clp > 0),
  fecha             date NOT NULL,
  estado            fin.estado_transferencia NOT NULL DEFAULT 'pendiente',
  vence_en          timestamptz,                         -- recordatorio a las 72 h
  sobre_id          uuid REFERENCES plan.sobre(id),      -- a_personal → sobre sin culpa (D05)
  hecha_por         uuid REFERENCES gob.integrante(id),
  hecha_en          timestamptz,
  cliente_op_id     uuid,
  creado_en         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (hogar_id, cliente_op_id),
  CHECK (cuenta_destino_id IS NULL OR cuenta_destino_id <> cuenta_origen_id),
  CHECK (tipo <> 'a_personal' OR sobre_id IS NOT NULL),
  CHECK (tipo = 'a_personal' OR cuenta_destino_id IS NOT NULL)
);

CREATE TABLE fin.conciliacion (                   -- R34, S1
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hogar_id           uuid NOT NULL REFERENCES gob.hogar(id),
  cuenta_id          uuid NOT NULL REFERENCES fin.cuenta(id),
  periodo_id         uuid NOT NULL REFERENCES plan.periodo(id),
  tipo               text NOT NULL CHECK (tipo IN ('semanal','mensual')),
  fecha_corte        date NOT NULL,
  saldo_real         bigint NOT NULL,
  saldo_registrado   bigint NOT NULL,
  diferencia         bigint GENERATED ALWAYS AS (saldo_real - saldo_registrado) STORED,
  ajuste_movimiento_id uuid REFERENCES fin.movimiento(id),
  motivo             text,
  realizada_por      uuid NOT NULL REFERENCES gob.integrante(id),
  realizada_en       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cuenta_id, tipo, fecha_corte),
  CHECK (saldo_real = saldo_registrado OR motivo IS NOT NULL)
);

CREATE TABLE fin.deuda (                          -- S2 (R21, R26)
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hogar_id            uuid NOT NULL REFERENCES gob.hogar(id),
  tipo                fin.tipo_deuda NOT NULL,
  acreedor            text NOT NULL,
  cuenta_id           uuid REFERENCES fin.cuenta(id),       -- tarjeta asociada
  movimiento_origen_id uuid REFERENCES fin.movimiento(id),  -- compra en cuotas (R26)
  monto_original      bigint NOT NULL CHECK (monto_original > 0),
  saldo_actual        bigint NOT NULL CHECK (saldo_actual >= 0),
  tasa_mensual_pct    numeric(6,3) CHECK (tasa_mensual_pct >= 0),
  cae_pct             numeric(6,2),
  cuota_monto         bigint CHECK (cuota_monto > 0),
  n_cuotas            smallint CHECK (n_cuotas > 0),
  dia_vencimiento     smallint CHECK (dia_vencimiento BETWEEN 1 AND 31),
  es_consumo          boolean NOT NULL DEFAULT true,         -- para criterio E2 y RCI
  orden_pago          smallint,                              -- según estrategia elegida (R21)
  estado              text NOT NULL DEFAULT 'vigente' CHECK (estado IN ('vigente','pagada','renegociada','castigada')),
  creado_en           timestamptz NOT NULL DEFAULT now(),
  CHECK (tipo <> 'compra_cuotas' OR (movimiento_origen_id IS NOT NULL AND n_cuotas IS NOT NULL))
);
ALTER TABLE plan.sobre ADD CONSTRAINT fk_sobre_deuda FOREIGN KEY (deuda_id) REFERENCES fin.deuda(id);

CREATE TABLE fin.cuota_deuda (                    -- cuotas preasignadas por mes de facturación (R26, D08)
  deuda_id          uuid NOT NULL REFERENCES fin.deuda(id) ON DELETE CASCADE,
  numero            smallint NOT NULL CHECK (numero > 0),
  mes_facturacion   date NOT NULL CHECK (extract(day FROM mes_facturacion) = 1),
  monto_clp         bigint NOT NULL CHECK (monto_clp > 0),
  sobre_id          uuid REFERENCES plan.sobre(id),    -- se fija al crear el sobre del mes en P2
  pagada            boolean NOT NULL DEFAULT false,
  PRIMARY KEY (deuda_id, numero)
);

CREATE TABLE fin.por_cobrar (                     -- R30: gastos compartidos
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hogar_id              uuid NOT NULL REFERENCES gob.hogar(id),
  movimiento_origen_id  uuid NOT NULL REFERENCES fin.movimiento(id),
  deudor                text NOT NULL,
  monto_clp             bigint NOT NULL CHECK (monto_clp > 0),
  estado                fin.estado_simple NOT NULL DEFAULT 'abierto',
  movimiento_pago_id    uuid REFERENCES fin.movimiento(id),
  creado_en             timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE fin.activo (                         -- V2: K8 índice de acumulación
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hogar_id         uuid NOT NULL REFERENCES gob.hogar(id),
  tipo             text NOT NULL CHECK (tipo IN ('vivienda','vehiculo','inversion','prevision_voluntaria','otro')),
  nombre           text NOT NULL,
  valor_clp        bigint NOT NULL CHECK (valor_clp >= 0),
  valorizado_en    date NOT NULL
);

-- =====================================================================
-- PLAN (cont.) — dinero real sobre los sobres
-- =====================================================================
CREATE TABLE plan.asignacion (                    -- estado "asignación real" (R01, R04)
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hogar_id          uuid NOT NULL REFERENCES gob.hogar(id),
  ingreso_id        uuid NOT NULL REFERENCES fin.ingreso(movimiento_id),
  sobre_id          uuid NOT NULL REFERENCES plan.sobre(id),
  monto_clp         bigint NOT NULL CHECK (monto_clp > 0),
  orden_flujo       smallint,
  propuesta_por     sys.tipo_actor NOT NULL DEFAULT 'ia',
  confirmada_por    uuid NOT NULL REFERENCES gob.integrante(id),   -- solo personas (P8)
  confirmada_en     timestamptz NOT NULL DEFAULT now(),
  transferencia_id  uuid REFERENCES fin.transferencia(id)
);
CREATE INDEX ix_asig_sobre ON plan.asignacion(sobre_id);

CREATE TABLE plan.reasignacion (                  -- N1 y ajustes (R10, R37, R38)
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hogar_id            uuid NOT NULL REFERENCES gob.hogar(id),
  periodo_id          uuid NOT NULL REFERENCES plan.periodo(id),
  sobre_origen_id     uuid NOT NULL REFERENCES plan.sobre(id),
  sobre_destino_id    uuid NOT NULL REFERENCES plan.sobre(id),
  monto_clp           bigint NOT NULL CHECK (monto_clp > 0),
  motivo              text,
  autoaprobada        boolean NOT NULL DEFAULT false,   -- bajo umbral (R38)
  solicitud_id        uuid REFERENCES gob.solicitud_aprobacion(id),
  evento_recuperacion_id uuid,                           -- FK abajo
  registrada_por      uuid NOT NULL REFERENCES gob.integrante(id),
  aplicada_en         timestamptz,                       -- nulo hasta aprobación
  creado_en           timestamptz NOT NULL DEFAULT now(),
  CHECK (sobre_origen_id <> sobre_destino_id),
  CHECK (autoaprobada OR solicitud_id IS NOT NULL OR aplicada_en IS NULL)
);

CREATE TABLE fin.imputacion (                     -- reparte un movimiento entre sobres
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hogar_id         uuid NOT NULL REFERENCES gob.hogar(id),
  movimiento_id    uuid NOT NULL REFERENCES fin.movimiento(id) ON DELETE CASCADE,
  sobre_id         uuid NOT NULL REFERENCES plan.sobre(id),
  monto_clp        bigint NOT NULL CHECK (monto_clp > 0),
  creada_por_tipo  sys.tipo_actor NOT NULL DEFAULT 'humano',
  creado_en        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (movimiento_id, sobre_id)
);
CREATE INDEX ix_imp_sobre ON fin.imputacion(sobre_id);

CREATE TABLE plan.libro_sobre (                   -- DB04: libro inmutable de saldos de sobre
  id              bigserial PRIMARY KEY,
  hogar_id        uuid NOT NULL REFERENCES gob.hogar(id),
  sobre_id        uuid NOT NULL REFERENCES plan.sobre(id),
  tipo            plan.tipo_libro NOT NULL,
  monto_clp       bigint NOT NULL CHECK (monto_clp <> 0),  -- + entra al sobre, − sale
  origen_tabla    text NOT NULL,
  origen_id       uuid,
  fecha_valor     date NOT NULL,
  version_cierre  integer NOT NULL DEFAULT 0,             -- D20: asiento de reapertura
  registrado_en   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_libro_sobre ON plan.libro_sobre(sobre_id) INCLUDE (monto_clp);
CREATE INDEX ix_libro_origen ON plan.libro_sobre(origen_tabla, origen_id);

CREATE TABLE plan.programacion_flujo (            -- P2: agenda del día de pago
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hogar_id          uuid NOT NULL REFERENCES gob.hogar(id),
  presupuesto_id    uuid NOT NULL REFERENCES plan.presupuesto_mensual(id) ON DELETE CASCADE,
  ingreso_esperado_id uuid REFERENCES plan.ingreso_esperado(id),
  orden             smallint NOT NULL,
  sobre_id          uuid NOT NULL REFERENCES plan.sobre(id),
  monto_clp         bigint NOT NULL CHECK (monto_clp > 0),
  dia               smallint NOT NULL CHECK (dia BETWEEN 1 AND 31),
  cuenta_destino_id uuid REFERENCES fin.cuenta(id)
);

-- =====================================================================
-- MED — medición, alertas, recuperación, cierres y reflexión
-- =====================================================================
CREATE TABLE med.cierre (                         -- P7 semanal y mensual; KP4 y D14
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hogar_id         uuid NOT NULL REFERENCES gob.hogar(id),
  periodo_id       uuid NOT NULL REFERENCES plan.periodo(id),
  tipo             med.tipo_cierre NOT NULL,
  fecha_programada date NOT NULL,
  estado           med.estado_cierre NOT NULL DEFAULT 'pendiente',
  responsable_id   uuid REFERENCES gob.integrante(id),
  realizado_por    uuid REFERENCES gob.integrante(id),
  realizado_en     timestamptz,
  duracion_seg     integer,
  resumen_ia       text,
  UNIQUE (hogar_id, tipo, fecha_programada)
);

CREATE TABLE med.reflexion (                      -- R19 valoración +/0/− y preguntas Kakeibo
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hogar_id         uuid NOT NULL REFERENCES gob.hogar(id),
  cierre_id        uuid NOT NULL REFERENCES med.cierre(id) ON DELETE CASCADE,
  integrante_id    uuid NOT NULL REFERENCES gob.integrante(id),
  categoria_id     uuid REFERENCES plan.categoria(id),
  valoracion       med.valoracion,
  pregunta         text,
  respuesta        text,
  creado_en        timestamptz NOT NULL DEFAULT now(),
  CHECK (valoracion IS NOT NULL OR respuesta IS NOT NULL)
);
CREATE UNIQUE INDEX ux_reflexion_valor ON med.reflexion(cierre_id, integrante_id, categoria_id)
  WHERE valoracion IS NOT NULL;

CREATE TABLE med.medicion_kpi (
  hogar_id         uuid NOT NULL REFERENCES gob.hogar(id),
  periodo_id       uuid NOT NULL REFERENCES plan.periodo(id),
  kpi_codigo       text NOT NULL REFERENCES ref.definicion_kpi(codigo),
  version_cierre   integer NOT NULL DEFAULT 0,       -- D20: recálculo deja versión anterior
  valor            numeric(14,4) NOT NULL,
  semaforo         med.severidad,
  detalle          jsonb,
  calculado_en     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (periodo_id, kpi_codigo, version_cierre)
);

CREATE TABLE med.evento_recuperacion (            -- P6, escalera N1–N4
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hogar_id         uuid NOT NULL REFERENCES gob.hogar(id),
  periodo_id       uuid NOT NULL REFERENCES plan.periodo(id),
  nivel            med.nivel_recuperacion NOT NULL,
  estado           med.estado_recuperacion NOT NULL DEFAULT 'abierto',
  regla_codigo     text NOT NULL REFERENCES ref.regla_metodo(codigo),   -- R10, R12, R14, R15
  causa_raiz       med.causa_raiz,
  sobre_id         uuid REFERENCES plan.sobre(id),
  responsable_id   uuid NOT NULL REFERENCES gob.integrante(id),
  plan_accion      text,
  criterio_salida  jsonb NOT NULL,
  vence_el         date NOT NULL,
  escalado_desde_id uuid REFERENCES med.evento_recuperacion(id),
  fecha_reinicio   date,                              -- N4 (R15)
  abierto_en       timestamptz NOT NULL DEFAULT now(),
  cerrado_en       timestamptz,
  CHECK (nivel <> 'N4' OR fecha_reinicio IS NOT NULL),
  CHECK (estado <> 'cerrado' OR cerrado_en IS NOT NULL)
);
ALTER TABLE plan.reasignacion ADD CONSTRAINT fk_reasig_recup
  FOREIGN KEY (evento_recuperacion_id) REFERENCES med.evento_recuperacion(id);

CREATE TABLE med.alerta (                         -- P5 (R09, R12, R40, D13)
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hogar_id         uuid NOT NULL REFERENCES gob.hogar(id),
  destinatario_id  uuid NOT NULL REFERENCES gob.integrante(id),
  tipo             text NOT NULL CHECK (tipo IN ('ritmo','sobre_negativo','balance_proyectado','pago_por_vencer',
                                                 'transferencia_pendiente','cierre_atrasado','abandono',
                                                 'fondo_insuficiente','uf_sin_dato','aprobacion_pendiente')),
  severidad        med.severidad NOT NULL,
  regla_codigo     text REFERENCES ref.regla_metodo(codigo),
  sobre_id         uuid REFERENCES plan.sobre(id),
  mensaje          text NOT NULL,                   -- redactado sin culpa (R16)
  dato             jsonb,
  estado           med.estado_alerta NOT NULL DEFAULT 'generada',
  fecha_local      date NOT NULL,                   -- día del destinatario (para el tope diario)
  clave_dedup      text,                            -- evita repetir la misma alerta el mismo día
  enviada_en       timestamptz,
  leida_en         timestamptz,
  creado_en        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (destinatario_id, fecha_local, clave_dedup)
);
CREATE INDEX ix_alerta_dia ON med.alerta(destinatario_id, fecha_local) WHERE estado = 'enviada';

-- =====================================================================
-- IA — propuestas, inferencias y conocimiento
-- =====================================================================
CREATE TABLE ia.recomendacion (                   -- P8: cita regla y fuente; KP6
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hogar_id         uuid NOT NULL REFERENCES gob.hogar(id),
  proceso          text NOT NULL,
  tipo             text NOT NULL,                   -- plan, distribucion, recorte, etapa, deuda, ahorro…
  titulo           text NOT NULL,
  contenido        text NOT NULL,
  propuesta        jsonb,                            -- payload aplicable si se acepta
  regla_codigo     text NOT NULL REFERENCES ref.regla_metodo(codigo),
  fuente_codigo    text REFERENCES ref.fuente_metodologica(codigo),
  objeto_tabla     text,
  objeto_id        uuid,
  estado           ia.estado_recomendacion NOT NULL DEFAULT 'propuesta',
  decidida_por     uuid REFERENCES gob.integrante(id),
  decidida_en      timestamptz,
  modelo           text NOT NULL,
  expira_en        timestamptz,
  creado_en        timestamptz NOT NULL DEFAULT now(),
  CHECK (estado = 'propuesta' OR estado = 'expirada' OR decidida_por IS NOT NULL)
);

CREATE TABLE ia.inferencia (                      -- D10: confianza por campo inferido
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hogar_id         uuid NOT NULL REFERENCES gob.hogar(id),
  movimiento_id    uuid NOT NULL REFERENCES fin.movimiento(id) ON DELETE CASCADE,
  campo            text NOT NULL CHECK (campo IN ('categoria','sobre','bloque','intencion','responsable',
                                                  'cuenta','monto','fecha','comercio','cuotas')),
  valor_propuesto  text NOT NULL,
  confianza        numeric(3,2) NOT NULL CHECK (confianza BETWEEN 0 AND 1),
  aceptada         boolean,                          -- null = sin revisar; mide precisión
  valor_final      text,
  modelo           text NOT NULL,
  creado_en        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (movimiento_id, campo)
);

-- =====================================================================
-- SYS — eventos, auditoría, offline, dispositivos
-- =====================================================================
CREATE TABLE sys.evento_dominio (                 -- DB08: 22 eventos + outbox
  id               uuid NOT NULL DEFAULT gen_random_uuid(),
  hogar_id         uuid NOT NULL,
  tipo             text NOT NULL CHECK (tipo IN (
                     'HogarCreado','EtapaConfirmada','EtapaPropuesta','AcuerdoVersionado','PresupuestoAprobado',
                     'IngresoRecibido','IngresoAsignado','TransferenciaPendiente','GastoRegistrado',
                     'MovimientoPorConfirmar','DuplicadoCandidato','SobreNegativo','RitmoExcedido',
                     'PagoPorVencer','DesvioDetectado','RecuperacionIniciada','NivelEscalado',
                     'RecuperacionCerrada','AbandonoDetectado','SemanaCerrada','MesCerrado','ReinicioAprobado')),
  version_esquema  smallint NOT NULL DEFAULT 1,
  actor_tipo       sys.tipo_actor NOT NULL,
  actor_id         uuid,
  ocurrido_en      timestamptz NOT NULL DEFAULT now(),
  carga            jsonb NOT NULL,
  correlacion_id   uuid NOT NULL,
  causa_id         uuid,
  publicado_en     timestamptz,                      -- outbox: nulo = por publicar
  PRIMARY KEY (id, ocurrido_en)
) PARTITION BY RANGE (ocurrido_en);
CREATE TABLE sys.evento_dominio_2026 PARTITION OF sys.evento_dominio
  FOR VALUES FROM ('2026-01-01') TO ('2027-01-01');
CREATE TABLE sys.evento_dominio_2027 PARTITION OF sys.evento_dominio
  FOR VALUES FROM ('2027-01-01') TO ('2028-01-01');
CREATE INDEX ix_evento_outbox ON sys.evento_dominio(ocurrido_en) WHERE publicado_en IS NULL;
CREATE INDEX ix_evento_hogar  ON sys.evento_dominio(hogar_id, tipo, ocurrido_en DESC);

CREATE TABLE sys.auditoria (                      -- cambios de filas en tablas sensibles
  id               bigserial,
  hogar_id         uuid,
  tabla            text NOT NULL,
  registro_id      text NOT NULL,
  operacion        char(1) NOT NULL CHECK (operacion IN ('I','U','D')),
  antes            jsonb,
  despues          jsonb,
  actor_id         uuid,
  actor_tipo       sys.tipo_actor,
  en               timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id, en)
) PARTITION BY RANGE (en);
CREATE TABLE sys.auditoria_2026 PARTITION OF sys.auditoria FOR VALUES FROM ('2026-01-01') TO ('2027-01-01');
CREATE TABLE sys.auditoria_2027 PARTITION OF sys.auditoria FOR VALUES FROM ('2027-01-01') TO ('2028-01-01');

CREATE TABLE sys.dispositivo (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hogar_id         uuid NOT NULL REFERENCES gob.hogar(id),
  integrante_id    uuid NOT NULL REFERENCES gob.integrante(id),
  plataforma       text NOT NULL CHECK (plataforma IN ('ios','android','web')),
  push_token       text,
  ultimo_sync_en   timestamptz,
  ultimo_cursor    bigint,                           -- último libro/evento visto
  activo           boolean NOT NULL DEFAULT true
);

CREATE TABLE sys.operacion_cliente (              -- D11: idempotencia de la cola offline
  hogar_id         uuid NOT NULL REFERENCES gob.hogar(id),
  cliente_op_id    uuid NOT NULL,
  dispositivo_id   uuid REFERENCES sys.dispositivo(id),
  tipo             text NOT NULL,
  recibida_en      timestamptz NOT NULL DEFAULT now(),
  resultado        jsonb,
  PRIMARY KEY (hogar_id, cliente_op_id)
);

-- =====================================================================
-- APP — contexto de sesión y seguridad
-- =====================================================================
CREATE OR REPLACE FUNCTION app.hogar_actual() RETURNS uuid
LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('app.hogar_id', true), '')::uuid $$;

CREATE OR REPLACE FUNCTION app.integrante_actual() RETURNS uuid
LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('app.integrante_id', true), '')::uuid $$;

CREATE OR REPLACE FUNCTION app.rol_actual() RETURNS gob.rol_integrante
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, gob AS $$
  SELECT i.rol FROM gob.integrante i
   WHERE i.id = app.integrante_actual() AND i.hogar_id = app.hogar_actual() AND i.activo
     AND (i.acceso_vence_en IS NULL OR i.acceso_vence_en > now())
$$;

CREATE OR REPLACE FUNCTION app.es_admin() RETURNS boolean
LANGUAGE sql STABLE AS $$ SELECT coalesce(app.rol_actual() IN ('ORG','CAD'), false) $$;

CREATE OR REPLACE FUNCTION app.parametro(p_hogar uuid, p_codigo text) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, gob AS $$
  SELECT r.valor FROM gob.regla_hogar r JOIN gob.acuerdo_hogar a ON a.id = r.acuerdo_id
   WHERE a.hogar_id = p_hogar AND a.estado = 'vigente' AND r.codigo = p_codigo
$$;

-- =====================================================================
-- INVARIANTES EN BASE DE DATOS (triggers)
-- =====================================================================

-- I1. Período cerrado no admite cambios de dinero (R34, D20)
CREATE OR REPLACE FUNCTION plan.chk_periodo_abierto() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE v_estado plan.estado_periodo; v_periodo uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN v_periodo := OLD.periodo_id; ELSE v_periodo := NEW.periodo_id; END IF;
  SELECT estado INTO v_estado FROM plan.periodo WHERE id = v_periodo;
  IF v_estado = 'cerrado' THEN
    RAISE EXCEPTION 'Período cerrado: reabrir con motivo (D20) antes de modificar'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN coalesce(NEW, OLD);
END $$;
CREATE TRIGGER trg_mov_periodo BEFORE INSERT OR UPDATE OR DELETE ON fin.movimiento
  FOR EACH ROW EXECUTE FUNCTION plan.chk_periodo_abierto();

-- I2. Suma de imputaciones = monto del movimiento al confirmar (diferido al commit)
CREATE OR REPLACE FUNCTION fin.chk_imputacion_cuadra() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE v_mov fin.movimiento; v_suma bigint;
BEGIN
  IF TG_TABLE_NAME = 'movimiento' THEN
    SELECT * INTO v_mov FROM fin.movimiento WHERE id = NEW.id;
  ELSIF TG_OP = 'DELETE' THEN
    SELECT * INTO v_mov FROM fin.movimiento WHERE id = OLD.movimiento_id;
  ELSE
    SELECT * INTO v_mov FROM fin.movimiento WHERE id = NEW.movimiento_id;
  END IF;
  IF v_mov.id IS NULL OR v_mov.tipo NOT IN ('gasto','reembolso')
     OR v_mov.estado NOT IN ('confirmado','conciliado') THEN
    RETURN NULL;
  END IF;
  SELECT coalesce(sum(monto_clp),0) INTO v_suma FROM fin.imputacion WHERE movimiento_id = v_mov.id;
  IF v_suma <> v_mov.monto_clp THEN
    RAISE EXCEPTION 'Movimiento % confirmado con imputaciones % ≠ monto %', v_mov.id, v_suma, v_mov.monto_clp
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER trg_imp_cuadra AFTER INSERT OR UPDATE OR DELETE ON fin.imputacion
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION fin.chk_imputacion_cuadra();
CREATE CONSTRAINT TRIGGER trg_mov_cuadra AFTER INSERT OR UPDATE OF estado, monto_clp ON fin.movimiento
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION fin.chk_imputacion_cuadra();

-- I3. La IA nunca imputa sola a Futuro, emergencia o deuda (R36)
CREATE OR REPLACE FUNCTION fin.chk_imputacion_ia() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE v_tipo plan.tipo_sobre;
BEGIN
  SELECT tipo INTO v_tipo FROM plan.sobre WHERE id = NEW.sobre_id;
  IF NEW.creada_por_tipo = 'ia' AND v_tipo IN ('futuro','emergencia','cuota') THEN
    RAISE EXCEPTION 'R36: la IA no puede imputar a sobres % sin confirmación humana', v_tipo
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_imp_ia BEFORE INSERT OR UPDATE ON fin.imputacion
  FOR EACH ROW EXECUTE FUNCTION fin.chk_imputacion_ia();

-- I4. Libro de sobres: los documentos contabilizan sus asientos
CREATE OR REPLACE FUNCTION plan.contabilizar() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, plan, fin AS $$
DECLARE v_por_asignar uuid; v_fecha date; v_mov fin.movimiento;
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
    -- al confirmar: ingreso → Por asignar; gasto/reembolso → asientos por imputación
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
      END IF;
    ELSIF NEW.estado = 'descartado' AND OLD.estado IN ('confirmado','conciliado') THEN
      -- reverso: asientos de signo contrario, nunca DELETE
      INSERT INTO plan.libro_sobre(hogar_id, sobre_id, tipo, monto_clp, origen_tabla, origen_id, fecha_valor)
      SELECT hogar_id, sobre_id, 'ajuste', -monto_clp, origen_tabla, origen_id, current_date
        FROM plan.libro_sobre WHERE origen_tabla = 'fin.movimiento' AND origen_id = NEW.id;
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_asig_libro   AFTER INSERT ON plan.asignacion   FOR EACH ROW EXECUTE FUNCTION plan.contabilizar();
CREATE TRIGGER trg_reasig_libro AFTER INSERT OR UPDATE OF aplicada_en ON plan.reasignacion
  FOR EACH ROW EXECUTE FUNCTION plan.contabilizar();
CREATE TRIGGER trg_mov_libro    AFTER UPDATE OF estado ON fin.movimiento FOR EACH ROW EXECUTE FUNCTION plan.contabilizar();

-- I5. R01: no se asigna más dinero del recibido (Por asignar nunca negativo por asignación)
CREATE OR REPLACE FUNCTION plan.chk_por_asignar() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE v_saldo bigint; v_tipo plan.tipo_sobre;
BEGIN
  SELECT tipo INTO v_tipo FROM plan.sobre WHERE id = NEW.sobre_id;
  IF v_tipo = 'por_asignar' AND NEW.tipo = 'asignacion' THEN
    SELECT coalesce(sum(monto_clp),0) INTO v_saldo FROM plan.libro_sobre WHERE sobre_id = NEW.sobre_id;
    IF v_saldo < 0 THEN
      RAISE EXCEPTION 'R01: asignación supera el dinero recibido (Por asignar = %)', v_saldo
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER trg_libro_r01 AFTER INSERT ON plan.libro_sobre
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION plan.chk_por_asignar();

-- I6. Libro inmutable
CREATE OR REPLACE FUNCTION sys.bloquear_cambio() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION '% es solo inserción', TG_TABLE_NAME USING ERRCODE = 'insufficient_privilege'; END $$;
CREATE TRIGGER trg_libro_inmutable BEFORE UPDATE OR DELETE ON plan.libro_sobre
  FOR EACH ROW EXECUTE FUNCTION sys.bloquear_cambio();
CREATE TRIGGER trg_evento_inmutable BEFORE DELETE ON sys.evento_dominio
  FOR EACH ROW EXECUTE FUNCTION sys.bloquear_cambio();

-- I7. Base cero al aprobar: Σ líneas = ingreso proyectado (P2, término)
CREATE OR REPLACE FUNCTION plan.chk_base_cero() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE v_suma bigint;
BEGIN
  IF NEW.estado = 'aprobado' AND OLD.estado = 'borrador' THEN
    SELECT coalesce(sum(monto_proyectado),0) INTO v_suma FROM plan.linea_plan WHERE presupuesto_id = NEW.id;
    IF v_suma <> NEW.ingreso_proyectado THEN
      RAISE EXCEPTION 'Base cero: líneas % ≠ ingreso proyectado %', v_suma, NEW.ingreso_proyectado
        USING ERRCODE = 'check_violation';
    END IF;
    -- la versión aprobada anterior pasa a reemplazada
    UPDATE plan.presupuesto_mensual SET estado = 'reemplazado'
     WHERE periodo_id = NEW.periodo_id AND id <> NEW.id AND estado IN ('aprobado','en_ejecucion');
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_presup_base_cero BEFORE UPDATE OF estado ON plan.presupuesto_mensual
  FOR EACH ROW EXECUTE FUNCTION plan.chk_base_cero();

-- I8. Doble firma y suplencia: estado de la solicitud según firmas (R37, R39)
CREATE OR REPLACE FUNCTION gob.resolver_solicitud() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE v_sol gob.solicitud_aprobacion; v_aprueba int; v_rechaza int; v_rol gob.rol_integrante;
BEGIN
  SELECT * INTO v_sol FROM gob.solicitud_aprobacion WHERE id = NEW.solicitud_id FOR UPDATE;
  SELECT rol INTO v_rol FROM gob.integrante WHERE id = NEW.integrante_id;
  IF v_rol NOT IN ('ORG','CAD') THEN
    RAISE EXCEPTION 'Solo administradores firman aprobaciones' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF v_sol.estado <> 'pendiente' THEN
    RAISE EXCEPTION 'La solicitud ya está %', v_sol.estado USING ERRCODE = 'check_violation';
  END IF;
  SELECT count(*) FILTER (WHERE decision = 'aprueba'), count(*) FILTER (WHERE decision = 'rechaza')
    INTO v_aprueba, v_rechaza FROM gob.firma WHERE solicitud_id = NEW.solicitud_id;
  IF v_rechaza > 0 THEN
    UPDATE gob.solicitud_aprobacion SET estado = 'rechazada', resuelta_en = now() WHERE id = v_sol.id;
  ELSIF v_aprueba >= v_sol.firmas_requeridas THEN
    UPDATE gob.solicitud_aprobacion SET estado = 'aprobada', resuelta_en = now() WHERE id = v_sol.id;
  END IF;
  RETURN NULL;
END $$;
CREATE TRIGGER trg_firma_resolver AFTER INSERT ON gob.firma
  FOR EACH ROW EXECUTE FUNCTION gob.resolver_solicitud();

-- I9. Retiro de Futuro o emergencia exige solicitud con doble firma aprobada (R37)
CREATE OR REPLACE FUNCTION plan.chk_retiro_futuro() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE v_tipo plan.tipo_sobre; v_ok boolean;
BEGIN
  SELECT tipo INTO v_tipo FROM plan.sobre WHERE id = NEW.sobre_origen_id;
  IF v_tipo IN ('futuro','emergencia') AND NEW.aplicada_en IS NOT NULL THEN
    SELECT (estado = 'aprobada' AND firmas_requeridas = 2) INTO v_ok
      FROM gob.solicitud_aprobacion WHERE id = NEW.solicitud_id;
    IF NOT coalesce(v_ok, false) THEN
      RAISE EXCEPTION 'R37: retirar de % requiere doble firma aprobada', v_tipo
        USING ERRCODE = 'insufficient_privilege';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_reasig_futuro BEFORE INSERT OR UPDATE OF aplicada_en ON plan.reasignacion
  FOR EACH ROW EXECUTE FUNCTION plan.chk_retiro_futuro();

-- I10. Integridad entre hogares: el hogar de la fila coincide con el del padre
CREATE OR REPLACE FUNCTION sys.chk_mismo_hogar() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE v_h uuid;
BEGIN
  IF TG_TABLE_NAME = 'imputacion' THEN
    SELECT hogar_id INTO v_h FROM plan.sobre WHERE id = NEW.sobre_id;
  ELSIF TG_TABLE_NAME = 'movimiento' THEN
    SELECT hogar_id INTO v_h FROM fin.cuenta WHERE id = NEW.cuenta_id;
  ELSIF TG_TABLE_NAME = 'asignacion' THEN
    SELECT hogar_id INTO v_h FROM plan.sobre WHERE id = NEW.sobre_id;
  END IF;
  IF v_h IS DISTINCT FROM NEW.hogar_id THEN
    RAISE EXCEPTION 'Referencia a otro hogar en %', TG_TABLE_NAME USING ERRCODE = 'foreign_key_violation';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_imp_hogar  BEFORE INSERT OR UPDATE ON fin.imputacion  FOR EACH ROW EXECUTE FUNCTION sys.chk_mismo_hogar();
CREATE TRIGGER trg_mov_hogar  BEFORE INSERT OR UPDATE ON fin.movimiento  FOR EACH ROW EXECUTE FUNCTION sys.chk_mismo_hogar();
CREATE TRIGGER trg_asig_hogar BEFORE INSERT OR UPDATE ON plan.asignacion FOR EACH ROW EXECUTE FUNCTION sys.chk_mismo_hogar();

-- I11. Auditoría genérica
CREATE OR REPLACE FUNCTION sys.auditar() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, sys AS $$
BEGIN
  INSERT INTO sys.auditoria(hogar_id, tabla, registro_id, operacion, antes, despues, actor_id, actor_tipo)
  VALUES (coalesce((to_jsonb(NEW)->>'hogar_id')::uuid, (to_jsonb(OLD)->>'hogar_id')::uuid),
          TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME,
          coalesce(to_jsonb(NEW)->>'id', to_jsonb(OLD)->>'id', ''),
          left(TG_OP, 1),
          CASE WHEN TG_OP <> 'INSERT' THEN to_jsonb(OLD) END,
          CASE WHEN TG_OP <> 'DELETE' THEN to_jsonb(NEW) END,
          app.integrante_actual(),
          CASE current_user WHEN 'compas_ia' THEN 'ia'::sys.tipo_actor
                            WHEN 'compas_sistema' THEN 'sistema'::sys.tipo_actor
                            ELSE 'humano'::sys.tipo_actor END);
  RETURN coalesce(NEW, OLD);
END $$;
CREATE TRIGGER trg_aud_movimiento  AFTER INSERT OR UPDATE OR DELETE ON fin.movimiento           FOR EACH ROW EXECUTE FUNCTION sys.auditar();
CREATE TRIGGER trg_aud_presupuesto AFTER INSERT OR UPDATE OR DELETE ON plan.presupuesto_mensual FOR EACH ROW EXECUTE FUNCTION sys.auditar();
CREATE TRIGGER trg_aud_reasig      AFTER INSERT OR UPDATE OR DELETE ON plan.reasignacion        FOR EACH ROW EXECUTE FUNCTION sys.auditar();
CREATE TRIGGER trg_aud_acuerdo     AFTER INSERT OR UPDATE OR DELETE ON gob.acuerdo_hogar        FOR EACH ROW EXECUTE FUNCTION sys.auditar();
CREATE TRIGGER trg_aud_integrante  AFTER INSERT OR UPDATE OR DELETE ON gob.integrante           FOR EACH ROW EXECUTE FUNCTION sys.auditar();
CREATE TRIGGER trg_aud_consent     AFTER INSERT OR UPDATE OR DELETE ON gob.consentimiento       FOR EACH ROW EXECUTE FUNCTION sys.auditar();
CREATE TRIGGER trg_aud_periodo     AFTER INSERT OR UPDATE OR DELETE ON plan.periodo             FOR EACH ROW EXECUTE FUNCTION sys.auditar();

-- actualizado_en
CREATE TRIGGER trg_hogar_upd      BEFORE UPDATE ON gob.hogar      FOR EACH ROW EXECUTE FUNCTION sys.tocar_actualizado();
CREATE TRIGGER trg_integrante_upd BEFORE UPDATE ON gob.integrante FOR EACH ROW EXECUTE FUNCTION sys.tocar_actualizado();
CREATE TRIGGER trg_movimiento_upd BEFORE UPDATE ON fin.movimiento FOR EACH ROW EXECUTE FUNCTION sys.tocar_actualizado();

-- =====================================================================
-- VISTAS DE LECTURA
-- =====================================================================
CREATE VIEW plan.v_saldo_sobre WITH (security_invoker = true) AS
SELECT s.id AS sobre_id, s.hogar_id, s.periodo_id, s.tipo, s.categoria_id, s.integrante_id,
       coalesce(sum(l.monto_clp) FILTER (WHERE l.tipo IN ('asignacion','reasignacion','arrastre','ingreso')), 0) AS disponible,
       coalesce(-sum(l.monto_clp) FILTER (WHERE l.tipo = 'imputacion'), 0)              AS gastado,
       coalesce(sum(l.monto_clp), 0)                                                    AS saldo
  FROM plan.sobre s LEFT JOIN plan.libro_sobre l ON l.sobre_id = s.id
 GROUP BY s.id;

CREATE VIEW plan.v_ritmo_sobre WITH (security_invoker = true) AS   -- R09: solo sobres variables
SELECT v.sobre_id, v.hogar_id, v.periodo_id, v.disponible, v.gastado,
       p.mes,
       (date_part('day', least(current_date, (p.mes + interval '1 month - 1 day')::date)))::int AS dias_transcurridos,
       date_part('day', (p.mes + interval '1 month - 1 day'))::int                             AS dias_mes,
       CASE WHEN v.disponible > 0 THEN
         round(v.gastado::numeric /
               (v.disponible * date_part('day', least(current_date, (p.mes + interval '1 month - 1 day')::date))
                / date_part('day', (p.mes + interval '1 month - 1 day')))::numeric, 2)
       END AS ritmo
  FROM plan.v_saldo_sobre v JOIN plan.periodo p ON p.id = v.periodo_id
 WHERE v.tipo IN ('variable','mesada');

CREATE VIEW plan.v_bloques_periodo WITH (security_invoker = true) AS   -- semáforo 50/30/20 (R06, R07)
SELECT pm.periodo_id, pm.hogar_id, c.bloque_codigo,
       sum(lp.monto_proyectado) AS monto,
       round(100.0 * sum(lp.monto_proyectado) / nullif(pm.ingreso_proyectado,0), 1) AS pct_ingreso
  FROM plan.presupuesto_mensual pm
  JOIN plan.linea_plan lp ON lp.presupuesto_id = pm.id
  JOIN plan.sobre s ON s.id = lp.sobre_id
  JOIN plan.categoria c ON c.id = s.categoria_id
 WHERE pm.estado IN ('aprobado','en_ejecucion','en_cierre','cerrado')
 GROUP BY pm.periodo_id, pm.hogar_id, c.bloque_codigo, pm.ingreso_proyectado;

-- =====================================================================
-- ROLES Y SEGURIDAD POR FILA (DB02, DB07, R25, D06, D18)
-- =====================================================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'compas_app')     THEN CREATE ROLE compas_app NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'compas_ia')      THEN CREATE ROLE compas_ia NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'compas_sistema') THEN CREATE ROLE compas_sistema NOLOGIN; END IF;
END $$;

GRANT USAGE ON SCHEMA ref, gob, fin, plan, med, ia, sys, app TO compas_app, compas_ia, compas_sistema;
GRANT SELECT ON ALL TABLES IN SCHEMA ref TO compas_app, compas_ia, compas_sistema;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA app TO compas_app, compas_ia, compas_sistema;

-- App (personas): lectura/escritura acotada por RLS
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA gob, fin, plan, med TO compas_app;
GRANT SELECT, UPDATE ON ia.recomendacion, ia.inferencia TO compas_app;
GRANT INSERT ON sys.evento_dominio, sys.operacion_cliente TO compas_app;
GRANT SELECT, INSERT, UPDATE ON sys.dispositivo TO compas_app;
REVOKE INSERT, UPDATE, DELETE ON plan.libro_sobre FROM compas_app;   -- solo vía triggers (DB04)
GRANT USAGE ON ALL SEQUENCES IN SCHEMA plan, sys TO compas_app, compas_sistema;

-- IA: lee para proponer, solo inserta propuestas (P8: nunca aprueba ni mueve dinero)
GRANT SELECT ON ALL TABLES IN SCHEMA gob, fin, plan, med TO compas_ia;
GRANT INSERT ON ia.recomendacion, ia.inferencia, sys.evento_dominio TO compas_ia;
GRANT INSERT ON plan.presupuesto_mensual, plan.linea_plan, gob.historial_etapa, gob.solicitud_aprobacion TO compas_ia;
GRANT UPDATE (intencion, confianza_ia, estado) ON fin.movimiento TO compas_ia;   -- capturado → por_confirmar
GRANT INSERT ON fin.imputacion TO compas_ia;   -- limitada por I3 (R36)
GRANT SELECT ON ia.recomendacion, ia.inferencia TO compas_ia;
REVOKE INSERT, UPDATE ON gob.firma, plan.asignacion, plan.reasignacion, fin.transferencia FROM compas_ia;

-- Sistema (jobs: UF, cierres, alertas, outbox)
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA gob, fin, plan, med, ia, sys TO compas_sistema;
GRANT INSERT, UPDATE ON ref.indicador_economico TO compas_sistema;

-- Habilitar RLS en todas las tablas con hogar_id
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT c.table_schema, c.table_name
      FROM information_schema.columns c
      JOIN information_schema.tables t USING (table_schema, table_name)
     WHERE c.column_name = 'hogar_id' AND t.table_type = 'BASE TABLE'
       AND c.table_schema IN ('gob','fin','plan','med','ia','sys')
       AND c.table_name NOT LIKE '%\_20__' ESCAPE '\'
       AND c.table_name <> 'auditoria'
  LOOP
    EXECUTE format('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY', r.table_schema, r.table_name);
    EXECUTE format('ALTER TABLE %I.%I FORCE ROW LEVEL SECURITY', r.table_schema, r.table_name);
    -- política base: aislamiento por hogar para todos los roles
    EXECUTE format($p$CREATE POLICY p_hogar ON %I.%I AS PERMISSIVE FOR ALL
                     USING (hogar_id = app.hogar_actual()) WITH CHECK (hogar_id = app.hogar_actual())$p$,
                   r.table_schema, r.table_name);
  END LOOP;
END $$;
ALTER TABLE gob.hogar ENABLE ROW LEVEL SECURITY;
ALTER TABLE gob.hogar FORCE ROW LEVEL SECURITY;
CREATE POLICY p_hogar ON gob.hogar FOR ALL USING (id = app.hogar_actual()) WITH CHECK (id = app.hogar_actual());

-- Políticas restrictivas por rol (se suman con AND a p_hogar)

-- Asesor externo: solo lectura y no vencido (D18)
CREATE POLICY r_asesor_solo_lectura ON fin.movimiento AS RESTRICTIVE FOR UPDATE TO compas_app
  USING (app.rol_actual() IS DISTINCT FROM 'ASE');
CREATE POLICY r_asesor_no_inserta ON fin.movimiento AS RESTRICTIVE FOR INSERT TO compas_app
  WITH CHECK (app.rol_actual() IN ('ORG','CAD','ING','MEN'));

-- Menor: ve y registra solo lo de su sobre (R25, D17)
CREATE POLICY r_menor_sobre ON plan.sobre AS RESTRICTIVE FOR SELECT TO compas_app
  USING (app.rol_actual() IS DISTINCT FROM 'MEN' OR integrante_id = app.integrante_actual());
CREATE POLICY r_menor_movimiento ON fin.movimiento AS RESTRICTIVE FOR SELECT TO compas_app
  USING (app.rol_actual() IS DISTINCT FROM 'MEN' OR registrado_por = app.integrante_actual());
CREATE POLICY r_menor_fondo ON plan.fondo AS RESTRICTIVE FOR SELECT TO compas_app
  USING (app.rol_actual() IS DISTINCT FROM 'MEN' OR integrante_id = app.integrante_actual());
CREATE POLICY r_menor_cuenta ON fin.cuenta AS RESTRICTIVE FOR SELECT TO compas_app
  USING (app.rol_actual() IS DISTINCT FROM 'MEN');
CREATE POLICY r_menor_presupuesto ON plan.presupuesto_mensual AS RESTRICTIVE FOR SELECT TO compas_app
  USING (app.rol_actual() IS DISTINCT FROM 'MEN');

-- Datos de menores visibles solo a administradores y al propio menor (R25)
CREATE POLICY r_datos_menor ON gob.integrante AS RESTRICTIVE FOR SELECT TO compas_app
  USING (NOT es_menor OR app.es_admin() OR id = app.integrante_actual());

-- Aprobaciones: solo administradores cambian estados de plan, acuerdo, etapa y período
CREATE POLICY r_admin_presupuesto ON plan.presupuesto_mensual AS RESTRICTIVE FOR UPDATE TO compas_app
  USING (app.es_admin());
CREATE POLICY r_admin_acuerdo ON gob.acuerdo_hogar AS RESTRICTIVE FOR ALL TO compas_app
  USING (app.es_admin() OR app.rol_actual() IN ('ING','ASE','MEN')) WITH CHECK (app.es_admin());
CREATE POLICY r_admin_periodo ON plan.periodo AS RESTRICTIVE FOR UPDATE TO compas_app USING (app.es_admin());
CREATE POLICY r_admin_firma ON gob.firma AS RESTRICTIVE FOR INSERT TO compas_app
  WITH CHECK (app.es_admin() AND integrante_id = app.integrante_actual());
CREATE POLICY r_admin_asignacion ON plan.asignacion AS RESTRICTIVE FOR INSERT TO compas_app
  WITH CHECK (app.es_admin() AND confirmada_por = app.integrante_actual());

-- Reflexión: cada integrante escribe la suya
CREATE POLICY r_reflexion_propia ON med.reflexion AS RESTRICTIVE FOR INSERT TO compas_app
  WITH CHECK (integrante_id = app.integrante_actual());

-- Alertas: cada persona ve las suyas; administradores, todas
CREATE POLICY r_alerta_propia ON med.alerta AS RESTRICTIVE FOR SELECT TO compas_app
  USING (destinatario_id = app.integrante_actual() OR app.es_admin());

-- Auditoría: escrita solo por el trigger (definer); lectura para administradores del hogar
ALTER TABLE sys.auditoria ENABLE ROW LEVEL SECURITY;
CREATE POLICY p_auditoria_admin ON sys.auditoria FOR SELECT TO compas_app
  USING (hogar_id = app.hogar_actual() AND app.es_admin());

COMMIT;
