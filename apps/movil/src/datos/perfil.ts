import { calcularPerfil, hallazgosPorReglas, type Hallazgo, type Perfil } from "@compas/dominio";
import type { Cliente } from "./cliente";
import { categorias, cuentas } from "./configuracion";
import { llamarIA } from "./ia";

// Spec 004: el perfil se calcula en el dominio; la IA (si está disponible) solo redacta los hallazgos.

export interface PerfilGuardado {
  id: string;
  version: number;
  estado: string;
  desde: string;
  hasta: string;
  perfil: Perfil;
  hallazgos: Hallazgo[];
  etapaSugerida: string | null;
  modelo: string;
}

export async function perfilVigente(db: Cliente): Promise<PerfilGuardado | null> {
  const { data } = await db.schema("med").from("perfil_inicial").select("*").neq("estado", "descartado")
    .order("version", { ascending: false }).limit(1).maybeSingle();
  if (!data) return null;
  return {
    id: data.id,
    version: data.version,
    estado: data.estado,
    desde: data.desde,
    hasta: data.hasta,
    perfil: data.perfil as unknown as Perfil,
    hallazgos: data.retroalimentacion as unknown as Hallazgo[],
    etapaSugerida: data.etapa_sugerida,
    modelo: data.modelo,
  };
}

export async function contarHistoricos(db: Cliente): Promise<{ total: number; sinRevisar: number }> {
  const [{ count: total }, { count: sinRevisar }] = await Promise.all([
    db.schema("fin").from("movimiento_historico").select("id", { count: "exact", head: true }),
    db.schema("fin").from("movimiento_historico").select("id", { count: "exact", head: true }).eq("revisado", false).eq("sentido", "cargo")
      .not("clase", "in", "(transferencia_interna,pago_tarjeta)"),
  ]);
  return { total: total ?? 0, sinRevisar: sinRevisar ?? 0 };
}

const REGLAS_PERFIL = [
  ["R03", "Aporte prorrateado a fondos de gastos irregulares"],
  ["R06", "Esenciales sobre 50 % del ingreso → rojo"],
  ["R07", "Futuro bajo el mínimo de la etapa → amarillo"],
  ["R12", "Balance mensual negativo → revisar el mes"],
  ["R17", "Intención del gasto y valoración"],
  ["R23", "La etapa la proponen las reglas o la IA; la confirman las personas"],
  ["R44", "Cada compra con tarjeta se aparta para pagarla"],
  ["R45", "El plan se arma con el ingreso base; el variable es extra"],
].map(([codigo, enunciado]) => ({ codigo: codigo!, enunciado: enunciado! }));

export async function generarPerfil(db: Cliente): Promise<{ error: string | null; conIA: boolean }> {
  const [{ data: hist }, cats, ctas] = await Promise.all([
    db.schema("fin").from("movimiento_historico").select("fecha, sentido, monto_clp, comercio, glosa, clase, categoria_id, cuenta_id").limit(20000),
    categorias(db),
    cuentas(db, false),
  ]);
  if (!hist?.length) return { error: "Primero carga cartolas de julio a septiembre: el perfil se arma con esos meses.", conIA: false };
  const perfil = calcularPerfil(
    hist.map((h) => ({ fecha: h.fecha, sentido: h.sentido as "cargo" | "abono", monto: Number(h.monto_clp), comercio: h.comercio, glosa: h.glosa, clase: h.clase, categoria_id: h.categoria_id, cuenta_id: h.cuenta_id })),
    cats.map((c) => ({ id: c.id, nombre: c.nombre, bloque: c.bloque, codigo: c.codigo })),
    ctas.map((c) => ({ id: c.id, nombre: c.nombre, tipo: c.tipo, saldo: c.saldo })),
  );
  // La IA recibe solo métricas (sin glosas, comercios ni nombres) y redacta (P8)
  const metricas = {
    meses: perfil.meses.length, ingresoBase: perfil.ingresoBase, ingresoVariable: perfil.ingresoVariable,
    gastoMensual: perfil.gastoMensual, gastoPorBloque: perfil.gastoPorBloque, k1: perfil.k1, k2: perfil.k2, k3: perfil.k3,
    k4: perfil.k4, k6: perfil.k6, nPagosFijos: perfil.pagosFijos.length, totalSuscripciones: perfil.suscripciones.reduce((s, x) => s + x.monto, 0),
    gastosIrregulares: perfil.irregulares.reduce((s, x) => s + x.monto, 0),
    tarjetas: perfil.tarjetas.map((t) => ({ facturadoMensual: t.facturadoMensual, pagadoMensual: t.pagadoMensual, pagaTotal: t.pagaTotal })),
    etapaSugerida: perfil.etapaSugerida, razonEtapa: perfil.razonEtapa,
  };
  const ia = await llamarIA<{ hallazgos: Hallazgo[]; modelo: string }>(db, "ia-texto", { tipo: "perfil", metricas, reglas: REGLAS_PERFIL });
  const hallazgos = ia.ok ? ia.datos.hallazgos : hallazgosPorReglas(perfil);
  const desde = perfil.meses[0] ?? hist[0]!.fecha;
  const ultimo = perfil.meses[perfil.meses.length - 1] ?? desde;
  const hasta = hist.reduce((m, h) => (h.fecha > m ? h.fecha : m), ultimo);
  const { error } = await db.schema("app").rpc("guardar_perfil", {
    p_desde: desde,
    p_hasta: hasta,
    p_perfil: perfil as never,
    p_retro: hallazgos as never,
    p_etapa: perfil.etapaSugerida,
    p_modelo: ia.ok ? ia.datos.modelo : "reglas",
  });
  return { error: error?.message ?? null, conIA: ia.ok };
}

export async function decidirPerfil(db: Cliente, id: string, aceptar: boolean) {
  const { error } = await db.schema("app").rpc("decidir_perfil", { p_perfil: id, p_aceptar: aceptar });
  return { error };
}
