import type { FinalidadConsentimiento } from "../legal/consentimiento";
import type { Cliente, Resultado } from "./cliente";
import { integranteActual } from "./integrante";

export { integranteActual };

// RPC de la migración 0005 (spec 001). La base valida JWT y rol.

export async function crearHogar(db: Cliente, nombreHogar: string, nombre: string): Resultado {
  const { error } = await db.schema("app").rpc("crear_hogar", { p_nombre_hogar: nombreHogar, p_nombre: nombre });
  return { error };
}

export async function invitarIntegrante(db: Cliente, correo: string, nombre: string, rol: "CAD" | "ING"): Resultado {
  const { error } = await db
    .schema("app")
    .rpc("invitar_integrante", { p_correo: correo, p_nombre: nombre, p_rol: rol });
  return { error };
}

// Cada hijo se registra con el consentimiento datos_menor de la versión aceptada (R25, D26).
export async function registrarHijos(db: Cliente, nombres: string[], versionConsentimiento: string): Resultado {
  for (const nombre of nombres) {
    const { error } = await db
      .schema("app")
      .rpc("registrar_menor", { p_nombre: nombre, p_version_consentimiento: versionConsentimiento });
    if (error) return { error };
  }
  return { error: null };
}

export async function guardarConsentimientos(
  db: Cliente,
  finalidades: FinalidadConsentimiento[],
  version: string,
): Resultado {
  const yo = await integranteActual(db);
  if (!yo) return { error: { message: "sin integrante" } };
  const { error } = await db
    .schema("gob")
    .from("consentimiento")
    .insert(
      finalidades.map((finalidad) => ({
        hogar_id: yo.hogar_id,
        titular_id: yo.id,
        otorgado_por_id: yo.id,
        finalidad,
        version_texto: version,
      })),
    );
  return { error };
}

export type EstadoAlta = "hogar" | "integrantes" | "consentimientos" | "acuerdo" | "listo";

// Dónde retomar el alta: hogar → integrantes → consentimientos → Acuerdo v1 → portada.
export async function estadoAlta(db: Cliente): Promise<EstadoAlta> {
  await db.schema("app").rpc("aceptar_invitacion");   // vincula al invitado por su correo, si corresponde
  const yo = await integranteActual(db);
  if (!yo) return "hogar";

  const { count: consentimientos } = await db
    .schema("gob")
    .from("consentimiento")
    .select("id", { count: "exact", head: true })
    .eq("titular_id", yo.id)
    .eq("finalidad", "uso_app")
    .is("revocado_en", null);
  if (!consentimientos) {
    const { count: otros } = await db
      .schema("gob")
      .from("integrante")
      .select("id", { count: "exact", head: true })
      .neq("id", yo.id);
    return yo.rol === "ORG" && !otros ? "integrantes" : "consentimientos";
  }

  const { data: acuerdos } = await db.schema("gob").from("acuerdo_hogar").select("estado");
  const { data: porFirmar } = await db
    .schema("gob")
    .from("solicitud_aprobacion")
    .select("id")
    .eq("tipo", "acuerdo")
    .eq("estado", "pendiente")
    .eq("aprobador_id", yo.id);
  if (porFirmar?.length) return "acuerdo";
  if (!acuerdos?.length && (yo.rol === "ORG" || yo.rol === "CAD")) return "acuerdo";
  return "listo";
}
