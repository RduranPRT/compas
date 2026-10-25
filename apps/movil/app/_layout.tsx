import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ProveedorSesion } from "../src/lib/sesion";

export default function Raiz() {
  return (
    <ProveedorSesion>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }} />
    </ProveedorSesion>
  );
}
