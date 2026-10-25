import type { Gasto } from "../datos/finanzas";

// D11: capturas sin conexión. Se guardan con su cliente_op_id y se reenvían; la RPC es idempotente.

const CLAVE = "compas.cola.gastos";

export interface Almacen {
  getItem(clave: string): string | null;
  setItem(clave: string, valor: string): void;
}

function almacen(): Almacen | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export function leerCola(a: Almacen | null = almacen()): Gasto[] {
  try {
    return JSON.parse(a?.getItem(CLAVE) ?? "[]") as Gasto[];
  } catch {
    return [];
  }
}

export function encolar(g: Gasto, a: Almacen | null = almacen()): void {
  a?.setItem(CLAVE, JSON.stringify([...leerCola(a), g]));
}

/** Reenvía la cola; quita lo que la base aceptó (o ya tenía) y deja lo que falló por red. */
export async function sincronizar(
  enviar: (g: Gasto) => Promise<{ error: { message: string } | null }>,
  a: Almacen | null = almacen(),
): Promise<{ enviados: number; pendientes: number }> {
  const cola = leerCola(a);
  const quedan: Gasto[] = [];
  let enviados = 0;
  for (const g of cola) {
    const { error } = await enviar(g);
    if (error && /fetch|network|conexi/i.test(error.message)) quedan.push(g);
    else enviados++;
  }
  a?.setItem(CLAVE, JSON.stringify(quedan));
  return { enviados, pendientes: quedan.length };
}

/** Último medio de pago usado por la persona (spec 005: por defecto, el último). */
export function ultimoMedio(a: Almacen | null = almacen()): string | null {
  return a?.getItem("compas.ultimo_medio") ?? null;
}

export function recordarMedio(cuentaId: string, a: Almacen | null = almacen()): void {
  a?.setItem("compas.ultimo_medio", cuentaId);
}
