import { hoyIso } from "@compas/dominio";
import { router } from "expo-router";
import { mensajeError } from "../../src/datos/cliente";
import { bandeja, confirmarMovimiento, descartarMovimiento, resolverDuplicado, sobresDeGasto, sobresDelMes } from "../../src/datos/finanzas";
import { supabase } from "../../src/lib/supabase";
import { useDatos } from "../../src/lib/useDatos";
import { Bandeja } from "../../src/pantallas/Bandeja";
import { ErrorCarga } from "../../src/ui";

const conMensaje = async (p: Promise<{ error: { message: string } | null }>) => {
  const r = await p;
  return { error: r.error ? { message: mensajeError(r.error) ?? r.error.message } : null };
};

export default function RutaBandeja() {
  const { datos, error, recargar } = useDatos(async () => {
    const [b, sobres] = await Promise.all([bandeja(supabase), sobresDelMes(supabase, hoyIso())]);
    return { ...b, sobres: sobresDeGasto(sobres) };
  });
  if (error) return <ErrorCarga texto={error} reintentar={recargar} />;
  return (
    <Bandeja
      movimientos={datos?.movimientos ?? null}
      duplicados={datos?.duplicados ?? []}
      sobres={datos?.sobres ?? []}
      confirmar={(id, sobreId) => conMensaje(confirmarMovimiento(supabase, id, sobreId))}
      descartar={(id) => conMensaje(descartarMovimiento(supabase, id))}
      resolverDuplicado={(id, es) => conMensaje(resolverDuplicado(supabase, id, es))}
      recargar={() => void recargar()}
      volver={() => router.back()}
    />
  );
}
