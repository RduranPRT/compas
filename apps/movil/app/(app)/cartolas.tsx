import { router } from "expo-router";
import { importaciones } from "../../src/datos/cartolas";
import { cuentas } from "../../src/datos/configuracion";
import { supabase } from "../../src/lib/supabase";
import { useDatos } from "../../src/lib/useDatos";
import { Cartolas } from "../../src/pantallas/Cartolas";
import { Cargando, ErrorCarga } from "../../src/ui";

export default function RutaCartolas() {
  const { datos, error, recargar } = useDatos(async () => {
    const [imps, ctas] = await Promise.all([importaciones(supabase), cuentas(supabase, false)]);
    return { imps, ctas };
  });
  if (error) return <ErrorCarga texto={error} reintentar={recargar} />;
  if (!datos) return <Cargando />;
  return (
    <Cartolas
      importaciones={datos.imps}
      cuentas={datos.ctas}
      cargar={() => router.push("/cargar-cartola")}
      revisar={(id) => router.push(`/revisar/${id}`)}
      volver={() => router.back()}
    />
  );
}
