import { redondearArriba } from "../dinero";

/**
 * R03 (YNAB): aporte mensual de un fondo prorrateado = (monto − saldo) / meses restantes.
 * Saldo ≥ monto → 0. Sin meses restantes → todo lo que falta, con alerta.
 */
export function r03_aporteProrrateado(
  montoObjetivo: number,
  saldo: number,
  mesesRestantes: number,
): { aporte: number; alerta: boolean } {
  const falta = montoObjetivo - saldo;
  if (falta <= 0) return { aporte: 0, alerta: false };
  if (mesesRestantes <= 0) return { aporte: falta, alerta: true };
  return { aporte: Math.min(falta, redondearArriba(falta / mesesRestantes, 100)), alerta: false };
}
