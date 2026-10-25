import { describe, expect, it } from "vitest";
import {
  r03_aporteProrrateado,
  r04_ordenFlujo,
  r06_semaforo,
  r08_holgura,
  r09_ritmo,
  r12_balanceProyectado,
  r18_horasVida,
  r33_ajusteIngreso,
  r35_esDuplicadoCandidato,
  r38_autoaprobada,
  r45_repartoVariable,
} from ".";

describe("Reglas del método", () => {
  it("R03: aporte = (monto − saldo) / meses restantes; saldo cubierto → 0; sin meses → todo con alerta", () => {
    expect(r03_aporteProrrateado(180000, 0, 6)).toEqual({ aporte: 30000, alerta: false });
    expect(r03_aporteProrrateado(180000, 200000, 6)).toEqual({ aporte: 0, alerta: false });
    expect(r03_aporteProrrateado(180000, 60000, 0)).toEqual({ aporte: 120000, alerta: true });
  });

  it("R04 y R05: E1 cubre fijos, emergencia, deudas, sobres y sin culpa; en E0 Cuatro Paredes va primero", () => {
    expect(r04_ordenFlujo("E1").slice(0, 5)).toEqual(["pagos_fijos", "emergencia", "deudas_minimos", "sobres", "sin_culpa"]);
    expect(r04_ordenFlujo("E0")[0]).toBe("cuatro_paredes");
    expect(r04_ordenFlujo("E3")[0]).toBe("futuro");
  });

  it("R06: Esenciales sobre 50 % queda en rojo; R07: Futuro bajo el mínimo de la etapa queda en amarillo", () => {
    const s = r06_semaforo({ ESENCIALES: 1392000, FUTURO: 120000, VIDA: 400000 }, 2400000, "E3");
    expect(s.find((b) => b.bloque === "ESENCIALES")).toMatchObject({ pct: 58, color: "rojo", regla: "R06" });
    expect(s.find((b) => b.bloque === "FUTURO")).toMatchObject({ pct: 5, color: "amarillo", regla: "R07", limitePct: 20 });
    const e1 = r06_semaforo({ ESENCIALES: 1000000, FUTURO: 50000, VIDA: 0 }, 2400000, "E2");
    expect(e1.find((b) => b.bloque === "FUTURO")?.color).toBe("amarillo");
  });

  it("R08: holgura de 15 % al primer mes, redondeada a $1.000", () => {
    expect(r08_holgura(700000, 15)).toBe(805000);
    expect(r08_holgura(12990, 15)).toBe(15000);
  });

  it("R09: ritmo 1,25 el día 12 con $200.000 de $400.000 en un mes de 30 días excede 1,1", () => {
    expect(r09_ritmo(400000, 200000, 12, 30)).toEqual({ ritmo: 1.25, excede: true });
    expect(r09_ritmo(400000, 100000, 15, 30)).toEqual({ ritmo: 0.5, excede: false });
    expect(r09_ritmo(0, 100, 15, 30).ritmo).toBeNull();
  });

  it("R12: el balance proyecta los sobres variables al ritmo actual y excluye el pago de tarjeta", () => {
    const bal = r12_balanceProyectado([
      { tipo: "variable", disponible: 300000, gastado: 200000, saldo: 100000 },
      { tipo: "fijo", disponible: 500000, gastado: 500000, saldo: 0 },
      { tipo: "pago_tarjeta", disponible: 90000, gastado: 0, saldo: 90000 },
    ], 10, 30);
    expect(bal).toBe(300000 - 600000);
  });

  it("R18: horas de vida = monto / (ingreso base / horas al mes)", () => {
    expect(r18_horasVida(12000, 2400000, 160)).toBe(0.8);
    expect(r18_horasVida(12000, 0, 160)).toBeNull();
  });

  it("R33: un sueldo de $2.200.000 contra $2.400.000 es −8,33 % y requiere ajuste", () => {
    expect(r33_ajusteIngreso(2200000, 2400000, 5)).toEqual({ diferenciaPct: -8.33, requiereAjuste: true });
    expect(r33_ajusteIngreso(2450000, 2400000, 5).requiereAjuste).toBe(false);
  });

  it("R35: mismo medio, monto igual y fecha ±2 días es posible duplicado", () => {
    const a = { cuentaId: "visa", monto: 12990, fecha: "2026-11-03" };
    expect(r35_esDuplicadoCandidato(a, { ...a, fecha: "2026-11-04" })).toBe(true);
    expect(r35_esDuplicadoCandidato(a, { ...a, fecha: "2026-11-06" })).toBe(false);
    expect(r35_esDuplicadoCandidato(a, { ...a, cuentaId: "cc" })).toBe(false);
  });

  it("R38: $8.000 de $200.000 se autoaprueba con umbral 5 %; $30.000 no", () => {
    expect(r38_autoaprobada(8000, 200000, 5)).toBe(true);
    expect(r38_autoaprobada(30000, 200000, 5)).toBe(false);
  });

  it("R45: con 50 % a Futuro, un bono de $600.000 propone $300.000 a Futuro", () => {
    expect(r45_repartoVariable(600000, 50)).toEqual({ futuro: 300000, resto: 300000 });
  });
});
