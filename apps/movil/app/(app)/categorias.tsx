import { router } from "expo-router";
import { mensajeError } from "../../src/datos/cliente";
import { activarCategoria, aplicarPlantilla, categorias, crearFondo, fondos, guardarCategoria } from "../../src/datos/configuracion";
import { supabase } from "../../src/lib/supabase";
import { useDatos } from "../../src/lib/useDatos";
import { Categorias } from "../../src/pantallas/Categorias";
import { Cargando, ErrorCarga } from "../../src/ui";

export default function RutaCategorias() {
  const { datos, error, recargar } = useDatos(async () => {
    const [cats, fs] = await Promise.all([categorias(supabase), fondos(supabase)]);
    return { cats, fs };
  });
  if (error) return <ErrorCarga texto={error} reintentar={recargar} />;
  if (!datos) return <Cargando />;
  const tras = async (p: Promise<{ error: { message: string } | null }>) => {
    const r = await p;
    if (!r.error) await recargar();
    return { error: r.error ? { message: mensajeError(r.error) ?? r.error.message } : null };
  };
  return (
    <Categorias
      categorias={datos.cats}
      fondos={datos.fs}
      aplicarPlantilla={() => tras(aplicarPlantilla(supabase))}
      guardar={(c) => tras(guardarCategoria(supabase, c))}
      activar={(id, activa) => tras(activarCategoria(supabase, id, activa))}
      crearFondo={(f) => tras(crearFondo(supabase, f))}
      volver={() => router.back()}
    />
  );
}
