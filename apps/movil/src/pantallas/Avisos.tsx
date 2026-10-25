import { formatoFecha } from "@compas/dominio";
import { Text, View } from "react-native";
import type { Aviso as AvisoDatos } from "../datos/gobierno";
import { Boton, colores, Pantalla, Parrafo, Subtitulo, Tarjeta, Vacio } from "../ui";

// D33 y R40: avisos dentro de la app; pasado el tope diario, el resto queda en el resumen.

export interface PropsAvisos {
  avisos: AvisoDatos[];
  abrirSobre: (id: string) => void;
  marcarLeidos: () => void;
  volver?: () => void;
}

const COLOR: Record<string, string> = { rojo: colores.rojo, amarillo: colores.amarillo, info: colores.texto };

export function Avisos({ avisos, abrirSobre, marcarLeidos, volver }: PropsAvisos) {
  const nuevos = avisos.filter((a) => a.estado === "enviada");
  const resumen = avisos.filter((a) => a.estado === "en_resumen");
  const leidos = avisos.filter((a) => a.estado === "leida");
  const lista = (titulo: string, xs: AvisoDatos[]) =>
    xs.length > 0 && (
      <View style={{ gap: 8 }}>
        <Subtitulo>{titulo}</Subtitulo>
        {xs.map((a) => (
          <Tarjeta key={a.id} {...(a.sobreId ? { onPress: () => abrirSobre(a.sobreId!), etiqueta: "Ver sobre" } : {})}>
            <Text style={{ color: COLOR[a.severidad] ?? colores.texto, fontSize: 16, lineHeight: 22 }}>{a.mensaje}</Text>
            <Parrafo suave>{`${formatoFecha(a.fecha)}${a.regla ? ` · ${a.regla}` : ""}`}</Parrafo>
          </Tarjeta>
        ))}
      </View>
    );
  return (
    <Pantalla titulo="Avisos" {...(volver ? { volver } : {})}>
      {avisos.length === 0 && <Vacio texto="No hay avisos. Cuando un sobre vaya rápido o un pago esté por vencer, aparecerá aquí." />}
      {lista("Nuevos", nuevos)}
      {lista("Resumen del día (R40)", resumen)}
      {(nuevos.length > 0 || resumen.length > 0) && <Boton texto="Marcar todos como leídos" secundario onPress={marcarLeidos} />}
      {lista("Anteriores", leidos)}
    </Pantalla>
  );
}
