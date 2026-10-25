/** R09: ritmo = gastado / (asignado × días transcurridos / días del mes). Sobre el umbral → RitmoExcedido. */
export function r09_ritmo(asignado: number, gastado: number, dia: number, diasMes: number, umbral = 1.1) {
  if (asignado <= 0) return { ritmo: null, excede: false };
  const ritmo = Math.round((100 * gastado) / ((asignado * Math.max(1, Math.min(dia, diasMes))) / diasMes)) / 100;
  return { ritmo, excede: ritmo > umbral };
}
