import { formatoPesos, NOMBRE_KPI, nombreMes, type Kpi } from "@compas/dominio";
import { useState } from "react";
import { View } from "react-native";
import type { GastoCategoria, Periodo } from "../datos/cierres";
import { Aviso, Boton, Campo, Cargando, Enlace, Fila, Opciones, Pantalla, Parrafo, Subtitulo, Tarjeta } from "../ui";

// HU-010-2 y 3: valorar cada categoría (+/0/−), responder una pregunta Kakeibo y cerrar con KPI (R19, R34).

export interface ResumenMes {
  ingresos: number;
  gastos: number;
  porCategoria: GastoCategoria[];
  kpis: Kpi[];
  pendientes: number;
}

export interface PropsCierreMensual {
  periodos: Periodo[];
  periodoId: string | null;
  elegirPeriodo: (id: string) => void;
  resumen: ResumenMes | null;
  lineaBase: boolean;
  irBandeja: () => void;
  valorar: (categoriaId: string, valoracion: "+" | "0" | "-") => Promise<{ error: string | null }>;
  cerrar: (respuestaKakeibo: string, justificacion: string) => Promise<{ error: string | null }>;
  reabrir: (motivo: string) => Promise<{ error: string | null }>;
  volver?: () => void;
}

export const PREGUNTA_KAKEIBO = "¿Qué gasto de este mes valió la pena y cuál cambiarías?";

function formatoKpi(k: Kpi): string {
  if (k.codigo === "K6") return formatoPesos(Math.round(k.valor));
  if (k.codigo === "K2") return `${String(k.valor).replace(".", ",")} meses`;
  if (k.codigo === "ICF") return `${k.valor} / 100`;
  return `${String(Math.round(k.valor * 1000) / 10).replace(".", ",")} %`;
}

export function CierreMensual(p: PropsCierreMensual) {
  const [valoraciones, setValoraciones] = useState<Record<string, "+" | "0" | "-">>({});
  const [respuesta, setRespuesta] = useState("");
  const [justificacion, setJustificacion] = useState("");
  const [motivo, setMotivo] = useState("");
  const [aviso, setAviso] = useState<{ texto: string; tipo: "error" | "exito" } | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const periodo = p.periodos.find((x) => x.id === p.periodoId);
  const cerrado = periodo?.estado === "cerrado";

  return (
    <Pantalla titulo="Cierre del mes" {...(p.volver ? { volver: p.volver } : {})}>
      <Opciones opciones={p.periodos.slice(0, 6).map((x) => ({ valor: x.id, texto: `${nombreMes(x.mes)}${x.estado === "cerrado" ? " ✓" : ""}` }))} valor={p.periodoId} onCambio={p.elegirPeriodo} />
      {!p.resumen || !periodo ? (
        <Cargando />
      ) : (
        <>
          {p.lineaBase && <Parrafo suave>Mes de línea base: se cierra sin presupuesto, para medir el punto de partida (D21).</Parrafo>}
          {p.resumen.pendientes > 0 && !cerrado && (
            <Tarjeta>
              <Enlace texto={`Primero confirma ${p.resumen.pendientes} movimientos pendientes del mes`} onPress={p.irBandeja} />
            </Tarjeta>
          )}
          <Tarjeta>
            <Subtitulo>Indicadores</Subtitulo>
            <Fila etiqueta="Ingresos" valor={p.resumen.ingresos} />
            <Fila etiqueta="Gastos" valor={-p.resumen.gastos} />
            {p.resumen.kpis.map((k) => (
              <Fila key={k.codigo} etiqueta={NOMBRE_KPI[k.codigo]} detalle={k.semaforo === "rojo" ? "Fuera del rango sugerido" : k.semaforo === "amarillo" ? "Por debajo de la meta" : undefined} valor={formatoKpi(k)} />
            ))}
          </Tarjeta>
          {!cerrado && (
            <>
              <Tarjeta>
                <Subtitulo>¿Cómo se sintió cada gasto? (R19)</Subtitulo>
                {p.resumen.porCategoria.map((c) => (
                  <View key={c.categoriaId} style={{ gap: 4 }}>
                    <Fila etiqueta={c.nombre} valor={c.gastado} />
                    <Opciones
                      opciones={[{ valor: "+", texto: "Valió la pena" }, { valor: "0", texto: "Neutro" }, { valor: "-", texto: "Lo cambiaría" }]}
                      valor={valoraciones[c.categoriaId] ?? null}
                      onCambio={async (v) => {
                        setValoraciones({ ...valoraciones, [c.categoriaId]: v });
                        const r = await p.valorar(c.categoriaId, v);
                        if (r.error) setAviso({ texto: r.error, tipo: "error" });
                      }}
                    />
                  </View>
                ))}
                <Campo etiqueta={PREGUNTA_KAKEIBO} value={respuesta} onChangeText={setRespuesta} multiline />
              </Tarjeta>
              <Campo etiqueta="Si falta un estado de cuenta de tarjeta, ¿por qué? (opcional)" value={justificacion} onChangeText={setJustificacion} />
              <Boton
                texto={`Cerrar ${nombreMes(periodo.mes)}`}
                ocupado={ocupado}
                onPress={async () => {
                  setOcupado(true);
                  const r = await p.cerrar(respuesta, justificacion);
                  setOcupado(false);
                  setAviso(r.error ? { texto: r.error, tipo: "error" } : { texto: "Mes cerrado. Los indicadores quedaron guardados.", tipo: "exito" });
                }}
              />
            </>
          )}
          {cerrado && (
            <Tarjeta>
              <Parrafo>Este mes está cerrado. Para corregirlo, reábrelo con un motivo (D20); al volver a cerrarlo se recalculan los indicadores y queda la versión anterior.</Parrafo>
              <Campo etiqueta="Motivo para reabrir" value={motivo} onChangeText={setMotivo} />
              <Boton
                texto="Reabrir el mes"
                secundario
                onPress={async () => {
                  const r = await p.reabrir(motivo);
                  setAviso(r.error ? { texto: r.error, tipo: "error" } : { texto: "Mes reabierto.", tipo: "exito" });
                }}
              />
            </Tarjeta>
          )}
        </>
      )}
      {aviso && <Aviso texto={aviso.texto} tipo={aviso.tipo} />}
    </Pantalla>
  );
}
