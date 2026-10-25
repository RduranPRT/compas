import type { Cliente } from "./cliente";

export interface IntegranteActual {
  id: string;
  hogar_id: string;
  rol: "ORG" | "CAD" | "ING" | "MEN" | "ASE";
}

// Integrante del usuario autenticado (la RLS limita a su hogar).
export async function integranteActual(db: Cliente): Promise<IntegranteActual | null> {
  const { data: usuario } = await db.auth.getUser();
  if (!usuario.user) return null;
  const { data } = await db
    .schema("gob")
    .from("integrante")
    .select("id, hogar_id, rol")
    .eq("usuario_auth_id", usuario.user.id)
    .eq("activo", true)
    .maybeSingle();
  return data;
}

export async function nombresMenores(db: Cliente): Promise<string[]> {
  const { data } = await db.schema("gob").from("integrante").select("nombre").eq("rol", "MEN").eq("activo", true);
  return (data ?? []).map((m) => m.nombre);
}
