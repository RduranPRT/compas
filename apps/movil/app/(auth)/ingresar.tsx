import { Ingresar } from "../../src/pantallas/Ingresar";
import { supabase } from "../../src/lib/supabase";

export default function RutaIngresar() {
  return (
    <Ingresar
      enviarCodigo={(email) => supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } })}
      verificarCodigo={(email, token) => supabase.auth.verifyOtp({ email, token, type: "email" })}
    />
  );
}
