import { useState } from "react";
import { Aviso, Boton, Campo, Pantalla, Parrafo } from "../ui";

export interface PropsIngresar {
  ingresar: (correo: string, clave: string) => Promise<{ error: { message: string } | null }>;
}

const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// HU-001-3 y D28: correo y contraseña; las cuentas las crea el organizador (sin registro público).
export function Ingresar({ ingresar }: PropsIngresar) {
  const [correo, setCorreo] = useState("");
  const [clave, setClave] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  async function enviar() {
    const limpio = correo.trim().toLowerCase();
    if (!CORREO.test(limpio)) return setError("Revisa el correo: debe tener la forma nombre@dominio.cl.");
    if (!clave) return setError("Escribe tu contraseña.");
    setError(null);
    setOcupado(true);
    const { error } = await ingresar(limpio, clave);
    setOcupado(false);
    if (error) {
      setError(
        "El correo o la contraseña no coinciden. Si no la recuerdas, pídele al organizador del hogar que te asigne una nueva.",
      );
    }
  }

  return (
    <Pantalla titulo="Ingresar a Compás">
      <Parrafo>La cuenta te la crea el organizador del hogar.</Parrafo>
      <Campo
        etiqueta="Correo"
        value={correo}
        onChangeText={setCorreo}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        inputMode="email"
      />
      <Campo
        etiqueta="Contraseña"
        value={clave}
        onChangeText={setClave}
        secureTextEntry
        autoCapitalize="none"
        autoComplete="current-password"
        onSubmitEditing={enviar}
      />
      <Aviso texto={error} tipo="error" />
      <Boton texto="Ingresar" onPress={enviar} ocupado={ocupado} />
    </Pantalla>
  );
}
