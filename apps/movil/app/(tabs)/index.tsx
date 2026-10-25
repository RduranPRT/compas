import { useEffect, useState } from "react";
import { firmaPendienteDelAcuerdo, nombreHogar } from "../../src/datos/hogar";
import { supabase } from "../../src/lib/supabase";
import { Portada } from "../../src/pantallas/Portada";

export default function RutaPortada() {
  const [hogar, setHogar] = useState("Compás");
  const [firmaPendiente, setFirmaPendiente] = useState<{ nombre: string; vigente: boolean } | null>(null);

  useEffect(() => {
    nombreHogar(supabase).then((n) => n && setHogar(n));
    firmaPendienteDelAcuerdo(supabase).then(setFirmaPendiente);
  }, []);

  return <Portada nombreHogar={hogar} firmaPendiente={firmaPendiente} />;
}
