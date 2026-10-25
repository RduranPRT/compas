import { hoyIso } from "@compas/dominio";
import { router, useLocalSearchParams } from "expo-router";
import { mensajeError } from "../../../src/datos/cliente";
import { descartarMovimiento, registrarReembolso, type Movimiento } from "../../../src/datos/finanzas";
import { useHogar } from "../../../src/lib/hogar";
import { supabase } from "../../../src/lib/supabase";
import { useDatos } from "../../../src/lib/useDatos";
import { MovimientoDetalle } from "../../../src/pantallas/MovimientoDetalle";
import { Cargando, ErrorCarga } from "../../../src/ui";

export default function RutaMovimiento() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { esAdmin } = useHogar();
  const { datos, error, recargar } = useDatos(async () => {
    const { data } = await supabase.schema("fin").from("v_movimiento").select("*").eq("id", id!).maybeSingle();
    if (!data) throw new Error("No encontramos ese movimiento.");
    const m: Movimiento = {
      id: data.id!, fecha: data.fecha_contable!, tipo: data.tipo!, estado: data.estado!, origen: data.origen!,
      monto: Number(data.monto_clp), comercio: data.comercio, nota: data.nota, cuentaId: data.cuenta_id!, cuenta: data.cuenta ?? "",
      tipoCuenta: data.tipo_cuenta ?? "", sobreId: data.sobre_id, sobre: data.sobre, intencion: data.intencion,
      confianza: data.confianza_ia === null ? null : Number(data.confianza_ia), nCuotas: data.n_cuotas,
    };
    return m;
  }, [id]);
  if (error) return <ErrorCarga texto={error} reintentar={recargar} />;
  if (!datos) return <Cargando />;
  const res = async (p: Promise<{ error: { message: string } | null }>) => {
    const r = await p;
    return { error: r.error ? (mensajeError(r.error) ?? r.error.message) : null };
  };
  return (
    <MovimientoDetalle
      movimiento={datos}
      esAdmin={esAdmin}
      hoy={hoyIso()}
      devolver={(monto) => res(registrarReembolso(supabase, datos.id, monto, hoyIso()))}
      descartar={() => res(descartarMovimiento(supabase, datos.id))}
      confirmar={() => router.push("/bandeja")}
      volver={() => router.back()}
    />
  );
}
