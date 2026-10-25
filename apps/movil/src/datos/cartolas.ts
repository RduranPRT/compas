import {
  minimizar,
  prepararLineas,
  tablaComoTexto,
  type LineaCartola,
  type LineaPreparada,
  type ReglaComercio,
  type Tabla,
} from "@compas/dominio";
import * as XLSX from "xlsx";
import type { Cliente } from "./cliente";
import type { Cuenta } from "./configuracion";
import { llamarIA } from "./ia";

// Spec 003 (D27, D30): el archivo se lee en el dispositivo y no se sube; a la base van solo las líneas.

export type Formato = "xlsx" | "csv" | "pdf";

export function formatoDe(nombre: string): Formato | null {
  const ext = nombre.toLowerCase().split(".").pop() ?? "";
  if (ext === "xlsx" || ext === "xls") return "xlsx";
  if (ext === "csv" || ext === "txt") return "csv";
  if (ext === "pdf") return "pdf";
  return null;
}

/** Todas las hojas con datos, una tras otra, como una sola tabla. */
export function leerTabla(contenido: ArrayBuffer): Tabla {
  const libro = XLSX.read(new Uint8Array(contenido), { type: "array", cellDates: true, raw: false, dense: true });
  const filas: Tabla = [];
  for (const nombre of libro.SheetNames) {
    const hoja = libro.Sheets[nombre];
    if (!hoja) continue;
    const datos = XLSX.utils.sheet_to_json<(string | number | Date | null)[]>(hoja, { header: 1, raw: true, defval: null, blankrows: false });
    filas.push(...datos);
  }
  return filas;
}

export interface Importacion {
  id: string;
  cuentaId: string;
  archivo: string;
  estado: string;
  desde: string | null;
  hasta: string | null;
  nFilas: number | null;
  nHistoricos: number | null;
  nMovimientos: number | null;
  nDuplicados: number | null;
  creadoEn: string;
}

export async function importaciones(db: Cliente): Promise<Importacion[]> {
  const { data } = await db.schema("fin").from("importacion").select("*").order("creado_en", { ascending: false });
  return (data ?? []).map((i) => ({
    id: i.id,
    cuentaId: i.cuenta_id,
    archivo: i.archivo_nombre,
    estado: i.estado,
    desde: i.desde,
    hasta: i.hasta,
    nFilas: i.n_filas,
    nHistoricos: i.n_historicos,
    nMovimientos: i.n_movimientos,
    nDuplicados: i.n_duplicados,
    creadoEn: i.creado_en,
  }));
}

export async function reglasComercio(db: Cliente): Promise<ReglaComercio[]> {
  const { data } = await db.schema("fin").from("regla_comercio").select("patron, categoria_id, integrante_id, intencion");
  return data ?? [];
}

/** Extracción con IA (D27): texto de la tabla minimizado → líneas. Null si la IA no está disponible. */
export async function extraerConIA(db: Cliente, tabla: Tabla, tipoCuenta: string, nombresMenores: string[]) {
  const texto = minimizar(tablaComoTexto(tabla), { nombresMenores });
  const r = await llamarIA<{ lineas: LineaCartola[]; totales: { cargos?: number; abonos?: number } | null; filas_no_leidas: string[] }>(
    db, "ia-extraer-cartola", { texto, tipoCuenta },
  );
  return r;
}

export interface ContextoImportacion {
  cuenta: Cuenta;
  cuentas: Cuenta[];
  categoriasPorCodigo: Record<string, string>;
  nombresMenores: string[];
}

export async function preparar(db: Cliente, lineas: LineaCartola[], ctx: ContextoImportacion): Promise<LineaPreparada[]> {
  return prepararLineas(lineas, {
    cuentaId: ctx.cuenta.id,
    tipoCuenta: ctx.cuenta.tipo,
    cuentas: ctx.cuentas.map((c) => ({ id: c.id, nombre: c.nombre, tipo: c.tipo, ultimos4: c.ultimos4 })),
    reglas: await reglasComercio(db),
    categoriasPorCodigo: ctx.categoriasPorCodigo,
    nombresMenores: ctx.nombresMenores,
  });
}

export interface ResultadoImportacion {
  importacion_id: string;
  n_filas: number;
  n_historicos: number;
  n_movimientos: number;
  n_duplicados: number;
  n_transferencias: number;
  n_calzados: number;
  estado: string;
}

export async function importar(
  db: Cliente,
  cuentaId: string,
  archivo: string,
  formato: Formato,
  sha256: string,
  lector: string,
  lineas: LineaPreparada[],
): Promise<{ error: { message: string } | null; data: ResultadoImportacion | null }> {
  const { data, error } = await db.schema("app").rpc("importar_cartola", {
    p_cuenta: cuentaId,
    p_archivo: archivo,
    p_formato: formato,
    p_sha256: sha256,
    p_lector: lector,
    p_lineas: lineas as never,
  });
  return { error, data: data as unknown as ResultadoImportacion | null };
}

