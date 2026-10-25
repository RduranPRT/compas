import { randomBytes } from "node:crypto";
import type { Database } from "@compas/contratos";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export type Cliente = SupabaseClient<Database>;

const url = () => process.env.SUPABASE_API_URL!;
const sinSesion = { auth: { persistSession: false, autoRefreshToken: false } };

// Usuario de prueba con correo único y clave aleatoria (no se guarda); la sesión vive en el cliente.
export async function usuarioDePrueba(nombre: string): Promise<{ db: Cliente; correo: string }> {
  const admin = createClient<Database>(url(), process.env.SUPABASE_SERVICE_ROLE_KEY!, sinSesion);
  const correo = `${nombre}.${Date.now()}.${randomBytes(3).toString("hex")}@prueba.test`;
  const clave = randomBytes(18).toString("base64url");
  const creado = await admin.auth.admin.createUser({ email: correo, password: clave, email_confirm: true });
  if (creado.error) throw creado.error;
  const db = createClient<Database>(url(), process.env.SUPABASE_ANON_KEY!, sinSesion);
  const ingreso = await db.auth.signInWithPassword({ email: correo, password: clave });
  if (ingreso.error) throw ingreso.error;
  return { db, correo };
}
