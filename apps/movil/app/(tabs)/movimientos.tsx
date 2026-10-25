import { hoyIso, mesDe } from "@compas/dominio";
import { router } from "expo-router";
import { useState } from "react";
import { contarPendientes, movimientosDelMes } from "../../src/datos/finanzas";
import { supabase } from "../../src/lib/supabase";
import { useDatos } from "../../src/lib/useDatos";
import { Movimientos } from "../../src/pantallas/Movimientos";
import { ErrorCarga } from "../../src/ui";

export default function RutaMovimientos() {
  const [mes, setMes] = useState(mesDe(hoyIso()));
  const { datos, error, recargar } = useDatos(async () => {
    const [movs, pendientes] = await Promise.all([movimientosDelMes(supabase, mes), contarPendientes(supabase)]);
    return { movs, pendientes };
  }, [mes]);
  if (error) return <ErrorCarga texto={error} reintentar={recargar} />;
  return (
    <Movimientos
      mes={mes}
      movimientos={datos?.movs ?? null}
      pendientes={datos?.pendientes ?? 0}
      cambiarMes={setMes}
      abrir={(m) => router.push(`/movimiento/${m.id}`)}
      irBandeja={() => router.push("/bandeja")}
      registrar={() => router.push("/registrar")}
    />
  );
}
