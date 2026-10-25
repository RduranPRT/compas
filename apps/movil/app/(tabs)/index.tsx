import { useEffect, useState } from "react";
import { firmaPendienteDelAcuerdo, nombreHogar } from "../../src/datos/hogar";
import { Portada } from "../../src/pantallas/Portada";

export default function RutaPortada() {
  const [hogar, setHogar] = useState("Compás");
  const [firmaPendienteDe, setFirmaPendienteDe] = useState<string | null>(null);

  useEffect(() => {
    nombreHogar().then((n) => n && setHogar(n));
    firmaPendienteDelAcuerdo().then(setFirmaPendienteDe);
  }, []);

  return <Portada nombreHogar={hogar} firmaPendienteDe={firmaPendienteDe} />;
}
