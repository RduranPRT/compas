import { router } from "expo-router";
import { mediciones } from "../../src/datos/cierres";
import { supabase } from "../../src/lib/supabase";
import { useDatos } from "../../src/lib/useDatos";
import { Indicadores } from "../../src/pantallas/Indicadores";
import { Cargando, ErrorCarga } from "../../src/ui";

export default function RutaIndicadores() {
  const { datos, error, recargar } = useDatos(() => mediciones(supabase));
  if (error) return <ErrorCarga texto={error} reintentar={recargar} />;
  if (!datos) return <Cargando />;
  return <Indicadores mediciones={datos} volver={() => router.back()} />;
}
