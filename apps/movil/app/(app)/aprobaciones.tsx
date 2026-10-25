import { router } from "expo-router";
import { mensajeError } from "../../src/datos/cliente";
import { puedoFirmar, resolverSolicitud, solicitudesPendientes } from "../../src/datos/gobierno";
import { useHogar } from "../../src/lib/hogar";
import { supabase } from "../../src/lib/supabase";
import { useDatos } from "../../src/lib/useDatos";
import { Aprobaciones } from "../../src/pantallas/Aprobaciones";
import { Cargando, ErrorCarga } from "../../src/ui";

export default function RutaAprobaciones() {
  const { yo, recargar: recargarHogar } = useHogar();
  const { datos, error, recargar } = useDatos(() => solicitudesPendientes(supabase));
  if (error) return <ErrorCarga texto={error} reintentar={recargar} />;
  if (!datos) return <Cargando />;
  return (
    <Aprobaciones
      solicitudes={datos}
      puedoFirmar={(s) => !!yo && puedoFirmar(s, yo.id)}
      resolver={async (id, aprueba) => {
        const r = await resolverSolicitud(supabase, id, aprueba);
        if (!r.error) await recargarHogar();
        return { error: r.error ? (mensajeError(r.error) ?? r.error.message) : null, estado: r.estado };
      }}
      volver={() => router.back()}
    />
  );
}
