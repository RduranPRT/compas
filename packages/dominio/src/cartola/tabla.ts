import { leerMonto } from "../dinero";
import { esFechaIso } from "../fechas";

// Ingesta universal (D27, D30): cualquier cartola llega como tabla de celdas. Sin lectores por banco:
// la persona confirma qué columna es cada cosa (mapeo asistido) o la IA entrega las líneas.

export type Celda = string | number | Date | null | undefined;
export type Tabla = Celda[][];

export interface LineaCartola {
  fecha: string;          // AAAA-MM-DD, fecha de la operación (D07)
  monto: number;          // pesos enteros con signo: cargo < 0, abono > 0
  glosa: string;
  cuota?: { numero: number; total: number };
}

export interface Mapeo {
  fecha: number;
  descripcion: number;
  /** Una columna con signo, o dos columnas separadas de cargos y abonos. */
  monto?: number;
  cargo?: number;
  abono?: number;
}

const PALABRAS: Record<keyof Mapeo, RegExp> = {
  fecha: /^(fecha|fecha\s+(de\s+)?(operaci[oó]n|transacci[oó]n|compra|mov\.?|movimiento)|f\.?\s*operaci[oó]n|d[ií]a)$/i,
  descripcion: /(descripci[oó]n|detalle|glosa|concepto|comercio|movimiento|transacci[oó]n|referencia)/i,
  cargo: /(cargo|d[eé]bito|giro|egreso|retiro|abono\s+a\s+cuenta\s+de\s+terceros)/i,
  abono: /(abono|cr[eé]dito|dep[oó]sito|ingreso)/i,
  monto: /^(monto|importe|valor|monto\s+\$|\$)$/i,
};

export function textoCelda(c: Celda): string {
  if (c === null || c === undefined) return "";
  if (c instanceof Date) return fechaDeCelda(c) ?? "";
  return String(c).trim();
}

/** Primera fila con al menos una fecha y una descripción reconocibles. */
export function detectarEncabezado(tabla: Tabla): number {
  for (let i = 0; i < Math.min(tabla.length, 40); i++) {
    const fila = (tabla[i] ?? []).map(textoCelda);
    const hayFecha = fila.some((c) => PALABRAS.fecha.test(c) || /^fecha/i.test(c));
    const hayDesc = fila.some((c) => PALABRAS.descripcion.test(c));
    if (hayFecha && hayDesc) return i;
  }
  return -1;
}

export function proponerMapeo(encabezados: Celda[]): Partial<Mapeo> {
  const t = encabezados.map(textoCelda);
  const buscar = (re: RegExp, excluir: number[] = []) => t.findIndex((c, i) => !excluir.includes(i) && re.test(c));
  const fecha = t.findIndex((c) => PALABRAS.fecha.test(c));
  const mapeo: Partial<Mapeo> = { fecha: fecha >= 0 ? fecha : t.findIndex((c) => /^fecha/i.test(c)) };
  const descripcion = buscar(PALABRAS.descripcion, [mapeo.fecha ?? -1]);
  if (descripcion >= 0) mapeo.descripcion = descripcion;
  const usados = [mapeo.fecha ?? -1, descripcion];
  const cargo = buscar(PALABRAS.cargo, usados);
  const abono = buscar(PALABRAS.abono, [...usados, cargo]);
  if (cargo >= 0) mapeo.cargo = cargo;
  if (abono >= 0) mapeo.abono = abono;
  if (cargo < 0 || abono < 0) {
    const monto = buscar(PALABRAS.monto, usados);
    if (monto >= 0) {
      delete mapeo.cargo;
      delete mapeo.abono;
      mapeo.monto = monto;
    }
  }
  if (mapeo.fecha !== undefined && mapeo.fecha < 0) delete mapeo.fecha;
  return mapeo;
}

export function mapeoCompleto(m: Partial<Mapeo>): m is Mapeo {
  return m.fecha !== undefined && m.descripcion !== undefined && (m.monto !== undefined || m.cargo !== undefined || m.abono !== undefined);
}

