/** R38: reasignación N1 bajo el umbral (% del disponible del sobre de origen) se autoaprueba. */
export function r38_autoaprobada(monto: number, disponibleOrigen: number, pctUmbral: number): boolean {
  return monto <= Math.floor((disponibleOrigen * pctUmbral) / 100);
}
