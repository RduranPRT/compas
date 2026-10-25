/** R18 (YMOYL): costo en horas de vida = monto / (ingreso base / horas al mes). */
export function r18_horasVida(monto: number, ingresoBaseMensual: number, horasMes: number): number | null {
  if (ingresoBaseMensual <= 0 || horasMes <= 0) return null;
  return Math.round((10 * monto) / (ingresoBaseMensual / horasMes)) / 10;
}
