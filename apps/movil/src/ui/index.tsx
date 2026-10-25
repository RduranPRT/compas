import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import type { TextInputProps } from "react-native";

export const colores = {
  texto: "#1d2433",
  suave: "#5b6475",
  primario: "#1f5f8b",
  error: "#a33a2b",
  fondo: "#ffffff",
  borde: "#cdd3dc",
};

export function Pantalla({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <ScrollView contentContainerStyle={estilos.pantalla}>
      <Text accessibilityRole="header" style={estilos.titulo}>
        {titulo}
      </Text>
      {children}
    </ScrollView>
  );
}

export function Campo({ etiqueta, ...props }: { etiqueta: string } & TextInputProps) {
  return (
    <View style={estilos.campo}>
      <Text style={estilos.etiqueta}>{etiqueta}</Text>
      <TextInput accessibilityLabel={etiqueta} style={estilos.entrada} {...props} />
    </View>
  );
}

export function Boton({
  texto,
  onPress,
  ocupado = false,
  secundario = false,
}: {
  texto: string;
  onPress: () => void;
  ocupado?: boolean;
  secundario?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={texto}
      accessibilityState={{ disabled: ocupado }}
      disabled={ocupado}
      onPress={onPress}
      style={[estilos.boton, secundario && estilos.botonSecundario]}
    >
      {ocupado ? (
        <ActivityIndicator color={secundario ? colores.primario : colores.fondo} />
      ) : (
        <Text style={[estilos.textoBoton, secundario && estilos.textoBotonSecundario]}>{texto}</Text>
      )}
    </Pressable>
  );
}

export function Aviso({ texto, tipo = "info" }: { texto: string | null; tipo?: "info" | "error" }) {
  if (!texto) return null;
  return (
    <Text accessibilityLiveRegion="polite" style={[estilos.aviso, tipo === "error" && { color: colores.error }]}>
      {texto}
    </Text>
  );
}

export function Parrafo({ children }: { children: ReactNode }) {
  return <Text style={estilos.parrafo}>{children}</Text>;
}

const estilos = StyleSheet.create({
  pantalla: { padding: 24, gap: 16, maxWidth: 560, width: "100%", alignSelf: "center" },
  titulo: { fontSize: 24, fontWeight: "700", color: colores.texto },
  campo: { gap: 6 },
  etiqueta: { fontSize: 14, color: colores.suave },
  entrada: {
    borderWidth: 1,
    borderColor: colores.borde,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: colores.texto,
  },
  boton: { backgroundColor: colores.primario, borderRadius: 8, paddingVertical: 12, alignItems: "center" },
  botonSecundario: { backgroundColor: "transparent", borderWidth: 1, borderColor: colores.primario },
  textoBoton: { color: colores.fondo, fontSize: 16, fontWeight: "600" },
  textoBotonSecundario: { color: colores.primario },
  aviso: { fontSize: 14, color: colores.suave },
  parrafo: { fontSize: 16, color: colores.texto, lineHeight: 22 },
});
