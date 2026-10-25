import { porcentaje, redondearArriba } from "../dinero";

/** R08: pago fijo nuevo o en UF con holgura (15 % por defecto) el primer mes; redondeado a $1.000. */
export function r08_holgura(monto: number, pctHolgura: number): number {
  return redondearArriba(monto + porcentaje(monto, pctHolgura));
}
