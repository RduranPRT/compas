import { hoyIso, semaforoDe } from "@compas/dominio";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { mensajeError } from "../../src/datos/cliente";
import { sobresDelMes } from "../../src/datos/finanzas";
import { calcularBorrador, enviarPlan, guardarBorrador, mesAPlanificar, planDelMes } from "../../src/datos/plan";
import { useHogar } from "../../src/lib/hogar";
import { supabase } from "../../src/lib/supabase";
import { useDatos } from "../../src/lib/useDatos";
import { Plan, type LineaVista } from "../../src/pantallas/Plan";
import { ErrorCarga } from "../../src/ui";

export default function RutaPlan() {
  const { parametros, etapa, esAdmin } = useHogar();
  const [mes, setMes] = useState(() => mesAPlanificar(hoyIso(), parametros.dia_plan, parametros.mes_primer_plan));
  // Los parámetros del Acuerdo llegan después del primer render: el mes por defecto se recalcula con ellos
  useEffect(() => {
    setMes(mesAPlanificar(hoyIso(), parametros.dia_plan, parametros.mes_primer_plan));
  }, [parametros.dia_plan, parametros.mes_primer_plan]);
  const { datos, error, cargando, recargar } = useDatos(async () => {
    const [plan, sobres] = await Promise.all([planDelMes(supabase, mes), sobresDelMes(supabase, mes)]);
    return { plan, sobres };
  }, [mes]);
  if (error) return <ErrorCarga texto={error} reintentar={recargar} />;
  const sobres = datos?.sobres ?? [];
  const sobresPlan = sobres.map((s) => ({ id: s.id, nombre: s.nombre, tipo: s.tipo as never, bloque: s.bloque, cuatroParedes: s.cuatroParedes }));

  const guardar = async (ingreso: number, lineas: LineaVista[], motivo?: string) => {
    const r = await guardarBorrador(supabase, mes, ingreso, lineas.map((l) => ({ sobreId: l.sobreId, monto: l.monto, regla: l.regla ?? "R04", explicacion: l.explicacion ?? "" })), motivo);
    if (!r.error) await recargar();
    return { error: r.error ? (mensajeError(r.error) ?? r.error.message) : null };
  };

  return (
    <Plan
      mes={mes}
      mesPrimerPlan={parametros.mes_primer_plan}
      cargando={cargando && !datos}
      plan={datos?.plan ?? null}
      sobres={sobres}
      esAdmin={esAdmin}
      semaforo={(lineas, ingreso) => semaforoDe(lineas, sobresPlan, ingreso, etapa)}
      cambiarMes={setMes}
      generar={async () => {
        const c = await calcularBorrador(supabase, mes, etapa, parametros);
        if (c.ingresoBase <= 0) return { error: "Primero declara los ingresos base en Ingresos y pagos fijos: el plan se arma con ellos (R45)." };
        // Con un plan aprobado vigente, el borrador es la versión siguiente (P2-A)
        const motivo = datos?.plan && datos.plan.estado !== "borrador" ? "Ajuste del plan (P2-A)" : undefined;
        return guardar(c.ingresoBase, c.borrador.lineas.map((l) => ({ sobreId: l.sobreId, monto: l.monto, regla: l.regla, explicacion: l.explicacion })), motivo);
      }}
      guardar={(ingreso, lineas) => guardar(ingreso, lineas)}
      enviar={async () => {
        if (!datos?.plan) return { error: "No hay plan para enviar." };
        const r = await enviarPlan(supabase, datos.plan.id);
        if (!r.error) await recargar();
        return { error: r.error ? (mensajeError(r.error) ?? r.error.message) : null };
      }}
      volver={() => router.back()}
    />
  );
}
