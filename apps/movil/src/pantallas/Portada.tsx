import { Aviso, Pantalla, Parrafo } from "../ui";

export interface PropsPortada {
  nombreHogar: string;
  /** Nombre del CAD si el Acuerdo se activó con urgente y aún no lo firma. */
  firmaPendienteDe: string | null;
}

export function Portada({ nombreHogar, firmaPendienteDe }: PropsPortada) {
  return (
    <Pantalla titulo={nombreHogar}>
      {firmaPendienteDe && <Aviso texto={`El Acuerdo v1 está vigente; falta la firma de ${firmaPendienteDe}.`} />}
      <Parrafo>Siguiente paso: cargar tus cuentas</Parrafo>
    </Pantalla>
  );
}
