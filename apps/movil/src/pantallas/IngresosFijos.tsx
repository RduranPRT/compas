import { formatoPesos, leerMonto } from "@compas/dominio";
import { useState } from "react";
import { View } from "react-native";
import type { Categoria, IngresoEsperado, PagoFijo } from "../datos/configuracion";
import type { Persona } from "../datos/hogar";
import { Aviso, Boton, Campo, Fila, Opciones, Pantalla, Parrafo, Subtitulo, Tarjeta } from "../ui";

// HU-002-4: ingresos típicos (base o variable, R45) y pagos fijos (CLP o UF, R08) que usa el plan.

type Resultado = Promise<{ error: { message: string } | null }>;

export interface PropsIngresosFijos {
  ingresos: IngresoEsperado[];
  fijos: PagoFijo[];
  personas: Persona[];
  categorias: Categoria[];
  crearIngreso: (i: { integranteId: string; descripcion: string; monto: number; dia: number | null; esBase: boolean }) => Resultado;
  quitarIngreso: (id: string) => Resultado;
  crearFijo: (p: { nombre: string; categoriaId: string; moneda: "CLP" | "UF"; monto: number; dia: number }) => Resultado;
  quitarFijo: (id: string) => Resultado;
  volver?: () => void;
}

export function IngresosFijos({ ingresos, fijos, personas, categorias, crearIngreso, quitarIngreso, crearFijo, quitarFijo, volver }: PropsIngresosFijos) {
  const adultos = personas.filter((p) => !p.esMenor);
  const [ing, setIng] = useState({ quien: adultos[0]?.id ?? "", descripcion: "", monto: "", dia: "", base: "base" as "base" | "variable" });
  const fijas = categorias.filter((c) => c.activa && (c.tipo === "fijo" || c.tipo === "variable"));
  const [fijo, setFijo] = useState({ nombre: "", categoria: fijas[0]?.id ?? "", moneda: "CLP" as "CLP" | "UF", monto: "", dia: "" });
  const [error, setError] = useState<string | null>(null);
  const nombre = (id: string) => personas.find((p) => p.id === id)?.nombre ?? "";
  const totalBase = ingresos.filter((i) => i.esBase).reduce((s, i) => s + i.monto, 0);

  const ejecutar = async (f: () => Resultado) => {
    const r = await f();
    setError(r.error?.message ?? null);
    return !r.error;
  };

  return (
    <Pantalla titulo="Ingresos y pagos fijos" {...(volver ? { volver } : {})}>
      <Tarjeta>
        <Subtitulo>Ingresos típicos</Subtitulo>
        <Parrafo suave>{`El plan se arma con el ingreso base (${formatoPesos(totalBase)}); el variable entra como extra (R45).`}</Parrafo>
        {ingresos.map((i) => (
          <View key={i.id} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <View style={{ flex: 1 }}>
              <Fila etiqueta={i.descripcion} detalle={`${nombre(i.integranteId)} · ${i.esBase ? "base" : "variable"}${i.dia ? ` · día ${i.dia}` : ""}`} valor={i.monto} />
            </View>
            <Boton texto="Quitar" secundario onPress={() => void ejecutar(() => quitarIngreso(i.id))} />
          </View>
        ))}
        <Opciones etiqueta="Quién lo recibe" opciones={adultos.map((p) => ({ valor: p.id, texto: p.nombre }))} valor={ing.quien} onCambio={(v) => setIng({ ...ing, quien: v })} />
        <Campo etiqueta="Descripción" placeholder="Sueldo, bono, honorarios…" value={ing.descripcion} onChangeText={(t) => setIng({ ...ing, descripcion: t })} />
        <View style={{ flexDirection: "row", gap: 8 }}>
          <View style={{ flex: 2 }}><Campo etiqueta="Monto mensual líquido" value={ing.monto} onChangeText={(t) => setIng({ ...ing, monto: t })} keyboardType="numeric" inputMode="numeric" /></View>
          <View style={{ flex: 1 }}><Campo etiqueta="Día" value={ing.dia} onChangeText={(t) => setIng({ ...ing, dia: t })} keyboardType="numeric" inputMode="numeric" /></View>
        </View>
        <Opciones opciones={[{ valor: "base", texto: "Base (estable)" }, { valor: "variable", texto: "Variable (bonos)" }]} valor={ing.base} onCambio={(v) => setIng({ ...ing, base: v })} />
        <Boton
          texto="Agregar ingreso"
          secundario
          onPress={async () => {
            const monto = Math.abs(leerMonto(ing.monto) ?? 0);
            if (!ing.quien || !ing.descripcion.trim() || !monto) return setError("Completa quién, descripción y monto.");
            const dia = Number(ing.dia);
            if (await ejecutar(() => crearIngreso({ integranteId: ing.quien, descripcion: ing.descripcion, monto, dia: dia >= 1 && dia <= 31 ? dia : null, esBase: ing.base === "base" }))) {
              setIng({ ...ing, descripcion: "", monto: "", dia: "" });
            }
          }}
        />
      </Tarjeta>
      <Tarjeta>
        <Subtitulo>Pagos fijos</Subtitulo>
        <Parrafo suave>Un pago nuevo o en UF lleva una holgura de 15 % en su primer plan (R08).</Parrafo>
        {fijos.map((f) => (
          <View key={f.id} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <View style={{ flex: 1 }}>
              <Fila
                etiqueta={f.nombre}
                detalle={`${categorias.find((c) => c.id === f.categoriaId)?.nombre ?? ""} · día ${f.dia}`}
                valor={f.moneda === "UF" ? `${String(f.monto).replace(".", ",")} UF` : f.monto}
              />
            </View>
            <Boton texto="Quitar" secundario onPress={() => void ejecutar(() => quitarFijo(f.id))} />
          </View>
        ))}
        <Campo etiqueta="Nombre" placeholder="Dividendo, Enel, colegio…" value={fijo.nombre} onChangeText={(t) => setFijo({ ...fijo, nombre: t })} />
        <Opciones etiqueta="Categoría" opciones={fijas.map((c) => ({ valor: c.id, texto: c.nombre }))} valor={fijo.categoria} onCambio={(v) => setFijo({ ...fijo, categoria: v })} />
        <Opciones opciones={[{ valor: "CLP", texto: "Pesos" }, { valor: "UF", texto: "UF" }]} valor={fijo.moneda} onCambio={(v) => setFijo({ ...fijo, moneda: v })} />
        <View style={{ flexDirection: "row", gap: 8 }}>
          <View style={{ flex: 2 }}><Campo etiqueta={fijo.moneda === "UF" ? "Monto en UF" : "Monto"} value={fijo.monto} onChangeText={(t) => setFijo({ ...fijo, monto: t })} keyboardType="decimal-pad" inputMode="decimal" /></View>
          <View style={{ flex: 1 }}><Campo etiqueta="Día de pago" value={fijo.dia} onChangeText={(t) => setFijo({ ...fijo, dia: t })} keyboardType="numeric" inputMode="numeric" /></View>
        </View>
        <Boton
          texto="Agregar pago fijo"
          secundario
          onPress={async () => {
            const monto = fijo.moneda === "UF" ? Number(fijo.monto.replace(",", ".")) : Math.abs(leerMonto(fijo.monto) ?? 0);
            const dia = Number(fijo.dia);
            if (!fijo.nombre.trim() || !fijo.categoria || !(monto > 0) || !(dia >= 1 && dia <= 31)) return setError("Completa nombre, categoría, monto y día del pago.");
            if (await ejecutar(() => crearFijo({ nombre: fijo.nombre, categoriaId: fijo.categoria, moneda: fijo.moneda, monto, dia }))) {
              setFijo({ ...fijo, nombre: "", monto: "", dia: "" });
            }
          }}
        />
      </Tarjeta>
      <Aviso texto={error} tipo="error" />
    </Pantalla>
  );
}
