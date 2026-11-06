import { formatoFecha } from "@compas/dominio";
import type { Importacion } from "../datos/cartolas";
import { Boton, colores, Etiqueta, Fila, Pantalla, Parrafo, Tarjeta, Vacio } from "../ui";

const ESTADO: Record<string, { texto: string; color: string }> = {
  en_revision: { texto: "Por revisar", color: colores.amarillo },
  importada: { texto: "Revisada", color: colores.verde },
  fallida: { texto: "Falló", color: colores.rojo },
  extraida: { texto: "Leída", color: colores.suave },
};

export interface PropsCartolas {
  importaciones: Importacion[];
  cuentas: { id: string; nombre: string }[];
  cargar: () => void;
  revisar: (id: string) => void;
  volver?: () => void;
}

export function Cartolas({ importaciones, cuentas, cargar, revisar, volver }: PropsCartolas) {
  return (
    <Pantalla titulo="Cartolas cargadas" {...(volver ? { volver } : {})}>
      <Boton texto="Cargar una cartola" onPress={cargar} />
      <Parrafo suave>Cargar cartolas es opcional: trae los movimientos desde el inicio del piloto para confirmarlos y calzarlos con lo anotado a mano.</Parrafo>
      {importaciones.length === 0 ? (
        <Vacio texto="Aún no hay cartolas. Descarga las de tus bancos en Excel y cárgalas aquí." />
      ) : (
        importaciones.map((i) => (
          <Tarjeta key={i.id} onPress={() => revisar(i.id)} etiqueta={`Revisar ${i.archivo}`}>
            <Fila
              etiqueta={cuentas.find((c) => c.id === i.cuentaId)?.nombre ?? "Cuenta"}
              detalle={`${i.archivo} · ${i.desde ? formatoFecha(i.desde) : ""} – ${i.hasta ? formatoFecha(i.hasta) : ""} · ${i.nMovimientos ?? 0} movimientos`}
              valor={<Etiqueta texto={ESTADO[i.estado]?.texto ?? i.estado} color={ESTADO[i.estado]?.color ?? colores.suave} />}
            />
          </Tarjeta>
        ))
      )}
    </Pantalla>
  );
}
