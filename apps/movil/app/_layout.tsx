import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, View } from "react-native";
import { ProveedorSesion, useSesion } from "../src/lib/sesion";

function Navegacion() {
  const { cargando, sesion } = useSesion();
  if (cargando) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator />
      </View>
    );
  }
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!sesion}>
        <Stack.Screen name="(auth)/ingresar" />
      </Stack.Protected>
      <Stack.Protected guard={!!sesion}>
        <Stack.Screen name="index" />
      </Stack.Protected>
    </Stack>
  );
}

export default function Raiz() {
  return (
    <ProveedorSesion>
      <StatusBar style="dark" />
      <Navegacion />
    </ProveedorSesion>
  );
}
