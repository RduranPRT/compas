import { PARAMETROS_POR_DEFECTO, type ParametrosAcuerdo } from "@compas/dominio";
import type { Cliente } from "./cliente";

export async function nombreHogar(db: Cliente): Promise<string | null> {
  const { data } = await db.schema("gob").from("hogar").select("nombre").maybeSingle();
  return data?.nombre ?? null;
}

// Solicitud de firma del Acuerdo aún pendiente: a quién y si el Acuerdo ya rige (urgente).
export async function firmaPendienteDelAcuerdo(db: Cliente): Promise<{ nombre: string; vigente: boolean } | null> {
  const { data } = await db
    .schema("gob")
    .from("solicitud_aprobacion")
    .select("objeto_id, aprobador:integrante!aprobador_id(nombre)")
    .eq("tipo", "acuerdo")
    .eq("estado", "pendiente")
    .maybeSingle();
  const nombre = data?.aprobador?.nombre;
  if (!data || !nombre) return null;
  const { data: acuerdo } = await db
    .schema("gob")
    .from("acuerdo_hogar")
    .select("estado")
    .eq("id", data.objeto_id)
    .maybeSingle();
  return { nombre, vigente: acuerdo?.estado === "vigente" };
}

export interface Hogar {
  id: string;
  nombre: string;
  etapa: string;
  eliminadoEn: string | null;
}

export async function hogar(db: Cliente): Promise<Hogar | null> {
  const { data } = await db.schema("gob").from("hogar").select("id, nombre, etapa_codigo, eliminado_en").maybeSingle();
  return data ? { id: data.id, nombre: data.nombre, etapa: data.etapa_codigo, eliminadoEn: data.eliminado_en } : null;
}

/** Parámetros del Acuerdo vigente; lo que falte toma el valor por defecto de la spec 001. */
export async function parametros(db: Cliente): Promise<ParametrosAcuerdo> {
  const { data } = await db
    .schema("gob")
    .from("regla_hogar")
    .select("codigo, valor, acuerdo:acuerdo_hogar!inner(estado)")
    .eq("acuerdo.estado", "vigente");
  const p: Record<string, unknown> = { ...PARAMETROS_POR_DEFECTO };
  for (const r of data ?? []) p[r.codigo] = r.valor;
  return p as ParametrosAcuerdo;
}

export interface Persona {
  id: string;
  nombre: string;
  rol: "ORG" | "CAD" | "ING" | "MEN" | "ASE";
  esMenor: boolean;
  tieneCuenta: boolean;
  horasMes: number | null;
}

export async function integrantes(db: Cliente): Promise<Persona[]> {
  const { data } = await db
    .schema("gob")
    .from("integrante")
    .select("id, nombre, rol, es_menor, usuario_auth_id, horas_mes")
    .eq("activo", true)
    .order("rol")
    .order("nombre");
  return (data ?? []).map((i) => ({
    id: i.id,
    nombre: i.nombre,
    rol: i.rol,
    esMenor: i.es_menor,
    tieneCuenta: i.usuario_auth_id !== null,
    horasMes: i.horas_mes,
  }));
}
