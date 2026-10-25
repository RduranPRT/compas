import type { Cliente, Resultado } from "./cliente";
import { integranteActual } from "./integrante";

// Spec 002: cuentas y tarjetas, categorías, fondos, ingresos esperados y pagos fijos (solo administradores).

export type TipoCuenta = "vista" | "ahorro" | "billetera" | "tarjeta_credito" | "inversion";

export interface Cuenta {
  id: string;
  nombre: string;
  tipo: TipoCuenta;
  institucion: string | null;
  ultimos4: string | null;
  saldoInicial: number;
  fechaSaldoInicial: string;
  diaFacturacion: number | null;
  diaPago: number | null;
  cupo: number | null;
  activa: boolean;
  saldo: number;
}

export async function cuentas(db: Cliente, soloActivas = true): Promise<Cuenta[]> {
  let q = db.schema("fin").from("cuenta").select("*").order("creado_en");
  if (soloActivas) q = q.eq("activa", true);
  const [{ data }, { data: saldos }] = await Promise.all([
    q,
    db.schema("fin").from("v_saldo_cuenta").select("cuenta_id, saldo"),
  ]);
  const saldo = new Map((saldos ?? []).map((s) => [s.cuenta_id, Number(s.saldo ?? 0)]));
  return (data ?? []).map((c) => ({
    id: c.id,
    nombre: c.nombre,
    tipo: c.tipo,
    institucion: c.institucion,
    ultimos4: c.ultimos4,
    saldoInicial: Number(c.saldo_inicial),
    fechaSaldoInicial: c.fecha_saldo_inicial,
    diaFacturacion: c.dia_facturacion,
    diaPago: c.dia_pago,
    cupo: c.cupo === null ? null : Number(c.cupo),
    activa: c.activa,
    saldo: saldo.get(c.id) ?? Number(c.saldo_inicial),
  }));
}

export interface NuevaCuenta {
  nombre: string;
  tipo: TipoCuenta;
  institucion?: string;
  ultimos4?: string;
  saldoInicial: number;
  fechaSaldoInicial: string;
  diaFacturacion?: number;
  diaPago?: number;
  cupo?: number;
}

export async function crearCuenta(db: Cliente, c: NuevaCuenta): Resultado {
  const yo = await integranteActual(db);
  if (!yo) return { error: { message: "sin integrante" } };
  const tarjeta = c.tipo === "tarjeta_credito";
  const { error } = await db.schema("fin").from("cuenta").insert({
    hogar_id: yo.hogar_id,
    nombre: c.nombre.trim(),
    tipo: c.tipo,
    institucion: c.institucion?.trim() || null,
    ultimos4: c.ultimos4?.trim() || null,
    // Una tarjeta guarda la deuda como saldo negativo (spec 002)
    saldo_inicial: tarjeta ? -Math.abs(c.saldoInicial) : c.saldoInicial,
    fecha_saldo_inicial: c.fechaSaldoInicial,
    dia_facturacion: tarjeta ? (c.diaFacturacion ?? null) : null,
    dia_pago: tarjeta ? (c.diaPago ?? null) : null,
    cupo: tarjeta ? (c.cupo ?? null) : null,
  });
  return { error };
}

export async function desactivarCuenta(db: Cliente, id: string, activa: boolean): Resultado {
  const { error } = await db.schema("fin").from("cuenta").update({ activa }).eq("id", id);
  return { error };
}

export type Bloque = "ESENCIALES" | "FUTURO" | "VIDA";
export type TipoSobre = "fijo" | "variable" | "fondo" | "futuro" | "emergencia" | "cuota" | "sin_culpa" | "mesada";

export interface Categoria {
  id: string;
  nombre: string;
  bloque: Bloque;
  tipo: TipoSobre;
  cuatroParedes: boolean;
  intencion: string | null;
  codigo: string | null;
  activa: boolean;
}

export async function categorias(db: Cliente, soloActivas = false): Promise<Categoria[]> {
  let q = db.schema("plan").from("categoria").select("*").order("bloque_codigo").order("nombre");
  if (soloActivas) q = q.eq("activa", true);
  const { data } = await q;
  return (data ?? []).map((c) => ({
    id: c.id,
    nombre: c.nombre,
    bloque: c.bloque_codigo as Bloque,
    tipo: c.tipo_sobre as TipoSobre,
    cuatroParedes: c.es_cuatro_paredes,
    intencion: c.intencion_default,
    codigo: c.plantilla_codigo,
    activa: c.activa,
  }));
}

export async function aplicarPlantilla(db: Cliente): Promise<{ error: { message: string } | null; creadas: number }> {
  const { data, error } = await db.schema("app").rpc("aplicar_plantilla_categorias");
  return { error, creadas: data ?? 0 };
}

export async function guardarCategoria(
  db: Cliente,
  c: { id?: string; nombre: string; bloque: Bloque; tipo: TipoSobre; activa?: boolean },
): Resultado {
  if (c.id) {
    const cambio: { nombre: string; activa?: boolean } = { nombre: c.nombre.trim() };
    if (c.activa !== undefined) cambio.activa = c.activa;
    const { error } = await db.schema("plan").from("categoria").update(cambio).eq("id", c.id);
    return { error };
  }
  const yo = await integranteActual(db);
  if (!yo) return { error: { message: "sin integrante" } };
  const { error } = await db.schema("plan").from("categoria").insert({
    hogar_id: yo.hogar_id,
    nombre: c.nombre.trim(),
    bloque_codigo: c.bloque,
    tipo_sobre: c.tipo,
    intencion_default: c.bloque === "VIDA" ? "deseo" : c.bloque === "ESENCIALES" ? "supervivencia" : null,
  });
  return { error };
}

