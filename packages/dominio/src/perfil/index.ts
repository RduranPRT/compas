import { formatoPesos } from "../formato";
import { mesDe } from "../fechas";
import { FUTURO_MIN_PCT, type Etapa } from "../reglas/r04_ordenFlujo";

// Perfil inicial (spec 004): todas las cifras las calcula este módulo; la IA solo redacta (P8).

export interface Historico {
  fecha: string;
  sentido: "cargo" | "abono";
  monto: number;                 // positivo
  comercio: string | null;
  glosa: string;
  clase: string | null;
  categoria_id: string | null;
  cuenta_id: string;
}

export interface CategoriaPerfil {
  id: string;
  nombre: string;
  bloque: "ESENCIALES" | "FUTURO" | "VIDA";
  codigo?: string | null;
  /** Tipo de sobre: los gastos de categorías variables (supermercado, bencina) no son pagos fijos. */
  tipo?: string | null;
}

export interface CuentaPerfil {
  id: string;
  nombre: string;
  tipo: string;
  saldo: number;
}

export interface Perfil {
  meses: string[];
  ingresoBase: number;
  ingresoVariable: number;
  gastoMensual: number;
  gastoPorBloque: { ESENCIALES: number; FUTURO: number; VIDA: number };
  gastoPorCategoria: { categoriaId: string | null; nombre: string; bloque: string | null; promedio: number }[];
  pagosFijos: { comercio: string; categoriaId: string | null; monto: number; dia: number; meses: number }[];
  suscripciones: { comercio: string; monto: number }[];
  irregulares: { comercio: string; categoriaId: string | null; monto: number; fecha: string }[];
  tarjetas: { cuentaId: string; nombre: string; facturadoMensual: number; pagadoMensual: number; pagaTotal: boolean }[];
  interesesYComisiones: number;
  k1: number | null;   // tasa de ahorro
  k2: number | null;   // meses de reserva
  k3: number | null;   // RCI
  k4: number | null;   // esenciales / ingreso
  k6: number;          // balance mensual promedio
  etapaSugerida: Etapa;
  razonEtapa: string;
}

const GASTO = new Set(["gasto", "comision", "interes", "otro"]);

function mediana(xs: number[]): number {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? (s[m] ?? 0) : Math.round(((s[m - 1] ?? 0) + (s[m] ?? 0)) / 2);
}

function variacion(xs: number[]): number {
  const prom = xs.reduce((a, b) => a + b, 0) / xs.length;
  if (prom === 0) return 0;
  return Math.max(...xs.map((x) => Math.abs(x - prom) / prom));
}

function porMes<T>(items: T[], fecha: (t: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const it of items) {
    const k = mesDe(fecha(it));
    m.set(k, [...(m.get(k) ?? []), it]);
  }
  return m;
}

const clave = (h: Historico) => (h.comercio ?? h.glosa).toUpperCase();

