import { hoyIso } from "@compas/dominio";
import { router } from "expo-router";
import { mensajeError } from "../../src/datos/cliente";
import {
  categorias,
  cerrarIngresoEsperado,
  cerrarPagoFijo,
  crearIngresoEsperado,
  crearPagoFijo,
  ingresosEsperados,
  pagosFijos,
} from "../../src/datos/configuracion";
import { useHogar } from "../../src/lib/hogar";
import { supabase } from "../../src/lib/supabase";
import { useDatos } from "../../src/lib/useDatos";
import { IngresosFijos } from "../../src/pantallas/IngresosFijos";
import { Cargando, ErrorCarga } from "../../src/ui";

export default function RutaIngresosFijos() {
  const { personas, parametros } = useHogar();
  const { datos, error, recargar } = useDatos(async () => {
    const [ing, fij, cats] = await Promise.all([ingresosEsperados(supabase), pagosFijos(supabase), categorias(supabase)]);
    return { ing, fij, cats };
  });
  if (error) return <ErrorCarga texto={error} reintentar={recargar} />;
  if (!datos) return <Cargando />;
  const desde = hoyIso() < parametros.inicio_piloto ? hoyIso() : parametros.inicio_piloto;
  const tras = async (p: Promise<{ error: { message: string } | null }>) => {
    const r = await p;
    if (!r.error) await recargar();
    return { error: r.error ? { message: mensajeError(r.error) ?? r.error.message } : null };
  };
  return (
    <IngresosFijos
      ingresos={datos.ing}
      fijos={datos.fij}
      personas={personas}
      categorias={datos.cats}
      crearIngreso={(i) => tras(crearIngresoEsperado(supabase, { ...i, desde }))}
      quitarIngreso={(id) => tras(cerrarIngresoEsperado(supabase, id, hoyIso()))}
      crearFijo={(f) => tras(crearPagoFijo(supabase, { ...f, desde: hoyIso() }))}
      quitarFijo={(id) => tras(cerrarPagoFijo(supabase, id, hoyIso()))}
      volver={() => router.back()}
    />
  );
}
