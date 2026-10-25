import { router } from "expo-router";
import { crearHogar } from "../../src/datos/alta";
import { supabase } from "../../src/lib/supabase";
import { AltaHogar } from "../../src/pantallas/AltaHogar";

export default function RutaHogar() {
  return (
    <AltaHogar
      crear={(nombreHogar, nombre) => crearHogar(supabase, nombreHogar, nombre)}
      continuar={() => router.replace("/integrantes")}
    />
  );
}