/** Fecha de una celda: Date, número de serie de Excel, dd/mm/aaaa, dd-mm-aa, aaaa-mm-dd o "03 OCT 2026". */
export function fechaDeCelda(c: Celda, anioPorDefecto?: number): string | null {
  if (c === null || c === undefined || c === "") return null;
  if (c instanceof Date) {
    if (Number.isNaN(c.getTime())) return null;
    return `${c.getUTCFullYear()}-${String(c.getUTCMonth() + 1).padStart(2, "0")}-${String(c.getUTCDate()).padStart(2, "0")}`;
  }
  if (typeof c === "number") {
    if (c < 20000 || c > 80000) return null;   // serie de Excel entre 1954 y 2119
    const d = new Date(Date.UTC(1899, 11, 30) + Math.round(c) * 86_400_000);
    return fechaDeCelda(d);
  }
  const t = c.trim();
  let m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/.exec(t);
  if (m) return validar(Number(m[1]), Number(m[2]), Number(m[3]));
  m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/.exec(t);
  if (m) {
    const anio = Number(m[3]) < 100 ? 2000 + Number(m[3]) : Number(m[3]);
    return validar(anio, Number(m[2]), Number(m[1]));
  }
  const meses = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  m = /^(\d{1,2})[\s/-]+([a-záéíóú]{3})[a-záéíóú]*\.?[\s/-]*(\d{2,4})?/i.exec(t);
  if (m && m[2]) {
    const mes = meses.indexOf(m[2].toLowerCase().slice(0, 3)) + 1;
    const anio = m[3] ? (Number(m[3]) < 100 ? 2000 + Number(m[3]) : Number(m[3])) : anioPorDefecto;
    if (mes > 0 && anio) return validar(anio, mes, Number(m[1]));
  }
  m = /^(\d{1,2})[-/.](\d{1,2})$/.exec(t);   // estados de cuenta sin año
  if (m && anioPorDefecto) return validar(anioPorDefecto, Number(m[2]), Number(m[1]));
  return null;
}

function validar(a: number, m: number, d: number): string | null {
  const iso = `${a}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  return esFechaIso(iso) ? iso : null;
}

const CUOTA = /\b(?:cuota\s*)?(\d{1,2})\s*(?:\/|de)\s*(\d{1,2})\b/i;

export interface ResultadoExtraccion {
  lineas: LineaCartola[];
  /** Filas con datos que no se pudieron leer (número de fila en la tabla, base 1). */
  noLeidas: number[];
}

/** Convierte la tabla en líneas según el mapeo. Ignora encabezados, saldos y filas vacías. */
export function extraerConMapeo(tabla: Tabla, filaEncabezado: number, mapeo: Mapeo, anioPorDefecto?: number): ResultadoExtraccion {
  const lineas: LineaCartola[] = [];
  const noLeidas: number[] = [];
  for (let i = filaEncabezado + 1; i < tabla.length; i++) {
    const fila = tabla[i] ?? [];
    if (fila.every((c) => textoCelda(c) === "")) continue;
    const fecha = fechaDeCelda(fila[mapeo.fecha], anioPorDefecto);
    const glosa = textoCelda(fila[mapeo.descripcion]);
    let monto: number | null = null;
    if (mapeo.monto !== undefined) {
      monto = leerMonto(fila[mapeo.monto] as string | number | null | undefined);
    } else {
      const cargo = mapeo.cargo !== undefined ? leerMonto(fila[mapeo.cargo] as string | number | null | undefined) : null;
      const abono = mapeo.abono !== undefined ? leerMonto(fila[mapeo.abono] as string | number | null | undefined) : null;
      if (cargo) monto = -Math.abs(cargo);
      else if (abono) monto = Math.abs(abono);
    }
    if (!fecha && !monto) {
      // subtotales, saldos o texto suelto: se ignoran salvo que parezcan movimientos
      if (glosa && /\d/.test(glosa) && !/saldo|total|subtotal|p[aá]gina/i.test(glosa)) noLeidas.push(i + 1);
      continue;
    }
    if (!fecha || !monto || /^(saldo|total)/i.test(glosa)) {
      if (!/saldo|total/i.test(glosa)) noLeidas.push(i + 1);
      continue;
    }
    const linea: LineaCartola = { fecha, monto, glosa: glosa || "(sin descripción)" };
    const cuota = CUOTA.exec(glosa);
    if (cuota && Number(cuota[2]) > 1 && Number(cuota[1]) <= Number(cuota[2])) {
      linea.cuota = { numero: Number(cuota[1]), total: Number(cuota[2]) };
    }
    lineas.push(linea);
  }
  return { lineas, noLeidas };
}

/** Tabla como texto (para la IA): una fila por línea, celdas separadas por " | ". */
export function tablaComoTexto(tabla: Tabla, maxFilas = 2000): string {
  return tabla
    .slice(0, maxFilas)
    .map((fila) => fila.map(textoCelda).join(" | "))
    .filter((l) => l.replace(/[|\s]/g, "") !== "")
    .join("\n");
}