export function calcularPerfil(hist: Historico[], categorias: CategoriaPerfil[], cuentas: CuentaPerfil[]): Perfil {
  const meses = [...new Set(hist.map((h) => mesDe(h.fecha)))].sort();
  const nMeses = Math.max(1, meses.length);
  const cat = new Map(categorias.map((c) => [c.id, c]));
  const tipoCuenta = new Map(cuentas.map((c) => [c.id, c.tipo]));

  // Ingresos: recurrentes (mismo origen en ≥ 2 meses, variación < 10 %) = base; el resto = variable (R45)
  const abonos = hist.filter((h) => h.sentido === "abono" && (h.clase === "ingreso" || h.clase === null)
    && tipoCuenta.get(h.cuenta_id) !== "tarjeta_credito");
  const porOrigen = new Map<string, Historico[]>();
  for (const a of abonos) porOrigen.set(clave(a), [...(porOrigen.get(clave(a)) ?? []), a]);
  const recurrentes = new Set<string>();
  for (const [origen, items] of porOrigen) {
    const mensual = [...porMes(items, (i) => i.fecha).values()].map((xs) => xs.reduce((s, x) => s + x.monto, 0));
    if (mensual.length >= Math.min(2, nMeses) && variacion(mensual) < 0.1) recurrentes.add(origen);
  }
  const baseMensual = meses.map((m) => abonos.filter((a) => recurrentes.has(clave(a)) && mesDe(a.fecha) === m)
    .reduce((s, a) => s + a.monto, 0));
  const ingresoBase = mediana(baseMensual);
  const ingresoVariable = Math.round(abonos.filter((a) => !recurrentes.has(clave(a))).reduce((s, a) => s + a.monto, 0) / nMeses);

  // Gastos (sin transferencias internas ni pagos de tarjeta, R27 y R28)
  const cargos = hist.filter((h) => h.sentido === "cargo" && GASTO.has(h.clase ?? "gasto"));
  const porCategoria = new Map<string, number>();
  for (const c of cargos) porCategoria.set(c.categoria_id ?? "", (porCategoria.get(c.categoria_id ?? "") ?? 0) + c.monto);
  const gastoPorCategoria = [...porCategoria.entries()]
    .map(([id, total]) => ({
      categoriaId: id || null,
      nombre: cat.get(id)?.nombre ?? "Sin clasificar",
      bloque: cat.get(id)?.bloque ?? null,
      promedio: Math.round(total / nMeses),
    }))
    .sort((a, b) => b.promedio - a.promedio);
  const gastoPorBloque = { ESENCIALES: 0, FUTURO: 0, VIDA: 0 };
  for (const g of gastoPorCategoria) if (g.bloque) gastoPorBloque[g.bloque as keyof typeof gastoPorBloque] += g.promedio;
  const gastoMensual = gastoPorCategoria.reduce((s, g) => s + g.promedio, 0);

  // Pagos fijos: mismo comercio en ≥ 2 de 3 meses con variación < 20 %
  const porComercio = new Map<string, Historico[]>();
  for (const c of cargos) porComercio.set(clave(c), [...(porComercio.get(clave(c)) ?? []), c]);
  const pagosFijos: Perfil["pagosFijos"] = [];
  const irregulares: Perfil["irregulares"] = [];
  for (const [comercio, items] of porComercio) {
    const mensual = [...porMes(items, (i) => i.fecha).values()].map((xs) => xs.reduce((s, x) => s + x.monto, 0));
    const variable = cat.get(items[0]?.categoria_id ?? "")?.tipo === "variable";
    if (!variable && mensual.length >= 2 && mensual.length >= Math.min(2, nMeses) && variacion(mensual) < 0.2) {
      pagosFijos.push({
        comercio,
        categoriaId: items[0]?.categoria_id ?? null,
        monto: Math.round(mensual.reduce((a, b) => a + b, 0) / mensual.length),
        dia: mediana(items.map((i) => Number(i.fecha.slice(8, 10)))),
        meses: mensual.length,
      });
    } else if (items.length === 1 && items[0]) {
      const item = items[0];
      const promCat = (porCategoria.get(item.categoria_id ?? "") ?? 0) / nMeses;
      if (item.categoria_id && item.monto >= 0.5 * promCat && item.monto >= 50000) {
        irregulares.push({ comercio, categoriaId: item.categoria_id, monto: item.monto, fecha: item.fecha });
      }
    }
  }
  pagosFijos.sort((a, b) => b.monto - a.monto);
  const suscripciones = pagosFijos.filter((p) => p.monto <= 30000).map((p) => ({ comercio: p.comercio, monto: p.monto }));

  // Tarjetas: facturado vs pagado; paga total si pagado ≥ 98 % de lo facturado
  const tarjetas = cuentas.filter((c) => c.tipo === "tarjeta_credito").map((t) => {
    const facturado = hist.filter((h) => h.cuenta_id === t.id && h.sentido === "cargo" && h.clase !== "pago_tarjeta")
      .reduce((s, h) => s + h.monto, 0);
    const pagado = hist.filter((h) => h.cuenta_id === t.id && h.sentido === "abono" && h.clase === "pago_tarjeta")
      .reduce((s, h) => s + h.monto, 0);
    return {
      cuentaId: t.id,
      nombre: t.nombre,
      facturadoMensual: Math.round(facturado / nMeses),
      pagadoMensual: Math.round(pagado / nMeses),
      pagaTotal: facturado === 0 || pagado >= 0.98 * facturado,
    };
  });

  const intereses = hist.filter((h) => h.sentido === "cargo" && (h.clase === "interes" || h.clase === "comision"))
    .reduce((s, h) => s + h.monto, 0);
  const interesesYComisiones = Math.round(intereses / nMeses);
  const ingresoTotal = ingresoBase + ingresoVariable;
  const ahorro = hist.filter((h) => h.sentido === "cargo" && h.clase === "transferencia_interna"
    && /AHORRO|INVERSION|FONDO|APV|DAP|DEPOSITO A PLAZO/.test(h.glosa.toUpperCase())).reduce((s, h) => s + h.monto, 0) / nMeses;
  const deudas = cargos.filter((c) => cat.get(c.categoria_id ?? "")?.codigo === "deudas" || /CUOTA|CREDITO|AVANCE/.test(c.glosa.toUpperCase()))
    .reduce((s, c) => s + c.monto, 0) / nMeses;
  const saldoAhorro = cuentas.filter((c) => c.tipo === "ahorro" || c.tipo === "inversion").reduce((s, c) => s + Math.max(0, c.saldo), 0);

  const k1 = ingresoTotal > 0 ? Math.round((1000 * ahorro) / ingresoTotal) / 1000 : null;
  const k3 = ingresoTotal > 0 ? Math.round((1000 * (deudas + interesesYComisiones)) / ingresoTotal) / 1000 : null;
  const k4 = ingresoTotal > 0 ? Math.round((1000 * gastoPorBloque.ESENCIALES) / ingresoTotal) / 1000 : null;
  const k2 = gastoPorBloque.ESENCIALES > 0 ? Math.round((10 * saldoAhorro) / gastoPorBloque.ESENCIALES) / 10 : null;
  const k6 = ingresoTotal - gastoMensual;

  // Etapa sugerida (tabla de la spec 004)
  const mora = hist.some((h) => /MORA|INTERES PENAL|PROTESTO/.test(h.glosa.toUpperCase()));
  const deudaConsumo = deudas > 0 || tarjetas.some((t) => !t.pagaTotal);
  let etapaSugerida: Etapa;
  let razonEtapa: string;
  if (mora) {
    etapaSugerida = "E0";
    razonEtapa = "Hay cargos por mora o intereses penales: primero se estabilizan los pagos esenciales.";
  } else if (k2 === null || k2 < 1) {
    etapaSugerida = "E1";
    razonEtapa = `La reserva cubre ${String(k2 ?? 0).replace(".", ",")} meses de esenciales; la meta de esta etapa es 1 mes.`;
  } else if (deudaConsumo) {
    etapaSugerida = "E2";
    razonEtapa = "Hay deuda de consumo o la tarjeta no se paga completa cada mes.";
  } else if (k2 < 3) {
    etapaSugerida = "E3";
    razonEtapa = `Sin deuda de consumo; la reserva cubre ${String(k2).replace(".", ",")} meses y la meta es de 3 a 6.`;
  } else {
    etapaSugerida = "E4";
    razonEtapa = `La reserva cubre ${String(k2).replace(".", ",")} meses de esenciales y no hay deuda de consumo.`;
  }

  return {
    meses, ingresoBase, ingresoVariable, gastoMensual, gastoPorBloque, gastoPorCategoria, pagosFijos, suscripciones,
    irregulares, tarjetas, interesesYComisiones, k1, k2, k3, k4, k6, etapaSugerida, razonEtapa,
  };
}

