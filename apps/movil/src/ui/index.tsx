import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import type { StyleProp, TextInputProps, ViewStyle } from "react-native";
import { formatoPesos } from "@compas/dominio";

export const colores = {
  texto: "#1d2433",
  suave: "#5b6475",
  primario: "#1f5f8b",
  primarioSuave: "#e7f0f7",
  error: "#a33a2b",
  fondo: "#ffffff",
  fondoApp: "#f5f7fa",
  borde: "#cdd3dc",
  verde: "#2e7d4f",
  amarillo: "#a86b00",
  rojo: "#a33a2b",
};

export function Pantalla({
  titulo,
  children,
  accion,
  volver,
  flotante,
}: {
  titulo: string;
  children: ReactNode;
  accion?: ReactNode;
  volver?: () => void;
  flotante?: ReactNode;
}) {
  return (
    <View style={{ flex: 1, backgroundColor: colores.fondoApp }}>
      <ScrollView contentContainerStyle={estilos.pantalla} keyboardShouldPersistTaps="handled">
        {volver ? (
          <Pressable accessibilityRole="link" accessibilityLabel="Volver" onPress={volver} style={{ alignSelf: "flex-start" }}>
            <Text style={estilos.enlace}>‹ Volver</Text>
          </Pressable>
        ) : null}
        <View style={estilos.cabecera}>
          <Text accessibilityRole="header" style={estilos.titulo}>
            {titulo}
          </Text>
          {accion}
        </View>
        {children}
      </ScrollView>
      {flotante}
    </View>
  );
}

export function Campo({ etiqueta, ayuda, ...props }: { etiqueta: string; ayuda?: string } & TextInputProps) {
  return (
    <View style={estilos.campo}>
      <Text style={estilos.etiqueta}>{etiqueta}</Text>
      <TextInput accessibilityLabel={etiqueta} style={estilos.entrada} placeholderTextColor="#98a1b0" {...props} />
      {ayuda ? <Text style={estilos.ayuda}>{ayuda}</Text> : null}
    </View>
  );
}

export function Boton({
  texto,
  onPress,
  ocupado = false,
  secundario = false,
  peligro = false,
  deshabilitado = false,
}: {
  texto: string;
  onPress: () => void;
  ocupado?: boolean;
  secundario?: boolean;
  peligro?: boolean;
  deshabilitado?: boolean;
}) {
  const inactivo = ocupado || deshabilitado;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={texto}
      accessibilityState={{ disabled: inactivo }}
      disabled={inactivo}
      onPress={onPress}
      style={[
        estilos.boton,
        secundario && estilos.botonSecundario,
        peligro && { backgroundColor: colores.error },
        inactivo && { opacity: 0.55 },
      ]}
    >
      {ocupado ? (
        <ActivityIndicator color={secundario ? colores.primario : colores.fondo} />
      ) : (
        <Text style={[estilos.textoBoton, secundario && estilos.textoBotonSecundario]}>{texto}</Text>
      )}
    </Pressable>
  );
}

export function Enlace({ texto, onPress }: { texto: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="link" accessibilityLabel={texto} onPress={onPress}>
      <Text style={estilos.enlace}>{texto}</Text>
    </Pressable>
  );
}

export function Aviso({ texto, tipo = "info" }: { texto: string | null; tipo?: "info" | "error" | "exito" | "alerta" }) {
  if (!texto) return null;
  const color = { info: colores.suave, error: colores.error, exito: colores.verde, alerta: colores.amarillo }[tipo];
  return (
    <Text accessibilityLiveRegion="polite" style={[estilos.aviso, { color }]}>
      {texto}
    </Text>
  );
}

export function Parrafo({ children, suave = false }: { children: ReactNode; suave?: boolean }) {
  return <Text style={[estilos.parrafo, suave && { color: colores.suave, fontSize: 14 }]}>{children}</Text>;
}

export function Subtitulo({ children }: { children: ReactNode }) {
  return <Text style={estilos.subtitulo}>{children}</Text>;
}

