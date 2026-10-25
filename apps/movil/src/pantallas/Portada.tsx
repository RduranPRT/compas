import { Aviso, Pantalla, Parrafo } from "../ui";

export interface PropsPortada {
  nombreHogar: string;
  /** Firma del Acuerdo pendiente: de quién y si ya rige (activado con urgente). */
  firmaPendiente: { nombre: string; vigente: boolean } | null;
}

export function Portada({ nombreHogar, firmaPendiente }: PropsPortada) {
  return (
    <Pantalla titulo={nombreHogar}>
      {firmaPendiente && (
        <Aviso
          texto={
            firmaPendiente.vigente
              ? `El Acuerdo v1 está vigente; falta la firma de ${firmaPendiente.nombre}.`
              : `El Acuerdo v1 queda vigente cuando ${firmaPendiente.nombre} lo firme.`
          }
        />
      )}
      <Parrafo>Siguiente paso: cargar tus cuentas</Parrafo>
    </Pantalla>
  );
}
