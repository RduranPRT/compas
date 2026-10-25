import { router } from "expo-router";
import { useEffect, useState } from "react";
import { integranteActual, nombresMenores } from "../../src/datos/integrante";
import { supabase } from "../../src/lib/supabase";
import { Consentimientos } from "../../src/pantallas/Consentimientos";

export default function RutaConsentimientos() {
  const [menores, setMenores] = useState<string[]>([]);
  useEffect(() => {
    nombresMenores().then(setMenores);
  }, []);

  return (
    <Consentimientos
      menores={menores}
      guardar={async (finalidades, version) => {
        const yo = await integranteActual();
        if (!yo) return { error: { message: "sin integrante" } };
        return supabase
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
      }}
      continuar={() => router.replace("/acuerdo")}
    />
  );
}
