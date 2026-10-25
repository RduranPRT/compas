import {
  detectarEncabezado,
  extraerConMapeo,
  formatoFecha,
  formatoPesos,
  mapeoCompleto,
  proponerMapeo,
  resumirLineas,
  textoCelda,
  type LineaCartola,
  type Mapeo,
  type Tabla,
} from "@compas/dominio";
import { useState } from "react";
import { View } from "react-native";
import { Aviso, Boton, Fila, Opciones, Pantalla, Parrafo, Subtitulo, Tarjeta } from "../ui";

// Spec 003 (D27, D30): elegir cuenta → elegir archivo → la IA lee la cartola o se confirma qué columna es cada
// cosa → resumen → importar. El archivo no sale del dispositivo; solo se guardan las líneas minimizadas.

export interface CuentaCartola {
  id: string;
  nombre: string;
  tipo: string;
}

export interface ArchivoLeido {
  nombre: string;
  formato: "xlsx" | "csv" | "pdf";
  sha256: string;
  tabla: Tabla;
}

export interface ResultadoIA {
  ok: boolean;
  lineas?: LineaCartola[];
  mensaje?: string;
  cuadra?: boolean;
}

export interface PropsCargarCartola {
  cuentas: CuentaCartola[];
  inicioPiloto: string;
  elegirArchivo: () => Promise<ArchivoLeido | null>;
  leerConIA: (tabla: Tabla, cuenta: CuentaCartola) => Promise<ResultadoIA>;
  importar: (cuenta: CuentaCartola, archivo: ArchivoLeido, lineas: LineaCartola[], lector: string) => Promise<{
    error: string | null;
    resultado?: { importacionId: string; historicos: number; movimientos: number; duplicados: number; transferencias: number; calzados: number };
  }>;
  revisar: (importacionId: string) => void;
  volver?: () => void;
}

const SIN = -1;

