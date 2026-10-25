import { formatoFecha, formatoPesos, leerMonto } from "@compas/dominio";
import { useState } from "react";
import type { Movimiento } from "../datos/finanzas";
import { Aviso, Boton, Campo, Fila, Pantalla, Parrafo, Subtitulo, Tarjeta } from "../ui";

// Detalle de un movimiento: devolución al sobre original (R29) o descarte con asientos de reverso (I2).

type Res = Promise<{ error: string | null }>;

export interface PropsMovimientoDetalle {
  movimiento: Movimiento;
  esAdmin: boolean;
  hoy: string;
  devolver: (monto: number) => Res;
  descartar: () => Res;
  confirmar: () => void;
  volver: () => void;
}

const ORIGEN: Record<string, string> = { manual: "Anotado a mano", chat: "Anotado por frase", cartola: "Desde cartola", sistema: "Sistema" };

export function MovimientoDetalle({ movimiento: m, esAdmin, devolver, descartar, confirmar, volver }: PropsMovimientoDetalle) {
  const [monto, setMonto] = useState("");
  const [aviso, setAviso] = useState<{ texto: string; tipo: "error" | "exito" } | null>(null);
  const [seguro, setSeguro] = useState(false);
  return (
    <Pantalla titulo={m.comercio ?? (m.tipo === "ingreso" ? "Ingreso" : "Movimiento")} volver={volver}>
      <Tarjeta>
        <Fila etiqueta="Monto" valor={m.tipo === "gasto" ? -m.monto : m.monto} fuerte />
        <Fila etiqueta="Fecha de compra" valor={formatoFecha(m.fecha)} />
        <Fila etiqueta="Medio" valor={m.cuenta} />
        {m.sobre && <Fila etiqueta="Sobre" valor={m.sobre} />}
        {m.intencion && <Fila etiqueta="Intención" valor={m.intencion} />}
        {m.nCuotas && <Fila etiqueta="Cuotas" valor={String(m.nCuotas)} />}
        <Fila etiqueta="Origen" valor={ORIGEN[m.origen] ?? m.origen} />
        {m.nota && <Parrafo suave>{m.nota}</Parrafo>}
      </Tarjeta>
      {m.estado === "por_confirmar" && esAdmin && <Boton texto="Ir a confirmar" onPress={confirmar} />}
      {m.tipo === "gasto" && (m.estado === "confirmado" || m.estado === "conciliado") && (
        <Tarjeta>
          <Subtitulo>Devolución</Subtitulo>
          <Parrafo suave>El monto devuelto vuelve al mismo sobre (R29); si fue con tarjeta, también libera lo apartado.</Parrafo>
          <Campo etiqueta="Monto devuelto" value={monto} onChangeText={setMonto} keyboardType="numeric" inputMode="numeric" />
          <Boton
            texto="Registrar devolución"
            secundario
            onPress={async () => {
              const v = Math.abs(leerMonto(monto) ?? 0);
              if (!v) return setAviso({ texto: "Escribe el monto devuelto.", tipo: "error" });
              const r = await devolver(v);
              setAviso(r.error ? { texto: r.error, tipo: "error" } : { texto: `Devolución de ${formatoPesos(v)} registrada.`, tipo: "exito" });
            }}
          />
        </Tarjeta>
      )}
      {esAdmin && m.estado !== "descartado" && m.tipo !== "transferencia" && (
        seguro ? (
          <Boton
            texto="Sí, descartar"
            peligro
            onPress={async () => {
              const r = await descartar();
              if (r.error) setAviso({ texto: r.error, tipo: "error" });
              else volver();
            }}
          />
        ) : (
          <Boton texto="Descartar movimiento" secundario onPress={() => setSeguro(true)} />
        )
      )}
      {aviso && <Aviso texto={aviso.texto} tipo={aviso.tipo} />}
    </Pantalla>
  );
}
