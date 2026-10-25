import { formatoFecha, formatoPesos, leerMonto } from "@compas/dominio";
import { useState } from "react";
import { View } from "react-native";
import { Aviso, Boton, Campo, Enlace, Fila, Pantalla, Parrafo, Subtitulo, Tarjeta } from "../ui";

// HU-010-1: el domingo se cuadran las cuentas con su saldo real (R34) y se despejan los pendientes.

export interface CuentaCierre {
  id: string;
  nombre: string;
  tipo: string;
  saldo: number;
}

export interface PropsCierreSemanal {
  hoy: string;
  ultimoCierre: string | null;
  cuentas: CuentaCierre[];
  pendientes: number;
  irBandeja: () => void;
  cerrar: (fechaCorte: string, saldos: { cuentaId: string; saldoReal: number; motivo?: string }[]) => Promise<{ error: string | null; conciliados?: number }>;
  volver?: () => void;
}

export function CierreSemanal({ hoy, ultimoCierre, cuentas, pendientes, irBandeja, cerrar, volver }: PropsCierreSemanal) {
  const [reales, setReales] = useState<Record<string, string>>({});
  const [motivos, setMotivos] = useState<Record<string, string>>({});
  const [aviso, setAviso] = useState<{ texto: string; tipo: "error" | "exito" } | null>(null);
  const [ocupado, setOcupado] = useState(false);
  // En una tarjeta se escribe la deuda (positiva); el saldo registrado de la tarjeta es negativo
  const real = (c: CuentaCierre) => {
    const v = leerMonto(reales[c.id] ?? "");
    if (v === null) return null;
    return c.tipo === "tarjeta_credito" ? -Math.abs(v) : v;
  };

  async function enviar() {
    const saldos = cuentas.map((c) => ({ c, r: real(c) })).filter((x) => x.r !== null);
    if (!saldos.length) return setAviso({ texto: "Escribe el saldo real de al menos una cuenta.", tipo: "error" });
    const faltaMotivo = saldos.find(({ c, r }) => r !== c.saldo && !(motivos[c.id] ?? "").trim());
    if (faltaMotivo) return setAviso({ texto: `En ${faltaMotivo.c.nombre} hay diferencia; escribe el motivo (R34).`, tipo: "error" });
    setOcupado(true);
    const r = await cerrar(hoy, saldos.map(({ c, r: saldoReal }) => ({ cuentaId: c.id, saldoReal: saldoReal!, motivo: motivos[c.id] ?? "" })));
    setOcupado(false);
    setAviso(r.error ? { texto: r.error, tipo: "error" } : { texto: `Semana cerrada: ${r.conciliados ?? 0} movimientos conciliados.`, tipo: "exito" });
  }

  return (
    <Pantalla titulo="Cierre semanal" {...(volver ? { volver } : {})}>
      <Parrafo suave>{`Unos 15 minutos. ${ultimoCierre ? `Último cierre: ${formatoFecha(ultimoCierre)}.` : "Es el primer cierre."}`}</Parrafo>
      {pendientes > 0 && (
        <Tarjeta>
          <Subtitulo>1. Despejar pendientes</Subtitulo>
          <Enlace texto={`Hay ${pendientes} movimientos por confirmar o posibles duplicados`} onPress={irBandeja} />
        </Tarjeta>
      )}
      <Tarjeta>
        <Subtitulo>{pendientes > 0 ? "2. Cuadrar cuentas" : "1. Cuadrar cuentas"}</Subtitulo>
        <Parrafo suave>Mira el saldo en la app de tu banco y escríbelo; en las tarjetas, la deuda total.</Parrafo>
        {cuentas.map((c) => {
          const r = real(c);
          const dif = r === null ? null : r - c.saldo;
          return (
            <View key={c.id} style={{ gap: 6 }}>
              <Fila etiqueta={c.nombre} detalle="Registrado en Compás" valor={c.tipo === "tarjeta_credito" ? -c.saldo : c.saldo} />
              <Campo etiqueta={c.tipo === "tarjeta_credito" ? `Deuda real de ${c.nombre}` : `Saldo real de ${c.nombre}`} value={reales[c.id] ?? ""} onChangeText={(t) => setReales({ ...reales, [c.id]: t })} keyboardType="numeric" inputMode="numeric" />
              {dif !== null && dif !== 0 && (
                <>
                  <Parrafo suave>{`Diferencia: ${formatoPesos(dif)}`}</Parrafo>
                  <Campo etiqueta={`Motivo de la diferencia en ${c.nombre}`} value={motivos[c.id] ?? ""} onChangeText={(t) => setMotivos({ ...motivos, [c.id]: t })} />
                </>
              )}
            </View>
          );
        })}
      </Tarjeta>
      <Boton texto="Cerrar la semana" onPress={enviar} ocupado={ocupado} />
      {aviso && <Aviso texto={aviso.texto} tipo={aviso.tipo} />}
    </Pantalla>
  );
}
