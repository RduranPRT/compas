import { formatoFecha, formatoPesos, leerMonto, nombreMes, type Asignacion } from "@compas/dominio";
import { useState } from "react";
import { TextInput, View } from "react-native";
import type { IngresoPorRepartir, Sobre, TransferenciaPendiente } from "../datos/finanzas";
import { Aviso, Boton, Campo, Casilla, colores, Fila, Opciones, Pantalla, Parrafo, Subtitulo, Tarjeta } from "../ui";

// Spec 007 "Llegó un ingreso": registrar, repartir en el orden de la etapa (R04, R45) y marcar transferencias.

type Res = Promise<{ error: string | null }>;

export interface PropsIngreso {
  hoy: string;
  diaMesSiguiente: number;
  adultos: { id: string; nombre: string }[];
  cuentas: { id: string; nombre: string }[];
  yo: string | null;
  porRepartir: IngresoPorRepartir[];
  transferencias: TransferenciaPendiente[];
  hayPlan: (mes: string) => boolean;
  sobresDe: (mes: string) => Sobre[];
  proponer: (ingreso: IngresoPorRepartir) => Asignacion[];
  registrar: (i: { cuentaId: string; monto: number; fecha: string; integranteId: string; esVariable: boolean; paraMesSiguiente: boolean; descripcion: string }) => Promise<{ error: string | null; aviso?: string }>;
  repartir: (ingresoId: string, asignaciones: { sobreId: string; monto: number }[]) => Res;
  marcar: (id: string, hecha: boolean) => Res;
  volver?: () => void;
}

function Reparto({ ingreso, p }: { ingreso: IngresoPorRepartir; p: PropsIngreso }) {
  const [montos, setMontos] = useState<Record<string, number>>(() =>
    Object.fromEntries(p.proponer(ingreso).map((a) => [a.sobreId, a.monto])));
  const [aviso, setAviso] = useState<{ texto: string; tipo: "error" | "exito" } | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const sobres = p.sobresDe(ingreso.mes).filter((s) => !["por_asignar", "proximo_mes"].includes(s.tipo));
  const total = Object.values(montos).reduce((s, x) => s + x, 0);
  const plan = p.hayPlan(ingreso.mes);
  const ordenados = [...sobres].sort((a, b) => (montos[b.id] ?? 0) - (montos[a.id] ?? 0));

  return (
    <Tarjeta>
      <Subtitulo>{`${ingreso.descripcion ?? "Ingreso"} · ${formatoPesos(ingreso.monto)}`}</Subtitulo>
      <Parrafo suave>{`${formatoFecha(ingreso.fecha)} · para ${nombreMes(ingreso.mes)} · quedan ${formatoPesos(ingreso.porRepartir)}${ingreso.esVariable ? " · variable (R45)" : ""}`}</Parrafo>
      {!plan && <Parrafo suave>Sin plan aprobado, el ingreso queda en Por asignar hasta aprobarlo (D02). Puedes repartir igual si lo acuerdan.</Parrafo>}
      {ordenados.map((s) => (
        <View key={s.id} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <View style={{ flex: 1 }}><Parrafo>{s.nombre}</Parrafo></View>
          <TextInput
            accessibilityLabel={`Asignar a ${s.nombre}`}
            value={montos[s.id] ? String(montos[s.id]) : ""}
            placeholder="0"
            onChangeText={(t) => setMontos({ ...montos, [s.id]: Math.max(0, Math.abs(leerMonto(t) ?? 0)) })}
            keyboardType="numeric"
            inputMode="numeric"
            style={{ width: 120, borderWidth: 1, borderColor: colores.borde, borderRadius: 8, padding: 8, textAlign: "right", fontSize: 16 }}
          />
        </View>
      ))}
      <Fila etiqueta="Queda por repartir" valor={ingreso.porRepartir - total} fuerte />
      <Boton
        texto="Confirmar reparto"
        ocupado={ocupado}
        onPress={async () => {
          if (total > ingreso.porRepartir) return setAviso({ texto: `Estás repartiendo ${formatoPesos(total)} y quedan ${formatoPesos(ingreso.porRepartir)} (R01).`, tipo: "error" });
          setOcupado(true);
          const r = await p.repartir(ingreso.id, Object.entries(montos).map(([sobreId, monto]) => ({ sobreId, monto })));
          setOcupado(false);
          setAviso(r.error ? { texto: r.error, tipo: "error" } : { texto: "Reparto confirmado. Las transferencias quedaron como tareas.", tipo: "exito" });
        }}
      />
      {aviso && <Aviso texto={aviso.texto} tipo={aviso.tipo} />}
    </Tarjeta>
  );
}

