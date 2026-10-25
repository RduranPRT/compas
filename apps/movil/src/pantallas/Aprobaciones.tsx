import { formatoFecha } from "@compas/dominio";
import { useState } from "react";
import { View } from "react-native";
import type { Solicitud } from "../datos/gobierno";
import { Aviso, Boton, Pantalla, Parrafo, Tarjeta, Vacio } from "../ui";

// Una sola bandeja para firmar: Acuerdo, plan, reasignaciones, retiros de Futuro (doble firma, R37) y etapa (R23).

export interface PropsAprobaciones {
  solicitudes: Solicitud[];
  puedoFirmar: (s: Solicitud) => boolean;
  resolver: (id: string, aprueba: boolean) => Promise<{ error: string | null; estado: string | null }>;
  volver?: () => void;
}

function Item({ s, puedo, resolver }: { s: Solicitud; puedo: boolean; resolver: PropsAprobaciones["resolver"] }) {
  const [aviso, setAviso] = useState<{ texto: string; tipo: "error" | "exito" | "info" } | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const decidir = async (aprueba: boolean) => {
    setOcupado(true);
    const r = await resolver(s.id, aprueba);
    setOcupado(false);
    if (r.error) return setAviso({ texto: r.error, tipo: "error" });
    setAviso({
      texto: r.estado === "aprobada" ? "Aprobado." : r.estado === "rechazada" ? "Rechazado: se mantiene lo vigente." : "Tu firma quedó registrada; falta la otra.",
      tipo: r.estado === "pendiente" ? "info" : "exito",
    });
  };
  const firmas = s.firmas.length;
  return (
    <Tarjeta>
      <Parrafo>{s.descripcion}</Parrafo>
      <Parrafo suave>
        {s.firmasRequeridas === 2
          ? `Requiere la firma de ambos administradores (${firmas} de 2).`
          : `Le corresponde a ${s.aprobador ?? "un administrador"} hasta el ${formatoFecha(s.venceEn.slice(0, 10))}; después decide el suplente (R39).`}
      </Parrafo>
      {puedo && !aviso ? (
        <View style={{ flexDirection: "row", gap: 8 }}>
          <View style={{ flex: 1 }}><Boton texto="Aprobar" onPress={() => void decidir(true)} ocupado={ocupado} /></View>
          <View style={{ flex: 1 }}><Boton texto="Rechazar" secundario onPress={() => void decidir(false)} /></View>
        </View>
      ) : !aviso ? (
        <Parrafo suave>Esperando la firma de otra persona.</Parrafo>
      ) : null}
      {aviso && <Aviso texto={aviso.texto} tipo={aviso.tipo} />}
    </Tarjeta>
  );
}

export function Aprobaciones({ solicitudes, puedoFirmar, resolver, volver }: PropsAprobaciones) {
  return (
    <Pantalla titulo="Aprobaciones" {...(volver ? { volver } : {})}>
      {solicitudes.length === 0 ? (
        <Vacio texto="No hay aprobaciones pendientes." />
      ) : (
        solicitudes.map((s) => <Item key={s.id} s={s} puedo={puedoFirmar(s)} resolver={resolver} />)
      )}
    </Pantalla>
  );
}
