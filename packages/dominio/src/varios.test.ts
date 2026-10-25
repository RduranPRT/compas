import { describe, expect, it } from "vitest";
import { leerMonto, repartirCuotas } from "./dinero";
import { diasDelMes, fechaEnMes, hoyIso, nombreMes, sumarDias, sumarMeses } from "./fechas";
import { interpretarFrase } from "./frase";
import { calcularKpis } from "./kpi";

describe("Dinero en pesos enteros (I3)", () => {
  it("lee montos chilenos y coloquiales", () => {
    expect(leerMonto("$12.990")).toBe(12990);
    expect(leerMonto("-12.990")).toBe(-12990);
    expect(leerMonto("(5.000)")).toBe(-5000);
    expect(leerMonto("12 lucas")).toBe(12000);
    expect(leerMonto("1,5 millones")).toBe(1500000);
    expect(leerMonto("2.400.000")).toBe(2400000);
    expect(leerMonto("hola")).toBeNull();
  });

  it("D32: cuotas enteras y la última absorbe el resto", () => {
    expect(repartirCuotas(300000, 3)).toEqual([100000, 100000, 100000]);
    expect(repartirCuotas(100000, 3)).toEqual([33333, 33333, 33334]);
  });
});

describe("Fechas en America/Santiago", () => {
  it("calcula meses, días y nombres", () => {
    expect(sumarMeses("2026-11-30", 3)).toBe("2027-02-28");
    expect(sumarDias("2026-12-31", 1)).toBe("2027-01-01");
    expect(diasDelMes("2028-02-01")).toBe(29);
    expect(fechaEnMes("2026-02-01", 31)).toBe("2026-02-28");
    expect(nombreMes("2026-12-01")).toBe("diciembre de 2026");
    expect(hoyIso(new Date("2026-10-26T02:00:00Z"))).toBe("2026-10-25");
  });
});

describe("Captura por frase (HU-005-2)", () => {
  const sobres = [
    { id: "alim", nombre: "Alimentación", codigo: "alimentacion" },
    { id: "transp", nombre: "Transporte", codigo: "transporte" },
  ];
  const cuentas = [
    { id: "cc", nombre: "Cuenta corriente", tipo: "vista" as const },
    { id: "visa", nombre: "Visa", tipo: "tarjeta_credito" as const },
    { id: "ef", nombre: "Efectivo", tipo: "billetera" as const },
  ];

  it("'gasté 12 lucas en la feria con débito' propone $12.000, Alimentación y la cuenta corriente", () => {
    const p = interpretarFrase("gasté 12 lucas en la feria con débito", sobres, cuentas, "2026-11-03");
    expect(p).toMatchObject({ monto: 12000, sobreId: "alim", cuentaId: "cc", fecha: "2026-11-03", nCuotas: 1 });
    expect(p.confianza).toBeGreaterThanOrEqual(0.8);
  });

  it("reconoce cuotas, tarjeta, ayer y efectivo", () => {
    expect(interpretarFrase("ayer bencina 35.000 con la visa en 3 cuotas", sobres, cuentas, "2026-11-03"))
      .toMatchObject({ monto: 35000, sobreId: "transp", cuentaId: "visa", fecha: "2026-11-02", nCuotas: 3 });
    expect(interpretarFrase("5 mil en efectivo", sobres, cuentas).cuentaId).toBe("ef");
  });

  it("sin datos suficientes baja la confianza para que la persona complete", () => {
    expect(interpretarFrase("compré algo", sobres, cuentas).confianza).toBeLessThan(0.8);
  });
});

describe("Indicadores (spec 010)", () => {
  it("K1, K2, K3, K4, K6, KP1 e ICF con semáforo", () => {
    const k = calcularKpis({
      ingresos: 2400000, gastos: 2500000, gastoEsenciales: 1392000, aFuturo: 120000, servicioDeuda: 100000,
      saldoEmergencia: 520000, esencialesMensuales: 1300000, capturados: 46, deCartola: 50, etapa: "E1",
    });
    const v = Object.fromEntries(k.map((x) => [x.codigo, x]));
    expect(v.K4).toMatchObject({ valor: 0.58, semaforo: "rojo" });
    expect(v.K6).toMatchObject({ valor: -100000, semaforo: "rojo" });
    expect(v.K2).toMatchObject({ valor: 0.4, semaforo: "amarillo" });
    expect(v.KP1).toMatchObject({ valor: 0.92, semaforo: null });
    expect(v.ICF?.valor).toBeGreaterThan(0);
    expect(v.ICF?.valor).toBeLessThanOrEqual(100);
  });
});
