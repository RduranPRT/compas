// Formatos para el usuario (es-CL). Montos: $12.345, punto de miles, sin decimales.

export function formatoPesos(monto: number): string {
  if (!Number.isSafeInteger(monto)) throw new Error(`Monto no entero: ${monto}`);
  const miles = Math.abs(monto)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${monto < 0 ? "-" : ""}$${miles}`;
}

export function formatoFecha(iso: string): string {
  const [a, m, d] = iso.split("-");
  return `${d}-${m}-${a}`;
}
