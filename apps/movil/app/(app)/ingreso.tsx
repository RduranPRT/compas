import { hoyIso, proponerDistribucion, type TipoSobre } from "@compas/dominio";
import { router } from "expo-router";
import { mensajeError } from "../../src/datos/cliente";
import { cuentas } from "../../src/datos/configuracion";
import {
  confirmarDistribucion,
  ingresosPorRepartir,
  marcarTransferencia,
  registrarIngreso,
  sobresDelMes,
  transferenciasPendientes,
  type Sobre,
} from "../../src/datos/finanzas";
import { planDelMes } from "../../src/datos/plan";
import { useHogar } from "../../src/lib/hogar";
import { supabase } from "../../src/lib/supabase";
import { useDatos } from "../../src/lib/useDatos";
import { Ingreso } from "../../src/pantallas/Ingreso";
import { Cargando, ErrorCarga } from "../../src/ui";

export default function RutaIngreso() {
  const { personas, yo, etapa, parametros } = useHogar();
  const hoy = hoyIso();
  const { datos, error, recargar } = useDatos(async () => {
    const [porRepartir, transf, ctas] = await Promise.all([ingresosPorRepartir(supabase), transferenciasPendientes(supabase), cuentas(supabase)]);
    const meses = [...new Set(porRepartir.map((i) => i.mes))];
    const porMes: Record<string, { sobres: Sobre[]; plan: Awaited<ReturnType<typeof planDelMes>> }> = {};
    for (const m of meses) {
      const [sobres, plan] = await Promise.all([sobresDelMes(supabase, m), planDelMes(supabase, m)]);
      porMes[m] = { sobres, plan };
    }
    return { porRepartir, transf, ctas, porMes };
  });
  if (error) return <ErrorCarga texto={error} reintentar={recargar} />;
  if (!datos) return <Cargando />;
  const res = async (p: Promise<{ error: { message: string } | null }>) => {
    const r = await p;
    if (!r.error) await recargar();
    return { error: r.error ? (mensajeError(r.error) ?? r.error.message) : null };
  };

  return (
    <Ingreso
      hoy={hoy}
      diaMesSiguiente={parametros.dia_ingreso_mes_siguiente}
      adultos={personas.filter((p) => !p.esMenor).map((p) => ({ id: p.id, nombre: p.nombre }))}
      cuentas={datos.ctas.filter((c) => c.tipo !== "tarjeta_credito").map((c) => ({ id: c.id, nombre: c.nombre }))}
      yo={yo?.id ?? null}
      porRepartir={datos.porRepartir}
      transferencias={datos.transf}
      hayPlan={(m) => !!datos.porMes[m]?.plan && ["aprobado", "en_ejecucion", "en_cierre"].includes(datos.porMes[m]!.plan!.estado)}
      sobresDe={(m) => datos.porMes[m]?.sobres ?? []}
      proponer={(ing) => {
        const mes = datos.porMes[ing.mes];
        if (!mes?.plan || mes.plan.estado === "borrador") return [];
        const lineas = mes.plan.lineas.map((l) => {
          const s = mes.sobres.find((x) => x.id === l.sobreId);
          return {
            sobreId: l.sobreId,
            nombre: s?.nombre ?? "",
            tipo: (s?.tipo ?? "variable") as TipoSobre,
            cuatroParedes: !!s?.cuatroParedes,
            plan: l.monto,
            asignado: Math.max(0, s?.disponible ?? 0),
          };
        });
        const emergenciaUsada = mes.sobres.some((s) => s.tipo === "emergencia" && s.gastado > 0);
        return proponerDistribucion(ing.porRepartir, ing.esVariable, etapa, lineas, { pctVariableAFuturo: parametros.pct_variable_a_futuro, emergenciaUsada });
      }}
      registrar={async (i) => {
        const r = await registrarIngreso(supabase, { ...i, tipo: i.esVariable ? "bono" : "sueldo" });
        if (r.error) return { error: mensajeError(r.error) ?? r.error.message };
        await recargar();
        return {
          error: null,
          ...(r.data?.ajuste_sugerido
            ? { aviso: `El sueldo llegó ${String(r.data.diferencia_pct).replace(".", ",")} % distinto de lo proyectado: conviene ajustar el plan (R33). Ve a Plan del mes.` }
            : {}),
        };
      }}
      repartir={(id, asignaciones) => res(confirmarDistribucion(supabase, id, asignaciones))}
      marcar={(id, hecha) => res(marcarTransferencia(supabase, id, hecha))}
      volver={() => router.back()}
    />
  );
}
