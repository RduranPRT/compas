import { formatoFecha, formatoPesos } from "@compas/dominio";
import { useState } from "react";
import { View } from "react-native";
import type { Movimiento, Sobre } from "../datos/finanzas";
import { Aviso, Boton, Cargando, Opciones, Pantalla, Parrafo, Subtitulo, Tarjeta, Vacio } from "../ui";

// HU-005-3: la co-administradora confirma por excepción: pendientes por antigüedad y posibles duplicados (R35, R36).

type Resultado = Promise<{ error: { message: string } | null }>;

export interface PropsBandeja {
  movimientos: (Movimiento & { categoriaSugeridaId: string | null })[] | null;
  duplicados: { id: string; a: Movimiento; b: Movimiento }[];
  sobres: Sobre[];
  confirmar: (id: string, sobreId: string | null) => Resultado;
  descartar: (id: string) => Resultado;
  resolverDuplicado: (id: string, esDuplicado: boolean) => Resultado;
  recargar: () => void;
  volver?: () => void;
}

function resumen(m: Movimiento) {
  return `${formatoFecha(m.fecha)} · ${formatoPesos(m.monto)} · ${m.comercio ?? "sin detalle"} · ${m.cuenta}`;
}

function Pendiente({ m, sobres, confirmar, descartar }: { m: Movimiento & { categoriaSugeridaId: string | null } } & Pick<PropsBandeja, "sobres" | "confirmar" | "descartar">) {
  const sugerido = sobres.find((s) => s.categoriaId && s.categoriaId === m.categoriaSugeridaId)?.id ?? m.sobreId ?? null;
  const [sobreId, setSobreId] = useState<string | null>(sugerido);
  const [elegir, setElegir] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const esGasto = m.tipo === "gasto";
  const nombre = sobres.find((s) => s.id === sobreId)?.nombre;

  async function ok() {
    if (esGasto && !sobreId) return setError("Elige el sobre del gasto.");
    setOcupado(true);
    const r = await confirmar(m.id, sobreId !== m.sobreId ? sobreId : null);
    setOcupado(false);
    if (r.error) setError(r.error.message);
  }

  return (
    <Tarjeta>
      <Parrafo>{resumen(m)}</Parrafo>
      {esGasto ? (
        <Parrafo suave>
          {nombre
            ? `${m.confianza !== null ? `Sugerido (${Math.round(m.confianza * 100)} %): ` : "Sobre: "}${nombre}`
            : "Sin sobre sugerido"}
        </Parrafo>
      ) : (
        <Parrafo suave>Ingreso: al confirmarlo entra a Por asignar (D02).</Parrafo>
      )}
      {esGasto && (elegir || !nombre) && (
        <Opciones opciones={sobres.map((s) => ({ valor: s.id, texto: s.nombre }))} valor={sobreId} onCambio={(v) => { setSobreId(v); setElegir(false); }} />
      )}
      <Aviso texto={error} tipo="error" />
      <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
        <View style={{ flexGrow: 1 }}><Boton texto="Confirmar" onPress={ok} ocupado={ocupado} /></View>
        {esGasto && nombre && !elegir && <View style={{ flexGrow: 1 }}><Boton texto="Cambiar sobre" secundario onPress={() => setElegir(true)} /></View>}
        <View style={{ flexGrow: 1 }}><Boton texto="Descartar" secundario onPress={async () => { const r = await descartar(m.id); if (r.error) setError(r.error.message); }} /></View>
      </View>
    </Tarjeta>
  );
}

export function Bandeja({ movimientos, duplicados, sobres, confirmar, descartar, resolverDuplicado, recargar, volver }: PropsBandeja) {
  const [error, setError] = useState<string | null>(null);
  const conRecarga = <A extends unknown[]>(f: (...a: A) => Resultado) => async (...a: A) => {
    const r = await f(...a);
    if (!r.error) recargar();
    return r;
  };
  const enDuplicado = new Set(duplicados.flatMap((d) => [d.a.id, d.b.id]));
  const solos = (movimientos ?? []).filter((m) => !enDuplicado.has(m.id));
  return (
    <Pantalla titulo="Por confirmar" {...(volver ? { volver } : {})}>
      {!movimientos ? (
        <Cargando />
      ) : solos.length === 0 && duplicados.length === 0 ? (
        <Vacio texto="No hay nada por confirmar. Todo está al día." />
      ) : null}
      {duplicados.length > 0 && (
        <>
          <Subtitulo>Posibles duplicados (R35)</Subtitulo>
          {duplicados.map((d) => (
            <Tarjeta key={d.id}>
              <Parrafo>{resumen(d.a)}</Parrafo>
              <Parrafo>{resumen(d.b)}</Parrafo>
              <Parrafo suave>Mismo monto y medio de pago con fechas cercanas.</Parrafo>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <Boton texto="Es el mismo" onPress={async () => setError((await conRecarga(resolverDuplicado)(d.id, true)).error?.message ?? null)} />
                </View>
                <View style={{ flex: 1 }}>
                  <Boton texto="Son distintos" secundario onPress={async () => setError((await conRecarga(resolverDuplicado)(d.id, false)).error?.message ?? null)} />
                </View>
              </View>
            </Tarjeta>
          ))}
        </>
      )}
      {solos.length > 0 && <Subtitulo>{`Pendientes (${solos.length}), del más antiguo al más nuevo`}</Subtitulo>}
      {solos.map((m) => (
        <Pendiente key={m.id} m={m} sobres={sobres} confirmar={conRecarga(confirmar)} descartar={conRecarga(descartar)} />
      ))}
      <Aviso texto={error} tipo="error" />
    </Pantalla>
  );
}
