import { formatoPesos } from "@compas/dominio";
import { useState } from "react";
import { View } from "react-native";
import type { Categoria } from "../datos/configuracion";
import type { GrupoRevision } from "../datos/cartolas";
import type { Persona } from "../datos/hogar";
import { Aviso, Boton, Cargando, Etiqueta, colores, Opciones, Pantalla, Parrafo, Subtitulo, Tarjeta, Vacio } from "../ui";

// HU-003-2: revisión en lote por comercio. Confirmar un grupo clasifica los históricos, confirma los
// movimientos del piloto y guarda la regla del comercio para las próximas cartolas.

type Clasificar = (comercio: string, categoriaId: string, integranteId: string | null) => Promise<{ error: string | null; mensaje?: string }>;

export interface PropsRevisar {
  grupos: GrupoRevision[] | null;
  categorias: Categoria[];
  personas: Persona[];
  clasificar: Clasificar;
  sugerirConIA?: () => Promise<string>;
  volver?: () => void;
}

function Grupo({ g, categorias, personas, clasificar }: { g: GrupoRevision } & Pick<PropsRevisar, "categorias" | "personas" | "clasificar">) {
  const opciones = categorias.filter((c) => c.activa && !["futuro", "emergencia", "cuota"].includes(c.tipo));
  const [categoriaId, setCategoriaId] = useState<string | null>(g.categoriaSugeridaId);
  const [elegir, setElegir] = useState(!g.categoriaSugeridaId);
  const [integranteId, setIntegranteId] = useState<string | null>(null);
  const [aviso, setAviso] = useState<{ texto: string; tipo: "error" | "exito" } | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const cat = categorias.find((c) => c.id === categoriaId);
  const necesitaPersona = cat?.tipo === "sin_culpa" || cat?.tipo === "mesada";
  const personasDe = personas.filter((p) => (cat?.tipo === "mesada" ? p.esMenor : !p.esMenor));

  async function confirmar() {
    if (!categoriaId) return setAviso({ texto: "Elige la categoría.", tipo: "error" });
    if (necesitaPersona && !integranteId) return setAviso({ texto: "Indica de quién es el sobre.", tipo: "error" });
    setOcupado(true);
    const r = await clasificar(g.comercio, categoriaId, integranteId);
    setOcupado(false);
    setAviso(r.error ? { texto: r.error, tipo: "error" } : { texto: r.mensaje ?? "Listo.", tipo: "exito" });
  }

  return (
    <Tarjeta>
      <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
        <Subtitulo>{g.comercio}</Subtitulo>
        {g.revisado && <Etiqueta texto="Revisado" color={colores.verde} />}
      </View>
      <Parrafo suave>{`${g.n} ${g.n === 1 ? "movimiento" : "movimientos"} · ${formatoPesos(g.monto)}`}</Parrafo>
      {cat && !elegir ? (
        <Parrafo>{`${g.confianza ? `Sugerido (${Math.round(g.confianza * 100)} %): ` : ""}${cat.nombre}`}</Parrafo>
      ) : (
        <Opciones opciones={opciones.map((c) => ({ valor: c.id, texto: c.nombre }))} valor={categoriaId} onCambio={(v) => { setCategoriaId(v); setElegir(false); }} />
      )}
      {necesitaPersona && (
        <Opciones etiqueta="¿De quién?" opciones={personasDe.map((p) => ({ valor: p.id, texto: p.nombre }))} valor={integranteId} onCambio={setIntegranteId} />
      )}
      {!g.revisado && (
        <View style={{ flexDirection: "row", gap: 8 }}>
          <View style={{ flex: 1 }}><Boton texto="Confirmar grupo" onPress={confirmar} ocupado={ocupado} /></View>
          {cat && !elegir && <View style={{ flex: 1 }}><Boton texto="Cambiar" secundario onPress={() => setElegir(true)} /></View>}
        </View>
      )}
      {aviso && <Aviso texto={aviso.texto} tipo={aviso.tipo} />}
    </Tarjeta>
  );
}

export function Revisar({ grupos, categorias, personas, clasificar, sugerirConIA, volver }: PropsRevisar) {
  const [mensajeIA, setMensajeIA] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const pendientes = (grupos ?? []).filter((g) => !g.revisado);
  return (
    <Pantalla titulo="Revisar movimientos" {...(volver ? { volver } : {})}>
      <Parrafo suave>Agrupados por comercio. Al confirmar un grupo, Compás recuerda la categoría para las próximas cartolas.</Parrafo>
      {sugerirConIA && pendientes.length > 0 && (
        <Boton
          texto="Sugerir categorías con IA"
          secundario
          ocupado={ocupado}
          onPress={async () => {
            setOcupado(true);
            setMensajeIA(await sugerirConIA());
            setOcupado(false);
          }}
        />
      )}
      <Aviso texto={mensajeIA} />
      {!grupos ? <Cargando /> : grupos.length === 0 ? <Vacio texto="No hay movimientos por revisar." /> : null}
      {(grupos ?? []).map((g) => (
        <Grupo key={`${g.comercio}-${g.revisado}`} g={g} categorias={categorias} personas={personas} clasificar={clasificar} />
      ))}
    </Pantalla>
  );
}
