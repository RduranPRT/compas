import { hoyIso, mesDe } from "@compas/dominio";
import { router } from "expo-router";
import { useState } from "react";
import { useHogar } from "../../src/lib/hogar";
import { sobresDelMes } from "../../src/datos/finanzas";
import { supabase } from "../../src/lib/supabase";
import { useDatos } from "../../src/lib/useDatos";
import { Sobres } from "../../src/pantallas/Sobres";
import { ErrorCarga } from "../../src/ui";

export default function RutaSobres() {
  const { parametros } = useHogar();
  const [mes, setMes] = useState(mesDe(hoyIso()));
  const { datos, error, recargar } = useDatos(() => sobresDelMes(supabase, mes), [mes]);
  if (error) return <ErrorCarga texto={error} reintentar={recargar} />;
  return (
    <Sobres
      mes={mes}
      sobres={datos}
      cambiarMes={setMes}
      abrir={(id) => router.push(`/sobre/${id}`)}
      registrar={() => router.push("/registrar")}
      lineaBase={mes < parametros.mes_primer_plan}
    />
  );
}