export interface GrupoRevision {
  comercio: string;
  origen: "historico" | "movimiento";
  n: number;
  monto: number;
  categoriaSugeridaId: string | null;
  confianza: number | null;
  revisado: boolean;
}

export async function gruposDeRevision(db: Cliente, importacionId: string | null): Promise<GrupoRevision[]> {
  let q = db.schema("fin").from("v_revision_comercio").select("*");
  if (importacionId) q = q.eq("importacion_id", importacionId);
  const { data } = await q;
  // Un comercio puede aparecer como histórico y como movimiento: se revisa una vez
  const porComercio = new Map<string, GrupoRevision>();
  for (const g of data ?? []) {
    const clave = g.comercio ?? "";
    const previo = porComercio.get(clave);
    const nuevo: GrupoRevision = {
      comercio: clave,
      origen: g.origen as GrupoRevision["origen"],
      n: Number(g.n ?? 0) + (previo?.n ?? 0),
      monto: Number(g.monto ?? 0) + (previo?.monto ?? 0),
      categoriaSugeridaId: previo?.categoriaSugeridaId ?? g.categoria_sugerida_id,
      confianza: g.confianza === null ? (previo?.confianza ?? null) : Number(g.confianza),
      revisado: (previo?.revisado ?? true) && !!g.revisado,
    };
    porComercio.set(clave, nuevo);
  }
  return [...porComercio.values()].sort((a, b) => Number(a.revisado) - Number(b.revisado) || b.monto - a.monto);
}

export async function clasificarComercio(db: Cliente, importacionId: string | null, comercio: string, categoriaId: string, integranteId?: string | null) {
  const args: { p_importacion?: string; p_comercio: string; p_categoria: string; p_integrante?: string } = {
    p_comercio: comercio,
    p_categoria: categoriaId,
  };
  if (importacionId) args.p_importacion = importacionId;
  if (integranteId) args.p_integrante = integranteId;
  const { data, error } = await db.schema("app").rpc("clasificar_comercio", args as never);
  return { error, data: data as unknown as { historicos: number; confirmados: number; pendientes: number } | null };
}

/** Sugerencias de la IA por comercio (R36: solo sugerencias). Devuelve cuántas se guardaron. */
export async function sugerirConIA(db: Cliente, importacionId: string, categorias: { id: string; nombre: string; bloque: string; tipo: string }[]) {
  const [{ data: movs }, { data: hist }] = await Promise.all([
    db.schema("fin").from("movimiento").select("id, comercio, nota, monto_clp, sentido").eq("importacion_id", importacionId).eq("estado", "por_confirmar").eq("tipo", "gasto"),
    db.schema("fin").from("movimiento_historico").select("id, comercio, glosa, monto_clp, sentido").eq("importacion_id", importacionId).eq("revisado", false),
  ]);
  const items = [
    ...(movs ?? []).map((m) => ({ clave: `m:${m.id}`, comercio: m.comercio ?? "", glosa: m.nota ?? m.comercio ?? "", monto: Number(m.monto_clp), sentido: (m.sentido ?? "cargo") as "cargo" | "abono" })),
    ...(hist ?? []).map((h) => ({ clave: `h:${h.id}`, comercio: h.comercio ?? "", glosa: h.glosa, monto: Number(h.monto_clp), sentido: h.sentido as "cargo" | "abono" })),
  ].slice(0, 300);
  if (!items.length) return { ok: true as const, guardadas: 0 };
  const opciones = categorias.filter((c) => !["futuro", "emergencia", "cuota"].includes(c.tipo)).map(({ id, nombre, bloque }) => ({ id, nombre, bloque }));
  const r = await llamarIA<{ resultados: { clave: string; categoria_id: string | null; intencion: string | null; confianza: number; clase: string }[]; modelo: string }>(
    db, "ia-clasificar", { items, categorias: opciones },
  );
  if (!r.ok) return r;
  const sugerencias = r.datos.resultados.map((x) => ({
    tabla: x.clave.startsWith("m:") ? "movimiento" : "historico",
    id: x.clave.slice(2),
    categoria_id: x.categoria_id,
    intencion: x.intencion,
    confianza: x.confianza,
    clase: x.clase,
    modelo: r.datos.modelo,
  }));
  const { data } = await db.schema("app").rpc("guardar_sugerencias", { p_items: sugerencias as never });
  return { ok: true as const, guardadas: Number(data ?? 0) };
}
