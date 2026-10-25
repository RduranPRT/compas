import { router } from "expo-router";
import { avisos, marcarAvisosLeidos } from "../../src/datos/gobierno";
import { supabase } from "../../src/lib/supabase";
import { useDatos } from "../../src/lib/useDatos";
import { Avisos } from "../../src/pantallas/Avisos";
import { Cargando, ErrorCarga } from "../../src/ui";

export default function RutaAvisos() {
  const { datos, error, recargar } = useDatos(() => avisos(supabase));
  if (error) return <ErrorCarga texto={error} reintentar={recargar} />;
  if (!datos) return <Cargando />;
  return (
    <Avisos
      avisos={datos}
      abrirSobre={(id) => router.push(`/sobre/${id}`)}
      marcarLeidos={async () => {
        await marcarAvisosLeidos(supabase, datos.filter((a) => a.estado !== "leida").map((a) => a.id));
        await recargar();
      }}
      volver={() => router.back()}
    />
  );
}
