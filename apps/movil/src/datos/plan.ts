import {
  diasDelMes,
  diferenciaDias,
  generarBorrador,
  mesDe,
  sinCulpaPorAdulto,
  sumarMeses,
  type Borrador,
  type Etapa,
  type ParametrosAcuerdo,
  type SobrePlan,
} from "@compas/dominio";
import type { Cliente, Resultado } from "./cliente";
import { fondos, ingresosEsperados, pagosFijos } from "./configuracion";
import { sobresDelMes, tarjetas, type Sobre } from "./finanzas";
import { integrantes } from "./hogar";

// Spec 006: datos para el borrador base cero, guardado, edición y envío a aprobación.

export interface PlanGuardado {
  id: string;
  version: number;
  estado: string;
  ingreso: number;
  solicitudId: string | null;
  lineas: { sobreId: string; monto: number; regla: string | null; explicacion: string | null }[];
}

export async function planDelMes(db: Cliente, mes: string): Promise<PlanGuardado | null> {
  const { data: periodo } = await db.schema("plan").from("periodo").select("id").eq("mes", mesDe(mes)).maybeSingle();
  if (!periodo) return null;
  const { data } = await db.schema("plan").from("presupuesto_mensual").select("id, version, estado, ingreso_proyectado, solicitud_id")
    .eq("periodo_id", periodo.id).neq("estado", "reemplazado").order("version", { ascending: false }).limit(1).maybeSingle();
  if (!data) return null;
  const { data: lineas } = await db.schema("plan").from("linea_plan").select("sobre_id, monto_proyectado, regla_codigo, explicacion").eq("presupuesto_id", data.id);
  return {
    id: data.id,
    version: data.version,
    estado: data.estado,
    ingreso: Number(data.ingreso_proyectado),
    solicitudId: data.solicitud_id,
    lineas: (lineas ?? []).map((l) => ({ sobreId: l.sobre_id, monto: Number(l.monto_proyectado), regla: l.regla_codigo, explicacion: l.explicacion })),
  };
}

/** Promedio mensual de gasto por categoría en los 3 meses previos (movimientos e históricos). */
async function promediosPorCategoria(db: Cliente, mes: string): Promise<Map<string, number>> {
  const desde = sumarMeses(mesDe(mes), -3);
  const hasta = mesDe(mes);
  const [{ data: movs }, { data: hist }] = await Promise.all([
    db.schema("fin").from("v_movimiento").select("categoria_id, monto_clp, tipo, fecha_contable").in("estado", ["confirmado", "conciliado"])
      .eq("tipo", "gasto").gte("fecha_contable", desde).lt("fecha_contable", hasta),
    db.schema("fin").from("movimiento_historico").select("categoria_id, monto_clp, fecha").eq("sentido", "cargo")
      .gte("fecha", desde).lt("fecha", hasta),
  ]);
  const meses = new Map<string, Set<string>>();
  const total = new Map<string, number>();
  const sumar = (cat: string | null, monto: number, fecha: string) => {
    if (!cat) return;
    total.set(cat, (total.get(cat) ?? 0) + monto);
    meses.set(cat, (meses.get(cat) ?? new Set()).add(mesDe(fecha)));
  };
  for (const m of movs ?? []) sumar(m.categoria_id, Number(m.monto_clp), m.fecha_contable!);
  for (const h of hist ?? []) sumar(h.categoria_id, Number(h.monto_clp), h.fecha);
  const r = new Map<string, number>();
  const nMeses = 3;
  for (const [cat, t] of total) r.set(cat, Math.round(t / Math.max(1, Math.min(nMeses, meses.get(cat)?.size ?? 1))));
  return r;
}

export interface DatosPlan {
  sobres: Sobre[];
  sobresPlan: SobrePlan[];
  ingresoBase: number;
  etapa: Etapa;
  borrador: Borrador;
}

