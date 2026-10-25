import { router, useLocalSearchParams } from "expo-router";
import { mensajeError } from "../../../src/datos/cliente";
import { movimientosDeSobre, sobresDelMes } from "../../../src/datos/finanzas";
import { reasignar } from "../../../src/datos/gobierno";
import { useHogar } from "../../../src/lib/hogar";
import { supabase } from "../../../src/lib/supabase";
import { useDatos } from "../../../src/lib/useDatos";
import { SobreDetalle } from "../../../src/pantallas/SobreDetalle";
import { Cargando, ErrorCarga } from "../../../src/ui";

export default function RutaSobre() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { esAdmin, parametros } = useHogar();
  const { datos, error, recargar } = useDatos(async () => {
    const { data } = await supabase.schema("plan").from("v_sobre").select("mes").eq("id", id!).maybeSingle();
    if (!data?.mes) throw new Error("No encontramos ese sobre.");
    const [sobres, movs] = await Promise.all([sobresDelMes(supabase, data.mes), movimientosDeSobre(supabase, id!)]);
    const sobre = sobres.find((s) => s.id === id);
    if (!sobre) throw new Error("No encontramos ese sobre.");
    return { sobre, sobres, movs };
  }, [id]);
  if (error) return <ErrorCarga texto={error} reintentar={recargar} />;
  if (!datos) return <Cargando />;
  return (
    <SobreDetalle
      key={`${datos.sobre.id}-${datos.sobre.saldo}`}
      sobre={datos.sobre}
      otros={datos.sobres}
      movimientos={datos.movs}
      esAdmin={esAdmin}
      umbralPct={parametros.autoaprobacion_n1_pct}
      reasignar={async (origen, destino, monto, motivo) => {
        const r = await reasignar(supabase, origen, destino, monto, motivo);
        if (r.error) return { error: { message: mensajeError(r.error) ?? r.error.message }, estado: null };
        await recargar();
        return { error: null, estado: r.data?.estado ?? null };
      }}
      volver={() => router.back()}
    />
  );
}
