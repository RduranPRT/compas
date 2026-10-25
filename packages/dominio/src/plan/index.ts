import { porcentaje, redondear } from "../dinero";
import { formatoPesos } from "../formato";
import { r03_aporteProrrateado } from "../reglas/r03_aporteProrrateado";
import { FUTURO_MIN_PCT, r04_ordenFlujo, type Destino, type Etapa } from "../reglas/r04_ordenFlujo";
import { r06_semaforo, type Bloque, type EstadoBloque } from "../reglas/r06_semaforo";
import { r08_holgura } from "../reglas/r08_holgura";
import { r45_repartoVariable } from "../reglas/r45_variable";

// Plan mensual base cero (spec 006) y reparto del ingreso (spec 007). Una función por regla (ADR-02);
// este orquestador aplica la precedencia: R05 > R13 > R04 > R03/R08 > R06/R07 (solo informan).

export type TipoSobre =
  | "por_asignar" | "proximo_mes" | "fijo" | "variable" | "fondo" | "futuro" | "emergencia" | "cuota" | "sin_culpa"
  | "mesada" | "pago_tarjeta";

export interface SobrePlan {
  id: string;
  nombre: string;
  tipo: TipoSobre;
  bloque: Bloque | null;
  cuatroParedes: boolean;
  integranteId?: string | null;
  /** Pago fijo declarado para el sobre: monto y si es nuevo o en UF (R08). */
  fijo?: { monto: number; conHolgura: boolean } | null;
  /** Promedio de gasto de los últimos 3 meses (variables). */
  promedio?: number | null;
  /** Fondos (R03). */
  fondo?: { objetivo: number; saldo: number; mesesRestantes: number } | null;
  /** Cuotas preasignadas que caen en el mes (R26). */
  cuotasDelMes?: number;
  /** Pago de tarjeta: deuda que aún no está apartada (R44). */
  deudaPorCubrir?: number;
}

export interface DatosBorrador {
  ingresoBase: number;
  etapa: Etapa;
  sobres: SobrePlan[];
  holguraPct: number;
  /** Sin culpa por adulto (D25/ADR-10), ya calculado según la modalidad del Acuerdo. */
  sinCulpaPorAdulto: Record<string, number>;
  esencialesMensuales: number;
  saldoEmergencia: number;
}

export interface LineaBorrador {
  sobreId: string;
  monto: number;
  regla: string;
  explicacion: string;
  holguraPct?: number;
  aporte?: number;
}

export interface Borrador {
  lineas: LineaBorrador[];
  ingreso: number;
  sinCubrir: { sobreId: string; falta: number }[];
  semaforo: EstadoBloque[];
}

interface Necesidad {
  sobre: SobrePlan;
  destino: Destino;
  monto: number;
  regla: string;
  explicacion: string;
  holguraPct?: number;
  aporte?: number;
}

