import { FUTURO_MIN_PCT, type Etapa } from "./r04_ordenFlujo";

// R06 y R07 (Warren, 50/30/20): semáforo de bloques. Informa, nunca bloquea (P3).

export type Color = "verde" | "amarillo" | "rojo";
export type Bloque = "ESENCIALES" | "FUTURO" | "VIDA";

export interface EstadoBloque {
  bloque: Bloque;
  monto: number;
  pct: number;          // % del ingreso, con un decimal
  limitePct: number;
  color: Color;
  regla: "R06" | "R07" | null;
  mensaje: string;
}

function pct(monto: number, ingreso: number): number {
  return ingreso > 0 ? Math.round((1000 * monto) / ingreso) / 10 : 0;
}

export function r06_semaforo(montos: Record<Bloque, number>, ingreso: number, etapa: Etapa): EstadoBloque[] {
  const esencial = pct(montos.ESENCIALES, ingreso);
  const futuro = pct(montos.FUTURO, ingreso);
  const vida = pct(montos.VIDA, ingreso);
  // R07: en E0–E2 el mínimo es el de la etapa; desde E3, 20 %
  const minFuturo = ["E0", "E1", "E2"].includes(etapa) ? (FUTURO_MIN_PCT[etapa] ?? 0) : 20;
  return [
    {
      bloque: "ESENCIALES",
      monto: montos.ESENCIALES,
      pct: esencial,
      limitePct: 50,
      color: esencial > 50 ? "rojo" : "verde",
      regla: esencial > 50 ? "R06" : null,
      mensaje: esencial > 50
        ? `Esenciales usa el ${esencial} % del ingreso; el método sugiere hasta 50 % (R06).`
        : `Esenciales usa el ${esencial} % del ingreso.`,
    },
    {
      bloque: "FUTURO",
      monto: montos.FUTURO,
      pct: futuro,
      limitePct: minFuturo,
      color: futuro < minFuturo ? "amarillo" : "verde",
      regla: futuro < minFuturo ? "R07" : null,
      mensaje: futuro < minFuturo
        ? `Futuro recibe el ${futuro} % del ingreso; para la etapa ${etapa} el mínimo sugerido es ${minFuturo} % (R07).`
        : `Futuro recibe el ${futuro} % del ingreso.`,
    },
    {
      bloque: "VIDA",
      monto: montos.VIDA,
      pct: vida,
      limitePct: 30,
      color: vida > 30 ? "amarillo" : "verde",
      regla: null,
      mensaje: `Vida usa el ${vida} % del ingreso; el método sugiere hasta 30 %.`,
    },
  ];
}
