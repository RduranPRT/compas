import { formatoFecha } from "@compas/dominio";
import { useState } from "react";
import type { Consentimiento } from "../datos/privacidad";
import { Aviso, Boton, Fila, Pantalla, Parrafo, Subtitulo, Tarjeta } from "../ui";

// Spec 011 (Ley 21.719): ver y revocar consentimientos, descargar los datos y borrar el hogar.

type Res = Promise<{ error: string | null; mensaje?: string }>;

const FINALIDAD: Record<string, string> = {
  uso_app: "Uso de la app",
  analitica_ia: "Análisis con IA",
  datos_menor: "Datos de menor",
};

export interface PropsPrivacidad {
  yo: string | null;
  esAdmin: boolean;
  consentimientos: Consentimiento[];
  borradoProgramado: string | null;
  revocar: (c: Consentimiento) => Res;
  activarIA: () => Res;
  exportar: () => Res;
  solicitarBorrado: () => Res;
  anularBorrado: () => Res;
  volver?: () => void;
}

export function Privacidad(p: PropsPrivacidad) {
  const [aviso, setAviso] = useState<{ texto: string; tipo: "error" | "exito" | "info" } | null>(null);
  const [confirmarBorrado, setConfirmarBorrado] = useState(false);
  const vigentes = p.consentimientos.filter((c) => !c.revocadoEn);
  const tengoIA = vigentes.some((c) => c.titularId === p.yo && c.finalidad === "analitica_ia");
  const ejecutar = async (f: () => Res, ok: string) => {
    const r = await f();
    setAviso(r.error ? { texto: r.error, tipo: "error" } : { texto: r.mensaje ?? ok, tipo: "exito" });
  };

  return (
    <Pantalla titulo="Privacidad" {...(p.volver ? { volver: p.volver } : {})}>
      <Tarjeta>
        <Subtitulo>Consentimientos vigentes</Subtitulo>
        {vigentes.map((c) => (
          <Fila
            key={c.id}
            etiqueta={`${FINALIDAD[c.finalidad] ?? c.finalidad} · ${c.titular}`}
            detalle={`Desde el ${formatoFecha(c.otorgadoEn.slice(0, 10))} · texto ${c.version}`}
            valor={(c.titularId === p.yo || (p.esAdmin && c.finalidad === "datos_menor"))
              ? <Boton texto="Revocar" secundario onPress={() => void ejecutar(() => p.revocar(c), c.finalidad === "datos_menor" ? "Revocado: el menor quedó inactivo (R25)." : "Revocado.")} />
              : ""}
          />
        ))}
        {!tengoIA && (
          <>
            <Parrafo suave>Sin análisis con IA, Compás funciona con las reglas del método. Si lo activas, los datos minimizados se procesan en Estados Unidos (ADR-04).</Parrafo>
            <Boton texto="Activar análisis con IA" secundario onPress={() => void ejecutar(p.activarIA, "Análisis con IA activado.")} />
          </>
        )}
      </Tarjeta>
      <Tarjeta>
        <Subtitulo>Tus datos</Subtitulo>
        <Parrafo suave>Descarga en JSON y CSV todo lo que puedes ver del hogar. El archivo se arma en este dispositivo.</Parrafo>
        <Boton texto="Descargar mis datos" secundario onPress={() => void ejecutar(p.exportar, "Descarga lista.")} />
      </Tarjeta>
      {p.esAdmin && (
        <Tarjeta>
          <Subtitulo>Borrar el hogar</Subtitulo>
          {p.borradoProgramado ? (
            <>
              <Parrafo>{`El borrado está programado desde el ${formatoFecha(p.borradoProgramado.slice(0, 10))}; a los 30 días se eliminan todos los datos (D19).`}</Parrafo>
              <Boton texto="Anular el borrado" onPress={() => void ejecutar(p.anularBorrado, "Borrado anulado.")} />
            </>
          ) : confirmarBorrado ? (
            <>
              <Parrafo>Se eliminarán todos los datos del hogar a los 30 días de que ambos administradores lo confirmen. Puedes anularlo antes.</Parrafo>
              <Boton texto="Sí, solicitar el borrado" peligro onPress={() => void ejecutar(p.solicitarBorrado, "Solicitud registrada: falta la firma en Aprobaciones.")} />
              <Boton texto="Cancelar" secundario onPress={() => setConfirmarBorrado(false)} />
            </>
          ) : (
            <Boton texto="Solicitar borrado del hogar" secundario onPress={() => setConfirmarBorrado(true)} />
          )}
        </Tarjeta>
      )}
      {aviso && <Aviso texto={aviso.texto} tipo={aviso.tipo} />}
    </Pantalla>
  );
}
