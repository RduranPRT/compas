import { formatoPesos, nombreMes } from "@compas/dominio";
import type { Cliente, Resultado } from "./cliente";

// Aprobaciones (R37, R39), avisos (R40, D33), reasignación N1 (R38) y etapa (R23).

export interface Solicitud {
  id: string;
  tipo: string;
  estado: string;
  aprobadorId: string | null;
  aprobador: string | null;
  solicitadaPor: string | null;
  firmasRequeridas: number;
  firmas: { integrante_id: string; decision: string; como_suplente: boolean }[];
  venceEn: string;
  escalada: boolean;
  regla: string | null;
  descripcion: string;
}

const NOMBRE_TIPO: Record<string, string> = {
  acuerdo: "Acuerdo del Hogar",
  presupuesto: "Plan del mes",
  ajuste_plan: "Ajuste del plan",
  reasignacion: "Mover dinero entre sobres",
  retiro_futuro: "Retiro de Futuro o emergencia",
  etapa: "Etapa del hogar",
  borrado_hogar: "Borrar los datos del hogar",
};

async function describir(db: Cliente, tipo: string, objetoId: string): Promise<string> {
  if (tipo === "presupuesto" || tipo === "ajuste_plan") {
    const { data } = await db.schema("plan").from("presupuesto_mensual").select("version, ingreso_proyectado, periodo:periodo(mes)").eq("id", objetoId).maybeSingle();
    if (data) return `Plan de ${nombreMes(data.periodo?.mes ?? "2026-01-01")}, versión ${data.version}: ingreso ${formatoPesos(Number(data.ingreso_proyectado))}.`;
  }
  if (tipo === "reasignacion" || tipo === "retiro_futuro") {
    const { data } = await db.schema("plan").from("reasignacion").select("monto_clp, motivo, sobre_origen_id, sobre_destino_id").eq("id", objetoId).maybeSingle();
    if (data) {
      const { data: s } = await db.schema("plan").from("v_sobre").select("id, nombre").in("id", [data.sobre_origen_id, data.sobre_destino_id]);
      const n = new Map((s ?? []).map((x) => [x.id, x.nombre]));
      return `${formatoPesos(Number(data.monto_clp))} desde ${n.get(data.sobre_origen_id) ?? "un sobre"} a ${n.get(data.sobre_destino_id) ?? "otro sobre"}${data.motivo ? `: ${data.motivo}` : ""}.`;
    }
  }
  if (tipo === "etapa") {
    const { data } = await db.schema("gob").from("historial_etapa").select("etapa_codigo, etapa_anterior, direccion").eq("id", objetoId).maybeSingle();
    if (data) return `Pasar a la etapa ${data.etapa_codigo}${data.etapa_anterior ? ` (desde ${data.etapa_anterior})` : ""}.`;
  }
  if (tipo === "acuerdo") return "Nueva versión del Acuerdo del Hogar.";
  if (tipo === "borrado_hogar") return "Borrar todos los datos del hogar a los 30 días. Se puede anular antes.";
  return "";
}

export async function solicitudesPendientes(db: Cliente): Promise<Solicitud[]> {
  const { data } = await db.schema("gob").from("v_solicitud").select("*").eq("estado", "pendiente").order("creado_en");
  const r: Solicitud[] = [];
  for (const s of data ?? []) {
    r.push({
      id: s.id!,
      tipo: s.tipo!,
      estado: s.estado!,
      aprobadorId: s.aprobador_id,
      aprobador: s.aprobador,
      solicitadaPor: s.solicitada_por,
      firmasRequeridas: s.firmas_requeridas ?? 1,
      firmas: (s.firmas as Solicitud["firmas"]) ?? [],
      venceEn: s.vence_en!,
      escalada: !!s.escalada_a_suplente,
      regla: s.regla_codigo,
      descripcion: `${NOMBRE_TIPO[s.tipo!] ?? s.tipo}. ${await describir(db, s.tipo!, s.objeto_id!)}`.trim(),
    });
  }
  return r;
}

/** ¿Puedo firmar ahora? Firma doble: cualquier administrador que no haya firmado. Simple: el aprobador o el suplente vencido el plazo. */
export function puedoFirmar(s: Solicitud, yo: string, ahora = new Date()): boolean {
  if (s.firmas.some((f) => f.integrante_id === yo)) return false;
  if (s.tipo === "acuerdo" && s.solicitadaPor === yo) return false;
  if (s.firmasRequeridas === 2 || !s.aprobadorId) return true;
  return s.aprobadorId === yo || s.escalada || new Date(s.venceEn) <= ahora;
}

export async function resolverSolicitud(db: Cliente, id: string, aprueba: boolean, comentario?: string) {
  const args: { p_solicitud: string; p_aprueba: boolean; p_comentario?: string } = { p_solicitud: id, p_aprueba: aprueba };
  if (comentario) args.p_comentario = comentario;
  const { data, error } = await db.schema("app").rpc("resolver_solicitud", args);
  return { error, estado: data as string | null };
}

export interface Aviso {
  id: string;
  tipo: string;
  severidad: "info" | "amarillo" | "rojo";
  regla: string | null;
  sobreId: string | null;
  mensaje: string;
  estado: string;
  fecha: string;
  dato: Record<string, unknown> | null;
}

export async function avisos(db: Cliente, limite = 50): Promise<Aviso[]> {
  const { data } = await db.schema("med").from("v_aviso").select("*").order("creado_en", { ascending: false }).limit(limite);
  return (data ?? []).map((a) => ({
    id: a.id!,
    tipo: a.tipo!,
    severidad: a.severidad as Aviso["severidad"],
    regla: a.regla_codigo,
    sobreId: a.sobre_id,
    mensaje: a.mensaje!,
    estado: a.estado!,
    fecha: a.fecha_local!,
    dato: (a.dato as Record<string, unknown> | null) ?? null,
  }));
}

export async function marcarAvisosLeidos(db: Cliente, ids: string[]): Resultado {
  if (!ids.length) return { error: null };
  const { error } = await db.schema("app").rpc("marcar_avisos_leidos", { p_ids: ids });
  return { error };
}

export async function reasignar(db: Cliente, origenId: string, destinoId: string, monto: number, motivo?: string) {
  const args: { p_origen: string; p_destino: string; p_monto: number; p_motivo?: string } = {
    p_origen: origenId, p_destino: destinoId, p_monto: monto,
  };
  if (motivo) args.p_motivo = motivo;
  const { data, error } = await db.schema("app").rpc("reasignar", args);
  return { error, data: data as unknown as { estado: "aplicada" | "pendiente"; solicitud_id: string | null } | null };
}

export async function proponerEtapa(db: Cliente, etapa: string, evidencia: Record<string, unknown>) {
  const { data, error } = await db.schema("app").rpc("proponer_etapa", { p_etapa: etapa, p_evidencia: evidencia as never, p_origen: "sistema" });
  return { error, solicitudId: data as string | null };
}

export async function etapaPropuesta(db: Cliente): Promise<{ etapa: string; solicitudId: string | null } | null> {
  const { data } = await db.schema("gob").from("historial_etapa").select("etapa_codigo, solicitud_id").eq("estado", "propuesta").maybeSingle();
  return data ? { etapa: data.etapa_codigo, solicitudId: data.solicitud_id } : null;
}
