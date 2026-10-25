import { z } from "zod";

// Parámetros del Acuerdo del Hogar (gob.regla_hogar). Valores por defecto: tabla de la spec 001.

const pesos = z.number().int().nonnegative(); // CLP enteros (I3)
const pct = z.number().int().min(0).max(100);
const fechaIso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const modalidadSinCulpa = z.enum(["igual", "proporcional_ingreso", "manual_por_adulto"]);
export type ModalidadSinCulpa = z.infer<typeof modalidadSinCulpa>;

// ADR-10: con manual_por_adulto el monto es un objeto {integrante_id: monto}; en las otras
// modalidades es opcional y, si existe, es un monto único que reemplaza a pct_sin_culpa.
const montoSinCulpa = z.union([pesos, z.record(z.uuid(), pesos)]);

export const parametrosAcuerdo = z
  .object({
    inicio_piloto: fechaIso,
    mes_primer_plan: fechaIso,
    dia_plan: z.number().int().min(1).max(28),
    dia_ingreso_mes_siguiente: z.number().int().min(1).max(31),
    umbral_ritmo: z.number().positive(),
    umbral_ajuste_ingreso_pct: pct,
    autoaprobacion_n1_pct: pct,
    plazo_suplencia_h: z.number().int().positive(),
    max_alertas_dia: z.number().int().nonnegative(),
    hora_resumen_diario: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    confianza_ia_min: z.number().min(0).max(1),
    umbral_conciliacion_clp: pesos,
    holgura_fijos_pct: pct,
    pct_reajuste_a_futuro: pct,
    pct_variable_a_futuro: pct,
    pct_sin_culpa: pct,
    modalidad_sin_culpa: modalidadSinCulpa,
    monto_sin_culpa_clp: montoSinCulpa.optional(),
    estrategia_deuda: z.enum(["avalancha", "bola_de_nieve"]),
    dias_abandono: z.number().int().positive(),
    tratamiento_cuotas_default: z.enum(["por_cuota", "total"]),
    dias_retencion_cartola: z.number().int().positive(),
  })
  .strict()
  .superRefine((p, ctx) => {
    const porAdulto = typeof p.monto_sin_culpa_clp === "object";
    if (p.modalidad_sin_culpa === "manual_por_adulto" && !porAdulto) {
      ctx.addIssue({
        code: "custom",
        path: ["monto_sin_culpa_clp"],
        message: "Con modalidad manual_por_adulto se define un monto por adulto (ADR-10).",
      });
    }
    if (p.modalidad_sin_culpa !== "manual_por_adulto" && porAdulto) {
      ctx.addIssue({
        code: "custom",
        path: ["monto_sin_culpa_clp"],
        message: "El monto por adulto solo aplica a la modalidad manual_por_adulto (ADR-10).",
      });
    }
  });

export type ParametrosAcuerdo = z.infer<typeof parametrosAcuerdo>;
export type CodigoParametro = keyof ParametrosAcuerdo;

export const PARAMETROS_POR_DEFECTO = {
  inicio_piloto: "2026-10-01",
  mes_primer_plan: "2026-12-01",
  dia_plan: 25,
  dia_ingreso_mes_siguiente: 20,
  umbral_ritmo: 1.1,
  umbral_ajuste_ingreso_pct: 5,
  autoaprobacion_n1_pct: 5,
  plazo_suplencia_h: 48,
  max_alertas_dia: 3,
  hora_resumen_diario: "20:00",
  confianza_ia_min: 0.8,
  umbral_conciliacion_clp: 1000,
  holgura_fijos_pct: 15,
  pct_reajuste_a_futuro: 50,
  pct_variable_a_futuro: 50,
  pct_sin_culpa: 5,
  modalidad_sin_culpa: "igual",
  estrategia_deuda: "avalancha",
  dias_abandono: 14,
  tratamiento_cuotas_default: "por_cuota",
  dias_retencion_cartola: 30,
} as const satisfies ParametrosAcuerdo;

// Regla, principio o decisión que cada parámetro configura (I5).
export const REGLA_DE_PARAMETRO: Record<CodigoParametro, string> = {
  inicio_piloto: "R41",
  mes_primer_plan: "D21",
  dia_plan: "P2",
  dia_ingreso_mes_siguiente: "D01",
  umbral_ritmo: "R09",
  umbral_ajuste_ingreso_pct: "R33",
  autoaprobacion_n1_pct: "R38",
  plazo_suplencia_h: "R39",
  max_alertas_dia: "R40",
  hora_resumen_diario: "D13",
  confianza_ia_min: "R36",
  umbral_conciliacion_clp: "R34",
  holgura_fijos_pct: "R08",
  pct_reajuste_a_futuro: "R22",
  pct_variable_a_futuro: "R45",
  pct_sin_culpa: "E1",
  modalidad_sin_culpa: "D25",
  monto_sin_culpa_clp: "D25",
  estrategia_deuda: "R21",
  dias_abandono: "D14",
  tratamiento_cuotas_default: "D08",
  dias_retencion_cartola: "R43",
};

export interface FilaReglaHogar {
  codigo: CodigoParametro;
  valor: ParametrosAcuerdo[CodigoParametro];
  regla_codigo: string | null; // FK a ref.regla_metodo: solo reglas R01–R45
}

export function parametrosAFilas(p: ParametrosAcuerdo): FilaReglaHogar[] {
  return (Object.keys(p) as CodigoParametro[])
    .filter((codigo) => p[codigo] !== undefined)
    .map((codigo) => {
      const regla = REGLA_DE_PARAMETRO[codigo];
      return { codigo, valor: p[codigo], regla_codigo: /^R\d{2}$/.test(regla) ? regla : null };
    });
}
