import { formatoPesos, nombreMes } from "@compas/dominio";
import { Text, View } from "react-native";
import { Aviso, BotonFlotante, Casilla, colores, Enlace, Fila, Pantalla, Parrafo, Subtitulo, Tarjeta } from "../ui";

// Portada: lo urgente arriba (avisos, aprobaciones, pendientes) y el estado del mes; mientras falte
// configurar el hogar, la lista "Configura tu hogar" muestra el siguiente paso (spec 002).

export interface PasoConfiguracion {
  clave: string;
  texto: string;
  hecho: boolean;
  ir: () => void;
}

export interface ResumenTarjeta {
  id: string;
  nombre: string;
  deuda: number;
  apartado: number;
  diaPago: number;
}

export interface PropsPortada {
  nombreHogar: string;
  /** Firma del Acuerdo pendiente: de quién y si ya rige (activado con urgente). */
  firmaPendiente: { nombre: string; vigente: boolean } | null;
  mes?: string;
  lineaBase?: boolean;
  mesPrimerPlan?: string;
  pasos?: PasoConfiguracion[];
  avisos?: { id: string; mensaje: string; severidad: string }[];
  aprobaciones?: number;
  pendientes?: number;
  porAsignar?: number;
  gastadoMes?: number;
  pronostico?: number | null;
  tarjetas?: ResumenTarjeta[];
  transferencias?: number;
  ir?: (ruta: string) => void;
}

export function Portada({
  nombreHogar,
  firmaPendiente,
  mes,
  lineaBase,
  mesPrimerPlan,
  pasos = [],
  avisos = [],
  aprobaciones = 0,
  pendientes = 0,
  porAsignar,
  gastadoMes,
  pronostico,
  tarjetas = [],
  transferencias = 0,
  ir,
}: PropsPortada) {
  const faltan = pasos.filter((p) => !p.hecho);
  const siguiente = faltan[0];
  return (
    <Pantalla titulo={nombreHogar} flotante={ir ? <BotonFlotante onPress={() => ir("/registrar")} /> : undefined}>
      {firmaPendiente && (
        <Aviso
          texto={
            firmaPendiente.vigente
              ? `El Acuerdo v1 está vigente; falta la firma de ${firmaPendiente.nombre}.`
              : `El Acuerdo v1 queda vigente cuando ${firmaPendiente.nombre} lo firme.`
          }
        />
      )}

      {siguiente ? (
        <Tarjeta>
          <Subtitulo>Configura tu hogar</Subtitulo>
          <Parrafo>{`Siguiente paso: ${siguiente.texto.toLowerCase()}`}</Parrafo>
          {pasos.map((p) => (
            <Casilla key={p.clave} etiqueta={p.texto} marcada={p.hecho} onCambio={() => p.ir()} />
          ))}
        </Tarjeta>
      ) : pasos.length === 0 ? (
        <Parrafo>Siguiente paso: cargar tus cuentas</Parrafo>
      ) : null}

      {(aprobaciones > 0 || pendientes > 0 || transferencias > 0) && (
        <Tarjeta>
          <Subtitulo>Para hoy</Subtitulo>
          {aprobaciones > 0 && ir && <Enlace texto={`${aprobaciones} ${aprobaciones === 1 ? "aprobación espera" : "aprobaciones esperan"} tu firma`} onPress={() => ir("/aprobaciones")} />}
          {pendientes > 0 && ir && <Enlace texto={`${pendientes} ${pendientes === 1 ? "movimiento por confirmar" : "movimientos por confirmar"}`} onPress={() => ir("/bandeja")} />}
          {transferencias > 0 && ir && <Enlace texto={`${transferencias} ${transferencias === 1 ? "transferencia pendiente" : "transferencias pendientes"}`} onPress={() => ir("/ingreso")} />}
        </Tarjeta>
      )}

      {avisos.length > 0 && (
        <Tarjeta onPress={ir ? () => ir("/avisos") : undefined} etiqueta="Ver avisos">
          <Subtitulo>Avisos</Subtitulo>
          {avisos.slice(0, 3).map((a) => (
            <Text key={a.id} style={{ color: a.severidad === "rojo" ? colores.rojo : a.severidad === "amarillo" ? colores.amarillo : colores.texto, fontSize: 15 }}>
              {`• ${a.mensaje}`}
            </Text>
          ))}
        </Tarjeta>
      )}

      {mes && (
        <Tarjeta onPress={ir ? () => ir("/sobres") : undefined} etiqueta="Ver sobres del mes">
          <Subtitulo>{`Mes de ${nombreMes(mes)}`}</Subtitulo>
          {lineaBase && mesPrimerPlan ? (
            <Parrafo suave>{`Línea base: registra y clasifica sin presupuesto. El primer plan es el de ${nombreMes(mesPrimerPlan)} (D21).`}</Parrafo>
          ) : null}
          {porAsignar !== undefined && <Fila etiqueta="Por asignar" valor={porAsignar} detalle="Dinero recibido que aún no tiene sobre (R01)" />}
          {gastadoMes !== undefined && <Fila etiqueta="Gastado en el mes" valor={gastadoMes} />}
          {pronostico !== undefined && pronostico !== null && !lineaBase && (
            <Fila etiqueta="Proyección a fin de mes" valor={pronostico} detalle={pronostico < 0 ? "Al ritmo actual el mes cerraría en negativo (R12)" : "Al ritmo actual"} />
          )}
        </Tarjeta>
      )}

      {tarjetas.map((t) => (
        <Tarjeta key={t.id} onPress={ir ? () => ir(`/tarjeta/${t.id}`) : undefined} etiqueta={`Ver ${t.nombre}`}>
          <Subtitulo>{t.nombre}</Subtitulo>
          <Parrafo>{`Debes ${formatoPesos(Math.max(0, t.deuda))} · apartado ${formatoPesos(Math.max(0, t.apartado))} · pago el día ${t.diaPago}`}</Parrafo>
          {t.apartado < t.deuda && <Parrafo suave>{`Falta apartar ${formatoPesos(t.deuda - Math.max(0, t.apartado))} (R44).`}</Parrafo>}
        </Tarjeta>
      ))}
      <View style={{ height: 8 }} />
    </Pantalla>
  );
}
