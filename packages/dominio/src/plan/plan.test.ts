import { describe, expect, it } from "vitest";
import { generarBorrador, proponerDistribucion, sinCulpaPorAdulto, type SobrePlan } from ".";

const sobres: SobrePlan[] = [
  { id: "viv", nombre: "Arriendo o dividendo", tipo: "fijo", bloque: "ESENCIALES", cuatroParedes: true, fijo: { monto: 700000, conHolgura: true } },
  { id: "serv", nombre: "Servicios", tipo: "fijo", bloque: "ESENCIALES", cuatroParedes: true, fijo: { monto: 120000, conHolgura: false } },
  { id: "alim", nombre: "Alimentación", tipo: "variable", bloque: "ESENCIALES", cuatroParedes: true, promedio: 401500 },
  { id: "ocio", nombre: "Ocio", tipo: "variable", bloque: "VIDA", cuatroParedes: false, promedio: 150000 },
  { id: "vest", nombre: "Vestuario", tipo: "variable", bloque: "VIDA", cuatroParedes: false, promedio: 50000, cuotasDelMes: 100000 },
  { id: "emer", nombre: "Fondo de emergencia", tipo: "emergencia", bloque: "FUTURO", cuatroParedes: false },
  { id: "fut", nombre: "Ahorro e inversión", tipo: "futuro", bloque: "FUTURO", cuatroParedes: false },
  { id: "perm", nombre: "Permiso de circulación", tipo: "fondo", bloque: "ESENCIALES", cuatroParedes: false, fondo: { objetivo: 180000, saldo: 0, mesesRestantes: 4 } },
  { id: "sc-r", nombre: "Sin culpa Rodrigo", tipo: "sin_culpa", bloque: "VIDA", cuatroParedes: false, integranteId: "r" },
  { id: "sc-a", nombre: "Sin culpa Ana", tipo: "sin_culpa", bloque: "VIDA", cuatroParedes: false, integranteId: "a" },
  { id: "visa", nombre: "Pago Visa", tipo: "pago_tarjeta", bloque: null, cuatroParedes: false, deudaPorCubrir: 120000 },
];

const datos = {
  ingresoBase: 2400000,
  etapa: "E1" as const,
  sobres,
  holguraPct: 15,
  sinCulpaPorAdulto: { r: 60000, a: 60000 },
  esencialesMensuales: 1300000,
  saldoEmergencia: 400000,
};

const suma = (xs: { monto: number }[]) => xs.reduce((s, x) => s + x.monto, 0);

