import { useState } from "react";
import { Aviso, Boton, Casilla, Pantalla, Parrafo } from "../ui";
import {
  TEXTO_CONSENTIMIENTO,
  VERSION_CONSENTIMIENTO,
  type FinalidadConsentimiento,
} from "../legal/consentimiento";

export interface PropsConsentimientos {
  /** Hijos ya registrados en el paso de integrantes (su datos_menor se otorga al registrarlos). */
  menores: string[];
  guardar: (
    finalidades: FinalidadConsentimiento[],
    version: string,
  ) => Promise<{ error: { message: string } | null }>;
  continuar: () => void;
}

// HU-001-5 y escenario "Consentimientos al primer ingreso" (S5, Ley 21.719).
export function Consentimientos({ menores, guardar, continuar }: PropsConsentimientos) {
  const [usoApp, setUsoApp] = useState(false);
  const [analiticaIa, setAnaliticaIa] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sinIa, setSinIa] = useState(false);
  const [ocupado, setOcupado] = useState(false);

  async function aceptar() {
    if (!usoApp) {
      setError("Para usar Compás necesitamos que aceptes el uso de la app.");
      return;
    }
    setError(null);
    setOcupado(true);
    const finalidades: FinalidadConsentimiento[] = analiticaIa ? ["uso_app", "analitica_ia"] : ["uso_app"];
    const { error } = await guardar(finalidades, VERSION_CONSENTIMIENTO);
    setOcupado(false);
    if (error) {
      setError("No pudimos guardar tu respuesta. Revisa tu conexión e inténtalo de nuevo.");
      return;
    }
    if (analiticaIa) continuar();
    else setSinIa(true);
  }

  if (sinIa) {
    return (
      <Pantalla titulo="Consentimientos">
        <Aviso texto="Listo. Compás funcionará sin funciones de IA; puedes activarlas después en Ajustes." />
        <Boton texto="Seguir" onPress={continuar} />
      </Pantalla>
    );
  }

  return (
    <Pantalla titulo="Consentimientos">
      <Parrafo>{TEXTO_CONSENTIMIENTO.uso_app}</Parrafo>
      <Casilla etiqueta="Acepto el uso de la app" marcada={usoApp} onCambio={setUsoApp} />
      <Parrafo>{TEXTO_CONSENTIMIENTO.analitica_ia}</Parrafo>
      <Casilla etiqueta="Acepto el análisis con IA (opcional)" marcada={analiticaIa} onCambio={setAnaliticaIa} />
      {menores.map((nombre) => (
        <Aviso key={nombre} texto={`${nombre}: datos de menor autorizados`} />
      ))}
      <Aviso texto={error} tipo="error" />
      <Boton texto="Continuar" onPress={aceptar} ocupado={ocupado} />
    </Pantalla>
  );
}
