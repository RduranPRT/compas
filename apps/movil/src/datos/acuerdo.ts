import type { Json } from "@compas/contratos";
import { PARAMETROS_POR_DEFECTO, parametrosAFilas } from "@compas/dominio";
import type { Cliente, Resultado } from "./cliente";

// RPC de la migración 0005 (spec 001). La base valida rol y JWT.

export async function proponerAcuerdoV1(db: Cliente, { urgente }: { urgente: boolean }): Resultado {
  const { error } = await db.schema("app").rpc("proponer_acuerdo", {
    // Filas de valores JSON (validadas por el esquema zod); se tipan como Json para la RPC.
    p_reglas: parametrosAFilas(PARAMETROS_POR_DEFECTO) as unknown as Json,
    p_urgente: urgente,
  });
  return { error };
}

export async function acuerdoPendienteDeFirma(db: Cliente): Promise<{ acuerdo: string; solicitud: string } | null> {
  const { data } = await db
    .schema("gob")
    .from("solicitud_aprobacion")
    .select("id, objeto_id")
    .eq("tipo", "acuerdo")
    .eq("estado", "pendiente")
    .maybeSingle();
  return data ? { acuerdo: data.objeto_id, solicitud: data.id } : null;
}

export async function firmarAcuerdo(
  db: Cliente,
  pendiente: { acuerdo: string; solicitud: string },
  integranteId: string,
): Resultado {
  const firma = await db
    .schema("gob")
    .from("firma")
    .insert({ solicitud_id: pendiente.solicitud, integrante_id: integranteId, decision: "aprueba" });
  if (firma.error) return { error: firma.error };
  const { error } = await db.schema("app").rpc("activar_acuerdo", { p_acuerdo: pendiente.acuerdo });
  return { error };
}

// El CAD invitado existe como integrante desde la invitación; sin usuario_auth_id hasta que ingresa.
export async function coAdministrador(db: Cliente): Promise<{ nombre: string; tieneCuenta: boolean } | null> {
  const { data } = await db
    .schema("gob")
    .from("integrante")
    .select("nombre, usuario_auth_id")
    .eq("rol", "CAD")
    .eq("activo", true)
    .maybeSingle();
  return data ? { nombre: data.nombre, tieneCuenta: data.usuario_auth_id !== null } : null;
}
