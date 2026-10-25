import { useState } from "react";
import { Aviso, Boton, Campo, Pantalla, Parrafo } from "../ui";

export interface PropsAltaHogar {
  crear: (nombreHogar: string, nombre: string) => Promise<{ error: { message: string } | null }>;
  continuar: () => void;
}

// Asistente de alta, paso 1 (HU-001-1).
export function AltaHogar({ crear, continuar }: PropsAltaHogar) {
  const [hogar, setHogar] = useState("");
  const [nombre, setNombre] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  async function enviar() {
    if (!hogar.trim() || !nombre.trim()) {
      setError("Escribe el nombre del hogar y el tuyo.");
      return;
    }
    setError(null);
    setOcupado(true);
    const { error } = await crear(hogar.trim(), nombre.trim());
    setOcupado(false);
    if (error) setError("No pudimos crear el hogar. Revisa tu conexión e inténtalo de nuevo.");
    else continuar();
  }

  return (
    <Pantalla titulo="Tu hogar">
      <Parrafo>Partamos por el hogar. Tú quedas como organizador.</Parrafo>
      <Campo etiqueta="Nombre del hogar" value={hogar} onChangeText={setHogar} placeholder="Por ejemplo, Familia Pérez" />
      <Campo etiqueta="Tu nombre" value={nombre} onChangeText={setNombre} autoComplete="given-name" />
      <Aviso texto={error} tipo="error" />
      <Boton texto="Crear hogar" onPress={enviar} ocupado={ocupado} />
    </Pantalla>
  );
}
