import {
  PARAMETROS_POR_DEFECTO,
  describirParametro,
  formatoFecha,
  type CodigoParametro,
} from "@compas/dominio";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Aviso, Boton, Pantalla, Parrafo, colores } from "../ui";

type Resultado = Promise<{ error: { message: string } | null }>;

export interface PropsAcuerdo {
  /** Un administrador propone; el otro firma la solicitud dirigida a él (E1). */
  modo: "proponer" | "firmar";
  /** El otro administrador (ORG o CAD): firma lo que propongo. */
  otro: { nombre: string; tieneCuenta: boolean } | null;
  proponer: (opciones: { urgente: boolean }) => Resultado;
  firmar: () => Resultado;
  continuar: () => void;
}

// HU-001-4 y escenario "Firmar el Acuerdo v1" (E1). Parámetros por defecto: tabla de la spec 001.
export function Acuerdo({ modo, otro, proponer, firmar, continuar }: PropsAcuerdo) {
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [esperandoFirma, setEsperandoFirma] = useState(false);
  const firmaInmediata = otro?.tieneCuenta === true;

  async function ejecutar(accion: () => Resultado, alTerminar: () => void) {
    setError(null);
    setOcupado(true);
    const { error } = await accion();
    setOcupado(false);
    if (error) setError("No pudimos guardar el Acuerdo. Revisa tu conexión e inténtalo de nuevo.");
    else alTerminar();
  }

  if (esperandoFirma && otro) {
    return (
      <Pantalla titulo="Acuerdo del Hogar v1">
        <Aviso texto={`Listo. El Acuerdo v1 queda vigente cuando ${otro.nombre} lo firme.`} />
        <Boton texto="Ir a la portada" onPress={continuar} />
      </Pantalla>
    );
  }

  return (
    <Pantalla titulo="Acuerdo del Hogar v1">
      <Parrafo>
        Estas son las reglas con las que parten. Vigente desde el {formatoFecha(PARAMETROS_POR_DEFECTO.inicio_piloto)}.
        Se pueden cambiar después con una nueva versión firmada.
      </Parrafo>
      {(Object.keys(PARAMETROS_POR_DEFECTO) as CodigoParametro[]).map((codigo) => {
        const d = describirParametro(codigo, PARAMETROS_POR_DEFECTO[codigo as keyof typeof PARAMETROS_POR_DEFECTO]);
        return (
          <View key={codigo} testID="parametro" style={estilos.parametro}>
            <Text style={estilos.nombre}>{d.nombre}</Text>
            <Text style={estilos.valor}>{`${d.valor} · ${d.regla}`}</Text>
            <Text style={estilos.explicacion}>{d.explicacion}</Text>
          </View>
        );
      })}
      <Aviso texto={error} tipo="error" />
      {modo === "firmar" ? (
        <Boton texto="Firmar el Acuerdo v1" ocupado={ocupado} onPress={() => ejecutar(firmar, continuar)} />
      ) : firmaInmediata ? (
        <Boton
          texto={`Pedir la firma de ${otro.nombre}`}
          ocupado={ocupado}
          onPress={() => ejecutar(() => proponer({ urgente: false }), () => setEsperandoFirma(true))}
        />
      ) : (
        <>
          <Aviso
            texto={
              otro
                ? `${otro.nombre} aún no ingresa a Compás: puedes activar el Acuerdo ahora y su firma quedará pendiente.`
                : "Puedes activar el Acuerdo ahora; cuando invites a tu pareja, se le pedirá su firma."
            }
          />
          <Boton
            texto="Activar ahora"
            ocupado={ocupado}
            onPress={() => ejecutar(() => proponer({ urgente: true }), continuar)}
          />
        </>
      )}
    </Pantalla>
  );
}

const estilos = StyleSheet.create({
  parametro: { borderBottomWidth: 1, borderBottomColor: colores.borde, paddingVertical: 8, gap: 2 },
  nombre: { fontSize: 16, fontWeight: "600", color: colores.texto },
  valor: { fontSize: 15, color: colores.primario },
  explicacion: { fontSize: 14, color: colores.suave },
});