export interface Hallazgo {
  titulo: string;
  explicacion: string;
  cifra: string;
  regla_codigo: string;
  fuente_codigo: string;
  accion: string;
}

const pct = (x: number | null) => (x === null ? "s/d" : `${Math.round(x * 1000) / 10} %`.replace(".", ","));

/** Hallazgos por reglas (D31): entre 3 y 5, sin culpa (R16): hecho, regla y opción. */
export function hallazgosPorReglas(p: Perfil): Hallazgo[] {
  const h: Hallazgo[] = [];
  if (p.k4 !== null && p.k4 > 0.5) {
    h.push({
      titulo: "Los esenciales ocupan más de la mitad del ingreso",
      explicacion: `En promedio, los gastos esenciales fueron ${formatoPesos(p.gastoPorBloque.ESENCIALES)} al mes. El método sugiere que no pasen del 50 % para dejar espacio a Futuro y Vida.`,
      cifra: pct(p.k4), regla_codigo: "R06", fuente_codigo: "WARREN",
      accion: "Revisen juntos los pagos fijos más altos y si alguno se puede renegociar.",
    });
  }
  const minFuturo = (FUTURO_MIN_PCT[p.etapaSugerida] ?? 5) / 100;
  if (p.k1 !== null && p.k1 < minFuturo) {
    h.push({
      titulo: "El ahorro mensual está bajo el mínimo de la etapa",
      explicacion: `Se apartó en promedio el ${pct(p.k1)} del ingreso. Para la etapa ${p.etapaSugerida} se sugiere al menos ${pct(minFuturo)}.`,
      cifra: pct(p.k1), regla_codigo: "R07", fuente_codigo: "WARREN",
      accion: "Programen el aporte a Futuro el mismo día que llega el sueldo.",
    });
  }
  for (const t of p.tarjetas.filter((x) => !x.pagaTotal)) {
    h.push({
      titulo: `La ${t.nombre} no se paga completa cada mes`,
      explicacion: `Se facturan en promedio ${formatoPesos(t.facturadoMensual)} y se pagan ${formatoPesos(t.pagadoMensual)}. Con el sobre de pago de tarjeta, cada compra queda apartada para pagarla completa.`,
      cifra: formatoPesos(t.facturadoMensual - t.pagadoMensual), regla_codigo: "R44", fuente_codigo: "YNAB",
      accion: "Usen el sobre de pago de tarjeta y prioricen cubrir la deuda previa en el primer plan.",
    });
  }
  if (p.irregulares.length) {
    const total = p.irregulares.reduce((s, i) => s + i.monto, 0);
    h.push({
      titulo: "Hay gastos grandes que no son mensuales",
      explicacion: `Se detectaron ${p.irregulares.length} gastos únicos que suman ${formatoPesos(total)}. Repartidos en 12 meses dejan de ser una sorpresa.`,
      cifra: formatoPesos(total), regla_codigo: "R03", fuente_codigo: "YNAB",
      accion: "Creen fondos prorrateados para los que se repiten cada año.",
    });
  }
  if (p.ingresoVariable > 0) {
    h.push({
      titulo: "Parte del ingreso es variable",
      explicacion: `Además del ingreso base de ${formatoPesos(p.ingresoBase)}, llegaron en promedio ${formatoPesos(p.ingresoVariable)} variables al mes. El plan se arma solo con el base.`,
      cifra: formatoPesos(p.ingresoVariable), regla_codigo: "R45", fuente_codigo: "COMPAS",
      accion: "Acuerden qué porcentaje de cada bono va a Futuro.",
    });
  }
  if (p.k6 < 0) {
    h.push({
      titulo: "Los gastos superaron los ingresos",
      explicacion: `En promedio, el mes cerró en ${formatoPesos(p.k6)}. El primer plan parte por cubrir lo esencial con lo que entra.`,
      cifra: formatoPesos(p.k6), regla_codigo: "R12", fuente_codigo: "COMPAS",
      accion: "En el primer plan, definan juntos qué sobres de Vida bajar.",
    });
  }
  if (p.suscripciones.length >= 2) {
    const total = p.suscripciones.reduce((s, x) => s + x.monto, 0);
    h.push({
      titulo: "Suscripciones que se repiten",
      explicacion: `Hay ${p.suscripciones.length} cargos pequeños que se repiten cada mes y suman ${formatoPesos(total)}.`,
      cifra: formatoPesos(total), regla_codigo: "R17", fuente_codigo: "KAKEIBO",
      accion: "Revisen si todas se usan; las que valoran, quedan como pago fijo.",
    });
  }
  // Siempre al menos 3: se completa con lo que va bien
  if (h.length < 3 && p.k4 !== null && p.k4 <= 0.5) {
    h.push({
      titulo: "Los esenciales están dentro del rango sugerido",
      explicacion: `Los gastos esenciales son el ${pct(p.k4)} del ingreso, bajo el 50 % que sugiere el método.`,
      cifra: pct(p.k4), regla_codigo: "R06", fuente_codigo: "WARREN",
      accion: "Mantengan los fijos revisados una vez al año.",
    });
  }
  if (h.length < 3 && p.pagosFijos.length) {
    const total = p.pagosFijos.reduce((s, x) => s + x.monto, 0);
    h.push({
      titulo: "Pagos fijos identificados",
      explicacion: `Se reconocieron ${p.pagosFijos.length} pagos que se repiten cada mes, por ${formatoPesos(total)} en total.`,
      cifra: formatoPesos(total), regla_codigo: "R08", fuente_codigo: "COMPAS",
      accion: "Revisen la lista y acepten los que deban quedar en el plan.",
    });
  }
  if (h.length < 3) {
    h.push({
      titulo: `Etapa sugerida: ${p.etapaSugerida}`,
      explicacion: p.razonEtapa,
      cifra: p.k2 === null ? "s/d" : `${String(p.k2).replace(".", ",")} meses de reserva`, regla_codigo: "R23", fuente_codigo: "COMPAS",
      accion: "Confirmen la etapa entre ambos para que el plan use su orden de prioridades.",
    });
  }
  return h.slice(0, 5);
}
