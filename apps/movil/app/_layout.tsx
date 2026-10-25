import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, View } from "react-native";
import { ProveedorHogar } from "../src/lib/hogar";
import { ProveedorSesion, useSesion } from "../src/lib/sesion";

// Al iniciar o cerrar sesión, la navegación vuelve a la portada; ella decide el paso del alta.
export const unstable_settings = { anchor: "(tabs)" };

function Navegacion() {
  const { cargando, sesion } = useSesion();
  if (cargando) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator />
      </View>
    );
  }
  const pila = (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!sesion}>
        <Stack.Screen name="ingresar" />
      </Stack.Protected>
      <Stack.Protected guard={!!sesion}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="(alta)" />
        <Stack.Screen name="(app)" />
      </Stack.Protected>
    </Stack>
  );
  // Los datos del hogar se cargan por usuario; al cambiar de sesión se vuelven a leer
  return sesion ? <ProveedorHogar key={sesion.user.id}>{pila}</ProveedorHogar> : pila;
}

export default function Raiz() {
  return (
    <ProveedorSesion>
      <StatusBar style="dark" />
      <Navegacion />
    </ProveedorSesion>
  );
}
