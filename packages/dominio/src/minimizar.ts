// R43 e I7: antes de cualquier llamada a la IA se quitan datos que identifican a personas o cuentas.
// Sin RUT, sin más de 4 dígitos de una cuenta o tarjeta, sin correos, sin teléfonos y sin nombres de menores.

const RUT = /\b\d{1,2}\.?\d{3}\.?\d{3}\s?-\s?[\dkK]\b/g;
const CORREO = /[\w.+-]+@[\w-]+(\.[\w-]+)+/g;
const TELEFONO = /(\+?56\s?)?\b9[\s.-]?\d{4}[\s.-]?\d{4}\b/g;
// Cuentas y tarjetas: 9 o más dígitos seguidos, o grupos con guiones o espacios que suman 9 o más
const NUMERO_LARGO = /\b\d(?:[\d\s-]*\d){8,}\b/g;

export interface OpcionesMinimizar {
  /** Nombres o apodos de los hijos (R25). */
  nombresMenores?: string[];
}

function escapar(t: string): string {
  return t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function minimizar(texto: string, opciones: OpcionesMinimizar = {}): string {
  let t = texto.replace(RUT, "[RUT]").replace(CORREO, "[correo]").replace(TELEFONO, "[teléfono]");
  t = t.replace(NUMERO_LARGO, (n) => {
    const digitos = n.replace(/\D/g, "");
    return digitos.length >= 9 ? `****${digitos.slice(-4)}` : n;
  });
  for (const nombre of opciones.nombresMenores ?? []) {
    const limpio = nombre.trim();
    if (limpio.length < 2) continue;
    t = t.replace(new RegExp(`(?<![\\p{L}])${escapar(limpio)}(?![\\p{L}])`, "giu"), "[menor]");
  }
  return t;
}
