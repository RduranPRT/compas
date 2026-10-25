import { hoyIso, sumarMeses, type Etapa } from "@compas/dominio";
import { router } from "expo-router";
import { mensajeError } from "../../src/datos/cliente";
import { categorias, crearFondo, crearIngresoEsperado, crearPagoFijo } from "../../src/datos/configuracion";
import { etapaPropuesta, proponerEtapa } from "../../src/datos/gobierno";
import { contarHistoricos, generarPerfil, perfilVigente } from "../../src/datos/perfil";
import { useHogar } from "../../src/lib/hogar";
import { supabase } from "../../src/lib/supabase";
import { useDatos } from "../../src/lib/useDatos";
import { PerfilInicial } from "../../src/pantallas/PerfilInicial";
import { Cargando, ErrorCarga } from "../../src/ui";

export default function RutaPerfil() {
  const { etapa, yo, parametros, recargar: recargarHogar } = useHogar();
  const { datos, error, recargar } = useDatos(async () => {
    const [perfil, historicos, propuesta, cats] = await Promise.all([perfilVigente(supabase), contarHistoricos(supabase), etapaPropuesta(supabase), categorias(supabase)]);
    return { perfil, historicos, propuesta, cats };
  });
  if (error) return <ErrorCarga texto={error} reintentar={recargar} />;
  if (!datos) return <Cargando />;
  const res = async (p: Promise<{ error: { message: string } | null }>) => {
    const r = await p;
    return { error: r.error ? (mensajeError(r.error) ?? r.error.message) : null };
  };
  const categoriaFijos = datos.cats.find((c) => c.codigo === "servicios")?.id ?? datos.cats.find((c) => c.tipo === "fijo")?.id ?? null;
  const categoriaFondos = datos.cats.find((c) => c.tipo === "fondo")?.id ?? null;
  return (
    <PerfilInicial
      perfil={datos.perfil}
      historicos={datos.historicos}
      etapaActual={etapa}
      etapaPropuesta={datos.propuesta?.etapa ?? null}
      generar={async () => {
        const r = await generarPerfil(supabase);
        if (!r.error) await recargar();
        return r;
      }}
      proponerEtapa={async (e: Etapa) => {
        const r = await proponerEtapa(supabase, e, { perfil_id: datos.perfil?.id, k2: datos.perfil?.perfil.k2, razon: datos.perfil?.perfil.razonEtapa });
        if (!r.error) {
          await recargar();
          await recargarHogar();
        }
        return { error: r.error ? (mensajeError(r.error) ?? r.error.message) : null };
      }}
      agregarIngreso={(descripcion, monto, dia, esBase) =>
        yo ? res(crearIngresoEsperado(supabase, { integranteId: yo.id, descripcion, monto, dia, esBase, desde: parametros.inicio_piloto })) : Promise.resolve({ error: "Sin sesión" })}
      agregarFijo={(nombre, categoriaId, monto, dia) => {
        const cat = categoriaId ?? categoriaFijos;
        if (!cat) return Promise.resolve({ error: "Primero elige las categorías del hogar." });
        return res(crearPagoFijo(supabase, { nombre, categoriaId: cat, moneda: "CLP", monto, dia: Math.min(28, Math.max(1, dia)), desde: hoyIso() }));
      }}
      crearFondo={(nombre, monto) =>
        categoriaFondos
          ? res(crearFondo(supabase, { nombre, categoriaId: categoriaFondos, objetivo: monto, fechaObjetivo: sumarMeses(hoyIso(), 11) }))
          : Promise.resolve({ error: "Activa la categoría Gastos anuales para crear fondos." })}
      irRevisar={() => router.push("/revisar/todo")}
      irCargar={() => router.push("/cargar-cartola")}
      volver={() => router.back()}
    />
  );
}
