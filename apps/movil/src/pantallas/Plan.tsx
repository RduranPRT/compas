import { formatoPesos, leerMonto, nombreMes, sumarMeses, type EstadoBloque } from "@compas/dominio";
import { useEffect, useState } from "react";
import { View } from "react-native";
import type { Sobre } from "../datos/finanzas";
import { Aviso, Boton, Cargando, colores, Fila, Pantalla, Parrafo, Subtitulo, Tarjeta, Vacio } from "../ui";
import { TextInput } from "react-native";

// HU-006-1 a 3: borrador base cero con la razón de cada línea, semáforo al instante y aprobación (R01, R06, R07, R39).

export interface LineaVista {
  sobreId: string;
  monto: number;
  regla: string | null;
  explicacion: string | null;
}

export interface PropsPlan {
  mes: string;
  mesPrimerPlan: string;
  cargando: boolean;
  plan: { id: string | null; version: number; estado: string; ingreso: number; lineas: LineaVista[] } | null;
  sobres: Sobre[];
  semaforo: (lineas: LineaVista[], ingreso: number) => EstadoBloque[];
  esAdmin: boolean;
  cambiarMes: (mes: string) => void;
  generar: () => Promise<{ error: string | null }>;
  guardar: (ingreso: number, lineas: LineaVista[]) => Promise<{ error: string | null }>;
  enviar: () => Promise<{ error: string | null }>;
  volver?: () => void;
}

const ESTADO: Record<string, string> = {
  borrador: "Borrador",
  aprobado: "Aprobado",
  en_ejecucion: "En ejecución",
  en_cierre: "En cierre",
  cerrado: "Cerrado",
};

