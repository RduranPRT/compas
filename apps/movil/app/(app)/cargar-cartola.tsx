import { cuadraConTotales, huellaArchivo, resumirLineas } from "@compas/dominio";
import { router } from "expo-router";
import { extraerConIA, formatoDe, importar, leerTabla, preparar } from "../../src/datos/cartolas";
import { mensajeError } from "../../src/datos/cliente";
import { categorias, cuentas } from "../../src/datos/configuracion";
import { elegirArchivo } from "../../src/lib/archivo";
import { useHogar } from "../../src/lib/hogar";
import { supabase } from "../../src/lib/supabase";
import { useDatos } from "../../src/lib/useDatos";
import { CargarCartola } from "../../src/pantallas/CargarCartola";
import { Cargando, ErrorCarga } from "../../src/ui";

export default function RutaCargarCartola() {
  const { parametros, personas } = useHogar();
  const { datos, error, recargar } = useDatos(async () => {
    const [ctas, cats] = await Promise.all([cuentas(supabase), categorias(supabase)]);
    return { ctas, cats };
  });
  if (error) return <ErrorCarga texto={error} reintentar={recargar} />;
  if (!datos) return <Cargando />;
  const menores = personas.filter((p) => p.esMenor).map((p) => p.nombre);
  const porCodigo = Object.fromEntries(datos.cats.filter((c) => c.codigo).map((c) => [c.codigo!, c.id]));

  return (
    <CargarCartola
      cuentas={datos.ctas.map((c) => ({ id: c.id, nombre: c.nombre, tipo: c.tipo }))}
      inicioPiloto={parametros.inicio_piloto}
      elegirArchivo={async () => {
        const a = await elegirArchivo();
        if (!a) return null;
        const formato = formatoDe(a.nombre);
        if (!formato) throw new Error("Ese tipo de archivo no se puede leer. Usa Excel (.xlsx o .xls) o CSV.");
        return { nombre: a.nombre, formato, sha256: await huellaArchivo(a.contenido), tabla: formato === "pdf" ? [] : leerTabla(a.contenido) };
      }}
      leerConIA={async (tabla, cuenta) => {
        const r = await extraerConIA(supabase, tabla, cuenta.tipo, menores);
        if (!r.ok) return { ok: false, mensaje: r.mensaje };
        const resumen = resumirLineas(r.datos.lineas, parametros.inicio_piloto);
        return { ok: true, lineas: r.datos.lineas, cuadra: cuadraConTotales(resumen, r.datos.totales ?? undefined) };
      }}
      importar={async (cuenta, archivo, lineas, lector) => {
        const c = datos.ctas.find((x) => x.id === cuenta.id)!;
        const preparadas = await preparar(supabase, lineas, { cuenta: c, cuentas: datos.ctas, categoriasPorCodigo: porCodigo, nombresMenores: menores });
        const r = await importar(supabase, cuenta.id, archivo.nombre, archivo.formato, archivo.sha256, lector, preparadas);
        if (r.error || !r.data) return { error: mensajeError(r.error) ?? "No pudimos importar la cartola." };
        return {
          error: null,
          resultado: {
            importacionId: r.data.importacion_id,
            historicos: r.data.n_historicos,
            movimientos: r.data.n_movimientos,
            duplicados: r.data.n_duplicados,
            transferencias: r.data.n_transferencias,
            calzados: r.data.n_calzados,
          },
        };
      }}
      revisar={(id) => router.push(`/revisar/${id}`)}
      volver={() => router.back()}
    />
  );
}
