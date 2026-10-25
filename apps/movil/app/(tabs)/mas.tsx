import { router } from "expo-router";
import { useHogar } from "../../src/lib/hogar";
import { supabase } from "../../src/lib/supabase";
import { Mas } from "../../src/pantallas/Mas";

export default function RutaMas() {
  const { yo, personas, etapa, esAdmin } = useHogar();
  const nombre = personas.find((p) => p.id === yo?.id)?.nombre ?? "";
  return (
    <Mas
      nombre={nombre}
      rol={yo?.rol ?? ""}
      etapa={etapa}
      esAdmin={esAdmin}
      ir={(ruta) => router.push(ruta as never)}
      salir={() => void supabase.auth.signOut()}
    />
  );
}
