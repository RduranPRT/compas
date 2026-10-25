import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
  acuerdoPendienteDeFirma,
  coAdministrador,
  firmarAcuerdo,
  proponerAcuerdoV1,
} from "../../src/datos/acuerdo";
import { integranteActual, type IntegranteActual } from "../../src/datos/integrante";
import { supabase } from "../../src/lib/supabase";
import { Acuerdo } from "../../src/pantallas/Acuerdo";

export default function RutaAcuerdo() {
  const [yo, setYo] = useState<IntegranteActual | null>(null);
  const [cad, setCad] = useState<{ nombre: string; tieneCuenta: boolean } | null>(null);
  const [pendiente, setPendiente] = useState<{ acuerdo: string; solicitud: string } | null>(null);

  useEffect(() => {
    integranteActual(supabase).then(setYo);
    coAdministrador(supabase).then(setCad);
    acuerdoPendienteDeFirma(supabase).then(setPendiente);
  }, []);

  const firmaElCad = yo?.rol === "CAD" && pendiente !== null;
  return (
    <Acuerdo
      modo={firmaElCad ? "firmar" : "proponer"}
      cad={cad}
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