export function Tarjeta({
  children,
  onPress,
  etiqueta,
  estilo,
}: {
  children: ReactNode;
  onPress?: () => void;
  etiqueta?: string;
  estilo?: StyleProp<ViewStyle>;
}) {
  if (onPress) {
    return (
      <Pressable accessibilityRole="button" accessibilityLabel={etiqueta} onPress={onPress} style={[estilos.tarjeta, estilo]}>
        {children}
      </Pressable>
    );
  }
  return <View style={[estilos.tarjeta, estilo]}>{children}</View>;
}

/** Fila etiqueta–valor; el valor numérico se muestra como monto (rojo si es negativo). */
export function Fila({ etiqueta, valor, detalle, fuerte = false }: { etiqueta: string; valor: ReactNode; detalle?: string; fuerte?: boolean }) {
  return (
    <View style={estilos.fila}>
      <View style={{ flex: 1 }}>
        <Text style={[estilos.parrafo, fuerte && { fontWeight: "700" }]}>{etiqueta}</Text>
        {detalle ? <Text style={estilos.ayuda}>{detalle}</Text> : null}
      </View>
      {typeof valor === "number" ? <Monto valor={valor} fuerte={fuerte} /> : typeof valor === "string" ? <Text style={estilos.parrafo}>{valor}</Text> : valor}
    </View>
  );
}

export function Monto({ valor, fuerte = false, grande = false }: { valor: number; fuerte?: boolean; grande?: boolean }) {
  return (
    <Text
      style={[
        estilos.parrafo,
        { fontVariant: ["tabular-nums"] },
        fuerte && { fontWeight: "700" },
        grande && { fontSize: 28, fontWeight: "700" },
        valor < 0 && { color: colores.rojo },
      ]}
    >
      {formatoPesos(valor)}
    </Text>
  );
}

export function Etiqueta({ texto, color = colores.suave }: { texto: string; color?: string }) {
  return (
    <View style={[estilos.chipEstado, { borderColor: color }]}>
      <Text style={{ color, fontSize: 12, fontWeight: "600" }}>{texto}</Text>
    </View>
  );
}

/** Barra de avance: gastado sobre disponible; amarilla sobre 90 %, roja sobre 100 %. */
export function Barra({ valor, total }: { valor: number; total: number }) {
  const pct = total > 0 ? Math.min(1, valor / total) : valor > 0 ? 1 : 0;
  const color = total > 0 && valor > total ? colores.rojo : pct > 0.9 ? colores.amarillo : colores.verde;
  return (
    <View style={estilos.barra} accessibilityRole="progressbar" aria-valuenow={Math.round(pct * 100)}>
      <View style={{ width: `${pct * 100}%`, height: "100%", backgroundColor: color, borderRadius: 4 }} />
    </View>
  );
}

