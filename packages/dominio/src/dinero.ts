import { z } from "zod";

// Dinero en pesos chilenos enteros (I3). Nunca float para montos.

export const montoClp = z.number().int().refine(Number.isSafeInteger, "Monto fuera de rango");
export const montoPositivo = montoClp.refine((n) => n > 0, "El monto debe ser mayor que cero");

/** Redondea hacia arriba al múltiplo de `paso` (por defecto $1.000). */
export function redondearArriba(monto: number, paso = 1000): number {
  return Math.ceil(monto / paso) * paso;
}

export function redondear(monto: number, paso = 1000): number {
  return Math.round(monto / paso) * paso;
}

/** Porcentaje entero de un monto, redondeado al peso. */
export function porcentaje(monto: number, pct: number): number {
  return Math.round((monto * pct) / 100);
}

/** D32: cuotas enteras; la última absorbe el resto. */
export function repartirCuotas(monto: number, n: number): number[] {
  if (!Number.isSafeInteger(monto) || monto <= 0) throw new Error("Monto inválido");
  if (!Number.isInteger(n) || n < 1) throw new Error("Cantidad de cuotas inválida");
  const cuota = Math.floor(monto / n);
  return Array.from({ length: n }, (_, i) => (i === n - 1 ? monto - cuota * (n - 1) : cuota));
}

/**
 * Lee un monto escrito por una persona o en una cartola chilena:
 * "$12.990", "12990", "-12.990", "(12.990)", "12 lucas", "12 mil", "1,5 millones", "12k".
 * Devuelve pesos enteros con signo, o null si no hay un monto claro.
 */
export function leerMonto(texto: string | number | null | undefined): number | null {
  if (texto === null || texto === undefined) return null;
  if (typeof texto === "number") return Number.isFinite(texto) ? Math.round(texto) : null;
  let t = texto.trim().toLowerCase();
  if (!t) return null;
  let signo = 1;
  if (/^\(.*\)$/.test(t)) {
    signo = -1;
    t = t.slice(1, -1);
  }
  if (t.startsWith("-") || t.startsWith("−") || t.endsWith("-")) signo = -1;
  const m = /(\d[\d.,\s]*)\s*(millones?|mm|palos?|lucas?|lukas?|mil|k)?/.exec(t);
  if (!m || !m[1]) return null;
  const numero = m[1].replace(/\s/g, "");
  const unidad = m[2] ?? "";
  let valor: number;
  if (unidad) {
    // con unidad, la coma o el punto son decimales: "1,5 millones", "12.5 lucas"
    valor = Number(numero.replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", "."));
    const factor = /^(millon|mm|palo)/.test(unidad) ? 1_000_000 : 1000;
    valor *= factor;
  } else if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(numero)) {
    valor = Number(numero.replace(/\./g, "").replace(",", "."));   // 12.990 o 1.234.567,00
  } else if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(numero)) {
    valor = Number(numero.replace(/,/g, ""));                        // 12,990 (formato inglés)
  } else {
    valor = Number(numero.replace(",", "."));
  }
  if (!Number.isFinite(valor)) return null;
  return signo * Math.round(valor);
}
