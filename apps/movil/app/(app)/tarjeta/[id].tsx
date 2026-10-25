import { formatoPesos, hoyIso } from "@compas/dominio";
import { router, useLocalSearchParams } from "expo-router";
import { mensajeError } from "../../../src/datos/cliente";
import { cuentas } from "../../../src/datos/configuracion";
import { comprasDeTarjeta, conciliarCuenta, registrarPagoTarjeta, tarjetas } from "../../../src/datos/finanzas";
import { supabase } from "../../../src/lib/supabase";
import { useDatos } from "../../../src/lib/useDatos";
import { cicloDe, TarjetaDetalle } from "../../../src/pantallas/TarjetaDetalle";
import { Cargando, ErrorCarga } from "../../../src/ui";

export default function RutaTarjeta() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const hoy = hoyIso();
  const { datos, error, recargar } = useDatos(async () => {
    const [ts, ctas] = await Promise.all([tarjetas(supabase), cuentas(supabase)]);
    const t = ts.find((x) => x.id === id);
    if (!t) throw new Error("No encontramos esa tarjeta.");
    const ciclo = cicloDe(hoy, t.diaFacturacion, t.diaPago);
    const compras = await comprasDeTarjeta(supabase, t.id, ciclo.desde, ciclo.hasta);
    return { t, compras, ctas };
  }, [id]);
  if (error) return <ErrorCarga texto={error} reintentar={recargar} />;
  if (!datos) return <Cargando />;
  return (
    <TarjetaDetalle
      tarjeta={datos.t}
      hoy={hoy}
      compras={datos.compras}
      cuentasOrigen={datos.ctas.filter((c) => c.tipo !== "tarjeta_credito").map((c) => ({ id: c.id, nombre: c.nombre }))}
      pagar={async (origen, monto, fecha) => {
        const r = await registrarPagoTarjeta(supabase, origen, datos.t.id, monto, fecha);
        if (!r.error) await recargar();
        return { error: r.error ? (mensajeError(r.error) ?? r.error.message) : null };
      }}
      conciliar={async (deuda, motivo) => {
        // El saldo de una tarjeta es negativo cuando se le debe
        const r = await conciliarCuenta(supabase, datos.t.id, "mensual", hoy, -deuda, motivo);
        if (r.error) return { error: mensajeError(r.error) ?? r.error.message };
        const dif = r.data?.diferencia ?? 0;
        return { error: null, mensaje: dif === 0 ? "Cuadra con el banco." : `Quedó registrada una diferencia de ${formatoPesos(-dif)}.` };
      }}
      volver={() => router.back()}
    />
  );
}
