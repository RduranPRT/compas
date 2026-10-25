// R04 (Sethi): orden de destinos del día de pago según la etapa (ref.flujo_etapa). R05: en E0, Cuatro Paredes primero.

export type Etapa = "E0" | "E1" | "E2" | "E3" | "E4" | "E5";
export type Destino =
  | "cuatro_paredes" | "pagos_fijos" | "deudas_minimos" | "deuda_objetivo" | "emergencia" | "futuro" | "fondos"
  | "sobres" | "sin_culpa";

export const FLUJO_ETAPA: Record<Etapa, Destino[]> = {
  E0: ["cuatro_paredes", "pagos_fijos", "deudas_minimos", "sobres", "sin_culpa"],
  E1: ["pagos_fijos", "emergencia", "deudas_minimos", "sobres", "sin_culpa"],
  E2: ["pagos_fijos", "deuda_objetivo", "fondos", "sobres", "sin_culpa"],
  E3: ["futuro", "pagos_fijos", "emergencia", "fondos", "sin_culpa"],
  E4: ["futuro", "pagos_fijos", "fondos", "sobres", "sin_culpa"],
  E5: ["futuro", "pagos_fijos", "fondos", "sobres", "sin_culpa"],
};

/** Mínimo a Futuro de la etapa en % del ingreso (R07); E1 = lo que va a emergencia. */
export const FUTURO_MIN_PCT: Record<Etapa, number | null> = { E0: 1, E1: null, E2: 5, E3: 10, E4: 20, E5: 20 };

export const NOMBRE_ETAPA: Record<Etapa, string> = {
  E0: "Estabilizar",
  E1: "Colchón inicial",
  E2: "Desendeudar",
  E3: "Proteger",
  E4: "Construir",
  E5: "Libertad",
};

/**
 * Orden completo: los destinos de la etapa primero y, después, los que la etapa no nombra
 * (para que todo sobre reciba su parte si alcanza). En E0, Cuatro Paredes siempre va primero (R05).
 */
export function r04_ordenFlujo(etapa: Etapa): Destino[] {
  const base = FLUJO_ETAPA[etapa];
  const todos: Destino[] = ["cuatro_paredes", "pagos_fijos", "deudas_minimos", "deuda_objetivo", "emergencia", "futuro",
    "fondos", "sobres", "sin_culpa"];
  const orden = [...base, ...todos.filter((d) => !base.includes(d))];
  return etapa === "E0" ? ["cuatro_paredes", ...orden.filter((d) => d !== "cuatro_paredes")] : orden;
}

export function esEtapa(x: string): x is Etapa {
  return /^E[0-5]$/.test(x);
}
