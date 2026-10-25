import { formatoFecha, formatoPesos, leerMonto } from "@compas/dominio";
import { useState } from "react";
import { View } from "react-native";
import type { Bloque, Categoria, Fondo, TipoSobre } from "../datos/configuracion";
import { Aviso, Boton, Campo, Casilla, Opciones, Pantalla, Parrafo, Subtitulo, Tarjeta, Vacio } from "../ui";

// HU-002-2: categorías sugeridas (15) agrupadas por bloque, editables; fondos de gastos anuales (R03).

type Resultado = Promise<{ error: { message: string } | null }>;

const BLOQUES: { valor: Bloque; texto: string }[] = [
  { valor: "ESENCIALES", texto: "Esenciales" },
  { valor: "FUTURO", texto: "Futuro" },
  { valor: "VIDA", texto: "Vida" },
];

export interface PropsCategorias {
  categorias: Categoria[];
  fondos: Fondo[];
  aplicarPlantilla: () => Resultado;
  guardar: (c: { id?: string; nombre: string; bloque: Bloque; tipo: TipoSobre }) => Resultado;
  activar: (id: string, activa: boolean) => Resultado;
  crearFondo: (f: { nombre: string; categoriaId: string; objetivo: number; fechaObjetivo: string }) => Resultado;
  volver?: () => void;
}

export function Categorias({ categorias, fondos, aplicarPlantilla, guardar, activar, crearFondo, volver }: PropsCategorias) {
  const [nombre, setNombre] = useState("");
  const [bloque, setBloque] = useState<Bloque>("VIDA");
  const [tipo, setTipo] = useState<"variable" | "fijo">("variable");
  const [editando, setEditando] = useState<{ id: string; nombre: string } | null>(null);
  const [fondo, setFondo] = useState({ nombre: "", monto: "", fecha: "" });
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const categoriaFondos = categorias.find((c) => c.tipo === "fondo" && c.activa);

  const ejecutar = async (f: () => Resultado) => {
    setOcupado(true);
    const r = await f();
    setOcupado(false);
    setError(r.error?.message ?? null);
    return !r.error;
  };

  if (categorias.length === 0) {
    return (
      <Pantalla titulo="Categorías" {...(volver ? { volver } : {})}>
        <Vacio
          texto="Parte con las 15 categorías sugeridas del método. Después puedes renombrarlas, desactivarlas o agregar otras."
          accion={<Boton texto="Usar categorías sugeridas" onPress={() => void ejecutar(aplicarPlantilla)} ocupado={ocupado} />}
        />
        <Aviso texto={error} tipo="error" />
      </Pantalla>
    );
  }

  return (
    <Pantalla titulo="Categorías" {...(volver ? { volver } : {})}>
      <Parrafo suave>Las marcadas como Cuatro Paredes (comida, vivienda, servicios y transporte) van primero en una etapa difícil (R05).</Parrafo>
      {BLOQUES.map((b) => (
        <Tarjeta key={b.valor}>
          <Subtitulo>{b.texto}</Subtitulo>
          {categorias.filter((c) => c.bloque === b.valor).map((c) => (
            <View key={c.id} style={{ gap: 6 }}>
              {editando?.id === c.id ? (
                <View style={{ flexDirection: "row", gap: 8, alignItems: "flex-end" }}>
                  <View style={{ flex: 1 }}><Campo etiqueta="Nuevo nombre" value={editando.nombre} onChangeText={(t) => setEditando({ id: c.id, nombre: t })} /></View>
                  <Boton texto="Guardar" onPress={async () => { if (await ejecutar(() => guardar({ id: c.id, nombre: editando.nombre, bloque: c.bloque, tipo: c.tipo }))) setEditando(null); }} />
                </View>
              ) : (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <View style={{ flex: 1 }}>
                    <Casilla etiqueta={`${c.nombre}${c.cuatroParedes ? " · Cuatro Paredes" : ""}`} marcada={c.activa} onCambio={(v) => void ejecutar(() => activar(c.id, v))} />
                  </View>
                  <Boton texto="Renombrar" secundario onPress={() => setEditando({ id: c.id, nombre: c.nombre })} />
                </View>
              )}
            </View>
          ))}
        </Tarjeta>
      ))}
      <Tarjeta>
        <Subtitulo>Agregar categoría</Subtitulo>
        <Campo etiqueta="Nombre" placeholder="Mascotas, Regalos, Hogar…" value={nombre} onChangeText={setNombre} />
        <Opciones etiqueta="Bloque" opciones={BLOQUES} valor={bloque} onCambio={setBloque} />
        <Opciones etiqueta="Tipo" opciones={[{ valor: "variable", texto: "Variable" }, { valor: "fijo", texto: "Fijo" }]} valor={tipo} onCambio={setTipo} />
        <Boton
          texto="Agregar"
          ocupado={ocupado}
          onPress={async () => {
            if (!nombre.trim()) return setError("Escribe el nombre de la categoría.");
            if (await ejecutar(() => guardar({ nombre, bloque, tipo }))) setNombre("");
          }}
        />
      </Tarjeta>
      {categoriaFondos && (
        <Tarjeta>
          <Subtitulo>Fondos de gastos anuales (R03)</Subtitulo>
          <Parrafo suave>Un gasto que llega una vez al año se reparte en cuotas mensuales: (monto − lo ahorrado) / meses que faltan.</Parrafo>
          {fondos.map((f) => (
            <Parrafo key={f.id}>{`${f.nombre}: ${formatoPesos(f.objetivo)}${f.fechaObjetivo ? ` para el ${formatoFecha(f.fechaObjetivo)}` : ""}`}</Parrafo>
          ))}
          <Campo etiqueta="Nombre del fondo" placeholder="Permiso de circulación" value={fondo.nombre} onChangeText={(t) => setFondo({ ...fondo, nombre: t })} />
          <Campo etiqueta="Monto" value={fondo.monto} onChangeText={(t) => setFondo({ ...fondo, monto: t })} keyboardType="numeric" inputMode="numeric" />
          <Campo etiqueta="Fecha (AAAA-MM-DD)" placeholder="2027-03-31" value={fondo.fecha} onChangeText={(t) => setFondo({ ...fondo, fecha: t })} />
          <Boton
            texto="Crear fondo"
            secundario
            onPress={async () => {
              const monto = Math.abs(leerMonto(fondo.monto) ?? 0);
              if (!fondo.nombre.trim() || !monto || !/^\d{4}-\d{2}-\d{2}$/.test(fondo.fecha)) return setError("Completa nombre, monto y fecha del fondo.");
              if (await ejecutar(() => crearFondo({ nombre: fondo.nombre, categoriaId: categoriaFondos.id, objetivo: monto, fechaObjetivo: fondo.fecha }))) {
                setFondo({ nombre: "", monto: "", fecha: "" });
              }
            }}
          />
        </Tarjeta>
      )}
      <Aviso texto={error} tipo="error" />
    </Pantalla>
  );
}
