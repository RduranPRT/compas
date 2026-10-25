import { useState } from "react";
import { TEXTO_CONSENTIMIENTO, VERSION_CONSENTIMIENTO } from "../legal/consentimiento";
import { Aviso, Boton, Campo, Casilla, Pantalla, Parrafo } from "../ui";

type Resultado = Promise<{ error: { message: string } | null }>;

export interface PropsAltaIntegrantes {
  /** Invita a la pareja como co-administradora (CAD). */
  invitar: (correo: string, nombre: string) => Resultado;
  /** Registra a los hijos sin cuenta, con la versión del consentimiento datos_menor aceptada. */
  registrarHijos: (nombres: string[], versionConsentimiento: string) => Resultado;
  continuar: () => void;
}

const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_HIJOS = 10;

// Asistente de alta, paso 2 (HU-001-1, HU-001-2). Los hijos no tienen cuenta en el MVP (D26).
export function AltaIntegrantes({ invitar, registrarHijos, continuar }: PropsAltaIntegrantes) {
  const [pareja, setPareja] = useState("");
  const [correo, setCorreo] = useState("");
  const [hijos, setHijos] = useState<string[]>([]);
  const [autoriza, setAutoriza] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  async function enviar() {
    const correoLimpio = correo.trim().toLowerCase();
    const invitaPareja = pareja.trim() !== "" || correoLimpio !== "";
    if (invitaPareja && !pareja.trim()) return setError("Escribe el nombre de tu pareja.");
    if (invitaPareja && !CORREO.test(correoLimpio))
      return setError("Revisa el correo de tu pareja: debe tener la forma nombre@dominio.cl.");
    if (hijos.some((h) => !h.trim())) return setError("Escribe el nombre o apodo de cada hijo.");
    if (hijos.length > 0 && !autoriza) return setError("Para registrar a tus hijos necesitamos tu autorización.");

    setError(null);
    setOcupado(true);
    const fallo = (invitaPareja && (await invitar(correoLimpio, pareja.trim())).error) ||
      (hijos.length > 0 && (await registrarHijos(hijos.map((h) => h.trim()), VERSION_CONSENTIMIENTO)).error);
    setOcupado(false);
    if (fallo) setError("No pudimos guardar los integrantes. Revisa tu conexión e inténtalo de nuevo.");
    else continuar();
  }

  return (
    <Pantalla titulo="Integrantes">
      <Parrafo>Invita a tu pareja para que administren juntos. Le llegará un código a su correo al ingresar.</Parrafo>
      <Campo etiqueta="Nombre de tu pareja" value={pareja} onChangeText={setPareja} />
      <Campo
        etiqueta="Correo de tu pareja"
        value={correo}
        onChangeText={setCorreo}
        autoCapitalize="none"
        keyboardType="email-address"
        inputMode="email"
      />

      <Parrafo>{`¿Cuántos hijos tienen? ${hijos.length}`}</Parrafo>
      {hijos.map((nombre, i) => (
        <Campo
          key={i}
          etiqueta={`Nombre o apodo del hijo ${i + 1}`}
          value={nombre}
          onChangeText={(t) => setHijos((hs) => hs.map((h, j) => (j === i ? t : h)))}
        />
      ))}
      {hijos.length < MAX_HIJOS && (
        <Boton texto="Agregar un hijo o hija" secundario onPress={() => setHijos((hs) => [...hs, ""])} />
      )}
      {hijos.length > 0 && <Boton texto="Quitar el último" secundario onPress={() => setHijos((hs) => hs.slice(0, -1))} />}
      {hijos.length > 0 && (
        <>
          <Parrafo>{TEXTO_CONSENTIMIENTO.datos_menor}</Parrafo>
          <Casilla etiqueta="Autorizo registrar a mis hijos" marcada={autoriza} onCambio={setAutoriza} />
        </>
      )}

      <Aviso texto={error} tipo="error" />
      <Boton texto="Continuar" onPress={enviar} ocupado={ocupado} />
    </Pantalla>
  );
}
