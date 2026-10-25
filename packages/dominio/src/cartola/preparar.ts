import { minimizar } from "../minimizar";
import {
  categoriaPorPalabras,
  claseDeterminista,
  comercioDe,
  normalizarGlosa,
  reglaPara,
  type ClaseLinea,
  type CuentaConocida,
  type ReglaComercio,
  type TipoCuenta,
} from "./clasificar";
import type { LineaCartola } from "./tabla";

// Líneas listas para app.importar_cartola: minimizadas, con huella, clase y categoría sugerida.

export interface LineaPreparada {
  fecha: string;
  monto: number;
  glosa: string;
  comercio: string;
  clase: ClaseLinea;
  hash: string;
  categoria_id?: string;
  intencion?: string;
  confianza?: number;
  tarjeta_id?: string;
}

export interface ContextoPreparar {
  cuentaId: string;
  tipoCuenta: TipoCuenta;
  cuentas: CuentaConocida[];
  reglas: ReglaComercio[];
  /** plantilla_codigo → id de la categoría del hogar */
  categoriasPorCodigo: Record<string, string>;
  nombresMenores?: string[];
}

async function sha256(texto: string): Promise<string> {
  const datos = new TextEncoder().encode(texto);
  const resumen = await globalThis.crypto.subtle.digest("SHA-256", datos);
  return Array.from(new Uint8Array(resumen), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Huella del archivo: impide importarlo dos veces (spec 003). */
export async function huellaArchivo(contenido: ArrayBuffer | Uint8Array): Promise<string> {
  const datos = contenido instanceof Uint8Array ? contenido : new Uint8Array(contenido);
  const resumen = await globalThis.crypto.subtle.digest("SHA-256", datos as BufferSource);
  return Array.from(new Uint8Array(resumen), (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Huella de línea: sha256 de cuenta | fecha | monto con signo | glosa normalizada | ordinal del día.
 * El ordinal distingue dos compras iguales el mismo día (spec 003).
 */
export async function huellaLinea(cuentaId: string, l: LineaCartola, ordinal: number): Promise<string> {
  return sha256([cuentaId, l.fecha, String(l.monto), normalizarGlosa(l.glosa), String(ordinal)].join("|"));
}

export async function prepararLineas(lineas: LineaCartola[], ctx: ContextoPreparar): Promise<LineaPreparada[]> {
  const vistos = new Map<string, number>();
  const resultado: LineaPreparada[] = [];
  for (const l of lineas) {
    const glosa = minimizar(l.glosa, { nombresMenores: ctx.nombresMenores ?? [] });
    const clave = `${l.fecha}|${l.monto}|${normalizarGlosa(glosa)}`;
    const ordinal = (vistos.get(clave) ?? 0) + 1;
    vistos.set(clave, ordinal);
    const { clase, tarjetaId } = claseDeterminista(glosa, l.monto, ctx.tipoCuenta, ctx.cuentas);
    const comercio = clase === "pago_tarjeta" ? "PAGO TARJETA" : comercioDe(glosa);
    const linea: LineaPreparada = {
      fecha: l.fecha,
      monto: l.monto,
      glosa,
      comercio,
      clase,
      hash: await huellaLinea(ctx.cuentaId, { ...l, glosa }, ordinal),
    };
    if (tarjetaId) linea.tarjeta_id = tarjetaId;
    if (l.monto < 0 && (clase === "gasto" || clase === "comision" || clase === "interes")) {
      const regla = reglaPara(comercio, ctx.reglas);
      if (regla) {
        linea.categoria_id = regla.categoria_id;
        linea.confianza = 0.95;
        if (regla.intencion) linea.intencion = regla.intencion;
      } else {
        const codigo = clase === "gasto" ? categoriaPorPalabras(glosa) : "comisiones";
        const id = codigo ? ctx.categoriasPorCodigo[codigo] : undefined;
        if (id) {
          linea.categoria_id = id;
          linea.confianza = 0.85;
        }
      }
    }
    resultado.push(linea);
  }
  return resultado;
}

export interface ResumenLineas {
  desde: string | null;
  hasta: string | null;
  antesDelPiloto: number;
  desdeElPiloto: number;
  cargos: number;
  abonos: number;
}

export function resumirLineas(lineas: { fecha: string; monto: number }[], inicioPiloto: string): ResumenLineas {
  const fechas = lineas.map((l) => l.fecha).sort();
  return {
    desde: fechas[0] ?? null,
    hasta: fechas[fechas.length - 1] ?? null,
    antesDelPiloto: lineas.filter((l) => l.fecha < inicioPiloto).length,
    desdeElPiloto: lineas.filter((l) => l.fecha >= inicioPiloto).length,
    cargos: lineas.filter((l) => l.monto < 0).reduce((s, l) => s - l.monto, 0),
    abonos: lineas.filter((l) => l.monto > 0).reduce((s, l) => s + l.monto, 0),
  };
}

/** Si el documento trae totales, cargos y abonos deben cuadrar (spec 003). */
export function cuadraConTotales(r: ResumenLineas, totales?: { cargos?: number; abonos?: number }): boolean {
  if (!totales) return true;
  if (totales.cargos !== undefined && Math.abs(totales.cargos) !== r.cargos) return false;
  if (totales.abonos !== undefined && Math.abs(totales.abonos) !== r.abonos) return false;
  return true;
}
