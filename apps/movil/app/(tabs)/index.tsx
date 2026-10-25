import { hoyIso, mesDe } from "@compas/dominio";
import { router } from "expo-router";
import { contarPendientes, pronosticoMes, sobresDelMes, tarjetas, transferenciasPendientes } from "../../src/datos/finanzas";
import { avisos, puedoFirmar, solicitudesPendientes } from "../../src/datos/gobierno";
import { firmaPendienteDelAcuerdo } from "../../src/datos/hogar";
import { useHogar } from "../../src/lib/hogar";
import { supabase } from "../../src/lib/supabase";
import { useDatos } from "../../src/lib/useDatos";
import { Portada, type PasoConfiguracion } from "../../src/pantallas/Portada";
import { Cargando } from "../../src/ui";

async function contar(esquema: "fin" | "plan" | "med" | "gob", tabla: string, filtro?: [string, string]): Promise<number> {
  let q = supabase.schema(esquema as "fin").from(tabla as "cuenta").select("id", { count: "exact", head: true });
  if (filtro) q = q.eq(filtro[0] as "id", filtro[1]);
  const { count } = await q;
  return count ?? 0;
}

export default function RutaPortada() {
  const { hogar, yo, esAdmin, parametros } = useHogar();
  const hoy = hoyIso();
  const mes = mesDe(hoy);
  const { datos } = useDatos(async () => {
    if (!yo) return null;
    const [firma, sobres, pend, tarj, transf, avs, sols, nCuentas, nCategorias, nIngresos, nCartolas, nPerfil, nEtapa, nPlan] = await Promise.all([
      firmaPendienteDelAcuerdo(supabase),
      sobresDelMes(supabase, hoy).catch(() => []),
      contarPendientes(supabase),
      tarjetas(supabase),
      transferenciasPendientes(supabase),
      avisos(supabase, 10),
      solicitudesPendientes(supabase),
      contar("fin", "cuenta"),
      contar("plan", "categoria"),
      contar("plan", "ingreso_esperado"),
      contar("fin", "importacion"),
      contar("med", "perfil_inicial"),
      contar("gob", "historial_etapa", ["estado", "confirmada"]),
      contar("plan", "presupuesto_mensual"),
    ]);
    const pronostico = await pronosticoMes(supabase, hoy).catch(() => null);
    return { firma, sobres, pend, tarj, transf, avs, sols, nCuentas, nCategorias, nIngresos, nCartolas, nPerfil, nEtapa, nPlan, pronostico };
  }, [yo?.id]);

  if (!hogar || !datos) return <Cargando />;
  const ir = (ruta: string) => router.push(ruta as never);
  const pasos: PasoConfiguracion[] = esAdmin
    ? [
        { clave: "cuentas", texto: "Cargar tus cuentas y tarjetas", hecho: datos.nCuentas > 0, ir: () => ir("/cuentas") },
        { clave: "categorias", texto: "Elegir categorías", hecho: datos.nCategorias > 0, ir: () => ir("/categorias") },
        { clave: "ingresos", texto: "Declarar ingresos y pagos fijos", hecho: datos.nIngresos > 0, ir: () => ir("/ingresos-fijos") },
        { clave: "cartolas", texto: "Cargar cartolas de julio en adelante", hecho: datos.nCartolas > 0, ir: () => ir("/cargar-cartola") },
        { clave: "perfil", texto: "Ver tu punto de partida", hecho: datos.nPerfil > 0, ir: () => ir("/perfil") },
        { clave: "etapa", texto: "Confirmar la etapa del hogar", hecho: datos.nEtapa > 0, ir: () => ir("/perfil") },
        { clave: "plan", texto: "Aprobar el primer plan", hecho: datos.nPlan > 0, ir: () => ir("/plan") },
      ]
    : [];
  const porAsignar = datos.sobres.find((s) => s.tipo === "por_asignar")?.saldo;
  const gastado = datos.sobres.filter((s) => s.tipo !== "por_asignar" && s.tipo !== "pago_tarjeta").reduce((s, x) => s + x.gastado, 0);
  const avisosNuevos = datos.avs.filter((a) => a.estado === "enviada");
  return (
    <Portada
      nombreHogar={hogar.nombre}
      firmaPendiente={datos.firma}
      mes={mes}
      lineaBase={mes < parametros.mes_primer_plan}
      mesPrimerPlan={parametros.mes_primer_plan}
      pasos={pasos}
      avisos={avisosNuevos}
      aprobaciones={yo ? datos.sols.filter((s) => puedoFirmar(s, yo.id)).length : 0}
      pendientes={esAdmin ? datos.pend : 0}
      {...(porAsignar !== undefined ? { porAsignar } : {})}
      gastadoMes={gastado}
      pronostico={datos.pronostico}
      tarjetas={datos.tarj.map((t) => ({ id: t.id, nombre: t.nombre, deuda: t.deuda, apartado: t.apartado, diaPago: t.diaPago }))}
      transferencias={datos.transf.length}
      ir={ir}
    />
  );
}
