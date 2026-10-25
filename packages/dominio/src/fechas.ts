// Fechas en la zona del hogar (America/Santiago) como texto ISO AAAA-MM-DD. Fecha contable = fecha de compra (D07).

const ZONA = "America/Santiago";
const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

export function hoyIso(ahora: Date = new Date()): string {
  // en-CA entrega AAAA-MM-DD
  return new Intl.DateTimeFormat("en-CA", { timeZone: ZONA, year: "numeric", month: "2-digit", day: "2-digit" }).format(ahora);
}

function partes(iso: string): [number, number, number] {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) throw new Error(`Fecha inválida: ${iso}`);
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

function iso(a: number, m: number, d: number): string {
  return `${a}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export function mesDe(fecha: string): string {
  const [a, m] = partes(fecha);
  return iso(a, m, 1);
}

export function sumarMeses(fecha: string, n: number): string {
  const [a, m, d] = partes(fecha);
  const total = a * 12 + (m - 1) + n;
  const anio = Math.floor(total / 12);
  const mes = (total % 12) + 1;
  return iso(anio, mes, Math.min(d, diasDelMes(iso(anio, mes, 1))));
}

export function sumarDias(fecha: string, n: number): string {
  const [a, m, d] = partes(fecha);
  const f = new Date(Date.UTC(a, m - 1, d + n));
  return iso(f.getUTCFullYear(), f.getUTCMonth() + 1, f.getUTCDate());
}

export function diasDelMes(fecha: string): number {
  const [a, m] = partes(fecha);
  return new Date(Date.UTC(a, m, 0)).getUTCDate();
}

export function diaDelMes(fecha: string): number {
  return partes(fecha)[2];
}

export function diferenciaDias(desde: string, hasta: string): number {
  const [a1, m1, d1] = partes(desde);
  const [a2, m2, d2] = partes(hasta);
  return Math.round((Date.UTC(a2, m2 - 1, d2) - Date.UTC(a1, m1 - 1, d1)) / 86_400_000);
}

/** "diciembre de 2026" */
export function nombreMes(fecha: string): string {
  const [a, m] = partes(fecha);
  return `${MESES[m - 1]} de ${a}`;
}

/** "Diciembre" */
export function nombreMesCorto(fecha: string): string {
  const n = MESES[partes(fecha)[1] - 1] ?? "";
  return n.charAt(0).toUpperCase() + n.slice(1);
}

/** Fecha válida en ese mes: el día 31 en febrero es el último día de febrero. */
export function fechaEnMes(mes: string, dia: number): string {
  const [a, m] = partes(mes);
  return iso(a, m, Math.min(Math.max(1, dia), diasDelMes(mes)));
}

export function esFechaIso(texto: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(texto);
  if (!m) return false;
  const [a, mes, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  return mes >= 1 && mes <= 12 && d >= 1 && d <= new Date(Date.UTC(a, mes, 0)).getUTCDate();
}
