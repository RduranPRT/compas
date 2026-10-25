import { formatoFecha, formatoPesos, NOMBRE_ETAPA, r06_semaforo, type Etapa, type Hallazgo, type Perfil } from "@compas/dominio";
import { useState } from "react";
import { View } from "react-native";
import { Aviso, Barra, Boton, colores, Fila, Pantalla, Parrafo, Subtitulo, Tarjeta, Vacio } from "../ui";

// Spec 004 "Tu punto de partida": ingresos, bloques con semáforo, fijos, tarjeta, hallazgos con regla y fuente,
// etapa sugerida y confirmación por ambos administradores (R23). Lo detectado se precarga uno por uno.

type Resultado = Promise<{ error: string | null }>;

export interface PropsPerfil {
  perfil: { id: string; estado: string; desde: string; hasta: string; perfil: Perfil; hallazgos: Hallazgo[]; modelo: string } | null;
  historicos: { total: number; sinRevisar: number };
  etapaActual: string;
  etapaPropuesta: string | null;
  generar: () => Promise<{ error: string | null; conIA: boolean }>;
  proponerEtapa: (etapa: Etapa) => Resultado;
  agregarIngreso: (descripcion: string, monto: number, dia: number | null, esBase: boolean) => Resultado;
  agregarFijo: (nombre: string, categoriaId: string | null, monto: number, dia: number) => Resultado;
  crearFondo: (nombre: string, monto: number) => Resultado;
  irRevisar: () => void;
  irCargar: () => void;
  volver?: () => void;
}

function Accion({ texto, hacer }: { texto: string; hacer: () => Resultado }) {
  const [estado, setEstado] = useState<"listo" | "hecho" | string>("listo");
  if (estado === "hecho") return <Aviso texto="Agregado" tipo="exito" />;
  return (
    <View style={{ gap: 4 }}>
      <Boton texto={texto} secundario onPress={async () => { const r = await hacer(); setEstado(r.error ?? "hecho"); }} />
      {estado !== "listo" && <Aviso texto={estado} tipo="error" />}
    </View>
  );
}

