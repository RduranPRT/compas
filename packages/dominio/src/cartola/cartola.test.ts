import { describe, expect, it } from "vitest";
import { minimizar } from "../minimizar";
import {
  claseDeterminista,
  comercioDe,
  detectarEncabezado,
  extraerConMapeo,
  fechaDeCelda,
  huellaLinea,
  mapeoCompleto,
  prepararLineas,
  proponerMapeo,
  reglaPara,
  resumirLineas,
  type Tabla,
} from ".";

const cuentas = [
  { id: "cc", nombre: "Cuenta corriente", tipo: "vista" as const, ultimos4: "1234" },
  { id: "ah", nombre: "Ahorro", tipo: "ahorro" as const, ultimos4: "9876" },
  { id: "visa", nombre: "Visa", tipo: "tarjeta_credito" as const, ultimos4: "4321" },
];

describe("Mapeo asistido de cartolas (D27, D30)", () => {
  const tabla: Tabla = [
    ["Banco Ejemplo", null, null, null],
    ["Cartola de cuenta corriente", null, null, null],
    ["Fecha", "Descripción", "Cargos", "Abonos", "Saldo"],
    ["15/09/2026", "COMPRA JUMBO LA REINA", "50.000", "", "800.000"],
    ["30/09/2026", "ABONO REMUNERACIONES", "", "2.400.000", "3.200.000"],
    [46296, "PAGO TARJETA VISA 4321", 420000, null, null],
    ["", "Saldo final", "", "", "2.780.000"],
    ["03/10/2026", "COMPRA FALABELLA 1/3", "30.000", "", ""],
  ];

  it("detecta la fila de encabezados y propone columnas de fecha, descripción, cargos y abonos", () => {
    const fila = detectarEncabezado(tabla);
    expect(fila).toBe(2);
    const mapeo = proponerMapeo(tabla[fila] ?? []);
    expect(mapeo).toEqual({ fecha: 0, descripcion: 1, cargo: 2, abono: 3 });
    expect(mapeoCompleto(mapeo)).toBe(true);
  });

  it("extrae líneas con signo, ignora saldos y reconoce la cuota de una compra", () => {
    const { lineas, noLeidas } = extraerConMapeo(tabla, 2, { fecha: 0, descripcion: 1, cargo: 2, abono: 3 });
    expect(lineas).toEqual([
      { fecha: "2026-09-15", monto: -50000, glosa: "COMPRA JUMBO LA REINA" },
      { fecha: "2026-09-30", monto: 2400000, glosa: "ABONO REMUNERACIONES" },
      { fecha: "2026-10-01", monto: -420000, glosa: "PAGO TARJETA VISA 4321" },
      { fecha: "2026-10-03", monto: -30000, glosa: "COMPRA FALABELLA 1/3", cuota: { numero: 1, total: 3 } },
    ]);
    expect(noLeidas).toEqual([]);
  });

  it("lee fechas de Excel, con año de dos dígitos y con mes en palabras", () => {
    expect(fechaDeCelda(46295)).toBe("2026-09-30");
    expect(fechaDeCelda("03-10-26")).toBe("2026-10-03");
    expect(fechaDeCelda("03 OCT 2026")).toBe("2026-10-03");
    expect(fechaDeCelda("03/10", 2026)).toBe("2026-10-03");
    expect(fechaDeCelda("31/02/2026")).toBeNull();
  });

  it("una columna única de monto con signo también sirve", () => {
    const t: Tabla = [["Fecha", "Detalle", "Monto"], ["2026-10-04", "FERIA", "-12.990"]];
    expect(proponerMapeo(t[0] ?? [])).toEqual({ fecha: 0, descripcion: 1, monto: 2 });
    expect(extraerConMapeo(t, 0, { fecha: 0, descripcion: 1, monto: 2 }).lineas[0]?.monto).toBe(-12990);
  });

  it("resume las líneas separando lo anterior al inicio del piloto (R41)", () => {
    const r = resumirLineas([{ fecha: "2026-09-15", monto: -50000 }, { fecha: "2026-10-03", monto: 20000 }], "2026-10-01");
    expect(r).toMatchObject({ antesDelPiloto: 1, desdeElPiloto: 1, cargos: 50000, abonos: 20000, desde: "2026-09-15" });
  });
});

