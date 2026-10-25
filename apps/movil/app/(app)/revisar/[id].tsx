import { router, useLocalSearchParams } from "expo-router";
import { clasificarComercio, gruposDeRevision, sugerirConIA } from "../../../src/datos/cartolas";
import { mensajeError } from "../../../src/datos/cliente";
import { categorias } from "../../../src/datos/configuracion";
import { useHogar } from "../../../src/lib/hogar";
import { supabase } from "../../../src/lib/supabase";
import { useDatos } from "../../../src/lib/useDatos";
import { Revisar } from "../../../src/pantallas/Revisar";
import { ErrorCarga } from "../../../src/ui";

export default function RutaRevisar() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const importacion = id === "todo" ? null : (id ?? null);
  const { personas } = useHogar();
  const { datos, error, recargar } = useDatos(async () => {
    const [grupos, cats] = await Promise.all([gruposDeRevision(supabase, importacion), categorias(supabase)]);
    return { grupos, cats };
  }, [importacion]);
  if (error) return <ErrorCarga texto={error} reintentar={recargar} />;
  return (
    <Revisar
      grupos={datos?.grupos ?? null}
      categorias={datos?.cats ?? []}
      personas={personas}
      clasificar={async (comercio, categoriaId, integranteId) => {
        const r = await clasificarComercio(supabase, importacion, comercio, categoriaId, integranteId);
        if (r.error) return { error: mensajeError(r.error) ?? r.error.message };
        void recargar();
        const d = r.data;
        return { error: null, mensaje: d ? `Listo: ${d.historicos} históricos y ${d.confirmados} movimientos clasificados${d.pendientes ? `; ${d.pendientes} quedaron en la bandeja como posible duplicado` : ""}.` : "Listo." };
      }}
      {...(importacion
        ? {
            sugerirConIA: async () => {
              const r = await sugerirConIA(supabase, importacion, datos?.cats ?? []);
              if (!r.ok) return r.mensaje;
              await recargar();
              return `La IA sugirió categorías para ${r.guardadas} movimientos. Revisa y confirma cada grupo.`;
            },
          }
        : {})}
      volver={() => router.back()}
    />
  );
}
