import type { Cliente, Resultado } from "./cliente";
import { integranteActual } from "./integrante";

// Spec 011 (Ley 21.719): consentimientos, exportación y borrado del hogar.

export interface Consentimiento {
  id: string;
  titularId: string;
  titular: string;
  finalidad: string;
  version: string;
  otorgadoEn: string;
  revocadoEn: string | null;
}

export async function consentimientos(db: Cliente): Promise<Consentimiento[]> {
  const { data } = await db.schema("gob").from("consentimiento").select("id, titular_id, finalidad, version_texto, otorgado_en, revocado_en, titular:integrante!titular_id(nombre)")
    .order("otorgado_en", { ascending: false });
  return (data ?? []).map((c) => ({
    id: c.id,
    titularId: c.titular_id,
    titular: c.titular?.nombre ?? "",
    finalidad: c.finalidad,
    version: c.version_texto,
    otorgadoEn: c.otorgado_en,
    revocadoEn: c.revocado_en,
  }));
}

export async function revocar(db: Cliente, finalidad: "uso_app" | "datos_menor" | "analitica_ia", titularId?: string): Resultado {
  const args: { p_finalidad: typeof finalidad; p_titular?: string } = { p_finalidad: finalidad };
  if (titularId) args.p_titular = titularId;
  const { error } = await db.schema("app").rpc("revocar_consentimiento", args);
  return { error };
}

export async function otorgar(db: Cliente, finalidad: "analitica_ia", version: string): Resultado {
  const yo = await integranteActual(db);
  if (!yo) return { error: { message: "sin integrante" } };
  const { error } = await db.schema("gob").from("consentimiento").insert({
    hogar_id: yo.hogar_id, titular_id: yo.id, otorgado_por_id: yo.id, finalidad, version_texto: version,
  });
  return { error };
}

const TABLAS: [string, string][] = [
  ["gob", "hogar"], ["gob", "integrante"], ["gob", "consentimiento"], ["gob", "acuerdo_hogar"], ["gob", "regla_hogar"],
  ["fin", "cuenta"], ["fin", "movimiento"], ["fin", "transferencia"], ["fin", "movimiento_historico"], ["fin", "importacion"],
  ["fin", "conciliacion"], ["fin", "deuda"], ["plan", "categoria"], ["plan", "periodo"], ["plan", "v_sobre"],
  ["plan", "presupuesto_mensual"], ["plan", "linea_plan"], ["plan", "ingreso_esperado"], ["plan", "pago_fijo"], ["plan", "fondo"],
  ["med", "cierre"], ["med", "reflexion"], ["med", "medicion_kpi"], ["med", "perfil_inicial"],
];

/** Todos los datos que la persona puede ver (la RLS decide), en JSON y un CSV de movimientos (D19). */
export async function exportarDatos(db: Cliente): Promise<{ json: string; csv: string }> {
  const resultado: Record<string, unknown[]> = {};
  for (const [esquema, tabla] of TABLAS) {
    const { data } = await db.schema(esquema as "gob").from(tabla as "hogar").select("*");
    resultado[`${esquema}.${tabla}`] = data ?? [];
  }
  const movs = (resultado["fin.movimiento"] ?? []) as Record<string, unknown>[];
  const columnas = ["fecha_contable", "tipo", "estado", "monto_clp", "comercio", "nota", "intencion", "origen"];
  const csv = [columnas.join(";"), ...movs.map((m) => columnas.map((c) => `"${String(m[c] ?? "").replace(/"/g, '""')}"`).join(";"))].join("\n");
  await db.schema("app").rpc("registrar_exportacion");
  return { json: JSON.stringify({ exportado_en: new Date().toISOString(), datos: resultado }, null, 2), csv };
}

export async function solicitarBorrado(db: Cliente) {
  const { data, error } = await db.schema("app").rpc("solicitar_borrado_hogar");
  return { error, solicitudId: data as string | null };
}

export async function anularBorrado(db: Cliente): Resultado {
  const { error } = await db.schema("app").rpc("anular_borrado_hogar");
  return { error };
}
