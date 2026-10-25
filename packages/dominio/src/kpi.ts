import { FUTURO_MIN_PCT, type Etapa } from "./reglas/r04_ordenFlujo";

// Indicadores del MVP (método, sección 9). Se calculan aquí y se guardan con app.cerrar_mes (spec 010).

export type Semaforo = "info" | "amarillo" | "rojo";

export interface DatosKpi {
  ingresos: number;                  // ingresos del mes (sin transferencias internas)
  gastos: number;                    // gastos confirmados (sin pagos de tarjeta ni transferencias, R27, R28)
  gastoEsenciales: number;
  aFuturo: number;                   // asignado a Futuro y emergencia en el mes
  servicioDeuda: number;             // cuotas de deudas e intereses del mes
  saldoEmergencia: number;
  esencialesMensuales: number;
  capturados: number;                // movimientos registrados a mano o por chat
  deCartola: number;                 // movimientos del mes según cartola
  etapa: Etapa;
}

export interface Kpi {
  codigo: "K1" | "K2" | "K3" | "K4" | "K6" | "KP1" | "ICF";
  valor: number;
  semaforo: Semaforo | null;
}

const r = (x: number, d = 4) => Math.round(x * 10 ** d) / 10 ** d;

export function calcularKpis(d: DatosKpi): Kpi[] {
  const k: Kpi[] = [];
  const minFuturo = (FUTURO_MIN_PCT[d.etapa] ?? 5) / 100;
  if (d.ingresos > 0) {
    const k1 = r(d.aFuturo / d.ingresos);
    k.push({ codigo: "K1", valor: k1, semaforo: k1 < minFuturo ? "amarillo" : null });
    const k3 = r(d.servicioDeuda / d.ingresos);
    k.push({ codigo: "K3", valor: k3, semaforo: k3 > 0.25 ? "rojo" : null });
    const k4 = r(d.gastoEsenciales / d.ingresos);
    k.push({ codigo: "K4", valor: k4, semaforo: k4 > 0.5 ? "rojo" : null });
  }
  if (d.esencialesMensuales > 0) {
    const k2 = r(d.saldoEmergencia / d.esencialesMensuales, 2);
    k.push({ codigo: "K2", valor: k2, semaforo: k2 < 1 ? "amarillo" : null });
  }
  const k6 = d.ingresos - d.gastos;
  k.push({ codigo: "K6", valor: k6, semaforo: k6 < 0 ? "rojo" : null });
  if (d.deCartola > 0) {
    const kp1 = r(Math.min(1, d.capturados / d.deCartola));
    k.push({ codigo: "KP1", valor: kp1, semaforo: kp1 < 0.9 ? "amarillo" : null });
  }
  const icf = indiceCompas(k);
  if (icf !== null) k.push({ codigo: "ICF", valor: icf, semaforo: icf >= 70 ? null : icf >= 40 ? "amarillo" : "rojo" });
  return k;
}

/** ICF 0–100: promedio de K1, K2, K3, K4 y K6 normalizados (adaptado de FinHealth). */
export function indiceCompas(k: Kpi[]): number | null {
  const v = (c: Kpi["codigo"]) => k.find((x) => x.codigo === c)?.valor;
  const partes: number[] = [];
  const k1 = v("K1"); if (k1 !== undefined) partes.push(Math.min(1, k1 / 0.2));
  const k2 = v("K2"); if (k2 !== undefined) partes.push(Math.min(1, k2 / 3));
  const k3 = v("K3"); if (k3 !== undefined) partes.push(Math.max(0, 1 - k3 / 0.5));
  const k4 = v("K4"); if (k4 !== undefined) partes.push(k4 <= 0.5 ? 1 : Math.max(0, 1 - (k4 - 0.5) / 0.5));
  const k6 = v("K6"); if (k6 !== undefined) partes.push(k6 >= 0 ? 1 : 0);
  if (!partes.length) return null;
  return Math.round((100 * partes.reduce((a, b) => a + b, 0)) / partes.length);
}

export const NOMBRE_KPI: Record<Kpi["codigo"], string> = {
  K1: "Tasa de ahorro",
  K2: "Meses de reserva",
  K3: "Carga financiera (RCI)",
  K4: "Esenciales / ingreso",
  K6: "Balance del mes",
  KP1: "Cobertura de captura",
  ICF: "Índice Compás",
};
