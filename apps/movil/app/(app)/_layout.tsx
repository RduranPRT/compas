import { Stack } from "expo-router";

// Pantallas internas: se abren sobre las pestañas y vuelven con "‹ Volver".
export default function Grupo() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
