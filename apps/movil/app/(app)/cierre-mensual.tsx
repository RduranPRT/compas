import { hoyIso, mesDe, sumarMeses } from "@compas/dominio";
import { router } from "expo-router";
import { useState } from "react";
import { cerrarMes, iniciarCierreMes, periodos, reabrirMes, resumenDelMes, valorar } from "../../src/datos/cierres";
import { mensajeError } from "../../src/datos/cliente";
import { useHogar } from "../../src/lib/hogar";
import { supabase } from "../../src/lib/supabase";
import { useDatos } from "../../src/lib/useDatos";
import { CierreMensual, PREGUNTA_KAKEIBO } from "../../src/pantallas/CierreMensual";
import { Cargando, ErrorCarga } from "../../src/ui";

export default function RutaCierreMensual() {
  const { etapa, parametros } = useHogar();
  const [elegido, setElegido] = useState<string | null>(null);
  const lista = useDatos(() => periodos(supabase));
  const ps = lista.datos ?? [];
  // Por defecto, el mes anterior (el cierre se hace los días 1 a 3)
  const anterior = ps.find((p) => p.mes === sumarMeses(mesDe(hoyIso()), -1)) ?? ps.find((p) => p.mes <= mesDe(hoyIso()));
  const periodoId = elegido ?? anterior?.id ?? null;
  const periodo = ps.find((p) => p.id === periodoId);
  const resumen = useDatos(async () => (periodo ? resumenDelMes(supabase, periodo.mes, etapa) : null), [periodo?.id, periodo?.estado]);

  if (lista.error) return <ErrorCarga texto={lista.error} reintentar={lista.recargar} />;
  if (!lista.datos) return <Cargando />;
  const res = (r: { error: { message: string } | null }) => ({ error: r.error ? (mensajeError(r.error) ?? r.error.message) : null });

  return (
    <CierreMensual
      periodos={ps}
      periodoId={periodoId}
      elegirPeriodo={setElegido}
      resumen={resumen.datos}
      lineaBase={!!periodo && periodo.mes < parametros.mes_primer_plan}
      irBandeja={() => router.push("/bandeja")}
      valorar={async (categoriaId, v) => {
        if (!periodoId) return { error: "Elige el mes." };
        const c = await iniciarCierreMes(supabase, periodoId);
        if (c.error || !c.cierreId) return res(c);
        return res(await valorar(supabase, c.cierreId, categoriaId, v));
      }}
      cerrar={async (respuesta, justificacion) => {
        if (!periodoId || !resumen.datos) return { error: "Elige el mes." };
        const c = await iniciarCierreMes(supabase, periodoId);
        if (c.error || !c.cierreId) return res(c);
        if (respuesta.trim()) await valorar(supabase, c.cierreId, null, null, PREGUNTA_KAKEIBO, respuesta);
        const r = await cerrarMes(supabase, periodoId, resumen.datos.kpis, null, justificacion);
        if (!r.error) await lista.recargar();
        return res(r);
      }}
      reabrir={async (motivo) => {
        if (!periodoId) return { error: "Elige el mes." };
        const r = await reabrirMes(supabase, periodoId, motivo);
        if (!r.error) await lista.recargar();
        return res(r);
      }}
      volver={() => router.back()}
    />
  );
}
