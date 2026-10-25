import { useState } from "react";
import { Aviso, Boton, Campo, Pantalla, Parrafo } from "../ui";

type Resultado = Promise<{ error: { message: string } | null }>;

export interface PropsIngresar {
  enviarCodigo: (correo: string) => Resultado;
  verificarCodigo: (correo: string, codigo: string) => Resultado;
}

const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// HU-001-3: ingreso con correo y código de 6 dígitos, sin contraseña.
export function Ingresar({ enviarCodigo, verificarCodigo }: PropsIngresar) {
  const [correo, setCorreo] = useState("");
  const [codigo, setCodigo] = useState("");
  const [enviadoA, setEnviadoA] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [codigoVencido, setCodigoVencido] = useState(false);
  const [ocupado, setOcupado] = useState(false);

  async function pedirCodigo(destino: string) {
    setError(null);
    setCodigoVencido(false);
    setOcupado(true);
    const { error } = await enviarCodigo(destino);
    setOcupado(false);
    if (error) {
      setError("No pudimos enviar el código. Revisa tu conexión e inténtalo de nuevo.");
      return;
    }
    setCodigo("");
    setEnviadoA(destino);
  }

  async function enviar() {
    const limpio = correo.trim().toLowerCase();
    if (!CORREO.test(limpio)) {
      setError("Revisa el correo: debe tener la forma nombre@dominio.cl.");
      return;
    }
    await pedirCodigo(limpio);
  }

  async function verificar() {
    if (!enviadoA) return;
    if (!/^\d{6}$/.test(codigo)) {
      setError("El código tiene 6 dígitos; revisa el último correo que te enviamos.");
      return;
    }
    setError(null);
    setOcupado(true);
    const { error } = await verificarCodigo(enviadoA, codigo);
    setOcupado(false);
    if (error) {
      setCodigoVencido(true);
      setError("Ese código ya no sirve: vence o se reemplaza al pedir otro. Puedes pedir uno nuevo.");
    }
  }

  if (!enviadoA) {
    return (
      <Pantalla titulo="Ingresar a Compás">
        <Parrafo>Te enviaremos un código de 6 dígitos a tu correo. No necesitas contraseña.</Parrafo>
        <Campo
          etiqueta="Correo"
          value={correo}
          onChangeText={setCorreo}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          inputMode="email"
        />
        <Aviso texto={error} tipo="error" />
        <Boton texto="Enviar código" onPress={enviar} ocupado={ocupado} />
      </Pantalla>
    );
  }

  return (
    <Pantalla titulo="Revisa tu correo">
      <Parrafo>Enviamos un código a {enviadoA}.</Parrafo>
      <Campo
        etiqueta="Código de 6 dígitos"
        value={codigo}
        onChangeText={setCodigo}
        keyboardType="number-pad"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
      />
      <Aviso texto={error} tipo="error" />
      <Boton texto="Ingresar" onPress={verificar} ocupado={ocupado} />
      {codigoVencido && <Boton texto="Pedir otro código" secundario onPress={() => pedirCodigo(enviadoA)} />}
      <Boton texto="Usar otro correo" secundario onPress={() => setEnviadoA(null)} />
    </Pantalla>
  );
}
