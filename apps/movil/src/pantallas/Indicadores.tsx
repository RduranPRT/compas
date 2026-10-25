import { formatoPesos, NOMBRE_KPI, nombreMes, type Kpi } from "@compas/dominio";
import type { Medicion } from "../datos/cierres";
import { Fila, Pantalla, Parrafo, Subtitulo, Tarjeta, Vacio } from "../ui";

// HU-010-3: indicadores de cada mes cerrado comparados con la línea base (primer mes cerrado).

export interface PropsIndicadores {
  mediciones: Medicion[];
  volver?: () => void;
}

function formato(codigo: string, valor: number): string {
  if (codigo === "K6") return formatoPesos(Math.round(valor));
  if (codigo === "K2") return `${String(valor).replace(".", ",")} meses`;
  if (codigo === "ICF") return `${valor}`;
  return `${String(Math.round(valor * 1000) / 10).replace(".", ",")} %`;
}

export function Indicadores({ mediciones, volver }: PropsIndicadores) {
  const meses = [...new Set(mediciones.map((m) => m.mes))].sort();
  const base = meses[0];
  return (
    <Pantalla titulo="Indicadores" {...(volver ? { volver } : {})}>
      {meses.length === 0 ? (
        <Vacio texto="Los indicadores aparecen al cerrar el primer mes (octubre es la línea base)." />
      ) : (
        [...meses].reverse().map((mes) => (
          <Tarjeta key={mes}>
            <Subtitulo>{`${nombreMes(mes)}${mes === base ? " · línea base" : ""}`}</Subtitulo>
            {mediciones.filter((m) => m.mes === mes).map((m) => {
              const inicial = mediciones.find((x) => x.mes === base && x.codigo === m.codigo);
              return (
                <Fila
                  key={m.codigo}
                  etiqueta={NOMBRE_KPI[m.codigo as Kpi["codigo"]] ?? m.codigo}
                  detalle={inicial && mes !== base ? `Línea base: ${formato(m.codigo, inicial.valor)}` : undefined}
                  valor={formato(m.codigo, m.valor)}
                />
              );
            })}
          </Tarjeta>
        ))
      )}
      <Parrafo suave>K1 tasa de ahorro · K2 meses de reserva · K3 carga financiera · K4 esenciales sobre ingreso · K6 balance · KP1 cobertura de captura · ICF índice 0–100.</Parrafo>
    </Pantalla>
  );
}
