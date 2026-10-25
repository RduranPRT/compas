import { supabase } from "../lib/supabase";

export async function nombreHogar(): Promise<string | null> {
  const { data } = await supabase.schema("gob").from("hogar").select("nombre").maybeSingle();
  return (data?.nombre as string | undefined) ?? null;
}

// Acuerdo activado con urgente cuya solicitud de firma sigue pendiente: nombre del aprobador.
export async function firmaPendienteDelAcuerdo(): Promise<string | null> {
  const { data } = await supabase
    .schema("gob")
    .from("solicitud_aprobacion")
    .select("aprobador:integrante!aprobador_id(nombre)")
    .eq("tipo", "acuerdo")
    .eq("estado", "pendiente")
    .maybeSingle();
  const aprobador = data?.aprobador as { nombre: string } | { nombre: string }[] | null | undefined;
  if (!aprobador) return null;
  return Array.isArray(aprobador) ? (aprobador[0]?.nombre ?? null) : aprobador.nombre;
}
