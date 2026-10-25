import { router } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { firmarAcuerdo, pantallaAcuerdo, proponerAcuerdoV1, type EstadoPantallaAcuerdo } from "../../src/datos/acuerdo";
import { supabase } from "../../src/lib/supabase";
import { Acuerdo } from "../../src/pantallas/Acuerdo";

export default function RutaAcuerdo() {
  const [estado, setEstado] = useState<EstadoPantallaAcuerdo | null>(null);
  useEffect(() => {
    pantallaAcuerdo(supabase).then(setEstado);
  }, []);

  if (!estado) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator />
      </View>
    );
  }
  const { yo, modo, pendiente, otro } = estado;
  return (
    <Acuerdo
      modo={modo}
      otro={otro}
      proponer={(opciones) => proponerAcuerdoV1(supabase, opciones)}
      firmar={() =>
        pendiente && yo
          ? firmarAcuerdo(supabase, pendiente, yo.id)
          : Promise.resolve({ error: { message: "sin solicitud" } })
      }
      continuar={() => router.replace("/")}
    />
  );
}