export async function activarCategoria(db: Cliente, id: string, activa: boolean): Resultado {
  const { error } = await db.schema("plan").from("categoria").update({ activa }).eq("id", id);
  return { error };
}

export interface Fondo {
  id: string;
  nombre: string;
  categoriaId: string;
  objetivo: number;
  fechaObjetivo: string | null;
  activo: boolean;
}

export async function fondos(db: Cliente): Promise<Fondo[]> {
  const { data } = await db.schema("plan").from("fondo").select("*").eq("activo", true).order("nombre");
  return (data ?? []).map((f) => ({
    id: f.id,
    nombre: f.nombre,
    categoriaId: f.categoria_id,
    objetivo: Number(f.monto_objetivo),
    fechaObjetivo: f.fecha_objetivo,
    activo: f.activo,
  }));
}

export async function crearFondo(db: Cliente, f: { nombre: string; categoriaId: string; objetivo: number; fechaObjetivo: string }): Resultado {
  const yo = await integranteActual(db);
  if (!yo) return { error: { message: "sin integrante" } };
  const { error } = await db.schema("plan").from("fondo").insert({
    hogar_id: yo.hogar_id,
    categoria_id: f.categoriaId,
    tipo: "gasto_verdadero",
    nombre: f.nombre.trim(),
    monto_objetivo: f.objetivo,
    fecha_objetivo: f.fechaObjetivo,
  });
  return { error };
}

export interface IngresoEsperado {
  id: string;
  integranteId: string;
  descripcion: string;
  tipo: "sueldo" | "honorarios_liquido" | "bono" | "gratificacion" | "reajuste" | "otro";
  monto: number;
  dia: number | null;
  esBase: boolean;
  cuentaId: string | null;
}

export async function ingresosEsperados(db: Cliente): Promise<IngresoEsperado[]> {
  const { data } = await db.schema("plan").from("ingreso_esperado").select("*").is("vigente_hasta", null).order("monto", { ascending: false });
  return (data ?? []).map((i) => ({
    id: i.id,
    integranteId: i.integrante_id,
    descripcion: i.descripcion,
    tipo: i.tipo_ingreso,
    monto: Number(i.monto),
    dia: i.dia_esperado,
    esBase: i.es_base,
    cuentaId: i.cuenta_id,
  }));
}

export async function crearIngresoEsperado(
  db: Cliente,
  i: { integranteId: string; descripcion: string; monto: number; dia?: number | null; esBase: boolean; desde: string; cuentaId?: string | null },
): Resultado {
  const yo = await integranteActual(db);
  if (!yo) return { error: { message: "sin integrante" } };
  const { error } = await db.schema("plan").from("ingreso_esperado").insert({
    hogar_id: yo.hogar_id,
    integrante_id: i.integranteId,
    descripcion: i.descripcion.trim(),
    tipo_ingreso: i.esBase ? "sueldo" : "bono",
    monto: i.monto,
    dia_esperado: i.dia ?? null,
    es_base: i.esBase,
    vigente_desde: i.desde,
    cuenta_id: i.cuentaId ?? null,
  });
  return { error };
}

export async function cerrarIngresoEsperado(db: Cliente, id: string, hasta: string): Resultado {
  const { error } = await db.schema("plan").from("ingreso_esperado").update({ vigente_hasta: hasta }).eq("id", id);
  return { error };
}

export interface PagoFijo {
  id: string;
  nombre: string;
  categoriaId: string;
  moneda: "CLP" | "UF";
  monto: number;
  dia: number;
  vigenteDesde: string;
}

export async function pagosFijos(db: Cliente): Promise<PagoFijo[]> {
  const { data } = await db.schema("plan").from("pago_fijo").select("*").is("vigente_hasta", null).order("dia_vencimiento");
  return (data ?? []).map((p) => ({
    id: p.id,
    nombre: p.nombre,
    categoriaId: p.categoria_id,
    moneda: p.moneda as "CLP" | "UF",
    monto: Number(p.monto),
    dia: p.dia_vencimiento,
    vigenteDesde: p.vigente_desde,
  }));
}

export async function crearPagoFijo(
  db: Cliente,
  p: { nombre: string; categoriaId: string; moneda: "CLP" | "UF"; monto: number; dia: number; desde: string },
): Resultado {
  const yo = await integranteActual(db);
  if (!yo) return { error: { message: "sin integrante" } };
  const { error } = await db.schema("plan").from("pago_fijo").insert({
    hogar_id: yo.hogar_id,
    categoria_id: p.categoriaId,
    nombre: p.nombre.trim(),
    moneda: p.moneda,
    monto: p.monto,
    dia_vencimiento: p.dia,
    vigente_desde: p.desde,
  });
  return { error };
}

export async function cerrarPagoFijo(db: Cliente, id: string, hasta: string): Resultado {
  const { error } = await db.schema("plan").from("pago_fijo").update({ vigente_hasta: hasta }).eq("id", id);
  return { error };
}
