// Clase y comercio de cada línea: primero reglas fijas y del hogar; la IA solo después (spec 003, D31).

export type ClaseLinea =
  | "gasto" | "ingreso" | "transferencia_interna" | "pago_tarjeta" | "comision" | "interes" | "reembolso" | "otro";

export type TipoCuenta = "vista" | "ahorro" | "billetera" | "tarjeta_credito" | "inversion";

export function normalizarGlosa(glosa: string): string {
  return glosa
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

const RUIDO = new Set([
  "COMPRA", "COMPRAS", "PAGO", "PAGOS", "CARGO", "POS", "WEB", "NACIONAL", "NACIONALES", "INTERNACIONAL", "TBK",
  "REDCOMPRA", "DEBITO", "CREDITO", "TARJETA", "TRANSACCION", "EN", "DE", "LA", "EL", "LOS", "LAS", "SA", "S.A.",
  "SPA", "LTDA", "Y", "CIA", "CL", "CHL", "SANTIAGO", "STGO", "INT", "NAC", "COM", "WWW",
]);

/** Comercio para agrupar la revisión: hasta dos palabras significativas de la glosa. */
export function comercioDe(glosa: string): string {
  const palabras = normalizarGlosa(glosa)
    .replace(/[*#]/g, " ")
    .replace(/\b\d+([/.-]\d+)*\b/g, " ")
    .split(/[^A-Z0-9&]+/)
    .filter((p) => p.length >= 2 && !RUIDO.has(p) && !/^\d+$/.test(p));
  return palabras.slice(0, 2).join(" ") || normalizarGlosa(glosa).slice(0, 30) || "SIN DESCRIPCION";
}

export interface CuentaConocida {
  id: string;
  nombre: string;
  tipo: TipoCuenta;
  ultimos4?: string | null;
}

/** Clase por reglas fijas (R27, R28). Devuelve también la tarjeta destino de un pago, si se reconoce. */
export function claseDeterminista(
  glosa: string,
  monto: number,
  tipoCuenta: TipoCuenta,
  cuentasHogar: CuentaConocida[] = [],
): { clase: ClaseLinea; tarjetaId?: string } {
  const g = normalizarGlosa(glosa);
  const abono = monto > 0;
  const tarjetas = cuentasHogar.filter((c) => c.tipo === "tarjeta_credito");
  const tarjetaMencionada = tarjetas.find(
    (t) => (t.ultimos4 && g.includes(t.ultimos4)) || g.includes(normalizarGlosa(t.nombre)),
  );

  if (tipoCuenta === "tarjeta_credito") {
    if (abono && /PAGO|ABONO|RECIBIDO/.test(g) && !/DEVOLUCION|REVERSA|ANULACION/.test(g)) return { clase: "pago_tarjeta" };
    if (abono) return { clase: "reembolso" };
  } else if (!abono && /PAGO\s+(DE\s+)?(TARJETA|TC|T\.C\.|TJ|VISA|MASTER|MASTERCARD|AMEX|CMR|LIDER)|PAGO\s+TARJ/.test(g)) {
    return tarjetaMencionada ? { clase: "pago_tarjeta", tarjetaId: tarjetaMencionada.id } : { clase: "pago_tarjeta" };
  }
  if (/COMISION|MANTENCION|CARGO\s+POR\s+SERVICIO|IMPUESTO\s+TIMBRE|ITE\b/.test(g)) return { clase: "comision" };
  if (/INTERES/.test(g)) return { clase: "interes" };
  const propia = cuentasHogar.some((c) => c.ultimos4 && c.tipo !== "tarjeta_credito" && g.includes(c.ultimos4));
  if (/TRASPASO|TRANSF|TEF\b/.test(g) && (propia || /PROPIA|ENTRE\s+CUENTAS|MISMO\s+TITULAR|AHORRO|INVERSION/.test(g))) {
    return { clase: "transferencia_interna" };
  }
  if (abono) return { clase: "ingreso" };
  return { clase: "gasto" };
}

/** Palabras frecuentes de comercios chilenos → categoría de la plantilla (sugerencia, confianza 0,85). */
const PALABRAS_CATEGORIA: [RegExp, string][] = [
  [/JUMBO|LIDER|UNIMARC|TOTTUS|SANTA ISABEL|ACUENTA|FERIA|SUPERMERCADO|MINIMARKET|PANADERIA|CARNICERIA|VERDULERIA|ALVI|MAYORISTA/, "alimentacion"],
  [/ENEL|CGE|AGUAS|ESVAL|ESSBIO|METROGAS|LIPIGAS|ABASTIBLE|GASCO|VTR|MOVISTAR|ENTEL|CLARO|WOM|GTD|MUNDO|DIRECTV/, "servicios"],
  [/COPEC|SHELL|ARAMCO|PETROBRAS|ENEX|CABIFY|DIDI|UBER(?! EATS)|METRO|BIP|AUTOPISTA|COSTANERA|VESPUCIO|AUTOPASE|TAG|ESTACIONAMIENTO|PEAJE|BENCINA/, "transporte"],
  [/FARMACIA|CRUZ VERDE|SALCOBRAND|AHUMADA|CLINICA|ISAPRE|FONASA|CONSALUD|COLMENA|BANMEDICA|CRUZ BLANCA|DENTAL|LABORATORIO|MEDIC/, "salud"],
  [/COLEGIO|UNIVERSIDAD|MATRICULA|LIBRERIA|INSTITUTO|JARDIN INFANTIL|ESCUELA/, "educacion"],
  [/DIVIDENDO|ARRIENDO|GASTOS? COMUNES|CONDOMINIO|INMOBILIARIA/, "vivienda"],
  [/NETFLIX|SPOTIFY|DISNEY|HBO|MAX\b|PRIME VIDEO|YOUTUBE|CINE|CINEMARK|CINEPLANET|RESTAURANT|STARBUCKS|RAPPI|PEDIDOS ?YA|UBER EATS|JUSTO|BAR\b|SUSHI|PIZZA|CAFE|PUB/, "ocio"],
  [/FALABELLA|PARIS|RIPLEY|H&M|ZARA|NIKE|ADIDAS|HUSH|CORONA|TRICOT|BATA|FOSSIL|DECATHLON/, "vestuario"],
  [/COMISION|INTERES|MANTENCION|IMPUESTO TIMBRE/, "comisiones"],
];

export function categoriaPorPalabras(glosa: string): string | null {
  const g = normalizarGlosa(glosa);
  for (const [re, codigo] of PALABRAS_CATEGORIA) if (re.test(g)) return codigo;
  return null;
}

export interface ReglaComercio {
  patron: string;
  categoria_id: string;
  integrante_id?: string | null;
  intencion?: string | null;
}

/** Regla del hogar que aplica a un comercio: igual, o el comercio empieza con el patrón. */
export function reglaPara(comercio: string, reglas: ReglaComercio[]): ReglaComercio | null {
  const c = normalizarGlosa(comercio);
  return (
    reglas.find((r) => r.patron === c) ??
    reglas
      .filter((r) => c.startsWith(`${r.patron} `) || r.patron.startsWith(`${c} `))
      .sort((a, b) => b.patron.length - a.patron.length)[0] ??
    null
  );
}
