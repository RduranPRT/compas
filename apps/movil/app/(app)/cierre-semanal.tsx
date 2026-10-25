import { hoyIso } from "@compas/dominio";
import { router } from "expo-router";
import { cerrarSemana, ultimoCierreSemanal } from "../../src/datos/cierres";
import { mensajeError } from "../../src/datos/cliente";
import { cuentas } from "../../src/datos/configuracion";
import { contarPendientes } from "../../src/datos/finanzas";
import { supabase } from "../../src/lib/supabase";
import { useDatos } from "../../src/lib/useDatos";
import { CierreSemanal } from "../../src/pantallas/CierreSemanal";
import { Cargando, ErrorCarga } from "../../src/ui";

export default function RutaCierreSemanal() {
  const { datos, error, recargar } = useDatos(async () => {
    const [ctas, pendientes, ultimo] = await Promise.all([cuentas(supabase), contarPendientes(supabase), ultimoCierreSemanal(supabase)]);
    return { ctas, pendientes, ultimo };
  });
  if (error) return <ErrorCarga texto={error} reintentar={recargar} />;
  if (!datos) return <Cargando />;
  return (
    <CierreSemanal
      hoy={hoyIso()}
      ultimoCierre={datos.ultimo}
      cuentas={datos.ctas.map((c) => ({ id: c.id, nombre: c.nombre, tipo: c.tipo, saldo: c.saldo }))}
      pendientes={datos.pendientes}
      irBandeja={() => router.push("/bandeja")}
      cerrar={async (fecha, saldos) => {
        const r = await cerrarSemana(supabase, fecha, saldos);
        if (r.error) return { error: mensajeError(r.error) ?? r.error.message };
        await recargar();
        return { error: null, conciliados: r.data?.conciliados ?? 0 };
      }}
      volver={() => router.back()}
    />
  );
}
