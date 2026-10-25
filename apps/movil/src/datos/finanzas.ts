import { mesDe } from "@compas/dominio";
import type { Cliente, Resultado } from "./cliente";
import { nuevoId } from "./cliente";

// Specs 005, 007 y 008: sobres del mes, movimientos, captura, bandeja, ingresos, reparto y tarjetas.

export interface Sobre {
  id: string;
  periodoId: string;
  mes: string;
  tipo: string;
  nombre: string;
  bloque: "ESENCIALES" | "FUTURO" | "VIDA" | null;
  categoriaId: string | null;
  integranteId: string | null;
  fondoId: string | null;
  cuentaId: string | null;
  cuatroParedes: boolean;
  cerrado: boolean;
  intencion: string | null;
  disponible: number;
  gastado: number;
  saldo: number;
}

/** Abre el mes con sus sobres (idempotente) y los devuelve. */
export async function sobresDelMes(db: Cliente, fecha: string): Promise<Sobre[]> {
  const mes = mesDe(fecha);
  await db.schema("app").rpc("asegurar_mes", { p_mes: mes });
  const { data, error } = await db.schema("plan").from("v_sobre").select("*").eq("mes", mes).order("nombre");
  if (error) throw new Error(error.message);
  return (data ?? []).map((s) => ({
    id: s.id!,
    periodoId: s.periodo_id!,
    mes: s.mes!,
    tipo: s.tipo!,
    nombre: s.nombre ?? "",
    bloque: (s.bloque_codigo ?? null) as Sobre["bloque"],
    categoriaId: s.categoria_id,
    integranteId: s.integrante_id,
    fondoId: s.fondo_id,
    cuentaId: s.cuenta_id,
    cuatroParedes: !!s.es_cuatro_paredes,
    cerrado: !!s.cerrado,
    intencion: s.intencion_default,
    disponible: Number(s.disponible ?? 0),
    gastado: Number(s.gastado ?? 0),
    saldo: Number(s.saldo ?? 0),
  }));
}

/** Sobres que reciben gastos (no Por asignar, Próximo mes ni pago de tarjeta). */
export function sobresDeGasto(sobres: Sobre[]): Sobre[] {
  return sobres.filter((s) => !["por_asignar", "proximo_mes", "pago_tarjeta", "cuota"].includes(s.tipo));
}

export interface Movimiento {
  id: string;
  fecha: string;
  tipo: string;
  estado: string;
  origen: string;
  monto: number;
  comercio: string | null;
  nota: string | null;
  cuentaId: string;
  cuenta: string;
  tipoCuenta: string;
  sobreId: string | null;
  sobre: string | null;
  intencion: string | null;
  confianza: number | null;
  nCuotas: number | null;
  categoriaSugeridaId?: string | null;
}

function aMovimiento(m: Record<string, unknown>): Movimiento {
  return {
    id: m.id as string,
    fecha: m.fecha_contable as string,
    tipo: m.tipo as string,
    estado: m.estado as string,
    origen: m.origen as string,
    monto: Number(m.monto_clp),
    comercio: (m.comercio as string | null) ?? null,
    nota: (m.nota as string | null) ?? null,
    cuentaId: m.cuenta_id as string,
    cuenta: (m.cuenta as string) ?? "",
    tipoCuenta: (m.tipo_cuenta as string) ?? "",
    sobreId: (m.sobre_id as string | null) ?? null,
    sobre: (m.sobre as string | null) ?? null,
    intencion: (m.intencion as string | null) ?? null,
    confianza: m.confianza_ia === null || m.confianza_ia === undefined ? null : Number(m.confianza_ia),
    nCuotas: (m.n_cuotas as number | null) ?? null,
  };
}

