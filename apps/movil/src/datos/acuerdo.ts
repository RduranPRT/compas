import type { Json } from "@compas/contratos";
import { PARAMETROS_POR_DEFECTO, parametrosAFilas } from "@compas/dominio";
import type { Cliente, Resultado } from "./cliente";
import { integranteActual, type IntegranteActual } from "./integrante";

// RPC de la migración 0005 (spec 001). La base valida rol y JWT.

export async function proponerAcuerdoV1(db: Cliente, { urgente }: { urgente: boolean }): Resultado {
  const { error } = await db.schema("app").rpc("proponer_acuerdo", {
    // Filas de valores JSON (validadas por el esquema zod); se tipan como Json para la RPC.
    p_reglas: parametrosAFilas(PARAMETROS_POR_DEFECTO) as unknown as Json,
    p_urgente: urgente,
  });
  return { error };
}

export interface PendienteDeFirma {
  acuerdo: string;
  solicitud: string;
}

export interface EstadoPantallaAcuerdo {
  yo: IntegranteActual | null;
  /** "firmar" si hay una solicitud del Acuerdo dirigida a mí, sin importar mi rol (E1). */
  modo: "proponer" | "firmar";
  pendiente: PendienteDeFirma | null;
  /** El otro administrador: firma lo que yo propongo, o propuso lo que yo firmo. */
  otro: { nombre: string; tieneCuenta: boolean } | null;
}

export async function pantallaAcuerdo(db: Cliente): Promise<EstadoPantallaAcuerdo> {
  const yo = await integranteActual(db);
  if (!yo) return { yo, modo: "proponer", pendiente: null, otro: null };
  const { data: solicitud } = await db
    .schema("gob")
    .from("solicitud_aprobacion")
    .select("id, objeto_id")
    .eq("tipo", "acuerdo")
    .eq("estado", "pendiente")
    .eq("aprobador_id", yo.id)
    .maybeSingle();
  const { data: otro } = await db
    .schema("gob")
    .from("integrante")
    .select("nombre, usuario_auth_id")
    .in("rol", ["ORG", "CAD"])
    .eq("activo", true)
    .neq("id", yo.id)
    .order("rol")
    .limit(1)
    .maybeSingle();
  return {
    yo,
    modo: solicitud ? "firmar" : "proponer",
    pendiente: solicitud ? { acuerdo: solicitud.objeto_id, solicitud: solicitud.id } : null,
    otro: otro ? { nombre: otro.nombre, tieneCuenta: otro.usuario_auth_id !== null } : null,
  };
}

export async function firmarAcuerdo(
  db: Cliente,
  pendiente: PendienteDeFirma,
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