export function CargarCartola({ cuentas, inicioPiloto, elegirArchivo, leerConIA, importar, revisar, volver }: PropsCargarCartola) {
  const [cuentaId, setCuentaId] = useState<string | null>(cuentas[0]?.id ?? null);
  const [archivo, setArchivo] = useState<ArchivoLeido | null>(null);
  const [fila, setFila] = useState(-1);
  const [mapeo, setMapeo] = useState<Partial<Mapeo>>({});
  const [lineasIA, setLineasIA] = useState<LineaCartola[] | null>(null);
  const [aviso, setAviso] = useState<{ texto: string; tipo: "error" | "info" | "exito" | "alerta" } | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [hecho, setHecho] = useState<NonNullable<Awaited<ReturnType<PropsCargarCartola["importar"]>>["resultado"]> | null>(null);
  const cuenta = cuentas.find((c) => c.id === cuentaId);

  async function elegir() {
    setAviso(null);
    setHecho(null);
    setLineasIA(null);
    try {
      const a = await elegirArchivo();
      if (!a) return;
      if (a.formato === "pdf") {
        setArchivo(null);
        return setAviso({ texto: "Por ahora Compás lee cartolas en Excel o CSV. Descárgala en ese formato desde tu banco.", tipo: "alerta" });
      }
      const f = detectarEncabezado(a.tabla);
      setArchivo(a);
      setFila(f);
      setMapeo(f >= 0 ? proponerMapeo(a.tabla[f] ?? []) : {});
      if (f < 0) setAviso({ texto: "No encontramos los encabezados. Prueba con la lectura con IA o con otra descarga del banco.", tipo: "alerta" });
    } catch (e) {
      setAviso({ texto: e instanceof Error ? e.message : "No pudimos leer el archivo.", tipo: "error" });
    }
  }

  async function usarIA() {
    if (!archivo || !cuenta) return;
    setOcupado(true);
    const r = await leerConIA(archivo.tabla, cuenta);
    setOcupado(false);
    if (!r.ok || !r.lineas) return setAviso({ texto: r.mensaje ?? "La IA no está disponible; usa las columnas.", tipo: "alerta" });
    setLineasIA(r.lineas);
    setAviso(r.cuadra === false
      ? { texto: "Los totales del documento no cuadran con las líneas leídas: revisa antes de importar.", tipo: "alerta" }
      : { texto: `La IA leyó ${r.lineas.length} movimientos.`, tipo: "exito" });
  }

  const encabezados = archivo && fila >= 0 ? (archivo.tabla[fila] ?? []).map((c, i) => ({ valor: String(i), texto: textoCelda(c) || `Columna ${i + 1}` })) : [];
  const extraido = archivo && fila >= 0 && mapeoCompleto(mapeo) ? extraerConMapeo(archivo.tabla, fila, mapeo, Number(inicioPiloto.slice(0, 4))) : null;
  const lineas = lineasIA ?? extraido?.lineas ?? [];
  const resumen = resumirLineas(lineas, inicioPiloto);

  async function confirmar() {
    if (!archivo || !cuenta || !lineas.length) return;
    setOcupado(true);
    const r = await importar(cuenta, archivo, lineas, lineasIA ? "ia" : "mapeo_columnas");
    setOcupado(false);
    if (r.error) return setAviso({ texto: r.error, tipo: "error" });
    setHecho(r.resultado ?? null);
    setArchivo(null);
    setAviso(null);
  }

  const columna = (clave: keyof Mapeo, etiqueta: string, opcional = false) => (
    <Opciones
      etiqueta={etiqueta}
      opciones={[...(opcional ? [{ valor: String(SIN), texto: "No hay" }] : []), ...encabezados]}
      valor={mapeo[clave] === undefined ? (opcional ? String(SIN) : null) : String(mapeo[clave])}
      onCambio={(v) => {
        const n = Number(v);
        const nuevo = { ...mapeo };
        if (n === SIN) delete nuevo[clave];
        else nuevo[clave] = n;
        if (clave === "monto" && n !== SIN) { delete nuevo.cargo; delete nuevo.abono; }
        if ((clave === "cargo" || clave === "abono") && n !== SIN) delete nuevo.monto;
        setMapeo(nuevo);
        setLineasIA(null);
      }}
    />
  );

  return (
    <Pantalla titulo="Cargar cartola" {...(volver ? { volver } : {})}>
      <Parrafo suave>El archivo se lee en este dispositivo y no se sube: solo se guardan los movimientos, sin RUT ni números de cuenta (R43).</Parrafo>
      <Opciones etiqueta="¿De qué cuenta es?" opciones={cuentas.map((c) => ({ valor: c.id, texto: c.nombre }))} valor={cuentaId} onCambio={setCuentaId} />
      <Boton texto={archivo ? `Cambiar archivo (${archivo.nombre})` : "Elegir archivo Excel o CSV"} secundario={!!archivo} onPress={elegir} />
      {archivo && fila >= 0 && (
        <Tarjeta>
          <Subtitulo>¿Qué columna es cada cosa?</Subtitulo>
          <Parrafo suave>Lo propusimos según los encabezados; corrige si algo no calza.</Parrafo>
          {columna("fecha", "Fecha")}
          {columna("descripcion", "Descripción")}
          {columna("cargo", "Cargos", true)}
          {columna("abono", "Abonos", true)}
          {mapeo.cargo === undefined && mapeo.abono === undefined && columna("monto", "Monto con signo", true)}
        </Tarjeta>
      )}
      {archivo && <Boton texto="Leer con IA" secundario onPress={usarIA} ocupado={ocupado} />}
      {lineas.length > 0 && (
        <Tarjeta>
          <Subtitulo>Resumen</Subtitulo>
          <Fila etiqueta="Movimientos" valor={String(lineas.length)} />
          <Fila etiqueta="Desde – hasta" valor={`${formatoFecha(resumen.desde ?? inicioPiloto)} – ${formatoFecha(resumen.hasta ?? inicioPiloto)}`} />
          <Fila etiqueta={`Antes del ${formatoFecha(inicioPiloto)} (solo perfil, R41)`} valor={String(resumen.antesDelPiloto)} />
          <Fila etiqueta="Desde el inicio del piloto (por confirmar, R42)" valor={String(resumen.desdeElPiloto)} />
          <Fila etiqueta="Cargos" valor={-resumen.cargos} />
          <Fila etiqueta="Abonos" valor={resumen.abonos} />
          {lineas.slice(0, 5).map((l, i) => (
            <Parrafo key={i} suave>{`${formatoFecha(l.fecha)} · ${l.glosa} · ${formatoPesos(l.monto)}`}</Parrafo>
          ))}
          {extraido && extraido.noLeidas.length > 0 && !lineasIA && (
            <Parrafo suave>{`Filas que no pudimos leer: ${extraido.noLeidas.slice(0, 10).join(", ")}.`}</Parrafo>
          )}
          <Boton texto={`Importar ${lineas.length} movimientos`} onPress={confirmar} ocupado={ocupado} />
        </Tarjeta>
      )}
      {aviso && <Aviso texto={aviso.texto} tipo={aviso.tipo} />}
      {hecho && (
        <Tarjeta>
          <Subtitulo>Cartola importada</Subtitulo>
          <Fila etiqueta="Históricos para el perfil" valor={String(hecho.historicos)} />
          <Fila etiqueta="Movimientos del piloto" valor={String(hecho.movimientos)} />
          <Fila etiqueta="Ya estaban (duplicados)" valor={String(hecho.duplicados)} />
          <Fila etiqueta="Transferencias y pagos de tarjeta" valor={String(hecho.transferencias)} />
          <Fila etiqueta="Calzados con lo anotado a mano" valor={String(hecho.calzados)} />
          <View style={{ gap: 8 }}>
            <Boton texto="Revisar y clasificar" onPress={() => revisar(hecho.importacionId)} />
            <Boton texto="Cargar otra cartola" secundario onPress={elegir} />
          </View>
        </Tarjeta>
      )}
    </Pantalla>
  );
}
