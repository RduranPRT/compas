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
