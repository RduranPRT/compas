import type { Database } from "@compas/contratos";
import { createClient } from "@supabase/supabase-js";
import { Platform } from "react-native";
import { crearAlmacenamientoSesion } from "./almacenamiento";

// La app usa solo la clave anónima y el JWT del usuario (CLAUDE.md, seguridad).
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const claveAnonima = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !claveAnonima) {
  throw new Error("Faltan EXPO_PUBLIC_SUPABASE_URL y EXPO_PUBLIC_SUPABASE_ANON_KEY (ver .env.example).");
}

export const supabase = createClient<Database>(url, claveAnonima, {
  auth: {
    storage: crearAlmacenamientoSesion(Platform.OS),
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
