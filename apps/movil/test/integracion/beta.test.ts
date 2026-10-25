import { extraerConMapeo, proponerDistribucion, type Tabla } from "@compas/dominio";
import { describe, expect, it } from "vitest";
import { clasificarComercio, gruposDeRevision, importar, preparar } from "../../src/datos/cartolas";
import { cerrarMes, cerrarSemana, iniciarCierreMes, periodos, resumenDelMes, valorar } from "../../src/datos/cierres";
import {
  aplicarPlantilla,
  categorias,
  crearCuenta,
  crearIngresoEsperado,
  crearPagoFijo,
  cuentas,
} from "../../src/datos/configuracion";
import {
  bandeja,
  confirmarDistribucion,
  confirmarMovimiento,
  ingresosPorRepartir,
  registrarGasto,
  registrarIngreso,
  registrarPagoTarjeta,
  sobresDelMes,
  tarjetas,
  transferenciasPendientes,
} from "../../src/datos/finanzas";
import { avisos, reasignar, resolverSolicitud, solicitudesPendientes } from "../../src/datos/gobierno";
import { integrantes, parametros } from "../../src/datos/hogar";
import { integranteActual } from "../../src/datos/integrante";
import { generarPerfil, perfilVigente } from "../../src/datos/perfil";
import { calcularBorrador, enviarPlan, guardarBorrador, planDelMes } from "../../src/datos/plan";
import { exportarDatos } from "../../src/datos/privacidad";
import { usuarioDePrueba, type Cliente } from "./entorno";

// Flujo completo de la Beta (specs 002–011) contra Supabase local, con las mismas funciones que usa la app.
// Línea base octubre de 2026; primer plan noviembre de 2026.

const FILAS = [
  ["inicio_piloto", "2026-10-01", "R41"], ["mes_primer_plan", "2026-11-01", null], ["dia_plan", 25, null],
  ["dia_ingreso_mes_siguiente", 20, null], ["umbral_ritmo", 1.1, "R09"], ["umbral_ajuste_ingreso_pct", 5, "R33"],
  ["autoaprobacion_n1_pct", 5, "R38"], ["plazo_suplencia_h", 48, "R39"], ["max_alertas_dia", 3, "R40"],
  ["confianza_ia_min", 0.8, "R36"], ["holgura_fijos_pct", 15, "R08"], ["pct_variable_a_futuro", 50, "R45"],
  ["pct_sin_culpa", 5, null], ["modalidad_sin_culpa", "igual", null], ["tratamiento_cuotas_default", "por_cuota", null],
].map(([codigo, valor, regla_codigo]) => ({ codigo, valor, regla_codigo }));

