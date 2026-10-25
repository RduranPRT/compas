import { PARAMETROS_POR_DEFECTO, parametrosAFilas } from "@compas/dominio";
import { supabase } from "../lib/supabase";

// RPC de la migración 0005 (spec 001). La base valida rol y JWT.

export async function proponerAcuerdoV1({ urgente }: { urgente: boolean }) {
  const { error } = await supabase
    .schema("app")
    .rpc("proponer_acuerdo", { p_reglas: parametrosAFilas(PARAMETROS_POR_DEFECTO), p_urgente: urgente });
  return { error };
}

export async function acuerdoPendienteDeFirma(): Promise<{ acuerdo: string; solicitud: string } | null> {
  const { data } = await supabase
    .schema("gob")
    .from("solicitud_aprobacion")
    .select("id, objeto_id")
    .eq("tipo", "acuerdo")
    .eq("estado", "pendiente")
    .maybeSingle();
  return data ? { acuerdo: data.objeto_id as string, solicitud: data.id as string } : null;
}

export async function firmarAcuerdo(pendiente: { acuerdo: string; solicitud: string }, integranteId: string) {
  const firma = await supabase
    .schema("gob")
    .from("firma")
    .insert({ solicitud_id: pendiente.solicitud, integrante_id: integranteId, decision: "aprueba" });
  if (firma.error) return { error: firma.error };
  const { error } = await supabase.schema("app").rpc("activar_acuerdo", { p_acuerdo: pendiente.acuerdo });
  return { error };
}

// El CAD invitado existe como integrante desde la invitación; sin usuario_auth_id hasta que ingresa.
export async function coAdministrador(): Promise<{ nombre: string; tieneCuenta: boolean } | null> {
  const { data } = await supabase
    .schema("gob")
    .from("integrante")
    .select("nombre, usuario_auth_id")
    .eq("rol", "CAD")
    .eq("activo", true)
    .maybeSingle();
  return data ? { nombre: data.nombre as string, tieneCuenta: data.usuario_auth_id !== null } : null;
}
