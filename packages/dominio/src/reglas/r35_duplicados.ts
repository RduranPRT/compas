import { diferenciaDias } from "../fechas";

export interface MovimientoComparable {
  cuentaId: string;
  monto: number;
  fecha: string;
}

/** R35: mismo medio, mismo monto y fecha ±2 días → posible duplicado. */
export function r35_esDuplicadoCandidato(a: MovimientoComparable, b: MovimientoComparable): boolean {
  return a.cuentaId === b.cuentaId && a.monto === b.monto && Math.abs(diferenciaDias(a.fecha, b.fecha)) <= 2;
}
