import { calcularKpis, mesDe, sumarMeses, type Etapa, type Kpi } from "@compas/dominio";
import type { Cliente, Resultado } from "./cliente";

// Spec 010: cierres semanal y mensual, valoración Kakeibo (R19), KPI e indicadores.

export async function cerrarSemana(db: Cliente, fechaCorte: string, saldos: { cuentaId: string; saldoReal: number; motivo?: string }[]) {
  const { data, error } = await db.schema("app").rpc("cerrar_semana", {
    p_fecha_corte: fechaCorte,
    p_saldos: saldos.map((s) => ({ cuenta_id: s.cuentaId, saldo_real: s.saldoReal, motivo: s.motivo ?? null })) as never,
  });
  return { error, data: data as unknown as { conciliados: number; diferencia_total: number } | null };
}

export async function ultimoCierreSemanal(db: Cliente): Promise<string | null> {
  const { data } = await db.schema("med").from("cierre").select("fecha_programada").eq("tipo", "semanal").eq("estado", "hecho")
    .order("fecha_programada", { ascending: false }).limit(1).maybeSingle();
  return data?.fecha_programada ?? null;
}

export interface Periodo {
  id: string;
  mes: string;
  estado: string;
  versionCierre: number;
}

export async function periodos(db: Cliente): Promise<Periodo[]> {
  const { data } = await db.schema("plan").from("periodo").select("id, mes, estado, version_cierre").order("mes", { ascending: false });
  return (data ?? []).map((p) => ({ id: p.id, mes: p.mes, estado: p.estado, versionCierre: p.version_cierre }));
}

export async function iniciarCierreMes(db: Cliente, periodoId: string) {
  const { data, error } = await db.schema("app").rpc("iniciar_cierre_mes", { p_periodo: periodoId });
  return { error, cierreId: data as string | null };
}

export async function valorar(db: Cliente, cierreId: string, categoriaId: string | null, valoracion: "+" | "0" | "-" | null, pregunta?: string, respuesta?: string): Resultado {
  const args: Record<string, unknown> = { p_cierre: cierreId };
  if (categoriaId) args.p_categoria = categoriaId;
  if (valoracion) args.p_valoracion = valoracion;
  if (pregunta) args.p_pregunta = pregunta;
  if (respuesta) args.p_respuesta = respuesta;
  const { error } = await db.schema("app").rpc("valorar", args as never);
  return { error };
}

export async function cerrarMes(db: Cliente, periodoId: string, kpis: Kpi[], resumen: string | null, justificacion?: string) {
  const args: Record<string, unknown> = {
    p_periodo: periodoId,
    p_kpis: kpis.map((k) => ({ codigo: k.codigo, valor: k.valor, semaforo: k.semaforo })),
  };
  if (resumen) args.p_resumen = resumen;
  if (justificacion) args.p_justificacion = justificacion;
  const { data, error } = await db.schema("app").rpc("cerrar_mes", args as never);
  return { error, data };
}

export async function reabrirMes(db: Cliente, periodoId: string, motivo: string): Resultado {
  const { error } = await db.schema("app").rpc("reabrir_periodo", { p_periodo: periodoId, p_motivo: motivo });
  return { error };
}

export interface GastoCategoria {
  categoriaId: string;
  nombre: string;
  bloque: string | null;
  gastado: number;
}