export function PerfilInicial(p: PropsPerfil) {
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState<{ texto: string; tipo: "error" | "info" | "exito" } | null>(null);

  async function generar() {
    setOcupado(true);
    const r = await p.generar();
    setOcupado(false);
    setAviso(r.error ? { texto: r.error, tipo: "error" } : { texto: r.conIA ? "Perfil generado; la IA redactó los hallazgos." : "Perfil generado con las reglas del método.", tipo: "exito" });
  }

  if (!p.perfil) {
    return (
      <Pantalla titulo="Tu punto de partida" {...(p.volver ? { volver: p.volver } : {})}>
        <Parrafo>Con las cartolas de julio a septiembre, Compás calcula cuánto entra, en qué se va, qué es fijo y cómo se usa la tarjeta, y sugiere la etapa del hogar.</Parrafo>
        {p.historicos.total === 0 ? (
          <Vacio texto="Aún no hay movimientos anteriores al piloto." accion={<Boton texto="Cargar cartolas" onPress={p.irCargar} />} />
        ) : (
          <>
            <Parrafo suave>{`${p.historicos.total} movimientos históricos cargados${p.historicos.sinRevisar ? `; ${p.historicos.sinRevisar} sin clasificar` : ""}.`}</Parrafo>
            {p.historicos.sinRevisar > 0 && <Boton texto="Clasificar antes de generar" secundario onPress={p.irRevisar} />}
            <Boton texto="Generar perfil" onPress={generar} ocupado={ocupado} />
          </>
        )}
        {aviso && <Aviso texto={aviso.texto} tipo={aviso.tipo} />}
      </Pantalla>
    );
  }

  const { perfil: datos, hallazgos } = p.perfil;
  const ingreso = datos.ingresoBase + datos.ingresoVariable;
  const semaforo = r06_semaforo(datos.gastoPorBloque, ingreso, datos.etapaSugerida);
  const color = (c: string) => (c === "rojo" ? colores.rojo : c === "amarillo" ? colores.amarillo : colores.verde);

  return (
    <Pantalla titulo="Tu punto de partida" {...(p.volver ? { volver: p.volver } : {})}>
      <Parrafo suave>{`Del ${formatoFecha(p.perfil.desde)} al ${formatoFecha(p.perfil.hasta)} · ${p.perfil.modelo === "reglas" ? "Hallazgos calculados con las reglas del método" : "Hallazgos redactados por IA a partir de las cifras"}`}</Parrafo>
      <Tarjeta>
        <Subtitulo>Ingresos al mes</Subtitulo>
        <Fila etiqueta="Base (sueldos)" valor={datos.ingresoBase} detalle="Con esto se arma el plan (R45)" />
        <Fila etiqueta="Variable (promedio)" valor={datos.ingresoVariable} />
        <Fila etiqueta="Gasto promedio" valor={datos.gastoMensual} />
        <Fila etiqueta="Balance promedio" valor={datos.k6} fuerte />
      </Tarjeta>
      <Tarjeta>
        <Subtitulo>En qué se va (50/30/20)</Subtitulo>
        {semaforo.map((b) => (
          <View key={b.bloque} style={{ gap: 4 }}>
            <Fila etiqueta={`${b.bloque === "ESENCIALES" ? "Esenciales" : b.bloque === "FUTURO" ? "Futuro" : "Vida"} · ${String(b.pct).replace(".", ",")} %`} valor={b.monto} />
            <Barra valor={b.pct} total={b.limitePct * (b.bloque === "FUTURO" ? 5 : 2)} />
            {b.regla && <Parrafo suave>{b.mensaje}</Parrafo>}
            {!b.regla && b.color !== "verde" && <Parrafo suave>{b.mensaje}</Parrafo>}
            <View style={{ height: 2, backgroundColor: color(b.color), opacity: 0.4 }} />
          </View>
        ))}
        {datos.gastoPorCategoria.slice(0, 8).map((g) => (
          <Fila key={g.nombre} etiqueta={g.nombre} valor={g.promedio} />
        ))}
      </Tarjeta>
      <Tarjeta>
        <Subtitulo>Hallazgos</Subtitulo>
        {hallazgos.map((h, i) => (
          <View key={i} style={{ gap: 4, paddingVertical: 6 }}>
            <Parrafo>{`${h.titulo} · ${h.cifra}`}</Parrafo>
            <Parrafo suave>{h.explicacion}</Parrafo>
            <Parrafo suave>{`Opción: ${h.accion} (${h.regla_codigo}, ${h.fuente_codigo})`}</Parrafo>
          </View>
        ))}
      </Tarjeta>
      <Tarjeta>
        <Subtitulo>{`Etapa sugerida: ${datos.etapaSugerida} ${NOMBRE_ETAPA[datos.etapaSugerida]}`}</Subtitulo>
        <Parrafo>{datos.razonEtapa}</Parrafo>
        {datos.k2 !== null && <Fila etiqueta="Meses de reserva (K2)" valor={String(datos.k2).replace(".", ",")} />}
        {p.etapaPropuesta ? (
          <Parrafo suave>{`La etapa ${p.etapaPropuesta} espera la firma de ambos administradores en Aprobaciones (R23).`}</Parrafo>
        ) : p.etapaActual === datos.etapaSugerida && p.etapaActual !== "E0" ? (
          <Parrafo suave>{`El hogar ya está en ${p.etapaActual}.`}</Parrafo>
        ) : (
          <Accion texto={`Proponer etapa ${datos.etapaSugerida}`} hacer={() => p.proponerEtapa(datos.etapaSugerida)} />
        )}
      </Tarjeta>
      {(datos.ingresoBase > 0 || datos.pagosFijos.length > 0 || datos.irregulares.length > 0) && (
        <Tarjeta>
          <Subtitulo>Precargar lo detectado</Subtitulo>
          <Parrafo suave>Acepta solo lo que corresponda; después puedes editarlo en Ingresos y pagos fijos.</Parrafo>
          {datos.ingresoBase > 0 && (
            <View style={{ gap: 4 }}>
              <Fila etiqueta="Ingreso base mensual" valor={datos.ingresoBase} />
              <Accion texto="Agregar como ingreso base" hacer={() => p.agregarIngreso("Ingreso base", datos.ingresoBase, null, true)} />
            </View>
          )}
          {datos.ingresoVariable > 0 && (
            <View style={{ gap: 4 }}>
              <Fila etiqueta="Ingreso variable promedio" valor={datos.ingresoVariable} />
              <Accion texto="Agregar como variable" hacer={() => p.agregarIngreso("Ingreso variable", datos.ingresoVariable, null, false)} />
            </View>
          )}
          {datos.pagosFijos.slice(0, 12).map((f) => (
            <View key={f.comercio} style={{ gap: 4 }}>
              <Fila etiqueta={f.comercio} detalle={`Día ${f.dia} · ${f.meses} meses`} valor={f.monto} />
              <Accion texto="Agregar como pago fijo" hacer={() => p.agregarFijo(f.comercio, f.categoriaId, f.monto, f.dia || 1)} />
            </View>
          ))}
          {datos.irregulares.map((g) => (
            <View key={g.comercio} style={{ gap: 4 }}>
              <Fila etiqueta={g.comercio} detalle={`Gasto único del ${formatoFecha(g.fecha)}`} valor={g.monto} />
              <Accion texto={`Crear fondo anual de ${formatoPesos(g.monto)}`} hacer={() => p.crearFondo(g.comercio, g.monto)} />
            </View>
          ))}
        </Tarjeta>
      )}
      <Boton texto="Volver a calcular" secundario onPress={generar} ocupado={ocupado} />
      {aviso && <Aviso texto={aviso.texto} tipo={aviso.tipo} />}
    </Pantalla>
  );
}