export async function calcularBorrador(db: Cliente, mes: string, etapa: Etapa, p: ParametrosAcuerdo): Promise<DatosPlan> {
  const [sobres, esperados, fijos, fondosHogar, tarjetasHogar, personas, promedios] = await Promise.all([
    sobresDelMes(db, mes),
    ingresosEsperados(db),
    pagosFijos(db),
    fondos(db),
    tarjetas(db),
    integrantes(db),
    promediosPorCategoria(db, mes),
  ]);
  const ingresoBase = esperados.filter((i) => i.esBase).reduce((s, i) => s + i.monto, 0);
  const fijoPorCategoria = new Map<string, { monto: number; conHolgura: boolean }>();
  for (const f of fijos) {
    const previo = fijoPorCategoria.get(f.categoriaId);
    // UF: se proyecta con un valor de referencia; R08 agrega holgura (D09). Nuevo = vigente desde este mes o el anterior.
    const monto = f.moneda === "UF" ? Math.round(f.monto * 40000) : f.monto;
    const nuevo = diferenciaDias(f.vigenteDesde, mesDe(mes)) <= 31;
    fijoPorCategoria.set(f.categoriaId, { monto: (previo?.monto ?? 0) + monto, conHolgura: (previo?.conHolgura ?? false) || f.moneda === "UF" || nuevo });
  }
  // Cuotas preasignadas del mes (R26)
  const { data: cuotas } = await db.schema("fin").from("cuota_deuda").select("sobre_id, monto_clp").eq("mes_facturacion", mesDe(mes));
  const cuotasPorSobre = new Map<string, number>();
  for (const c of cuotas ?? []) if (c.sobre_id) cuotasPorSobre.set(c.sobre_id, (cuotasPorSobre.get(c.sobre_id) ?? 0) + Number(c.monto_clp));
  // Saldo actual de cada fondo (suma de sus sobres en todos los meses)
  const { data: saldosFondo } = await db.schema("plan").from("v_sobre").select("fondo_id, saldo").not("fondo_id", "is", null);
  const saldoFondo = new Map<string, number>();
  for (const s of saldosFondo ?? []) if (s.fondo_id) saldoFondo.set(s.fondo_id, (saldoFondo.get(s.fondo_id) ?? 0) + Number(s.saldo ?? 0));
  const { data: emer } = await db.schema("plan").from("v_sobre").select("saldo").eq("tipo", "emergencia");
  const saldoEmergencia = (emer ?? []).reduce((s, x) => s + Math.max(0, Number(x.saldo ?? 0)), 0);
  const esencialesMensuales = [...promedios.entries()].reduce((s, [cat, monto]) => {
    const sobre = sobres.find((x) => x.categoriaId === cat);
    return s + (sobre?.bloque === "ESENCIALES" ? monto : 0);
  }, 0) || [...fijoPorCategoria.values()].reduce((s, f) => s + f.monto, 0);

  const adultos = personas.filter((x) => !x.esMenor && ["ORG", "CAD", "ING"].includes(x.rol));
  const sinCulpa = sinCulpaPorAdulto(
    p.modalidad_sin_culpa,
    ingresoBase,
    p.pct_sin_culpa,
    adultos.map((a) => ({ id: a.id, ingreso: esperados.filter((i) => i.integranteId === a.id && i.esBase).reduce((s, i) => s + i.monto, 0) })),
    p.monto_sin_culpa_clp,
  );

  const sobresPlan: SobrePlan[] = sobres
    .filter((s) => !["por_asignar", "proximo_mes", "cuota"].includes(s.tipo))
    .map((s) => {
      const fondo = s.fondoId ? fondosHogar.find((f) => f.id === s.fondoId) : null;
      const tarjeta = s.cuentaId ? tarjetasHogar.find((t) => t.id === s.cuentaId) : null;
      const base: SobrePlan = {
        id: s.id,
        nombre: s.nombre,
        tipo: s.tipo as SobrePlan["tipo"],
        bloque: s.bloque,
        cuatroParedes: s.cuatroParedes,
        integranteId: s.integranteId,
        fijo: s.categoriaId ? (fijoPorCategoria.get(s.categoriaId) ?? null) : null,
        promedio: s.categoriaId ? (promedios.get(s.categoriaId) ?? null) : null,
        cuotasDelMes: cuotasPorSobre.get(s.id) ?? 0,
      };
      if (fondo) {
        const meses = fondo.fechaObjetivo ? Math.max(0, Math.round(diferenciaDias(mesDe(mes), mesDe(fondo.fechaObjetivo)) / 30.4) + 1) : 12;
        base.fondo = { objetivo: fondo.objetivo, saldo: saldoFondo.get(fondo.id) ?? 0, mesesRestantes: meses };
      }
      // R44: la deuda de la tarjeta que aún no está apartada
      if (tarjeta) base.deudaPorCubrir = Math.max(0, tarjeta.deuda - Math.max(0, tarjeta.apartado));
      return base;
    });
  const borrador = generarBorrador({
    ingresoBase,
    etapa,
    sobres: sobresPlan,
    holguraPct: p.holgura_fijos_pct,
    sinCulpaPorAdulto: sinCulpa,
    esencialesMensuales,
    saldoEmergencia,
  });
  return { sobres, sobresPlan, ingresoBase, etapa, borrador };
}

export async function guardarBorrador(db: Cliente, mes: string, ingreso: number, lineas: Borrador["lineas"], motivo?: string) {
  const args = {
    p_mes: mesDe(mes),
    p_ingreso: ingreso,
    p_lineas: lineas.map((l) => ({
      sobre_id: l.sobreId, monto: l.monto, regla_codigo: l.regla, explicacion: l.explicacion,
      holgura_pct: l.holguraPct ?? null, aporte_calculado: l.aporte ?? null,
    })) as never,
    p_generado_por: "sistema" as const,
    ...(motivo ? { p_motivo: motivo } : {}),
  };
  const { data, error } = await db.schema("app").rpc("guardar_borrador_plan", args);
  return { error, id: data as string | null };
}

export async function actualizarLinea(db: Cliente, presupuestoId: string, sobreId: string, monto: number): Resultado {
  const { error } = await db.schema("app").rpc("actualizar_linea_plan", { p_presupuesto: presupuestoId, p_sobre: sobreId, p_monto: monto });
  return { error };
}

export async function enviarPlan(db: Cliente, presupuestoId: string) {
  const { data, error } = await db.schema("app").rpc("enviar_plan", { p_presupuesto: presupuestoId });
  return { error, solicitudId: data as string | null };
}

/** Mes que se planifica ahora: desde el día del plan (25) se prepara el siguiente. */
export function mesAPlanificar(hoy: string, diaPlan: number, mesPrimerPlan: string): string {
  const actual = mesDe(hoy);
  const dia = Number(hoy.slice(8, 10));
  const candidato = dia >= Math.min(diaPlan, diasDelMes(hoy)) ? sumarMeses(actual, 1) : actual;
  return candidato < mesPrimerPlan ? mesPrimerPlan : candidato;
}