export function Opciones<T extends string>({
  etiqueta,
  opciones,
  valor,
  onCambio,
}: {
  etiqueta?: string;
  opciones: { valor: T; texto: string }[];
  valor: T | null;
  onCambio: (v: T) => void;
}) {
  return (
    <View style={estilos.campo}>
      {etiqueta ? <Text style={estilos.etiqueta}>{etiqueta}</Text> : null}
      <View role="radiogroup" aria-label={etiqueta} style={estilos.chips}>
        {opciones.map((o) => {
          const activa = o.valor === valor;
          return (
            <Pressable
              key={o.valor}
              role="radio"
              aria-checked={activa}
              aria-label={o.texto}
              onPress={() => onCambio(o.valor)}
              style={[estilos.chip, activa && estilos.chipActivo]}
            >
              <Text style={[estilos.textoChip, activa && { color: colores.fondo }]}>{o.texto}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function Casilla({
  etiqueta,
  marcada,
  onCambio,
}: {
  etiqueta: string;
  marcada: boolean;
  onCambio: (marcada: boolean) => void;
}) {
  return (
    <Pressable
      role="checkbox"
      aria-label={etiqueta}
      aria-checked={marcada}
      onPress={() => onCambio(!marcada)}
      style={estilosCasilla.fila}
    >
      <View style={[estilosCasilla.caja, marcada && estilosCasilla.marcada]}>
        {marcada && <Text style={estilosCasilla.check}>✓</Text>}
      </View>
      <Text style={[estilos.parrafo, { flex: 1 }]}>{etiqueta}</Text>
    </Pressable>
  );
}

export function Cargando() {
  return (
    <View style={{ padding: 32, alignItems: "center" }}>
      <ActivityIndicator color={colores.primario} />
    </View>
  );
}

export function Vacio({ texto, accion }: { texto: string; accion?: ReactNode }) {
  return (
    <View style={[estilos.tarjeta, { alignItems: "center", gap: 12 }]}>
      <Text style={[estilos.parrafo, { color: colores.suave, textAlign: "center" }]}>{texto}</Text>
      {accion}
    </View>
  );
}

export function ErrorCarga({ texto, reintentar }: { texto: string; reintentar: () => void }) {
  return (
    <View style={[estilos.tarjeta, { gap: 12 }]}>
      <Aviso texto={texto} tipo="error" />
      <Boton texto="Reintentar" secundario onPress={reintentar} />
    </View>
  );
}

export function BotonFlotante({ onPress, etiqueta = "Registrar un gasto" }: { onPress: () => void; etiqueta?: string }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={etiqueta} onPress={onPress} style={estilos.flotante}>
      <Text style={{ color: colores.fondo, fontSize: 30, lineHeight: 32, fontWeight: "600" }}>+</Text>
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  pantalla: { padding: 16, paddingBottom: 96, gap: 14, maxWidth: 640, width: "100%", alignSelf: "center" },
  cabecera: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, paddingTop: 8 },
  titulo: { fontSize: 24, fontWeight: "700", color: colores.texto, flexShrink: 1 },
  subtitulo: { fontSize: 17, fontWeight: "700", color: colores.texto, marginTop: 6 },
  campo: { gap: 6 },
  etiqueta: { fontSize: 14, color: colores.suave },
  ayuda: { fontSize: 13, color: colores.suave },
  entrada: {
    borderWidth: 1,
    borderColor: colores.borde,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: colores.texto,
    backgroundColor: colores.fondo,
  },
  boton: { backgroundColor: colores.primario, borderRadius: 8, paddingVertical: 12, paddingHorizontal: 16, alignItems: "center" },
  botonSecundario: { backgroundColor: "transparent", borderWidth: 1, borderColor: colores.primario },
  textoBoton: { color: colores.fondo, fontSize: 16, fontWeight: "600" },
  textoBotonSecundario: { color: colores.primario },
  enlace: { color: colores.primario, fontSize: 15, fontWeight: "600" },
  aviso: { fontSize: 14, color: colores.suave },
  parrafo: { fontSize: 16, color: colores.texto, lineHeight: 22 },
  tarjeta: { backgroundColor: colores.fondo, borderRadius: 12, padding: 14, gap: 8, borderWidth: 1, borderColor: "#e3e7ee" },
  fila: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 28 },
  chipEstado: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, alignSelf: "flex-start" },
  barra: { height: 8, borderRadius: 4, backgroundColor: "#e3e7ee", overflow: "hidden" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { borderWidth: 1, borderColor: colores.borde, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: colores.fondo },
  chipActivo: { backgroundColor: colores.primario, borderColor: colores.primario },
  textoChip: { fontSize: 14, color: colores.texto },
  flotante: {
    position: "absolute",
    right: 20,
    bottom: 24,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colores.primario,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
});

const estilosCasilla = StyleSheet.create({
  fila: { flexDirection: "row", alignItems: "center", gap: 10 },
  caja: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: colores.primario,
    alignItems: "center",
    justifyContent: "center",
  },
  marcada: { backgroundColor: colores.primario },
  check: { color: colores.fondo, fontSize: 14, fontWeight: "700" },
});