/** Datos del mes para KPI y valoración: ingresos, gastos por categoría y bloque, aportes y cobertura. */
export async function resumenDelMes(db: Cliente, mes: string, etapa: Etapa) {
  const inicio = mesDe(mes);
  const fin = sumarMeses(inicio, 1);
  const { data: periodo } = await db.schema("plan").from("periodo").select("id").eq("mes", inicio).maybeSingle();
  const [{ data: movs }, { data: sobres }, { data: cuotas }, { data: emer }] = await Promise.all([
    db.schema("fin").from("v_movimiento").select("tipo, estado, origen, monto_clp, categoria_id, sobre, bloque_codigo, importacion_id")
      .eq("periodo_id", periodo?.id ?? "00000000-0000-0000-0000-000000000000").neq("estado", "descartado"),
    db.schema("plan").from("v_sobre").select("tipo, disponible, categoria_id, bloque_codigo").eq("mes", inicio),
    db.schema("fin").from("cuota_deuda").select("monto_clp").eq("mes_facturacion", inicio),
    db.schema("plan").from("v_sobre").select("saldo").eq("tipo", "emergencia").lt("mes", fin),
  ]);
  const ms = movs ?? [];
  const ingresos = ms.filter((m) => m.tipo === "ingreso").reduce((s, m) => s + Number(m.monto_clp), 0);
  const gastosMov = ms.filter((m) => m.tipo === "gasto");
  const reembolsos = ms.filter((m) => m.tipo === "reembolso").reduce((s, m) => s + Number(m.monto_clp), 0);
  const gastos = gastosMov.reduce((s, m) => s + Number(m.monto_clp), 0) - reembolsos;
  const porCategoria = new Map<string, GastoCategoria>();
  for (const m of gastosMov) {
    if (!m.categoria_id) continue;
    const previo = porCategoria.get(m.categoria_id);
    porCategoria.set(m.categoria_id, {
      categoriaId: m.categoria_id,
      nombre: m.sobre ?? "",
      bloque: m.bloque_codigo,
      gastado: (previo?.gastado ?? 0) + Number(m.monto_clp),
    });
  }
  const gastoEsenciales = [...porCategoria.values()].filter((c) => c.bloque === "ESENCIALES").reduce((s, c) => s + c.gastado, 0);
  const aFuturo = (sobres ?? []).filter((s) => s.tipo === "futuro" || s.tipo === "emergencia").reduce((s, x) => s + Math.max(0, Number(x.disponible ?? 0)), 0);
  const servicioDeuda = (cuotas ?? []).reduce((s, c) => s + Number(c.monto_clp), 0)
    + ms.filter((m) => m.tipo === "gasto" && /comisi|inter/i.test(m.sobre ?? "")).reduce((s, m) => s + Number(m.monto_clp), 0);
  const deCartola = ms.filter((m) => m.importacion_id && m.tipo !== "transferencia").length;
  const capturados = ms.filter((m) => m.origen === "manual" || m.origen === "chat").length;
  const kpis = calcularKpis({
    ingresos, gastos, gastoEsenciales, aFuturo, servicioDeuda,
    saldoEmergencia: (emer ?? []).reduce((s, x) => s + Math.max(0, Number(x.saldo ?? 0)), 0),
    esencialesMensuales: gastoEsenciales,
    capturados, deCartola: Math.max(deCartola, 0), etapa,
  });
  const pendientes = ms.filter((m) => m.estado === "por_confirmar" || m.estado === "capturado").length;
  return { ingresos, gastos, porCategoria: [...porCategoria.values()].sort((a, b) => b.gastado - a.gastado), kpis, pendientes };
}

export interface Medicion {
  mes: string;
  codigo: string;
  valor: number;
  semaforo: string | null;
  version: number;
}

export async function mediciones(db: Cliente): Promise<Medicion[]> {
  const [{ data }, { data: pers }] = await Promise.all([
    db.schema("med").from("medicion_kpi").select("periodo_id, kpi_codigo, valor, semaforo, version_cierre").order("calculado_en"),
    db.schema("plan").from("periodo").select("id, mes"),
  ]);
  const mesDePeriodo = new Map((pers ?? []).map((p) => [p.id, p.mes]));
  // Por mes y KPI, la última versión del cierre (D20)
  const ultima = new Map<string, Medicion>();
  for (const m of data ?? []) {
    const mes = mesDePeriodo.get(m.periodo_id) ?? "";
    const clave = `${mes}|${m.kpi_codigo}`;
    const previa = ultima.get(clave);
    if (!previa || previa.version <= m.version_cierre) {
      ultima.set(clave, { mes, codigo: m.kpi_codigo, valor: Number(m.valor), semaforo: m.semaforo, version: m.version_cierre });
    }
  }
  return [...ultima.values()].sort((a, b) => a.mes.localeCompare(b.mes));
}