function necesidades(d: DatosBorrador): Necesidad[] {
  const n: Necesidad[] = [];
  for (const s of d.sobres) {
    const cuotas = s.cuotasDelMes ?? 0;
    const conCuotas = (monto: number, texto: string) =>
      cuotas > 0 ? { monto: monto + cuotas, texto: `${texto} Incluye cuotas del mes (R26).` } : { monto, texto };
    switch (s.tipo) {
      case "pago_tarjeta":
        if ((s.deudaPorCubrir ?? 0) > 0) {
          n.push({ sobre: s, destino: d.etapa === "E2" ? "deuda_objetivo" : "pagos_fijos", monto: s.deudaPorCubrir ?? 0,
            regla: "R44", explicacion: "Cubre lo facturado de la tarjeta que aún no está apartado." });
        }
        break;
      case "fijo": {
        const base = s.fijo?.monto ?? s.promedio ?? 0;
        const conHolgura = s.fijo?.conHolgura ?? false;
        const monto = conHolgura ? r08_holgura(base, d.holguraPct) : redondear(base, 1000);
        const { monto: total, texto } = conCuotas(monto, conHolgura
          ? `Pago fijo nuevo o en UF con holgura de ${d.holguraPct} % (R08).`
          : s.fijo ? "Pago fijo declarado." : "Promedio de los últimos meses.");
        if (total > 0) n.push({ sobre: s, destino: s.cuatroParedes && d.etapa === "E0" ? "cuatro_paredes" : "pagos_fijos", monto: total,
          regla: conHolgura ? "R08" : "R04", explicacion: texto, ...(conHolgura ? { holguraPct: d.holguraPct } : {}) });
        break;
      }
      case "variable": {
        const { monto, texto } = conCuotas(redondear(s.promedio ?? 0, 1000), "Promedio de gasto de los últimos 3 meses.");
        if (monto > 0) n.push({ sobre: s, destino: s.cuatroParedes && d.etapa === "E0" ? "cuatro_paredes" : "sobres", monto,
          regla: s.cuatroParedes && d.etapa === "E0" ? "R05" : "R04", explicacion: texto });
        break;
      }
      case "fondo": {
        const f = s.fondo;
        if (!f) break;
        const { aporte, alerta } = r03_aporteProrrateado(f.objetivo, f.saldo, f.mesesRestantes);
        if (aporte > 0) n.push({ sobre: s, destino: "fondos", monto: aporte, regla: "R03", aporte,
          explicacion: alerta ? "La fecha del fondo ya llegó: se propone completar lo que falta (R03)."
            : `Aporte prorrateado: lo que falta dividido en ${f.mesesRestantes} meses (R03).` });
        break;
      }
      case "emergencia": {
        const metaMeses = ["E0", "E1", "E2"].includes(d.etapa) ? 1 : 3;
        const falta = Math.max(0, metaMeses * d.esencialesMensuales - d.saldoEmergencia);
        const plazo = metaMeses === 1 ? 3 : 12;
        const aporte = falta > 0 ? Math.min(falta, redondear(falta / plazo, 1000) || falta) : 0;
        if (aporte > 0) n.push({ sobre: s, destino: "emergencia", monto: aporte, regla: "R03",
          explicacion: `Avanza hacia ${metaMeses} ${metaMeses === 1 ? "mes" : "meses"} de esenciales en el fondo de emergencia.` });
        break;
      }
      case "futuro": {
        const pct = FUTURO_MIN_PCT[d.etapa];
        if (pct) n.push({ sobre: s, destino: "futuro", monto: porcentaje(d.ingresoBase, pct), regla: "R07",
          explicacion: `Mínimo a Futuro de la etapa ${d.etapa}: ${pct} % del ingreso (R07).` });
        break;
      }
      case "sin_culpa": {
        const monto = s.integranteId ? (d.sinCulpaPorAdulto[s.integranteId] ?? 0) : 0;
        if (monto > 0) n.push({ sobre: s, destino: "sin_culpa", monto, regla: "R04",
          explicacion: "Monto personal de libre uso según el Acuerdo (D06, D25)." });
        break;
      }
      case "mesada":
        if ((s.promedio ?? 0) > 0) n.push({ sobre: s, destino: "sobres", monto: redondear(s.promedio ?? 0, 500),
          regla: "R04", explicacion: "Mesada del mes anterior (D17)." });
        break;
      default:
        break;
    }
  }
  return n;
}

/** Borrador base cero: Σ líneas = ingreso base (R45). Se cubre en el orden de la etapa hasta agotar (R04, D03). */
export function generarBorrador(d: DatosBorrador): Borrador {
  const orden = r04_ordenFlujo(d.etapa);
  const pend = necesidades(d).sort((a, b) => orden.indexOf(a.destino) - orden.indexOf(b.destino));
  let resto = d.ingresoBase;
  const lineas = new Map<string, LineaBorrador>();
  const sinCubrir: Borrador["sinCubrir"] = [];
  for (const x of pend) {
    const monto = Math.min(x.monto, resto);
    resto -= monto;
    if (monto < x.monto) sinCubrir.push({ sobreId: x.sobre.id, falta: x.monto - monto });
    const linea: LineaBorrador = {
      sobreId: x.sobre.id,
      monto,
      regla: x.regla,
      explicacion: monto < x.monto ? `${x.explicacion} No alcanza completo: faltan ${formatoPesos(x.monto - monto)} (D03).` : x.explicacion,
    };
    if (x.holguraPct !== undefined) linea.holguraPct = x.holguraPct;
    if (x.aporte !== undefined) linea.aporte = x.aporte;
    lineas.set(x.sobre.id, linea);
  }
  // Lo que sobra va al primer destino de ahorro de la etapa: E0–E2 emergencia, E3+ Futuro (D04)
  if (resto > 0) {
    const tipoDestino = ["E0", "E1", "E2"].includes(d.etapa) ? "emergencia" : "futuro";
    const destino = d.sobres.find((s) => s.tipo === tipoDestino) ?? d.sobres.find((s) => s.tipo === "futuro" || s.tipo === "emergencia");
    if (destino) {
      const previa = lineas.get(destino.id);
      lineas.set(destino.id, {
        sobreId: destino.id,
        monto: (previa?.monto ?? 0) + resto,
        regla: "R04",
        explicacion: `${previa ? `${previa.explicacion} ` : ""}Lo que sobra del ingreso va a ${destino.nombre}, primer destino de ahorro de la etapa (D04).`,
      });
    }
  }
  const resultado = [...lineas.values()];
  return { lineas: resultado, ingreso: d.ingresoBase, sinCubrir, semaforo: semaforoDe(resultado, d.sobres, d.ingresoBase, d.etapa) };
}

export function semaforoDe(lineas: { sobreId: string; monto: number }[], sobres: SobrePlan[], ingreso: number, etapa: Etapa): EstadoBloque[] {
  const bloques: Record<Bloque, number> = { ESENCIALES: 0, FUTURO: 0, VIDA: 0 };
  const porId = new Map(sobres.map((s) => [s.id, s]));
  for (const l of lineas) {
    const s = porId.get(l.sobreId);
    const bloque = s?.bloque ?? (s?.tipo === "pago_tarjeta" ? "ESENCIALES" : null);
    if (bloque) bloques[bloque] += l.monto;
  }
  return r06_semaforo(bloques, ingreso, etapa);
}

