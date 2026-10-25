import { porcentaje } from "../dinero";

/** R22 y R45: parte del ingreso variable o del reajuste que se sugiere a Futuro. */
export function r45_repartoVariable(monto: number, pctAFuturo: number): { futuro: number; resto: number } {
  const futuro = porcentaje(monto, pctAFuturo);
  return { futuro, resto: monto - futuro };
}
