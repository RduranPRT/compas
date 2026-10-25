import { Tabs } from "expo-router";

export default function Pestanas() {
  return (
    <Tabs screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" options={{ title: "Inicio" }} />
    </Tabs>
  );
}
