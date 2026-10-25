import { supabase } from "../src/lib/supabase";
import { Ingresar } from "../src/pantallas/Ingresar";

export default function RutaIngresar() {
  return <Ingresar ingresar={(email, password) => supabase.auth.signInWithPassword({ email, password })} />;
}
