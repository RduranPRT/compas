import { supabase } from "../lib/supabase";

export interface IntegranteActual {
  id: string;
  hogar_id: string;
  rol: "ORG" | "CAD" | "ING" | "MEN" | "ASE";
}

// Integrante del usuario autenticado (la RLS limita a su hogar).
export async function integranteActual(): Promise<IntegranteActual | null> {
  const { data: usuario } = await supabase.auth.getUser();
  if (!usuario.user) return null;
  const { data } = await supabase
    .schema("gob")
    .from("integrante")
    .select("id, hogar_id, rol")
    .eq("usuario_auth_id", usuario.user.id)
    .eq("activo", true)
    .maybeSingle();
  return (data as IntegranteActual | null) ?? null;
}

export async function nombresMenores(): Promise<string[]> {
  const { data } = await supabase.schema("gob").from("integrante").select("nombre").eq("rol", "MEN").eq("activo", true);
  return (data ?? []).map((m: { nombre: string }) => m.nombre);
}
