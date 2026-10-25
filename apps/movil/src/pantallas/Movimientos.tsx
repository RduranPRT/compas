import { formatoFecha, nombreMes, sumarMeses } from "@compas/dominio";
import { useState } from "react";
import { View } from "react-native";
import type { Movimiento } from "../datos/finanzas";
import { Boton, BotonFlotante, Cargando, colores, Enlace, Etiqueta, Fila, Opciones, Pantalla, Parrafo, Tarjeta, Vacio } from "../ui";

const ESTADO: Record<string, { texto: string; color: string }> = {
  por_confirmar: { texto: "Por confirmar", color: colores.amarillo },
  capturado: { texto: "Por confirmar", color: colores.amarillo },
  confirmado: { texto: "Confirmado", color: colores.verde },
  conciliado: { texto: "Conciliado", color: colores.suave },
};

export function signo(m: Movimiento): number {
  if (m.tipo === "ingreso" || m.tipo === "reembolso") return m.monto;
  if (m.tipo === "transferencia") return 0;
  return -m.monto;
}

export interface PropsMovimientos {
  mes: string;
  movimientos: Movimiento[] | null;
  pendientes: number;
  cambiarMes: (mes: string) => void;
  abrir: (m: Movimiento) => void;
  irBandeja: () => void;
  registrar: () => void;
}

export function Movimientos({ mes, movimientos, pendientes, cambiarMes, abrir, irBandeja, registrar }: PropsMovimientos) {
  const [filtro, setFiltro] = useState<"todos" | "gastos" | "ingresos" | "transferencias">("todos");
  const lista = (movimientos ?? []).filter((m) =>
    filtro === "todos" ? true : filtro === "gastos" ? m.tipo === "gasto" || m.tipo === "reembolso" : filtro === "ingresos" ? m.tipo === "ingreso" : m.tipo === "transferencia");
  return (
    <Pantalla titulo="Movimientos" flotante={<BotonFlotante onPress={registrar} />}>
      <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
        <View style={{ flex: 1 }}><Boton texto="‹ Anterior" secundario onPress={() => cambiarMes(sumarMeses(mes, -1))} /></View>
        <View style={{ flex: 2, alignItems: "center" }}><Parrafo>{nombreMes(mes)}</Parrafo></View>
        <View style={{ flex: 1 }}><Boton texto="Siguiente ›" secundario onPress={() => cambiarMes(sumarMeses(mes, 1))} /></View>
      </View>
      {pendientes > 0 && <Enlace texto={`Revisar ${pendientes} por confirmar o posibles duplicados`} onPress={irBandeja} />}
      <Opciones
        opciones={[
          { valor: "todos", texto: "Todos" },
          { valor: "gastos", texto: "Gastos" },
          { valor: "ingresos", texto: "Ingresos" },
          { valor: "transferencias", texto: "Transferencias" },
        ]}
        valor={filtro}
        onCambio={setFiltro}
      />
      {!movimientos ? (
        <Cargando />
      ) : lista.length === 0 ? (
        <Vacio texto="No hay movimientos en este mes. Registra un gasto con el botón + o carga una cartola." />
      ) : (
        lista.map((m) => (
          <Tarjeta key={m.id} onPress={() => abrir(m)} etiqueta={`Movimiento de ${m.comercio ?? m.sobre ?? m.tipo}`}>
            <Fila
              etiqueta={m.comercio || m.sobre || (m.tipo === "ingreso" ? "Ingreso" : "Gasto")}
              detalle={`${formatoFecha(m.fecha)} · ${m.sobre ?? (m.tipo === "transferencia" ? "Transferencia" : m.tipo === "ingreso" ? "Por asignar" : "Sin sobre")} · ${m.cuenta}${m.nCuotas ? ` · ${m.nCuotas} cuotas` : ""}`}
              valor={m.tipo === "transferencia" ? (m.monto) : signo(m)}
            />
            {ESTADO[m.estado] && m.estado !== "confirmado" && <Etiqueta texto={ESTADO[m.estado]!.texto} color={ESTADO[m.estado]!.color} />}
          </Tarjeta>
        ))
      )}
    </Pantalla>
  );
}