export async function movimientosDelMes(db: Cliente, fecha: string): Promise<Movimiento[]> {
  const mes = mesDe(fecha);
  const { data: periodo } = await db.schema("plan").from("periodo").select("id").eq("mes", mes).maybeSingle();
  if (!periodo) return [];
  const { data, error } = await db
    .schema("fin")
    .from("v_movimiento")
    .select("*")
    .eq("periodo_id", periodo.id)
    .neq("estado", "descartado")
    .order("fecha_contable", { ascending: false })
    .order("creado_en", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((m) => aMovimiento(m as Record<string, unknown>));
}

export async function movimientosDeSobre(db: Cliente, sobreId: string): Promise<Movimiento[]> {
  const { data: imps } = await db.schema("fin").from("imputacion").select("movimiento_id").eq("sobre_id", sobreId);
  const ids = (imps ?? []).map((i) => i.movimiento_id);
  if (!ids.length) return [];
  const { data } = await db.schema("fin").from("v_movimiento").select("*").in("id", ids).neq("estado", "descartado")
    .order("fecha_contable", { ascending: false });
  return (data ?? []).map((m) => aMovimiento(m as Record<string, unknown>));
}

export interface Pendientes {
  movimientos: (Movimiento & { categoriaSugeridaId: string | null })[];
  duplicados: { id: string; a: Movimiento; b: Movimiento }[];
}

export async function bandeja(db: Cliente): Promise<Pendientes> {
  const [{ data: movs }, { data: dups }] = await Promise.all([
    db.schema("fin").from("movimiento").select("id, categoria_sugerida_id").eq("estado", "por_confirmar").neq("tipo", "transferencia"),
    db.schema("fin").from("duplicado_candidato").select("id, movimiento_a_id, movimiento_b_id").eq("estado", "abierto"),
  ]);
  const ids = [...new Set([...(movs ?? []).map((m) => m.id), ...(dups ?? []).flatMap((d) => [d.movimiento_a_id, d.movimiento_b_id])])];
  if (!ids.length) return { movimientos: [], duplicados: [] };
  const { data } = await db.schema("fin").from("v_movimiento").select("*").in("id", ids).order("creado_en");
  const porId = new Map((data ?? []).map((m) => [m.id as string, aMovimiento(m as Record<string, unknown>)]));
  const sugerida = new Map((movs ?? []).map((m) => [m.id, m.categoria_sugerida_id]));
  return {
    movimientos: (movs ?? [])
      .map((m) => porId.get(m.id))
      .filter((m): m is Movimiento => !!m)
      .sort((a, b) => a.fecha.localeCompare(b.fecha))
      .map((m) => ({ ...m, categoriaSugeridaId: sugerida.get(m.id) ?? null })),
    duplicados: (dups ?? [])
      .map((d) => ({ id: d.id, a: porId.get(d.movimiento_a_id), b: porId.get(d.movimiento_b_id) }))
      .filter((d): d is { id: string; a: Movimiento; b: Movimiento } => !!d.a && !!d.b),
  };
}

export async function contarPendientes(db: Cliente): Promise<number> {
  const { count } = await db.schema("fin").from("movimiento").select("id", { count: "exact", head: true })
    .eq("estado", "por_confirmar").neq("tipo", "transferencia");
  const { count: dups } = await db.schema("fin").from("duplicado_candidato").select("id", { count: "exact", head: true })
    .eq("estado", "abierto");
  return (count ?? 0) + (dups ?? 0);
}

export interface Gasto {
  clienteOp?: string;
  cuentaId: string;
  sobreId: string;
  monto: number;
  fecha: string;
  comercio?: string | null;
  nota?: string | null;
  intencion?: string | null;
  nCuotas?: number;
  tratamiento?: "por_cuota" | "total" | null;
  origen?: "manual" | "chat";
  confianza?: number | null;
}

export interface RespuestaGasto {
  movimiento_id: string;
  estado: string;
  duplicado?: boolean;
  repetida?: boolean;
}

export async function registrarGasto(db: Cliente, g: Gasto): Promise<{ error: { message: string } | null; data: RespuestaGasto | null }> {
  const args: Record<string, unknown> = {
    p_cliente_op: g.clienteOp ?? nuevoId(),
    p_cuenta: g.cuentaId,
    p_sobre: g.sobreId,
    p_monto: g.monto,
    p_fecha: g.fecha,
    p_n_cuotas: g.nCuotas ?? 1,
    p_origen: g.origen ?? "manual",
  };
  if (g.comercio) args.p_comercio = g.comercio;
  if (g.nota) args.p_nota = g.nota;
  if (g.intencion) args.p_intencion = g.intencion;
  if (g.tratamiento) args.p_tratamiento = g.tratamiento;
  if (g.confianza !== null && g.confianza !== undefined) args.p_confianza = g.confianza;
  const { data, error } = await db.schema("app").rpc("registrar_gasto", args as never);
  return { error, data: (data as unknown as RespuestaGasto) ?? null };
}

export interface NuevoIngreso {
  clienteOp?: string;
  cuentaId: string;
  monto: number;
  fecha: string;
  integranteId: string;
  tipo: "sueldo" | "honorarios_liquido" | "bono" | "gratificacion" | "reajuste" | "otro";
  esVariable: boolean;
  paraMesSiguiente: boolean;
  descripcion?: string;
}

export async function registrarIngreso(db: Cliente, i: NuevoIngreso) {
  const { data, error } = await db.schema("app").rpc("registrar_ingreso", {
    p_cliente_op: i.clienteOp ?? nuevoId(),
    p_cuenta: i.cuentaId,
    p_monto: i.monto,
    p_fecha: i.fecha,
    p_integrante: i.integranteId,
    p_tipo_ingreso: i.tipo,
    p_es_variable: i.esVariable,
    p_para_mes_siguiente: i.paraMesSiguiente,
    p_descripcion: i.descripcion ?? "",
  });
  return { error, data: data as unknown as { movimiento_id: string; diferencia_pct: number | null; ajuste_sugerido: boolean } | null };
}

export async function registrarReembolso(db: Cliente, originalId: string, monto: number, fecha: string): Resultado {
  const { error } = await db.schema("app").rpc("registrar_reembolso", {
    p_cliente_op: nuevoId(), p_original: originalId, p_monto: monto, p_fecha: fecha,
  });
  return { error };
}

export async function registrarPagoTarjeta(db: Cliente, origenId: string, tarjetaId: string, monto: number, fecha: string): Resultado {
  const { error } = await db.schema("app").rpc("registrar_pago_tarjeta", {
    p_cliente_op: nuevoId(), p_origen: origenId, p_tarjeta: tarjetaId, p_monto: monto, p_fecha: fecha,
  });
  return { error };
}

export async function confirmarMovimiento(db: Cliente, id: string, sobreId?: string | null): Resultado {
  const args: { p_mov: string; p_sobre?: string } = { p_mov: id };
  if (sobreId) args.p_sobre = sobreId;
  const { error } = await db.schema("app").rpc("confirmar_movimiento", args);
  return { error };
}

export async function descartarMovimiento(db: Cliente, id: string): Resultado {
  const { error } = await db.schema("app").rpc("descartar_movimiento", { p_mov: id });
  return { error };
}

export async function resolverDuplicado(db: Cliente, id: string, esDuplicado: boolean): Resultado {
  const { error } = await db.schema("app").rpc("resolver_duplicado", { p_dup: id, p_es_duplicado: esDuplicado });
  return { error };
}

export interface Tarjeta {
  id: string;
  nombre: string;
  ultimos4: string | null;
  diaFacturacion: number;
  diaPago: number;
  cupo: number | null;
  deuda: number;
  apartado: number;
}

export async function tarjetas(db: Cliente): Promise<Tarjeta[]> {
  const { data } = await db.schema("fin").from("v_tarjeta").select("*").eq("activa", true).order("nombre");
  return (data ?? []).map((t) => ({
    id: t.cuenta_id!,
    nombre: t.nombre ?? "",
    ultimos4: t.ultimos4,
    diaFacturacion: t.dia_facturacion ?? 1,
    diaPago: t.dia_pago ?? 1,
    cupo: t.cupo === null ? null : Number(t.cupo),
    deuda: Number(t.deuda ?? 0),
    apartado: Number(t.apartado ?? 0),
  }));
}

export async function comprasDeTarjeta(db: Cliente, tarjetaId: string, desde: string, hasta: string): Promise<Movimiento[]> {
  const { data } = await db.schema("fin").from("v_movimiento").select("*").eq("cuenta_id", tarjetaId)
    .gte("fecha_contable", desde).lte("fecha_contable", hasta).in("tipo", ["gasto", "reembolso"]).neq("estado", "descartado")
    .order("fecha_contable", { ascending: false });
  return (data ?? []).map((m) => aMovimiento(m as Record<string, unknown>));
}

export async function conciliarCuenta(db: Cliente, cuentaId: string, tipo: "semanal" | "mensual", fechaCorte: string, saldoReal: number, motivo?: string) {
  const { data, error } = await db.schema("app").rpc("conciliar_cuenta", {
    p_cuenta: cuentaId, p_tipo: tipo, p_fecha_corte: fechaCorte, p_saldo_real: saldoReal, p_motivo: motivo ?? "",
  });
  return { error, data: data as unknown as { saldo_registrado: number; diferencia: number } | null };
}

export interface IngresoPorRepartir {
  id: string;
  mes: string;
  fecha: string;
  monto: number;
  porRepartir: number;
  descripcion: string | null;
  esVariable: boolean;
  cuentaId: string;
}

export async function ingresosPorRepartir(db: Cliente): Promise<IngresoPorRepartir[]> {
  const { data } = await db.schema("plan").from("v_ingreso_por_repartir").select("*").gt("por_repartir", 0).order("fecha_contable");
  return (data ?? []).map((i) => ({
    id: i.ingreso_id!,
    mes: i.mes!,
    fecha: i.fecha_contable!,
    monto: Number(i.monto_clp),
    porRepartir: Number(i.por_repartir),
    descripcion: i.comercio,
    esVariable: !!i.es_variable,
    cuentaId: i.cuenta_id!,
  }));
}

export async function confirmarDistribucion(db: Cliente, ingresoId: string, asignaciones: { sobreId: string; monto: number }[]) {
  const { data, error } = await db.schema("app").rpc("confirmar_distribucion", {
    p_ingreso: ingresoId,
    p_asignaciones: asignaciones.filter((a) => a.monto > 0).map((a) => ({ sobre_id: a.sobreId, monto: a.monto })),
  });
  return { error, data: data as unknown as { asignado: number; pendiente: number; transferencias: number } | null };
}

export interface TransferenciaPendiente {
  id: string;
  tipo: string;
  monto: number;
  origen: string;
  destino: string | null;
  sobre: string | null;
  vence: string | null;
}

export async function transferenciasPendientes(db: Cliente): Promise<TransferenciaPendiente[]> {
  const { data } = await db.schema("fin").from("v_transferencia_pendiente").select("*").order("fecha");
  return (data ?? []).map((t) => ({
    id: t.id!,
    tipo: t.tipo!,
    monto: Number(t.monto_clp),
    origen: t.cuenta_origen ?? "",
    destino: t.cuenta_destino,
    sobre: t.sobre,
    vence: t.vence_en,
  }));
}

export async function marcarTransferencia(db: Cliente, id: string, hecha: boolean): Resultado {
  const { error } = await db.schema("app").rpc("marcar_transferencia", { p_transferencia: id, p_hecha: hecha });
  return { error };
}

export async function pronosticoMes(db: Cliente, fecha: string): Promise<number | null> {
  const { data } = await db.schema("app").rpc("pronostico_mes", { p_mes: mesDe(fecha) });
  return data === null || data === undefined ? null : Number(data);
}
