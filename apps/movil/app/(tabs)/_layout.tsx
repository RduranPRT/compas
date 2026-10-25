import { Redirect, Tabs } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { estadoAlta, type EstadoAlta } from "../../src/datos/alta";
import { useHogar } from "../../src/lib/hogar";
import { supabase } from "../../src/lib/supabase";
import { colores } from "../../src/ui";

const ICONO: Record<string, string> = { index: "⌂", sobres: "▦", movimientos: "≡", mas: "⋯" };

// Mientras el alta no termine, se retoma en el paso pendiente. Después: cuatro pestañas visibles.
export default function Pestanas() {
  const [estado, setEstado] = useState<EstadoAlta | null>(null);
  const { recargar } = useHogar();
  useEffect(() => {
    estadoAlta(supabase).then((e) => {
      setEstado(e);
      if (e === "listo") void recargar();
    });
  }, [recargar]);

  if (!estado) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator />
      </View>
    );
  }
  if (estado !== "listo") return <Redirect href={`/${estado}`} />;
  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colores.primario,
        tabBarInactiveTintColor: colores.suave,
        tabBarLabelStyle: { fontSize: 12 },
        tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>{ICONO[route.name] ?? "•"}</Text>,
      })}
    >
      <Tabs.Screen name="index" options={{ title: "Inicio" }} />
      <Tabs.Screen name="sobres" options={{ title: "Sobres" }} />
      <Tabs.Screen name="movimientos" options={{ title: "Movimientos" }} />
      <Tabs.Screen name="mas" options={{ title: "Más" }} />
    </Tabs>
  );
}
