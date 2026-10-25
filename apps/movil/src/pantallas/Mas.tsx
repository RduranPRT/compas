import { View } from "react-native";
import { Boton, Enlace, Pantalla, Parrafo, Subtitulo, Tarjeta } from "../ui";

// Menú: configuración del hogar, datos, ciclo del mes, gobierno y privacidad.

export interface PropsMas {
  nombre: string;
  rol: string;
  etapa: string;
  esAdmin: boolean;
  ir: (ruta: string) => void;
  salir: () => void;
}

const SECCIONES: { titulo: string; soloAdmin?: boolean; items: [string, string][] }[] = [
  { titulo: "El mes", items: [["Llegó un ingreso", "/ingreso"], ["Plan del mes", "/plan"], ["Cierre semanal", "/cierre-semanal"], ["Cierre del mes", "/cierre-mensual"], ["Indicadores", "/indicadores"]] },
  { titulo: "Datos", soloAdmin: true, items: [["Cargar cartola", "/cargar-cartola"], ["Cartolas cargadas", "/cartolas"], ["Tu punto de partida (perfil)", "/perfil"]] },
  { titulo: "Hogar", soloAdmin: true, items: [["Cuentas y tarjetas", "/cuentas"], ["Categorías y fondos", "/categorias"], ["Ingresos y pagos fijos", "/ingresos-fijos"]] },
  { titulo: "Acuerdos", items: [["Aprobaciones", "/aprobaciones"], ["Avisos", "/avisos"]] },
  { titulo: "Privacidad", items: [["Consentimientos y datos", "/privacidad"]] },
];

const ROL: Record<string, string> = { ORG: "Organizador/a", CAD: "Co-administrador/a", ING: "Integrante con ingresos" };

export function Mas({ nombre, rol, etapa, esAdmin, ir, salir }: PropsMas) {
  return (
    <Pantalla titulo="Más">
      <Parrafo suave>{`${nombre} · ${ROL[rol] ?? rol} · Etapa ${etapa}`}</Parrafo>
      {SECCIONES.filter((s) => esAdmin || !s.soloAdmin).map((s) => (
        <Tarjeta key={s.titulo}>
          <Subtitulo>{s.titulo}</Subtitulo>
          <View style={{ gap: 12 }}>
            {s.items.map(([texto, ruta]) => (
              <Enlace key={ruta} texto={texto} onPress={() => ir(ruta)} />
            ))}
          </View>
        </Tarjeta>
      ))}
      <Boton texto="Cerrar sesión" secundario onPress={salir} />
    </Pantalla>
  );
}