/** Sin culpa por adulto según la modalidad del Acuerdo (D25, ADR-10). */
export function sinCulpaPorAdulto(
  modalidad: "igual" | "proporcional_ingreso" | "manual_por_adulto",
  ingreso: number,
  pctSinCulpa: number,
  adultos: { id: string; ingreso: number }[],
  montoAcordado?: number | Record<string, number>,
): Record<string, number> {
  const r: Record<string, number> = {};
  if (modalidad === "manual_por_adulto" && typeof montoAcordado === "object") {
    for (const a of adultos) r[a.id] = montoAcordado[a.id] ?? 0;
    return r;
  }
  const porPersona = typeof montoAcordado === "number" ? montoAcordado : redondear(porcentaje(ingreso, pctSinCulpa), 1000);
  if (modalidad === "proporcional_ingreso") {
    const total = porPersona * adultos.length;
    const suma = adultos.reduce((s, a) => s + a.ingreso, 0);
    for (const a of adultos) r[a.id] = suma > 0 ? redondear((total * a.ingreso) / suma, 1000) : porPersona;
    return r;
  }
  for (const a of adultos) r[a.id] = porPersona;
  return r;
}

// ---------------------------------------------------------------------------------------------
// Reparto del ingreso (spec 007)

export interface LineaReparto {
  sobreId: string;
  nombre: string;
  tipo: TipoSobre;
  cuatroParedes: boolean;
  /** Proyectado en el plan aprobado. */
  plan: number;
  /** Ya asignado este mes con otros ingresos. */
  asignado: number;
}

export interface Asignacion {
  sobreId: string;
  monto: number;
  regla: string;
}

function destinoDe(l: LineaReparto, etapa: Etapa): Destino {
  if (l.cuatroParedes) return etapa === "E0" ? "cuatro_paredes" : l.tipo === "variable" ? "sobres" : "pagos_fijos";
  switch (l.tipo) {
    case "fijo": case "pago_tarjeta": case "cuota": return "pagos_fijos";
    case "emergencia": return "emergencia";
    case "futuro": return "futuro";
    case "fondo": return "fondos";
    case "sin_culpa": return "sin_culpa";
    default: return "sobres";
  }
}

/**
 * Propuesta de reparto en el orden de la etapa (R04) hasta agotar el ingreso (R01, D03).
 * Variable: primero el % acordado a Futuro (R45, R22). Si se usó la emergencia, se repone antes que Futuro (R13).
 */
export function proponerDistribucion(
  monto: number,
  esVariable: boolean,
  etapa: Etapa,
  lineas: LineaReparto[],
  opciones: { pctVariableAFuturo: number; emergenciaUsada?: boolean } = { pctVariableAFuturo: 50 },
): Asignacion[] {
  let resto = monto;
  const asignaciones = new Map<string, Asignacion>();
  const sumar = (sobreId: string, m: number, regla: string) => {
    if (m <= 0) return;
    const previa = asignaciones.get(sobreId);
    asignaciones.set(sobreId, { sobreId, monto: (previa?.monto ?? 0) + m, regla: previa?.regla ?? regla });
    resto -= m;
  };
  const pendiente = (l: LineaReparto) => Math.max(0, l.plan - l.asignado - (asignaciones.get(l.sobreId)?.monto ?? 0));
  const emergencia = lineas.find((l) => l.tipo === "emergencia");
  const futuro = lineas.find((l) => l.tipo === "futuro");
  const reponer = opciones.emergenciaUsada && ["E1", "E2", "E3"].includes(etapa);

  if (esVariable) {
    const { futuro: aFuturo } = r45_repartoVariable(monto, opciones.pctVariableAFuturo);
    const destino = reponer && emergencia ? emergencia : futuro ?? emergencia;
    if (destino) sumar(destino.sobreId, Math.min(aFuturo, resto), reponer ? "R13" : "R45");
  }
  if (reponer && emergencia) sumar(emergencia.sobreId, Math.min(pendiente(emergencia), resto), "R13");

  const orden = r04_ordenFlujo(etapa);
  const ordenadas = [...lineas].sort((a, b) => orden.indexOf(destinoDe(a, etapa)) - orden.indexOf(destinoDe(b, etapa)));
  for (const l of ordenadas) {
    if (resto <= 0) break;
    sumar(l.sobreId, Math.min(pendiente(l), resto), etapa === "E0" && l.cuatroParedes ? "R05" : "R04");
  }
  // Lo que sobra (ingreso mayor al plan, D04): E0–E2 a emergencia; E3+ a Futuro
  if (resto > 0) {
    const destino = ["E0", "E1", "E2"].includes(etapa) ? emergencia ?? futuro : futuro ?? emergencia;
    if (destino) sumar(destino.sobreId, resto, "R04");
  }
  return [...asignaciones.values()];
}
