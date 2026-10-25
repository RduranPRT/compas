import type { Database } from "@compas/contratos";
import type { SupabaseClient } from "@supabase/supabase-js";

// Las funciones de datos reciben el cliente: la app pasa el de src/lib/supabase y las
// pruebas de integración uno con sesión de prueba.
export type Cliente = SupabaseClient<Database>;
export type Resultado = Promise<{ error: { message: string } | null }>;