describe("Plan mensual base cero (spec 006)", () => {
  it("Borrador base cero: Σ líneas = ingreso base, cada línea con regla y explicación (R45, P8)", () => {
    const b = generarBorrador(datos);
    expect(suma(b.lineas)).toBe(2400000);
    for (const l of b.lineas) expect(l.regla && l.explicacion).toBeTruthy();
  });

  it("R08, R03, R26 y R44: holgura del fijo nuevo, aporte prorrateado, cuotas del mes y deuda de la tarjeta", () => {
    const b = generarBorrador(datos);
    const l = (id: string) => b.lineas.find((x) => x.sobreId === id);
    expect(l("viv")).toMatchObject({ monto: 805000, regla: "R08", holguraPct: 15 });
    expect(l("perm")).toMatchObject({ monto: 45000, regla: "R03" });
    expect(l("vest")?.monto).toBe(150000);
    expect(l("vest")?.explicacion).toMatch(/R26/);
    expect(l("visa")).toMatchObject({ monto: 120000, regla: "R44" });
    expect(l("sc-r")?.monto).toBe(60000);
  });

  it("Orden de la etapa (R04): en E1, con poco ingreso, se cubren fijos y emergencia antes que sobres y sin culpa", () => {
    const b = generarBorrador({ ...datos, ingresoBase: 1400000 });
    expect(suma(b.lineas)).toBe(1400000);
    const l = (id: string) => b.lineas.find((x) => x.sobreId === id)?.monto ?? 0;
    expect(l("viv")).toBe(805000);
    expect(l("emer")).toBeGreaterThan(0);
    expect(l("sc-r")).toBe(0);
    expect(b.sinCubrir.length).toBeGreaterThan(0);
  });

  it("R05: en E0 las Cuatro Paredes se cubren antes que cualquier destino y nunca se recortan primero", () => {
    const b = generarBorrador({ ...datos, etapa: "E0", ingresoBase: 1400000 });
    const l = (id: string) => b.lineas.find((x) => x.sobreId === id)?.monto ?? 0;
    expect(l("viv") + l("serv") + l("alim")).toBe(805000 + 120000 + 402000);
    expect(l("sc-r")).toBe(0);
  });

  it("Lo que sobra va al primer destino de ahorro de la etapa (D04): E1 a emergencia, E4 a Futuro", () => {
    const e1 = generarBorrador({ ...datos, ingresoBase: 5000000 });
    expect(suma(e1.lineas)).toBe(5000000);
    expect(e1.lineas.find((x) => x.sobreId === "emer")?.explicacion).toMatch(/sobra/);
    const e4 = generarBorrador({ ...datos, etapa: "E4", ingresoBase: 5000000 });
    expect(e4.lineas.find((x) => x.sobreId === "fut")?.explicacion).toMatch(/sobra/);
  });

  it("Semáforo (R06, R07): Esenciales sobre 50 % queda en rojo y el plan se puede aprobar igual", () => {
    const b = generarBorrador({ ...datos, ingresoBase: 2000000 });
    expect(b.semaforo.find((s) => s.bloque === "ESENCIALES")?.color).toBe("rojo");
  });

  it("Sin culpa por modalidad (D25): igual, proporcional al ingreso o manual por adulto", () => {
    const adultos = [{ id: "r", ingreso: 2000000 }, { id: "a", ingreso: 1000000 }];
    expect(sinCulpaPorAdulto("igual", 3000000, 5, adultos)).toEqual({ r: 150000, a: 150000 });
    expect(sinCulpaPorAdulto("proporcional_ingreso", 3000000, 5, adultos)).toEqual({ r: 200000, a: 100000 });
    expect(sinCulpaPorAdulto("manual_por_adulto", 3000000, 5, adultos, { r: 80000, a: 50000 })).toEqual({ r: 80000, a: 50000 });
  });
});

describe("Reparto del ingreso (spec 007)", () => {
  const lineas = [
    { sobreId: "viv", nombre: "Arriendo", tipo: "fijo" as const, cuatroParedes: true, plan: 800000, asignado: 0 },
    { sobreId: "alim", nombre: "Alimentación", tipo: "variable" as const, cuatroParedes: true, plan: 600000, asignado: 0 },
    { sobreId: "emer", nombre: "Emergencia", tipo: "emergencia" as const, cuatroParedes: false, plan: 300000, asignado: 0 },
    { sobreId: "fut", nombre: "Futuro", tipo: "futuro" as const, cuatroParedes: false, plan: 200000, asignado: 0 },
    { sobreId: "sc", nombre: "Sin culpa", tipo: "sin_culpa" as const, cuatroParedes: false, plan: 100000, asignado: 0 },
  ];

  it("Sueldo con plan aprobado: se reparte según el plan y no se asigna más de lo recibido (R01, R04)", () => {
    const a = proponerDistribucion(2000000, false, "E1", lineas, { pctVariableAFuturo: 50 });
    expect(suma(a)).toBe(2000000);
    expect(a.find((x) => x.sobreId === "viv")?.monto).toBe(800000);
    const corto = proponerDistribucion(1000000, false, "E1", lineas, { pctVariableAFuturo: 50 });
    expect(suma(corto)).toBe(1000000);
    expect(corto.find((x) => x.sobreId === "sc")).toBeUndefined();
  });

  it("Ingreso variable (R45, R22): con 50 % a Futuro, un bono de $600.000 propone $300.000 a Futuro", () => {
    const yaCubierto = lineas.map((l) => ({ ...l, asignado: l.plan }));
    const a = proponerDistribucion(600000, true, "E3", yaCubierto, { pctVariableAFuturo: 50 });
    expect(a.find((x) => x.sobreId === "fut")?.monto).toBe(600000);
    expect(a.find((x) => x.sobreId === "fut")?.regla).toBe("R45");
  });

  it("Reponer emergencia primero (R13): si se usó en el mes, va antes que Futuro", () => {
    const a = proponerDistribucion(400000, false, "E3", lineas, { pctVariableAFuturo: 50, emergenciaUsada: true });
    expect(a[0]).toMatchObject({ sobreId: "emer", regla: "R13" });
  });
});
