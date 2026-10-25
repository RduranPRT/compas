import { Redirect, Tabs } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { estadoAlta, type EstadoAlta } from "../../src/datos/alta";
import { supabase } from "../../src/lib/supabase";

// Mientras el alta no termine, se retoma en el paso pendiente.
export default function Pestanas() {
  const [estado, setEstado] = useState<EstadoAlta | null>(null);
  useEffect(() => {
    estadoAlta(supabase).then(setEstado);
  }, []);

  if (!estado) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator />
      </View>
    );
  }
  if (estado !== "listo") return <Redirect href={`/${estado}`} />;
  return (
    <Tabs screenOptions={{ headerShown: false, tabBarStyle: { display: "none" } }}>
      <Tabs.Screen name="index" options={{ title: "Inicio" }} />
    </Tabs>
  );
}
