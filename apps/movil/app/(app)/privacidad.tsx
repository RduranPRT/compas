import { hoyIso } from "@compas/dominio";
import { router } from "expo-router";
import { mensajeError } from "../../src/datos/cliente";
import { anularBorrado, consentimientos, exportarDatos, otorgar, revocar, solicitarBorrado } from "../../src/datos/privacidad";
import { descargarTexto } from "../../src/lib/archivo";
import { useHogar } from "../../src/lib/hogar";
import { VERSION_CONSENTIMIENTO } from "../../src/legal/consentimiento";
import { supabase } from "../../src/lib/supabase";
import { useDatos } from "../../src/lib/useDatos";
import { Privacidad } from "../../src/pantallas/Privacidad";
import { Cargando, ErrorCarga } from "../../src/ui";

export default function RutaPrivacidad() {
  const { yo, esAdmin, hogar, recargar: recargarHogar } = useHogar();
  const { datos, error, recargar } = useDatos(() => consentimientos(supabase));
  if (error) return <ErrorCarga texto={error} reintentar={recargar} />;
  if (!datos) return <Cargando />;
  const res = async (p: Promise<{ error: { message: string } | null }>) => {
    const r = await p;
    if (!r.error) {
      await recargar();
      await recargarHogar();
    }
    return { error: r.error ? (mensajeError(r.error) ?? r.error.message) : null };
  };
  return (
    <Privacidad
      yo={yo?.id ?? null}
      esAdmin={esAdmin}
      consentimientos={datos}
      borradoProgramado={hogar?.eliminadoEn ?? null}
      revocar={(c) => res(revocar(supabase, c.finalidad as "uso_app" | "datos_menor" | "analitica_ia", c.titularId === yo?.id ? undefined : c.titularId))}
      activarIA={() => res(otorgar(supabase, "analitica_ia", VERSION_CONSENTIMIENTO))}
      exportar={async () => {
        try {
          const { json, csv } = await exportarDatos(supabase);
          descargarTexto(`compas-datos-${hoyIso()}.json`, json);
          descargarTexto(`compas-movimientos-${hoyIso()}.csv`, csv, "text/csv");
          return { error: null, mensaje: "Descargamos dos archivos: todos tus datos (JSON) y los movimientos (CSV)." };
        } catch (e) {
          return { error: e instanceof Error ? e.message : "No pudimos preparar la descarga." };
        }
      }}
      solicitarBorrado={async () => {
        const r = await solicitarBorrado(supabase);
        if (r.error) return { error: mensajeError(r.error) ?? r.error.message };
        router.push("/aprobaciones");
        return { error: null };
      }}
      anularBorrado={() => res(anularBorrado(supabase))}
      volver={() => router.back()}
    />
  );
}
