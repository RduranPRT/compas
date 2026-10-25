/** R33: ingreso base real distinto del proyectado en más del umbral → ajuste del plan (P2-A). */
export function r33_ajusteIngreso(real: number, proyectado: number, umbralPct = 5) {
  if (proyectado <= 0) return { diferenciaPct: null, requiereAjuste: false };
  const diferenciaPct = Math.round((10000 * (real - proyectado)) / proyectado) / 100;
  return { diferenciaPct, requiereAjuste: Math.abs(diferenciaPct) > umbralPct };
}