describe("Clase y comercio por reglas (R27, R28)", () => {
  it("un pago de tarjeta desde la cuenta corriente es transferencia hacia la tarjeta mencionada (R27)", () => {
    expect(claseDeterminista("PAGO TARJETA VISA 4321", -420000, "vista", cuentas)).toEqual({ clase: "pago_tarjeta", tarjetaId: "visa" });
    expect(claseDeterminista("PAGO RECIBIDO GRACIAS", 420000, "tarjeta_credito", cuentas).clase).toBe("pago_tarjeta");
  });

  it("un traspaso a una cuenta propia es transferencia interna; a un tercero es gasto (R28)", () => {
    expect(claseDeterminista("TRASPASO A CTA 0000009876", -100000, "vista", cuentas).clase).toBe("transferencia_interna");
    expect(claseDeterminista("TRANSF A JUAN PEREZ", -50000, "vista", cuentas).clase).toBe("gasto");
  });

  it("comisiones, intereses, ingresos y devoluciones en tarjeta", () => {
    expect(claseDeterminista("COMISION MANTENCION", -5990, "vista").clase).toBe("comision");
    expect(claseDeterminista("INTERESES ROTATIVOS", -3000, "tarjeta_credito").clase).toBe("interes");
    expect(claseDeterminista("ABONO REMUNERACIONES", 2400000, "vista").clase).toBe("ingreso");
    expect(claseDeterminista("DEVOLUCION FALABELLA", 15000, "tarjeta_credito").clase).toBe("reembolso");
  });

  it("agrupa por comercio sin números, fechas ni palabras de relleno", () => {
    expect(comercioDe("COMPRA JUMBO LA REINA 12/10")).toBe("JUMBO REINA");
    expect(comercioDe("PAGO WEB*NETFLIX.COM 8888")).toBe("NETFLIX");
    expect(comercioDe("Compra nacional Líder Express")).toBe("LIDER EXPRESS");
  });

  it("la regla del hogar se aplica al mismo comercio o a uno que empieza igual", () => {
    const reglas = [{ patron: "JUMBO", categoria_id: "alim" }, { patron: "JUMBO REINA", categoria_id: "otra" }];
    expect(reglaPara("JUMBO REINA", reglas)?.categoria_id).toBe("otra");
    expect(reglaPara("JUMBO KENNEDY", reglas)?.categoria_id).toBe("alim");
    expect(reglaPara("LIDER", reglas)).toBeNull();
  });
});

describe("Preparación de líneas para importar (R35, R43)", () => {
  it("minimiza antes de cualquier envío: sin RUT, sin más de 4 dígitos de cuenta, sin nombre del menor (R43)", () => {
    const t = minimizar("TRANSF A 12.345.678-9 CTA 0001234567890 MESADA TOMÁS tomas@correo.cl +56 9 1234 5678", {
      nombresMenores: ["Tomás"],
    });
    expect(t).not.toMatch(/12\.345\.678|0001234567890|Tom[aá]s|tomas@|1234 5678/i);
    expect(t).toContain("****7890");
    expect(t).toContain("[RUT]");
    expect(t).toContain("[menor]");
  });

  it("dos compras iguales el mismo día tienen huellas distintas por el ordinal; la misma línea, la misma huella", async () => {
    const l = { fecha: "2026-10-04", monto: -2500, glosa: "METRO" };
    const a = await huellaLinea("cc", l, 1);
    expect(a).toHaveLength(64);
    expect(await huellaLinea("cc", l, 1)).toBe(a);
    expect(await huellaLinea("cc", l, 2)).not.toBe(a);
  });

  it("prepara clase, comercio, regla del hogar y sugerencia por palabras", async () => {
    const lineas = await prepararLineas(
      [
        { fecha: "2026-10-03", monto: -23000, glosa: "COMPRA JUMBO LA REINA" },
        { fecha: "2026-10-04", monto: -2500, glosa: "METRO" },
        { fecha: "2026-10-04", monto: -2500, glosa: "METRO" },
        { fecha: "2026-10-05", monto: -420000, glosa: "PAGO TARJETA VISA 4321" },
      ],
      {
        cuentaId: "cc",
        tipoCuenta: "vista",
        cuentas,
        reglas: [{ patron: "JUMBO REINA", categoria_id: "alim-hogar" }],
        categoriasPorCodigo: { transporte: "transp-hogar" },
      },
    );
    expect(lineas.map((l) => [l.comercio, l.clase, l.categoria_id ?? null, l.confianza ?? null])).toEqual([
      ["JUMBO REINA", "gasto", "alim-hogar", 0.95],
      ["METRO", "gasto", "transp-hogar", 0.85],
      ["METRO", "gasto", "transp-hogar", 0.85],
      ["PAGO TARJETA", "pago_tarjeta", null, null],
    ]);
    expect(lineas[1]?.hash).not.toBe(lineas[2]?.hash);
    expect(lineas[3]?.tarjeta_id).toBe("visa");
  });
});
