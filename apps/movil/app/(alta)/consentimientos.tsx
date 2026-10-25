import { router } from "expo-router";
import { useEffect, useState } from "react";
import { guardarConsentimientos } from "../../src/datos/alta";
import { nombresMenores } from "../../src/datos/integrante";
import { supabase } from "../../src/lib/supabase";
import { Consentimientos } from "../../src/pantallas/Consentimientos";

export default function RutaConsentimientos() {
  const [menores, setMenores] = useState<string[]>([]);
  useEffect(() => {
    nombresMenores(supabase).then(setMenores);
  }, []);

  return (
    <Consentimientos
      menores={menores}
      guardar={(finalidades, version) => guardarConsentimientos(supabase, finalidades, version)}
      continuar={() => router.replace("/")}
    />
  );
}
