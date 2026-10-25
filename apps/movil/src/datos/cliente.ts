import type { Database } from "@compas/contratos";
import type { SupabaseClient } from "@supabase/supabase-js";

// Las funciones de datos reciben el cliente: la app pasa el de src/lib/supabase y las
// pruebas de integración uno con sesión de prueba.
export type Cliente = SupabaseClient<Database>;
export type Resultado = Promise<{ error: { message: string } | null }>;

/** Mensaje para la persona: los RAISE de la base ya vienen en español y sin culpa (R16). */
export function mensajeError(error: { message: string } | null | undefined, porDefecto = "No pudimos guardar. Revisa tu conexión e inténtalo de nuevo."): string | null {
  if (!error) return null;
  const m = error.message ?? "";
  if (/Failed to fetch|NetworkError|network/i.test(m)) return "Sin conexión. Inténtalo de nuevo cuando vuelvas a tener señal.";
  if (/permission denied|row-level security|JWT/i.test(m)) return "No tienes permiso para hacer esto en el hogar.";
  if (/^[A-ZÁÉÍÓÚÑ¿]/.test(m) && !/violates|constraint|column|relation|function|syntax/.test(m)) return m;
  return porDefecto;
}

/** Lanza si la respuesta trae error; devuelve los datos. */
export function datos<T>(r: { data: T | null; error: { message: string } | null }): T {
  if (r.error) throw new Error(mensajeError(r.error) ?? r.error.message);
  return r.data as T;
}

export function nuevoId(): string {
  const c = globalThis.crypto;
  if (c?.randomUUID) return c.randomUUID();
  return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (x) =>
    (Number(x) ^ (Math.random() * 16) >> (Number(x) / 4)).toString(16));
}
