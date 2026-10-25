import { formatoFecha, formatoPesos, leerMonto } from "@compas/dominio";
import { useState } from "react";
import type { Movimiento, Tarjeta as TarjetaDatos } from "../datos/finanzas";
import { Aviso, Boton, Campo, Fila, Opciones, Pantalla, Parrafo, Subtitulo, Tarjeta, Vacio } from "../ui";

// Spec 008: cuánto se debe, cuánto está apartado (R44), compras del ciclo, pago (R27) y cuadre con el estado de cuenta (R34).

type Res = Promise<{ error: string | null; mensaje?: string }>;

export interface CicloTarjeta {
  desde: string;
  hasta: string;
  vence: string;
}

export function cicloDe(hoy: string, diaFacturacion: number, diaPago: number): CicloTarjeta {
  const [a, m, d] = hoy.split("-").map(Number) as [number, number, number];
  const fecha = (anio: number, mes: number, dia: number) => {
    const fin = new Date(Date.UTC(anio, mes, 0)).getUTCDate();
    return `${anio}-${String(mes).padStart(2, "0")}-${String(Math.min(dia, fin)).padStart(2, "0")}`;
  };
  const mover = (anio: number, mes: number, delta: number): [number, number] => {
    const t = anio * 12 + (mes - 1) + delta;
    return [Math.floor(t / 12), (t % 12) + 1];
  };
  // El ciclo en curso cierra el próximo día de facturación
  const [ah, mh] = d <= diaFacturacion ? [a, m] : mover(a, m, 1);
  const [ad, md] = mover(ah, mh, -1);
  const [av, mv] = diaPago > diaFacturacion ? [ah, mh] : mover(ah, mh, 1);
  const hasta = fecha(ah, mh, diaFacturacion);
  const anterior = fecha(ad, md, diaFacturacion);
  const [ya, ym, yd] = anterior.split("-").map(Number) as [number, number, number];
  const desde = new Date(Date.UTC(ya, ym - 1, yd + 1)).toISOString().slice(0, 10);
  return { desde, hasta, vence: fecha(av, mv, diaPago) };
}

export interface PropsTarjeta {
  tarjeta: TarjetaDatos;
  hoy: string;
  compras: Movimiento[];
  cuentasOrigen: { id: string; nombre: string }[];
  pagar: (origenId: string, monto: number, fecha: string) => Res;
  conciliar: (facturado: number, motivo: string) => Res;
  volver: () => void;
}

export function TarjetaDetalle({ tarjeta, hoy, compras, cuentasOrigen, pagar, conciliar, volver }: PropsTarjeta) {
  const ciclo = cicloDe(hoy, tarjeta.diaFacturacion, tarjeta.diaPago);
  const [origen, setOrigen] = useState<string | null>(cuentasOrigen[0]?.id ?? null);
  const [monto, setMonto] = useState(tarjeta.deuda > 0 ? String(tarjeta.deuda) : "");
  const [facturado, setFacturado] = useState("");
  const [motivo, setMotivo] = useState("");
  const [aviso, setAviso] = useState<{ texto: string; tipo: "error" | "exito" | "alerta" } | null>(null);
  const totalCiclo = compras.reduce((s, m) => s + (m.tipo === "reembolso" ? -m.monto : m.monto), 0);

  return (
    <Pantalla titulo={tarjeta.nombre} volver={volver}>
      <Tarjeta>
        <Fila etiqueta="Deuda total" valor={Math.max(0, tarjeta.deuda)} fuerte />
        <Fila etiqueta="Apartado para pagarla (R44)" valor={tarjeta.apartado} />
        {tarjeta.apartado < tarjeta.deuda && (
          <Parrafo suave>{`Falta apartar ${formatoPesos(tarjeta.deuda - Math.max(0, tarjeta.apartado))}. Con plan, el borrador lo cubre antes que Vida.`}</Parrafo>
        )}
        <Fila etiqueta="Próximo pago" valor={formatoFecha(ciclo.vence)} />
      </Tarjeta>
      <Tarjeta>
        <Subtitulo>Registrar pago</Subtitulo>
        <Parrafo suave>El pago no es gasto: consume lo apartado (R27).</Parrafo>
        <Opciones etiqueta="Desde" opciones={cuentasOrigen.map((c) => ({ valor: c.id, texto: c.nombre }))} valor={origen} onCambio={setOrigen} />
        <Campo etiqueta="Monto" value={monto} onChangeText={setMonto} keyboardType="numeric" inputMode="numeric" />
        <Boton
          texto="Registrar pago"
          onPress={async () => {
            const m = Math.abs(leerMonto(monto) ?? 0);
            if (!origen || !m) return setAviso({ texto: "Elige la cuenta y el monto.", tipo: "error" });
            const r = await pagar(origen, m, hoy);
            setAviso(r.error ? { texto: r.error, tipo: "error" } : { texto: `Pago de ${formatoPesos(m)} registrado.`, tipo: "exito" });
          }}
        />
      </Tarjeta>
      <Tarjeta>
        <Subtitulo>Cuadrar con el estado de cuenta</Subtitulo>
        <Parrafo suave>Escribe la deuda total que informa el banco; si no coincide, anota el motivo (R34).</Parrafo>
        <Campo etiqueta="Deuda según el banco" value={facturado} onChangeText={setFacturado} keyboardType="numeric" inputMode="numeric" />
        <Campo etiqueta="Motivo de la diferencia (si hay)" value={motivo} onChangeText={setMotivo} />
        <Boton
          texto="Cuadrar"
          secundario
          onPress={async () => {
            const f = Math.abs(leerMonto(facturado) ?? 0);
            const r = await conciliar(f, motivo);
            setAviso(r.error ? { texto: r.error, tipo: "error" } : { texto: r.mensaje ?? "Cuadrado.", tipo: "exito" });
          }}
        />
      </Tarjeta>
      {aviso && <Aviso texto={aviso.texto} tipo={aviso.tipo} />}
      <Subtitulo>{`Compras del ciclo (${formatoFecha(ciclo.desde)} – ${formatoFecha(ciclo.hasta)}): ${formatoPesos(totalCiclo)}`}</Subtitulo>
      {compras.length === 0 ? (
        <Vacio texto="Sin compras en este ciclo." />
      ) : (
        compras.map((m) => (
          <Fila key={m.id} etiqueta={m.comercio ?? m.sobre ?? "Compra"} detalle={`${formatoFecha(m.fecha)} · ${m.sobre ?? ""}${m.nCuotas ? ` · ${m.nCuotas} cuotas` : ""}`} valor={m.tipo === "reembolso" ? m.monto : -m.monto} />
        ))
      )}
    </Pantalla>
  );
}