export function Ingreso(p: PropsIngreso) {
  const [monto, setMonto] = useState("");
  const [quien, setQuien] = useState<string | null>(p.yo && p.adultos.some((a) => a.id === p.yo) ? p.yo : (p.adultos[0]?.id ?? null));
  const [cuenta, setCuenta] = useState<string | null>(p.cuentas[0]?.id ?? null);
  const [tipo, setTipo] = useState<"base" | "variable">("base");
  const [descripcion, setDescripcion] = useState("");
  const dia = Number(p.hoy.slice(8, 10));
  const [siguiente, setSiguiente] = useState(dia >= p.diaMesSiguiente);
  const [aviso, setAviso] = useState<{ texto: string; tipo: "error" | "exito" | "alerta" } | null>(null);
  const [ocupado, setOcupado] = useState(false);

  async function registrar() {
    const m = Math.abs(leerMonto(monto) ?? 0);
    if (!m || !quien || !cuenta) return setAviso({ texto: "Completa monto, quién lo recibe y en qué cuenta.", tipo: "error" });
    setOcupado(true);
    const r = await p.registrar({ cuentaId: cuenta, monto: m, fecha: p.hoy, integranteId: quien, esVariable: tipo === "variable", paraMesSiguiente: siguiente, descripcion: descripcion || (tipo === "base" ? "Sueldo" : "Bono") });
    setOcupado(false);
    if (r.error) return setAviso({ texto: r.error, tipo: "error" });
    setAviso({ texto: r.aviso ?? "Ingreso registrado: está en Por asignar. Repártelo abajo.", tipo: r.aviso ? "alerta" : "exito" });
    setMonto("");
    setDescripcion("");
  }

  return (
    <Pantalla titulo="Llegó un ingreso" {...(p.volver ? { volver: p.volver } : {})}>
      <Tarjeta>
        <Campo etiqueta="Monto líquido" value={monto} onChangeText={setMonto} keyboardType="numeric" inputMode="numeric" />
        <Opciones etiqueta="¿Quién lo recibió?" opciones={p.adultos.map((a) => ({ valor: a.id, texto: a.nombre }))} valor={quien} onCambio={setQuien} />
        <Opciones etiqueta="¿En qué cuenta?" opciones={p.cuentas.map((c) => ({ valor: c.id, texto: c.nombre }))} valor={cuenta} onCambio={setCuenta} />
        <Opciones opciones={[{ valor: "base", texto: "Base (sueldo)" }, { valor: "variable", texto: "Variable (bono)" }]} valor={tipo} onCambio={setTipo} />
        <Campo etiqueta="Descripción (opcional)" value={descripcion} onChangeText={setDescripcion} />
        <Casilla etiqueta="Es para el mes siguiente (D01)" marcada={siguiente} onCambio={setSiguiente} />
        <Boton texto="Registrar ingreso" onPress={registrar} ocupado={ocupado} />
        {aviso && <Aviso texto={aviso.texto} tipo={aviso.tipo} />}
      </Tarjeta>
      {p.porRepartir.length > 0 && <Subtitulo>Por repartir</Subtitulo>}
      {p.porRepartir.map((i) => <Reparto key={i.id} ingreso={i} p={p} />)}
      {p.transferencias.length > 0 && (
        <Tarjeta>
          <Subtitulo>Transferencias pendientes</Subtitulo>
          <Parrafo suave>La app no mueve dinero: hazlas en tu banco y márcalas aquí.</Parrafo>
          {p.transferencias.map((t) => (
            <Casilla
              key={t.id}
              etiqueta={`${formatoPesos(t.monto)} · ${t.sobre ?? t.tipo} · desde ${t.origen}${t.destino ? ` a ${t.destino}` : " a la cuenta personal"}`}
              marcada={false}
              onCambio={() => void p.marcar(t.id, true)}
            />
          ))}
        </Tarjeta>
      )}
    </Pantalla>
  );
}