describe("Beta del MVP contra Supabase local", () => {
  let org: Cliente;
  let cad: Cliente;
  const sinError = (r: { error: { message: string } | null }) => expect(r.error?.message ?? null).toBeNull();

  it("alta: hogar, co-administradora, consentimientos y Acuerdo vigente", async () => {
    ({ db: org } = await usuarioDePrueba("org"));
    const { db, correo } = await usuarioDePrueba("cad");
    cad = db;
    sinError(await org.schema("app").rpc("crear_hogar", { p_nombre_hogar: "Hogar Beta", p_nombre: "Rodrigo" }));
    sinError(await org.schema("app").rpc("invitar_integrante", { p_correo: correo, p_nombre: "Ana", p_rol: "CAD" }));
    sinError(await org.schema("app").rpc("registrar_menor", { p_nombre: "Tomás", p_version_consentimiento: "v1" }));
    sinError(await cad.schema("app").rpc("aceptar_invitacion"));
    for (const c of [org, cad]) {
      const yo = (await integranteActual(c))!;
      sinError(await c.schema("gob").from("consentimiento").insert({ hogar_id: yo.hogar_id, titular_id: yo.id, otorgado_por_id: yo.id, finalidad: "uso_app", version_texto: "v1" }));
    }
    sinError(await org.schema("app").rpc("proponer_acuerdo", { p_reglas: FILAS as never, p_urgente: true }));
    const [sol] = await solicitudesPendientes(cad);
    expect((await resolverSolicitud(cad, sol!.id, true)).estado).toBe("aprobada");
    expect((await parametros(org)).mes_primer_plan).toBe("2026-11-01");
  });

  it("spec 002: cuentas, tarjeta con deuda previa, categorías sugeridas, ingresos y pagos fijos", async () => {
    sinError(await crearCuenta(org, { nombre: "Cuenta corriente", tipo: "vista", ultimos4: "1234", saldoInicial: 850000, fechaSaldoInicial: "2026-10-01" }));
    sinError(await crearCuenta(org, { nombre: "Visa", tipo: "tarjeta_credito", ultimos4: "4321", saldoInicial: 420000, fechaSaldoInicial: "2026-10-01", diaFacturacion: 25, diaPago: 5 }));
    sinError(await crearCuenta(org, { nombre: "Ahorro", tipo: "ahorro", saldoInicial: 600000, fechaSaldoInicial: "2026-10-01" }));
    expect((await aplicarPlantilla(org)).creadas).toBe(15);
    const yo = (await integranteActual(org))!;
    sinError(await crearIngresoEsperado(org, { integranteId: yo.id, descripcion: "Sueldo", monto: 2400000, dia: 30, esBase: true, desde: "2026-10-01" }));
    const viv = (await categorias(org)).find((c) => c.codigo === "vivienda")!;
    sinError(await crearPagoFijo(org, { nombre: "Dividendo", categoriaId: viv.id, moneda: "CLP", monto: 700000, dia: 5, desde: "2026-10-01" }));
    const [visa] = await tarjetas(org);
    expect(visa).toMatchObject({ nombre: "Visa", deuda: 420000, apartado: 0 });
    const sobres = await sobresDelMes(org, "2026-10-15");
    expect(sobres.filter((s) => s.tipo === "sin_culpa").map((s) => s.nombre).sort()).toEqual(["Sin culpa Ana", "Sin culpa Rodrigo"]);
    expect(sobres.some((s) => s.nombre === "Mesada Tomás")).toBe(true);
    expect(sobres.some((s) => s.nombre === "Pago Visa")).toBe(true);
  });

  it("spec 003: cartola por mapeo de columnas, históricos y movimientos, y revisión por comercio", async () => {
    const tabla: Tabla = [
      ["Fecha", "Descripción", "Cargos", "Abonos"],
      ["30/07/2026", "ABONO REMUNERACIONES", "", "2.400.000"],
      ["30/08/2026", "ABONO REMUNERACIONES", "", "2.400.000"],
      ["30/09/2026", "ABONO REMUNERACIONES", "", "2.450.000"],
      ["10/07/2026", "COMPRA JUMBO LA REINA", "350.000", ""],
      ["10/08/2026", "COMPRA JUMBO LA REINA", "380.000", ""],
      ["10/09/2026", "COMPRA JUMBO LA REINA", "400.000", ""],
      ["05/07/2026", "PAC DIVIDENDO HIPOTECARIO", "700.000", ""],
      ["05/08/2026", "PAC DIVIDENDO HIPOTECARIO", "700.000", ""],
      ["05/09/2026", "PAC DIVIDENDO HIPOTECARIO", "700.000", ""],
      ["03/10/2026", "COMPRA JUMBO LA REINA", "23.000", ""],
      ["05/10/2026", "PAGO TARJETA VISA 4321", "420.000", ""],
      ["08/10/2026", "COPEC RUTA 68", "35.000", ""],
    ];
    const { lineas } = extraerConMapeo(tabla, 0, { fecha: 0, descripcion: 1, cargo: 2, abono: 3 });
    const ctas = await cuentas(org);
    const cc = ctas.find((c) => c.tipo === "vista")!;
    const cats = await categorias(org);
    const porCodigo = Object.fromEntries(cats.filter((c) => c.codigo).map((c) => [c.codigo!, c.id]));
    const prep = await preparar(org, lineas, { cuenta: cc, cuentas: ctas, categoriasPorCodigo: porCodigo, nombresMenores: ["Tomás"] });
    const r = await importar(org, cc.id, "cartola.xlsx", "xlsx", `sha-${Date.now()}`, "mapeo_columnas", prep);
    sinError(r);
    expect(r.data).toMatchObject({ n_historicos: 9, n_movimientos: 2, n_transferencias: 1 });
    const grupos = await gruposDeRevision(org, r.data!.importacion_id);
    const jumbo = grupos.find((g) => g.comercio === "JUMBO REINA")!;
    expect(jumbo).toMatchObject({ n: 4, categoriaSugeridaId: porCodigo.alimentacion });
    const c = await clasificarComercio(org, r.data!.importacion_id, "JUMBO REINA", porCodigo.alimentacion!);
    expect(c.data).toMatchObject({ historicos: 3, confirmados: 1 });
    sinError(await clasificarComercio(org, r.data!.importacion_id, "PAC DIVIDENDO", porCodigo.vivienda!));
    sinError(await clasificarComercio(org, r.data!.importacion_id, "COPEC RUTA", porCodigo.transporte!));
    const [visa] = await tarjetas(org);
    expect(visa!.deuda).toBe(0);
  });

  it("spec 005: captura, duplicado en la bandeja y confirmación por la co-administradora", async () => {
    const sobres = await sobresDelMes(org, "2026-10-20");
    const alim = sobres.find((s) => s.nombre === "Alimentación")!;
    const visa = (await cuentas(org)).find((c) => c.tipo === "tarjeta_credito")!;
    const a = await registrarGasto(org, { cuentaId: visa.id, sobreId: alim.id, monto: 12990, fecha: "2026-10-20", comercio: "Feria" });
    expect(a.data?.estado).toBe("confirmado");
    const b = await registrarGasto(cad, { cuentaId: visa.id, sobreId: alim.id, monto: 12990, fecha: "2026-10-21" });
    expect(b.data).toMatchObject({ estado: "por_confirmar", duplicado: true });
    const pend = await bandeja(cad);
    expect(pend.duplicados).toHaveLength(1);
    sinError(await confirmarMovimiento(cad, b.data!.movimiento_id));
    expect((await bandeja(cad)).duplicados).toHaveLength(0);
  });

  it("spec 004: perfil con reglas (sin IA), etapa propuesta y confirmada por ambos (R23)", async () => {
    const g = await generarPerfil(org);
    expect(g).toEqual({ error: null, conIA: false });
    const p = (await perfilVigente(org))!;
    expect(p.perfil.ingresoBase).toBe(2400000);
    expect(p.hallazgos.length).toBeGreaterThanOrEqual(3);
    expect(p.modelo).toBe("reglas");
    sinError(await org.schema("app").rpc("proponer_etapa", { p_etapa: p.perfil.etapaSugerida, p_evidencia: {}, p_origen: "sistema" }));
    const [sol] = (await solicitudesPendientes(org)).filter((s) => s.tipo === "etapa");
    expect((await resolverSolicitud(org, sol!.id, true)).estado).toBe("pendiente");
    expect((await resolverSolicitud(cad, sol!.id, true)).estado).toBe("aprobada");
  });

  it("spec 006: borrador base cero de noviembre, envío y aprobación del ORG", async () => {
    const p = await parametros(org);
    const c = await calcularBorrador(org, "2026-11-01", "E1", p);
    expect(c.ingresoBase).toBe(2400000);
    expect(c.borrador.lineas.reduce((s, l) => s + l.monto, 0)).toBe(2400000);
    const viv = c.sobres.find((s) => s.nombre === "Arriendo o dividendo")!;
    expect(c.borrador.lineas.find((l) => l.sobreId === viv.id)?.monto).toBe(805000);
    const g = await guardarBorrador(cad, "2026-11-01", c.ingresoBase, c.borrador.lineas);
    sinError(g);
    sinError(await enviarPlan(cad, g.id!));
    const [sol] = (await solicitudesPendientes(org)).filter((s) => s.tipo === "presupuesto");
    expect((await resolverSolicitud(org, sol!.id, true)).estado).toBe("aprobada");
    expect((await planDelMes(org, "2026-11-01"))?.estado).toBe("aprobado");
  });

  it("spec 007: sueldo para noviembre, reparto según el plan y transferencias pendientes", async () => {
    const yo = (await integranteActual(org))!;
    const cc = (await cuentas(org)).find((c) => c.tipo === "vista")!;
    sinError(await registrarIngreso(org, { cuentaId: cc.id, monto: 2400000, fecha: "2026-10-30", integranteId: yo.id, tipo: "sueldo", esVariable: false, paraMesSiguiente: true }));
    const [ing] = await ingresosPorRepartir(org);
    expect(ing).toMatchObject({ mes: "2026-11-01", porRepartir: 2400000 });
    const plan = (await planDelMes(org, "2026-11-01"))!;
    const sobres = await sobresDelMes(org, "2026-11-01");
    const lineas = plan.lineas.map((l) => {
      const s = sobres.find((x) => x.id === l.sobreId)!;
      return { sobreId: s.id, nombre: s.nombre, tipo: s.tipo as never, cuatroParedes: s.cuatroParedes, plan: l.monto, asignado: 0 };
    });
    const propuesta = proponerDistribucion(ing!.porRepartir, false, "E1", lineas, { pctVariableAFuturo: 50 });
    expect(propuesta.reduce((s, a) => s + a.monto, 0)).toBe(2400000);
    const r = await confirmarDistribucion(org, ing!.id, propuesta);
    sinError(r);
    expect(r.data?.pendiente).toBe(0);
    expect((await transferenciasPendientes(org)).some((t) => t.tipo === "a_personal")).toBe(true);
    expect((await sobresDelMes(org, "2026-11-01")).find((s) => s.tipo === "por_asignar")?.saldo).toBe(0);
  });

  it("spec 008 y 009: compra con tarjeta en noviembre, sobre negativo, aviso y N1 autoaprobado", async () => {
    const visa = (await cuentas(org)).find((c) => c.tipo === "tarjeta_credito")!;
    const cc = (await cuentas(org)).find((c) => c.tipo === "vista")!;
    let sobres = await sobresDelMes(org, "2026-11-01");
    const ocio = sobres.find((s) => s.nombre === "Ocio y salidas")!;
    const disponibleOcio = ocio.saldo;
    sinError(await registrarGasto(org, { cuentaId: visa.id, sobreId: ocio.id, monto: disponibleOcio + 5000, fecha: "2026-11-02" }));
    sobres = await sobresDelMes(org, "2026-11-01");
    expect(sobres.find((s) => s.id === ocio.id)!.saldo).toBe(-5000);
    expect((await avisos(org)).some((a) => a.tipo === "sobre_negativo")).toBe(true);
    const origen = sobres.filter((s) => s.saldo > 100000 && s.tipo === "variable").sort((a, b) => b.saldo - a.saldo)[0]!;
    const r = await reasignar(org, origen.id, ocio.id, 5000, "Cubrir ocio");
    expect(r.data?.estado).toBe("aplicada");
    sinError(await registrarPagoTarjeta(org, cc.id, visa.id, disponibleOcio + 5000, "2026-11-05"));
  });

  it("spec 010: cierre semanal y cierre de octubre como línea base con KPI", async () => {
    const ctas = await cuentas(org);
    const cc = ctas.find((c) => c.tipo === "vista")!;
    const s = await cerrarSemana(org, "2026-11-30", [{ cuentaId: cc.id, saldoReal: cc.saldo }]);
    sinError(s);
    const oct = (await periodos(org)).find((p) => p.mes === "2026-10-01")!;
    const res = await resumenDelMes(org, oct.mes, "E1");
    expect(res.pendientes).toBe(0);
    expect(res.kpis.some((k) => k.codigo === "K6")).toBe(true);
    const c = await iniciarCierreMes(org, oct.id);
    sinError(await valorar(org, c.cierreId!, res.porCategoria[0]!.categoriaId, "+"));
    sinError(await cerrarMes(org, oct.id, res.kpis, null, "La Visa se revisa con la cartola de la cuenta corriente"));
    expect((await periodos(org)).find((p) => p.mes === "2026-10-01")?.estado).toBe("cerrado");
  });

  it("spec 011: exportación con los datos que la persona puede ver", async () => {
    const { json, csv } = await exportarDatos(cad);
    const datos = JSON.parse(json).datos;
    expect(datos["fin.cuenta"]).toHaveLength(3);
    expect(datos["gob.integrante"].map((i: { nombre: string }) => i.nombre)).toContain("Tomás");
    expect(csv.split("\n")[0]).toContain("fecha_contable");
    expect((await integrantes(cad)).length).toBe(3);
  });
});
