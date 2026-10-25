import { formatoPesos, nombreMes, sumarMeses } from "@compas/dominio";
import { View } from "react-native";
import type { Sobre } from "../datos/finanzas";
import { Barra, Boton, BotonFlotante, Cargando, Fila, Pantalla, Parrafo, Subtitulo, Tarjeta, Vacio } from "../ui";

// Sobres del mes por bloque (50/30/20): saldo, gastado y disponible; los negativos ofrecen cubrirse (R10).

const BLOQUES: { clave: Sobre["bloque"] | "OTROS"; nombre: string }[] = [
  { clave: "ESENCIALES", nombre: "Esenciales" },
  { clave: "FUTURO", nombre: "Futuro" },
  { clave: "VIDA", nombre: "Vida" },
  { clave: "OTROS", nombre: "Por asignar y tarjetas" },
];

export interface PropsSobres {
  mes: string;
  sobres: Sobre[] | null;
  cambiarMes: (mes: string) => void;
  abrir: (id: string) => void;
  registrar: () => void;
  /** Mes de línea base: sin presupuesto ni avisos (D21). */
  lineaBase?: boolean;
}

export function Sobres({ mes, sobres, cambiarMes, abrir, registrar, lineaBase = false }: PropsSobres) {
  return (
    <Pantalla titulo="Sobres" flotante={<BotonFlotante onPress={registrar} />}>
      <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
        <View style={{ flex: 1 }}><Boton texto="‹ Anterior" secundario onPress={() => cambiarMes(sumarMeses(mes, -1))} /></View>
        <View style={{ flex: 2, alignItems: "center" }}><Parrafo>{nombreMes(mes)}</Parrafo></View>
        <View style={{ flex: 1 }}><Boton texto="Siguiente ›" secundario onPress={() => cambiarMes(sumarMeses(mes, 1))} /></View>
      </View>
      {lineaBase && <Parrafo suave>Mes de línea base: se ve lo gastado por sobre, sin presupuesto ni avisos (D21).</Parrafo>}
      {!sobres ? (
        <Cargando />
      ) : sobres.length <= 1 ? (
        <Vacio texto="Este mes aún no tiene sobres. Agrega categorías en Más → Categorías." />
      ) : (
        BLOQUES.map((b) => {
          const delBloque = sobres.filter((s) => (b.clave === "OTROS" ? !s.bloque : s.bloque === b.clave));
          if (!delBloque.length) return null;
          const total = delBloque.reduce((s, x) => s + x.saldo, 0);
          return (
            <View key={b.nombre} style={{ gap: 8 }}>
              <Fila etiqueta={b.nombre} valor={total} fuerte />
              {delBloque.map((s) => (
                <Tarjeta key={s.id} onPress={() => abrir(s.id)} etiqueta={`${s.nombre}: ver detalle`}>
                  <Fila
                    etiqueta={s.nombre}
                    valor={s.saldo}
                    detalle={detalleSobre(s, lineaBase)}
                  />
                  {s.tipo !== "por_asignar" && s.tipo !== "pago_tarjeta" && (s.disponible > 0 || s.gastado > 0) && <Barra valor={s.gastado} total={s.disponible} />}
                </Tarjeta>
              ))}
              <Subtitulo> </Subtitulo>
            </View>
          );
        })
      )}
    </Pantalla>
  );
}

function detalleSobre(s: Sobre, lineaBase: boolean): string | undefined {
  if (s.tipo === "por_asignar") return "Dinero recibido que aún no tiene sobre (R01)";
  if (s.tipo === "pago_tarjeta") {
    if (lineaBase && s.saldo < 0) return "Incluye la deuda previa al piloto, pagada sin plan";
    return "Apartado para pagar la tarjeta (R44)";
  }
  if (lineaBase) return s.gastado ? `Gastado ${formatoPesos(s.gastado)}` : undefined;
  if (s.saldo < 0) return "Quedó negativo: toca para cubrirlo (R10)";
  if (!s.disponible && !s.gastado) return undefined;
  return `Gastado ${formatoPesos(Math.max(0, s.gastado))} de ${formatoPesos(Math.max(0, s.disponible))}`;
}
