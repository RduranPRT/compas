export interface SobreParaPronostico {
  tipo: string;
  disponible: number;
  gastado: number;
  saldo: number;
}

/** R12: balance proyectado al fin de mes; los sobres variables se proyectan al ritmo actual. */
export function r12_balanceProyectado(sobres: SobreParaPronostico[], dia: number, diasMes: number): number {
  const transcurridos = Math.max(1, Math.min(dia, diasMes));
  return sobres
    .filter((s) => s.tipo !== "pago_tarjeta")
    .reduce((suma, s) => {
      if (s.tipo === "variable" || s.tipo === "mesada") {
        return suma + s.disponible - Math.round((s.gastado * diasMes) / transcurridos);
      }
      return suma + s.saldo;
    }, 0);
}
