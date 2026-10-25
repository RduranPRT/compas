import { categoriaPorPalabras, normalizarGlosa } from "./cartola/clasificar";
import { leerMonto } from "./dinero";
import { hoyIso, sumarDias } from "./fechas";

// Captura por frase (HU-005-2, D31): "gasté 12 lucas en la feria con débito". Reglas en el dispositivo;
// la IA solo mejora la propuesta. La persona siempre confirma antes de guardar.

export interface OpcionSobre {
  id: string;
  nombre: string;
  /** plantilla_codigo de la categoría, para reconocer palabras como "feria" o "bencina". */
  codigo?: string | null;
}

export interface OpcionCuenta {
  id: string;
  nombre: string;
  tipo: "vista" | "ahorro" | "billetera" | "tarjeta_credito" | "inversion";
}

export interface PropuestaFrase {
  monto: number | null;
  sobreId: string | null;
  cuentaId: string | null;
  fecha: string;
  comercio: string | null;
  nCuotas: number;
  confianza: number;
}

const SIN_TILDE = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function interpretarFrase(
  frase: string,
  sobres: OpcionSobre[],
  cuentas: OpcionCuenta[],
  hoy: string = hoyIso(),
): PropuestaFrase {
  const t = SIN_TILDE(frase);
  const montoTexto = /(\$?\s*\d[\d.,]*\s*(millones?|palos?|lucas?|lukas?|mil|k)?)/.exec(t);
  const monto = montoTexto?.[1] ? Math.abs(leerMonto(montoTexto[1]) ?? 0) || null : null;

  // Sobre: por nombre del sobre o por palabras conocidas de su categoría
  let sobreId: string | null = null;
  for (const s of sobres) {
    const nombre = SIN_TILDE(s.nombre);
    const palabras = nombre.split(/[^a-z]+/).filter((p) => p.length >= 4);
    if (t.includes(nombre) || palabras.some((p) => t.includes(p))) {
      sobreId = s.id;
      break;
    }
  }
  if (!sobreId) {
    const codigo = categoriaPorPalabras(normalizarGlosa(frase)) ?? palabraComun(t);
    sobreId = sobres.find((s) => s.codigo && s.codigo === codigo)?.id ?? null;
  }

  // Medio de pago
  let cuentaId: string | null = null;
  const porNombre = cuentas.find((c) => t.includes(SIN_TILDE(c.nombre)));
  if (porNombre) cuentaId = porNombre.id;
  else if (/efectivo|cash|plata en mano/.test(t)) cuentaId = cuentas.find((c) => c.tipo === "billetera")?.id ?? null;
  else if (/credito|tarjeta|visa|master|cuotas?/.test(t)) cuentaId = cuentas.find((c) => c.tipo === "tarjeta_credito")?.id ?? null;
  else if (/debito|redcompra|cuenta ?rut|transferencia/.test(t)) cuentaId = cuentas.find((c) => c.tipo === "vista")?.id ?? null;

  const cuotas = /(\d{1,2})\s*cuotas?/.exec(t);
  const fecha = /anteayer/.test(t) ? sumarDias(hoy, -2) : /ayer/.test(t) ? sumarDias(hoy, -1) : hoy;
  const comercio = /\ben (el |la |los |las )?([a-z0-9][a-z0-9 ]{2,30}?)(?= con | en \d| \d|$|,)/.exec(t)?.[2]?.trim() ?? null;

  const aciertos = [monto !== null, sobreId !== null, cuentaId !== null].filter(Boolean).length;
  return {
    monto,
    sobreId,
    cuentaId,
    fecha,
    comercio: comercio && !/^\d/.test(comercio) ? comercio : null,
    nCuotas: cuotas ? Math.max(1, Number(cuotas[1])) : 1,
    confianza: aciertos === 3 ? 0.85 : aciertos === 2 ? 0.6 : 0.3,
  };
}

function palabraComun(t: string): string | null {
  if (/feria|super|almuerzo|pan\b|verdura|fruta|carne/.test(t)) return "alimentacion";
  if (/bencina|micro|metro|uber|taxi|peaje|estacionamiento/.test(t)) return "transporte";
  if (/remedio|doctor|medico|farmacia|dentista/.test(t)) return "salud";
  if (/cine|salida|restoran|restaurant|cafe|cerveza|helado/.test(t)) return "ocio";
  if (/ropa|zapatos|polera|pantalon/.test(t)) return "vestuario";
  if (/luz|agua|gas|internet|celular/.test(t)) return "servicios";
  return null;
}
