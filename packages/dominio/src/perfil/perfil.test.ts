import { describe, expect, it } from "vitest";
import { calcularPerfil, hallazgosPorReglas, type Historico } from ".";

const categorias = [
  { id: "alim", nombre: "Alimentación", bloque: "ESENCIALES" as const, codigo: "alimentacion" },
  { id: "serv", nombre: "Luz, agua, gas, internet", bloque: "ESENCIALES" as const, codigo: "servicios" },
  { id: "viv", nombre: "Arriendo o dividendo", bloque: "ESENCIALES" as const, codigo: "vivienda" },
  { id: "ocio", nombre: "Ocio y salidas", bloque: "VIDA" as const, codigo: "ocio" },
];
const cuentas = [
  { id: "cc", nombre: "Cuenta corriente", tipo: "vista", saldo: 500000 },
  { id: "ah", nombre: "Ahorro", tipo: "ahorro", saldo: 600000 },
  { id: "visa", nombre: "Visa", tipo: "tarjeta_credito", saldo: -400000 },
];

function h(fecha: string, sentido: "cargo" | "abono", monto: number, comercio: string, clase: string, categoria_id: string | null, cuenta_id = "cc"): Historico {
  return { fecha, sentido, monto, comercio, glosa: comercio, clase, categoria_id, cuenta_id };
}

const historia: Historico[] = [
  h("2026-07-30", "abono", 2400000, "REMUNERACIONES", "ingreso", null),
  h("2026-08-30", "abono", 2400000, "REMUNERACIONES", "ingreso", null),
  h("2026-09-30", "abono", 2450000, "REMUNERACIONES", "ingreso", null),
  h("2026-08-15", "abono", 600000, "BONO", "ingreso", null),
  h("2026-07-10", "cargo", 45000, "ENEL", "gasto", "serv"),
  h("2026-08-10", "cargo", 48000, "ENEL", "gasto", "serv"),
  h("2026-09-11", "cargo", 50000, "ENEL", "gasto", "serv"),
  h("2026-07-05", "cargo", 950000, "INMOBILIARIA", "gasto", "viv"),
  h("2026-08-05", "cargo", 950000, "INMOBILIARIA", "gasto", "viv"),
  h("2026-09-05", "cargo", 950000, "INMOBILIARIA", "gasto", "viv"),
  h("2026-07-12", "cargo", 380000, "JUMBO", "gasto", "alim", "visa"),
  h("2026-08-12", "cargo", 420000, "JUMBO", "gasto", "alim", "visa"),
  h("2026-09-12", "cargo", 400000, "JUMBO", "gasto", "alim", "visa"),
  h("2026-08-20", "cargo", 9990, "NETFLIX", "gasto", "ocio", "visa"),
  h("2026-09-20", "cargo", 9990, "NETFLIX", "gasto", "ocio", "visa"),
  h("2026-09-25", "cargo", 250000, "AEROLINEA", "gasto", "ocio", "visa"),
  h("2026-08-05", "abono", 300000, "PAGO", "pago_tarjeta", null, "visa"),
  h("2026-09-05", "abono", 300000, "PAGO", "pago_tarjeta", null, "visa"),
  h("2026-08-05", "cargo", 300000, "PAGO TARJETA", "pago_tarjeta", null),
];

describe("Perfil inicial (spec 004)", () => {
  const p = calcularPerfil(historia, categorias, cuentas);

  it("Ingreso base y variable (R45): mediana de los abonos recurrentes y promedio de los no recurrentes", () => {
    expect(p.ingresoBase).toBe(2400000);
    expect(p.ingresoVariable).toBe(200000);
  });

  it("Pago fijo detectado: ENEL en los tres meses con variación menor a 20 %, con monto promedio y día típico", () => {
    expect(p.pagosFijos.find((f) => f.comercio === "ENEL")).toMatchObject({ categoriaId: "serv", monto: 47667, dia: 10, meses: 3 });
    expect(p.suscripciones).toEqual([{ comercio: "NETFLIX", monto: 9990 }]);
  });

  it("Uso de la tarjeta: indica que no se paga el total facturado", () => {
    expect(p.tarjetas[0]).toMatchObject({ nombre: "Visa", pagaTotal: false, pagadoMensual: 200000 });
  });

  it("Gastos irregulares: un cargo único grande es candidato a fondo prorrateado (R03)", () => {
    expect(p.irregulares.map((i) => i.comercio)).toEqual(["AEROLINEA"]);
  });

  it("Semáforo real: esenciales sobre 50 % del ingreso y transferencias excluidas del gasto (R06, R27)", () => {
    expect(p.gastoPorBloque.ESENCIALES).toBe(1397667);
    expect(p.k4).toBeGreaterThan(0.5);
    expect(p.gastoPorCategoria.some((g) => g.nombre === "Sin clasificar")).toBe(false);
  });

  it("Etapa sugerida E1 porque la reserva cubre menos de un mes de esenciales (R23)", () => {
    expect(p.k2).toBe(0.4);
    expect(p.etapaSugerida).toBe("E1");
  });

  it("Retroalimentación con regla y fuente: entre 3 y 5 hallazgos sin lenguaje de culpa (P8, R16)", () => {
    const hs = hallazgosPorReglas(p);
    expect(hs.length).toBeGreaterThanOrEqual(3);
    expect(hs.length).toBeLessThanOrEqual(5);
    for (const x of hs) {
      expect(x.titulo && x.explicacion && x.cifra && x.regla_codigo && x.fuente_codigo && x.accion).toBeTruthy();
      expect(`${x.titulo} ${x.explicacion} ${x.accion}`).not.toMatch(/culpa|mal |deber[ií]an|irresponsable|despilfarr/i);
    }
    expect(hs.map((x) => x.regla_codigo)).toContain("R06");
  });
});
