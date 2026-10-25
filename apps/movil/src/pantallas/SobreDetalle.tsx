import { formatoFecha, formatoPesos, leerMonto } from "@compas/dominio";
import { useState } from "react";
import type { Movimiento, Sobre } from "../datos/finanzas";
import { Aviso, Barra, Boton, Campo, Fila, Opciones, Pantalla, Parrafo, Subtitulo, Tarjeta, Vacio } from "../ui";

// HU-009-2: un sobre negativo ofrece de dónde cubrirlo. Futuro y emergencia piden doble firma (R37);
// bajo el umbral se aplica de inmediato (R38); sobre el umbral, lo aprueba el otro administrador.

export interface PropsSobreDetalle {
  sobre: Sobre;
  otros: Sobre[];
  movimientos: Movimiento[];
  esAdmin: boolean;
  umbralPct: number;
  reasignar: (origenId: string, destinoId: string, monto: number, motivo: string) => Promise<{ error: { message: string } | null; estado: "aplicada" | "pendiente" | null }>;
  volver: () => void;
}

export function SobreDetalle({ sobre, otros, movimientos, esAdmin, umbralPct, reasignar, volver }: PropsSobreDetalle) {
  const deficit = sobre.saldo < 0 ? -sobre.saldo : 0;
  // Orígenes sugeridos: Vida primero, luego otros esenciales; Futuro y emergencia al final (R10, R37)
  const prioridad = (s: Sobre) => (s.tipo === "futuro" || s.tipo === "emergencia" ? 3 : s.bloque === "VIDA" ? 0 : s.bloque === "ESENCIALES" ? 1 : 2);
  const origenes = otros
    .filter((s) => s.id !== sobre.id && s.saldo > 0 && !["por_asignar", "pago_tarjeta", "proximo_mes"].includes(s.tipo))
    .sort((a, b) => prioridad(a) - prioridad(b) || b.saldo - a.saldo);
  const [origen, setOrigen] = useState<string | null>(origenes[0]?.id ?? null);
  const [montoTexto, setMontoTexto] = useState(deficit ? String(deficit) : "");
  const [motivo, setMotivo] = useState("");
  const [aviso, setAviso] = useState<{ texto: string; tipo: "error" | "exito" | "info" } | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const elegido = origenes.find((s) => s.id === origen);
  const monto = Math.abs(leerMonto(montoTexto) ?? 0);
  const necesitaDoble = elegido?.tipo === "futuro" || elegido?.tipo === "emergencia";
  const automatica = elegido && !necesitaDoble && monto <= Math.floor((Math.max(elegido.disponible, elegido.saldo) * umbralPct) / 100);

  async function mover() {
    if (!origen || !monto) return setAviso({ texto: "Elige de qué sobre y cuánto mover.", tipo: "error" });
    setOcupado(true);
    const r = await reasignar(origen, sobre.id, monto, motivo.trim());
    setOcupado(false);
    if (r.error) return setAviso({ texto: r.error.message, tipo: "error" });
    setAviso(r.estado === "aplicada"
      ? { texto: `Listo: se movieron ${formatoPesos(monto)} a ${sobre.nombre}.`, tipo: "exito" }
      : { texto: necesitaDoble ? "Quedó pendiente de la firma de ambos administradores (R37)." : "Quedó pendiente de la aprobación del otro administrador.", tipo: "info" });
  }

  return (
    <Pantalla titulo={sobre.nombre} volver={volver}>
      <Tarjeta>
        <Fila etiqueta="Saldo" valor={sobre.saldo} fuerte />
        <Fila etiqueta="Disponible en el mes" valor={sobre.disponible} />
        <Fila etiqueta="Gastado" valor={sobre.gastado} />
        {sobre.disponible > 0 && <Barra valor={sobre.gastado} total={sobre.disponible} />}
      </Tarjeta>
      {deficit > 0 && <Parrafo>{`Este sobre quedó en ${formatoPesos(sobre.saldo)}. Se cubre moviendo dinero desde otro sobre (R10).`}</Parrafo>}
      {esAdmin && sobre.tipo !== "por_asignar" && sobre.tipo !== "pago_tarjeta" && (
        <Tarjeta>
          <Subtitulo>{deficit > 0 ? "Cubrir este sobre" : "Traer dinero desde otro sobre"}</Subtitulo>
          {origenes.length === 0 ? (
            <Parrafo suave>No hay otros sobres con saldo este mes. Puedes repartir un ingreso o esperar el próximo.</Parrafo>
          ) : (
            <>
              <Opciones etiqueta="Desde" opciones={origenes.map((s) => ({ valor: s.id, texto: `${s.nombre} (${formatoPesos(s.saldo)})` }))} valor={origen} onCambio={setOrigen} />
              <Campo etiqueta="Monto" value={montoTexto} onChangeText={setMontoTexto} keyboardType="numeric" inputMode="numeric" />
              <Campo etiqueta="Motivo (opcional)" value={motivo} onChangeText={setMotivo} />
              {elegido && (
                <Parrafo suave>
                  {necesitaDoble
                    ? "Sacar de Futuro o emergencia requiere la firma de ambos administradores (R37)."
                    : automatica
                      ? `Hasta el ${umbralPct} % del sobre de origen se aplica de inmediato (R38).`
                      : `Sobre el ${umbralPct} % del sobre de origen, lo aprueba el otro administrador (R38).`}
                </Parrafo>
              )}
              <Boton texto="Mover dinero" onPress={mover} ocupado={ocupado} />
            </>
          )}
          {aviso && <Aviso texto={aviso.texto} tipo={aviso.tipo} />}
        </Tarjeta>
      )}
      <Subtitulo>Movimientos</Subtitulo>
      {movimientos.length === 0 ? (
        <Vacio texto="Sin movimientos en este sobre." />
      ) : (
        movimientos.map((m) => (
          <Fila key={m.id} etiqueta={m.comercio ?? "Gasto"} detalle={`${formatoFecha(m.fecha)} · ${m.cuenta}`} valor={m.tipo === "reembolso" ? m.monto : -m.monto} />
        ))
      )}
    </Pantalla>
  );
}
