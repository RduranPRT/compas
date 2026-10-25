import { router } from "expo-router";
import { invitarIntegrante, registrarHijos } from "../../src/datos/alta";
import { supabase } from "../../src/lib/supabase";
import { AltaIntegrantes } from "../../src/pantallas/AltaIntegrantes";

export default function RutaIntegrantes() {
  return (
    <AltaIntegrantes
      invitar={(correo, nombre) => invitarIntegrante(supabase, correo, nombre, "CAD")}
      registrarHijos={(nombres, version) => registrarHijos(supabase, nombres, version)}
      continuar={() => router.replace("/consentimientos")}
    />
  );
}