export function Plan({ mes, mesPrimerPlan, cargando, plan, sobres, semaforo, esAdmin, cambiarMes, generar, guardar, enviar, volver }: PropsPlan) {
  const [lineas, setLineas] = useState<LineaVista[]>(plan?.lineas ?? []);
  const [ingreso, setIngreso] = useState(plan?.ingreso ?? 0);
  const [aviso, setAviso] = useState<{ texto: string; tipo: "error" | "exito" | "info" } | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [sucio, setSucio] = useState(false);
  useEffect(() => {
    setLineas(plan?.lineas ?? []);
    setIngreso(plan?.ingreso ?? 0);
    setSucio(false);
  }, [plan]);

  const editable = !!plan && plan.estado === "borrador" && esAdmin;
  const suma = lineas.reduce((s, l) => s + l.monto, 0);
  const porAsignar = ingreso - suma;
  const bloques = semaforo(lineas, ingreso);
  const nombre = (id: string) => sobres.find((s) => s.id === id)?.nombre ?? "Sobre";
  const enLinea = new Set(lineas.map((l) => l.sobreId));
  const sinLinea = sobres.filter((s) => !enLinea.has(s.id) && !["por_asignar", "proximo_mes", "cuota"].includes(s.tipo));

  const ejecutar = async (f: () => Promise<{ error: string | null }>, ok: string) => {
    setOcupado(true);
    const r = await f();
    setOcupado(false);
    setAviso(r.error ? { texto: r.error, tipo: "error" } : { texto: ok, tipo: "exito" });
    if (!r.error) setSucio(false);
    return !r.error;
  };

  const cambiar = (sobreId: string, texto: string) => {
    const monto = Math.max(0, Math.abs(leerMonto(texto) ?? 0));
    setSucio(true);
    setLineas((ls) => (ls.some((l) => l.sobreId === sobreId)
      ? ls.map((l) => (l.sobreId === sobreId ? { ...l, monto, regla: l.regla, explicacion: "Ajustado a mano" } : l))
      : [...ls, { sobreId, monto, regla: null, explicacion: "Ajustado a mano" }]));
  };

  return (
    <Pantalla titulo={`Plan de ${nombreMes(mes)}`} {...(volver ? { volver } : {})}>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <View style={{ flex: 1 }}><Boton texto="‹ Mes anterior" secundario onPress={() => cambiarMes(sumarMeses(mes, -1))} /></View>
        <View style={{ flex: 1 }}><Boton texto="Mes siguiente ›" secundario onPress={() => cambiarMes(sumarMeses(mes, 1))} /></View>
      </View>
      {mes < mesPrimerPlan && (
        <Parrafo suave>{`Este mes es línea base: se registra sin presupuesto. El primer plan es el de ${nombreMes(mesPrimerPlan)} (D21).`}</Parrafo>
      )}
      {cargando ? (
        <Cargando />
      ) : !plan ? (
        <Vacio
          texto="Aún no hay plan para este mes. Compás arma un borrador base cero con tus ingresos base, pagos fijos, fondos, cuotas y la deuda de la tarjeta, en el orden de tu etapa."
          accion={esAdmin ? <Boton texto="Generar borrador" onPress={() => void ejecutar(generar, "Borrador listo. Ajusta lo que quieras y envíalo a aprobación.")} ocupado={ocupado} /> : undefined}
        />
      ) : (
        <>
          <Parrafo suave>{`Versión ${plan.version} · ${ESTADO[plan.estado] ?? plan.estado}`}</Parrafo>
          <Tarjeta>
            <Subtitulo>Semáforo 50/30/20</Subtitulo>
            {bloques.map((b) => (
              <Fila
                key={b.bloque}
                etiqueta={`${b.bloque === "ESENCIALES" ? "Esenciales" : b.bloque === "FUTURO" ? "Futuro" : "Vida"} · ${String(b.pct).replace(".", ",")} %`}
                detalle={b.color !== "verde" ? b.mensaje : undefined}
                valor={<View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: b.color === "rojo" ? colores.rojo : b.color === "amarillo" ? colores.amarillo : colores.verde }} />}
              />
            ))}
            <Parrafo suave>El semáforo informa; no impide aprobar (P3).</Parrafo>
          </Tarjeta>
          <Tarjeta>
            <Fila etiqueta="Ingreso base proyectado" valor={ingreso} fuerte />
            <Fila etiqueta="Por asignar" valor={porAsignar} fuerte detalle={porAsignar === 0 ? "Cada peso tiene una tarea (P1)" : porAsignar > 0 ? "Falta asignar este monto" : "Las líneas superan el ingreso"} />
          </Tarjeta>
          {lineas.map((l) => (
            <Tarjeta key={l.sobreId}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <Parrafo>{nombre(l.sobreId)}</Parrafo>
                  {l.explicacion ? <Parrafo suave>{`${l.explicacion}${l.regla && !l.explicacion.includes(l.regla) ? ` (${l.regla})` : ""}`}</Parrafo> : null}
                </View>
                {editable ? (
                  <TextInput
                    accessibilityLabel={`Monto de ${nombre(l.sobreId)}`}
                    value={String(l.monto)}
                    onChangeText={(t) => cambiar(l.sobreId, t)}
                    keyboardType="numeric"
                    inputMode="numeric"
                    style={{ width: 120, borderWidth: 1, borderColor: colores.borde, borderRadius: 8, padding: 8, textAlign: "right", fontSize: 16 }}
                  />
                ) : (
                  <Parrafo>{formatoPesos(l.monto)}</Parrafo>
                )}
              </View>
            </Tarjeta>
          ))}
          {editable && sinLinea.length > 0 && (
            <Tarjeta>
              <Subtitulo>Otros sobres</Subtitulo>
              {sinLinea.map((s) => (
                <View key={s.id} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <View style={{ flex: 1 }}><Parrafo>{s.nombre}</Parrafo></View>
                  <TextInput
                    accessibilityLabel={`Monto de ${s.nombre}`}
                    placeholder="0"
                    onChangeText={(t) => cambiar(s.id, t)}
                    keyboardType="numeric"
                    inputMode="numeric"
                    style={{ width: 120, borderWidth: 1, borderColor: colores.borde, borderRadius: 8, padding: 8, textAlign: "right", fontSize: 16 }}
                  />
                </View>
              ))}
            </Tarjeta>
          )}
          {editable && (
            <View style={{ gap: 8 }}>
              {sucio && <Boton texto="Guardar cambios" secundario onPress={() => void ejecutar(() => guardar(ingreso, lineas), "Cambios guardados.")} ocupado={ocupado} />}
              <Boton
                texto="Enviar a aprobación"
                ocupado={ocupado}
                onPress={async () => {
                  if (sucio && !(await ejecutar(() => guardar(ingreso, lineas), "Cambios guardados."))) return;
                  await ejecutar(enviar, "Enviado: el organizador lo aprueba; si no responde en 48 horas, decide el suplente (R39).");
                }}
              />
              <Boton texto="Rehacer borrador" secundario onPress={() => void ejecutar(generar, "Borrador recalculado.")} />
            </View>
          )}
        </>
      )}
      {aviso && <Aviso texto={aviso.texto} tipo={aviso.tipo} />}
    </Pantalla>
  );
}
