import type { Cliente } from "./cliente";

// Funciones de IA en Supabase (ADR-04). Si responden "no disponible" (sin clave o sin consentimiento
// analitica_ia), la app sigue con sus reglas (D31): por eso cada llamada devuelve null en vez de fallar.

export type ResultadoIA<T> = { ok: true; datos: T } | { ok: false; motivo: "sin_ia" | "error"; mensaje: string };

export async function llamarIA<T>(db: Cliente, funcion: string, cuerpo: unknown): Promise<ResultadoIA<T>> {
  try {
    const { data, error } = await db.functions.invoke(funcion, { body: cuerpo as Record<string, unknown> });
    if (error) {
      const estado = (error as { context?: { status?: number } }).context?.status;
      if (estado === 503) return { ok: false, motivo: "sin_ia", mensaje: "La IA no está disponible; seguimos con las reglas del método." };
      return { ok: false, motivo: "error", mensaje: "La IA no respondió; seguimos con las reglas del método." };
    }
    return { ok: true, datos: data as T };
  } catch {
    return { ok: false, motivo: "error", mensaje: "La IA no respondió; seguimos con las reglas del método." };
  }
}

/** ¿La persona tiene vigente el consentimiento de análisis con IA? (S5) */
export async function tieneConsentimientoIA(db: Cliente, integranteId: string): Promise<boolean> {
  const { data } = await db.schema("app").rpc("consentimiento_vigente", { p_integrante: integranteId, p_finalidad: "analitica_ia" });
  return !!data;
}
