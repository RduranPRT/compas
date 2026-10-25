import { describe, expect, it } from "vitest";
import {
  PARAMETROS_POR_DEFECTO,
  describirParametro,
  REGLA_DE_PARAMETRO,
  parametrosAcuerdo,
  parametrosAFilas,
} from "./parametros";

describe("Parámetros por defecto del Acuerdo v1 (spec 001)", () => {
  it("son válidos según el esquema", () => {
    expect(parametrosAcuerdo.parse(PARAMETROS_POR_DEFECTO)).toEqual(PARAMETROS_POR_DEFECTO);
  });

  it("tienen los valores de la tabla de la spec", () => {
    expect(PARAMETROS_POR_DEFECTO).toEqual({
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
    });
  });

  it("cada parámetro cita su regla o decisión (I5)", () => {
    for (const codigo of Object.keys(PARAMETROS_POR_DEFECTO)) {
      expect(REGLA_DE_PARAMETRO[codigo as keyof typeof REGLA_DE_PARAMETRO]).toBeTruthy();
    }
    expect(REGLA_DE_PARAMETRO.modalidad_sin_culpa).toBe("D25");
    expect(REGLA_DE_PARAMETRO.plazo_suplencia_h).toBe("R39");
  });
});

describe("modalidad_sin_culpa (ADR-10, D25)", () => {
  const adultoA = "11111111-1111-4111-8111-111111111111";
  const adultoB = "22222222-2222-4222-8222-222222222222";

  it.each(["igual", "proporcional_ingreso", "manual_por_adulto"] as const)(
    "acepta la modalidad %s",
    (modalidad) => {
      const p = {
        ...PARAMETROS_POR_DEFECTO,
        modalidad_sin_culpa: modalidad,
        ...(modalidad === "manual_por_adulto"
          ? { monto_sin_culpa_clp: { [adultoA]: 50000, [adultoB]: 40000 } }
          : {}),
      };
      expect(parametrosAcuerdo.safeParse(p).success).toBe(true);
    },
  );

  it("rechaza una modalidad desconocida", () => {
    const p = { ...PARAMETROS_POR_DEFECTO, modalidad_sin_culpa: "por_edad" };
    expect(parametrosAcuerdo.safeParse(p).success).toBe(false);
  });

  it("manual_por_adulto exige un monto por adulto", () => {
    const p = { ...PARAMETROS_POR_DEFECTO, modalidad_sin_culpa: "manual_por_adulto" };
    expect(parametrosAcuerdo.safeParse(p).success).toBe(false);
  });

  it("igual acepta un monto fijo único en pesos enteros", () => {
    const p = { ...PARAMETROS_POR_DEFECTO, monto_sin_culpa_clp: 60000 };
    expect(parametrosAcuerdo.safeParse(p).success).toBe(true);
  });

  it("los montos sin culpa son pesos enteros, nunca decimales (I3)", () => {
    const p = {
      ...PARAMETROS_POR_DEFECTO,
      modalidad_sin_culpa: "manual_por_adulto",
      monto_sin_culpa_clp: { [adultoA]: 50000.5 },
    };
    expect(parametrosAcuerdo.safeParse(p).success).toBe(false);
  });
});

describe("Validaciones de rango", () => {
  it("dia_plan entre 1 y 28", () => {
    expect(parametrosAcuerdo.safeParse({ ...PARAMETROS_POR_DEFECTO, dia_plan: 31 }).success).toBe(false);
  });

  it("hora_resumen_diario en formato HH:MM", () => {
    expect(
      parametrosAcuerdo.safeParse({ ...PARAMETROS_POR_DEFECTO, hora_resumen_diario: "8pm" }).success,
    ).toBe(false);
  });
});

describe("parametrosAFilas", () => {
  it("genera una fila de gob.regla_hogar por parámetro, con regla_codigo solo para reglas R", () => {
    const filas = parametrosAFilas(PARAMETROS_POR_DEFECTO);
    expect(filas).toHaveLength(Object.keys(PARAMETROS_POR_DEFECTO).length);
    expect(filas).toContainEqual({ codigo: "plazo_suplencia_h", valor: 48, regla_codigo: "R39" });
    expect(filas).toContainEqual({ codigo: "modalidad_sin_culpa", valor: "igual", regla_codigo: null });
  });
});

describe("describirParametro (Acuerdo legible, spec 001)", () => {
  it("todos los parámetros por defecto tienen nombre y explicación", () => {
    for (const [codigo, valor] of Object.entries(PARAMETROS_POR_DEFECTO)) {
      const d = describirParametro(codigo as keyof typeof PARAMETROS_POR_DEFECTO, valor);
      expect(d.nombre.length).toBeGreaterThan(0);
      expect(d.explicacion.length).toBeGreaterThan(0);
      expect(d.regla).toBe(REGLA_DE_PARAMETRO[codigo as keyof typeof REGLA_DE_PARAMETRO]);
    }
  });

  it.each([
    ["umbral_conciliacion_clp", 1000, "$1.000"],
    ["plazo_suplencia_h", 48, "48 h"],
    ["pct_sin_culpa", 5, "5 %"],
    ["umbral_ritmo", 1.1, "1,1"],
    ["inicio_piloto", "2026-10-01", "01-10-2026"],
    ["modalidad_sin_culpa", "igual", "Igual para cada adulto"],
    ["estrategia_deuda", "avalancha", "Avalancha"],
    ["tratamiento_cuotas_default", "por_cuota", "Cada cuota en su mes"],
    ["hora_resumen_diario", "20:00", "20:00"],
  ] as const)("%s = %s se muestra como %s", (codigo, valor, texto) => {
    expect(describirParametro(codigo, valor).valor).toBe(texto);
  });
});
