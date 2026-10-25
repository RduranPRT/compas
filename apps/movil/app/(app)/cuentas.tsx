import { router } from "expo-router";
import { mensajeError } from "../../src/datos/cliente";
import { crearCuenta, cuentas, desactivarCuenta } from "../../src/datos/configuracion";
import { useHogar } from "../../src/lib/hogar";
import { supabase } from "../../src/lib/supabase";
import { useDatos } from "../../src/lib/useDatos";
import { Cuentas } from "../../src/pantallas/Cuentas";
import { Cargando, ErrorCarga } from "../../src/ui";

export default function RutaCuentas() {
  const { parametros } = useHogar();
  const { datos, error, recargar } = useDatos(() => cuentas(supabase, false));
  if (error) return <ErrorCarga texto={error} reintentar={recargar} />;
  if (!datos) return <Cargando />;
  const tras = async (p: Promise<{ error: { message: string } | null }>) => {
    const r = await p;
    if (!r.error) await recargar();
    return { error: r.error ? { message: mensajeError(r.error) ?? r.error.message } : null };
  };
  return (
    <Cuentas
      key={datos.length}
      cuentas={datos}
      inicioPiloto={parametros.inicio_piloto}
      crear={(c) => tras(crearCuenta(supabase, c))}
      activar={(id, activa) => tras(desactivarCuenta(supabase, id, activa))}
      volver={() => router.back()}
    />
  );
}
