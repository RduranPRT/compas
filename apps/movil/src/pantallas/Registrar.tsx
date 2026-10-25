import { formatoPesos, leerMonto, sumarDias, type PropuestaFrase } from "@compas/dominio";
import { useMemo, useState } from "react";
import { View } from "react-native";
import type { Gasto, RespuestaGasto, Sobre } from "../datos/finanzas";
import { Aviso, Boton, Campo, Opciones, Pantalla, Parrafo, Subtitulo, Tarjeta } from "../ui";

// HU-005-1 y HU-005-2: anotar un gasto en dos toques (monto y sobre) o con una frase.

export interface CuentaCaptura {
  id: string;
  nombre: string;
  tipo: string;
}

export interface PropsRegistrar {
  hoy: string;
  sobres: Sobre[];
  cuentas: CuentaCaptura[];
  medioPorDefecto: string | null;
  tratamientoPorDefecto: "por_cuota" | "total";
  guardar: (g: Gasto) => Promise<{ error: { message: string } | null; data: RespuestaGasto | null; enCola?: boolean }>;
  interpretar: (frase: string) => Promise<PropuestaFrase & { conIA: boolean }>;
  horasDeVida?: (monto: number) => number | null;
  volver?: () => void;
}

export function Registrar({ hoy, sobres, cuentas, medioPorDefecto, tratamientoPorDefecto, guardar, interpretar, horasDeVida, volver }: PropsRegistrar) {
  const [modo, setModo] = useState<"gasto" | "frase">("gasto");
  const [montoTexto, setMontoTexto] = useState("");
  const [sobreId, setSobreId] = useState<string | null>(null);
  const [cuentaId, setCuentaId] = useState<string | null>(medioPorDefecto && cuentas.some((c) => c.id === medioPorDefecto) ? medioPorDefecto : (cuentas[0]?.id ?? null));
  const [fecha, setFecha] = useState(hoy);
  const [comercio, setComercio] = useState("");
  const [cuotas, setCuotas] = useState("1");
  const [tratamiento, setTratamiento] = useState<"por_cuota" | "total">(tratamientoPorDefecto);
  const [verTodos, setVerTodos] = useState(false);
  const [frase, setFrase] = useState("");
  const [origen, setOrigen] = useState<"manual" | "chat">("manual");
  const [confianza, setConfianza] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const monto = Math.abs(leerMonto(montoTexto) ?? 0);
  const cuenta = cuentas.find((c) => c.id === cuentaId);
  const esTarjeta = cuenta?.tipo === "tarjeta_credito";
  // Sobres frecuentes primero: los que más se usan en el mes
  const ordenados = useMemo(() => [...sobres].sort((a, b) => b.gastado - a.gastado || a.nombre.localeCompare(b.nombre)), [sobres]);
  const visibles = verTodos ? ordenados : ordenados.slice(0, 8);
  if (sobreId && !visibles.some((s) => s.id === sobreId)) {
    const elegido = ordenados.find((s) => s.id === sobreId);
    if (elegido) visibles.push(elegido);
  }

  async function usarFrase() {
    if (!frase.trim()) return setError("Escribe qué gastaste, por ejemplo: 12 lucas en la feria con débito.");
    setOcupado(true);
    setError(null);
    const p = await interpretar(frase);
    setOcupado(false);
    if (p.monto) setMontoTexto(String(p.monto));
    if (p.sobreId) setSobreId(p.sobreId);
    if (p.cuentaId) setCuentaId(p.cuentaId);
    if (p.comercio) setComercio(p.comercio);
    setFecha(p.fecha);
    setCuotas(String(p.nCuotas));
    setOrigen("chat");
    setConfianza(p.conIA ? p.confianza : null);
    setModo("gasto");
    setExito(p.monto && p.sobreId ? "Revisa la propuesta y confirma." : "Completa lo que falta y confirma.");
  }

  async function enviar() {
    setExito(null);
    if (!monto) return setError("Escribe el monto.");
    if (!sobreId) return setError("Elige el sobre.");
    if (!cuentaId) return setError("Elige con qué pagaste.");
    const n = Math.max(1, Number(cuotas) || 1);
    setError(null);
    setOcupado(true);
    const r = await guardar({
      cuentaId, sobreId, monto, fecha, comercio: comercio.trim() || null,
      nCuotas: esTarjeta ? n : 1, tratamiento: esTarjeta && n > 1 ? tratamiento : null, origen, confianza,
    });
    setOcupado(false);
    if (r.error) return setError(r.error.message);
    const sobre = sobres.find((s) => s.id === sobreId)?.nombre ?? "el sobre";
    const horas = horasDeVida?.(monto);
    const partes = [
      r.enCola ? `Guardado sin conexión: ${formatoPesos(monto)} en ${sobre}. Se enviará al volver la señal.` : `Listo: ${formatoPesos(monto)} en ${sobre}.`,
      horas ? `Equivale a ${String(horas).replace(".", ",")} horas de trabajo (R18).` : "",
      r.data?.duplicado ? "Parece repetido: quedó en la bandeja para revisarlo (R35)." : r.data?.estado === "por_confirmar" ? "Quedó por confirmar." : "",
    ];
    setExito(partes.filter(Boolean).join(" "));
    setMontoTexto("");
    setComercio("");
    setCuotas("1");
    setOrigen("manual");
    setConfianza(null);
    setFrase("");
  }

  return (
    <Pantalla titulo="Registrar gasto" {...(volver ? { volver } : {})}>
      <Opciones
        opciones={[{ valor: "gasto", texto: "Monto y sobre" }, { valor: "frase", texto: "Escribir una frase" }]}
        valor={modo}
        onCambio={setModo}
      />
      {modo === "frase" ? (
        <>
          <Campo
            etiqueta="¿Qué gastaste?"
            placeholder="gasté 12 lucas en la feria con débito"
            value={frase}
            onChangeText={setFrase}
            autoFocus
            onSubmitEditing={usarFrase}
          />
          <Boton texto="Interpretar" onPress={usarFrase} ocupado={ocupado} />
        </>
      ) : (
        <>
          <Campo
            etiqueta="Monto"
            placeholder="$0"
            value={montoTexto}
            onChangeText={setMontoTexto}
            keyboardType="numeric"
            inputMode="numeric"
            autoFocus
            ayuda={monto ? formatoPesos(monto) : undefined}
          />
          <Subtitulo>Sobre</Subtitulo>
          <Opciones opciones={visibles.map((s) => ({ valor: s.id, texto: s.nombre }))} valor={sobreId} onCambio={setSobreId} />
          {ordenados.length > 8 && (
            <Boton texto={verTodos ? "Ver menos sobres" : "Ver todos los sobres"} secundario onPress={() => setVerTodos(!verTodos)} />
          )}
          <Opciones etiqueta="Pagaste con" opciones={cuentas.map((c) => ({ valor: c.id, texto: c.nombre }))} valor={cuentaId} onCambio={setCuentaId} />
          <Opciones
            etiqueta="Fecha de la compra"
            opciones={[{ valor: hoy, texto: "Hoy" }, { valor: sumarDias(hoy, -1), texto: "Ayer" }, { valor: sumarDias(hoy, -2), texto: "Anteayer" }]}
            valor={[hoy, sumarDias(hoy, -1), sumarDias(hoy, -2)].includes(fecha) ? fecha : null}
            onCambio={setFecha}
          />
          {![hoy, sumarDias(hoy, -1), sumarDias(hoy, -2)].includes(fecha) && <Parrafo suave>{`Fecha: ${fecha}`}</Parrafo>}
          <Campo etiqueta="Detalle (opcional)" placeholder="Feria, Jumbo, bencina…" value={comercio} onChangeText={setComercio} />
          {esTarjeta && (
            <Tarjeta>
              <Campo etiqueta="Cuotas" value={cuotas} onChangeText={setCuotas} keyboardType="numeric" inputMode="numeric" />
              {Number(cuotas) > 1 && (
                <Opciones
                  etiqueta="¿Cómo se descuenta? (D08)"
                  opciones={[{ valor: "por_cuota", texto: "Cada cuota en su mes" }, { valor: "total", texto: "Todo este mes" }]}
                  valor={tratamiento}
                  onCambio={setTratamiento}
                />
              )}
            </Tarjeta>
          )}
          <Aviso texto={error} tipo="error" />
          <Aviso texto={exito} tipo="exito" />
          <View style={{ gap: 8 }}>
            <Boton texto="Guardar gasto" onPress={enviar} ocupado={ocupado} />
          </View>
        </>
      )}
      {modo === "frase" && <Aviso texto={error} tipo="error" />}
    </Pantalla>
  );
}
