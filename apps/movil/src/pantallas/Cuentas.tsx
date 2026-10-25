import { formatoFecha, leerMonto } from "@compas/dominio";
import { useState } from "react";
import { View } from "react-native";
import type { Cuenta, NuevaCuenta, TipoCuenta } from "../datos/configuracion";
import { Aviso, Boton, Campo, Fila, Opciones, Pantalla, Parrafo, Subtitulo, Tarjeta, Vacio } from "../ui";

// HU-002-1: cuentas y tarjetas del fondo común (D23) con su saldo al inicio del piloto. Nunca el número completo.

type Resultado = Promise<{ error: { message: string } | null }>;

const TIPOS: { valor: TipoCuenta; texto: string }[] = [
  { valor: "vista", texto: "Cuenta corriente o vista" },
  { valor: "tarjeta_credito", texto: "Tarjeta de crédito" },
  { valor: "ahorro", texto: "Ahorro" },
  { valor: "billetera", texto: "Efectivo" },
  { valor: "inversion", texto: "Inversión" },
];

export interface PropsCuentas {
  cuentas: Cuenta[];
  inicioPiloto: string;
  crear: (c: NuevaCuenta) => Resultado;
  activar: (id: string, activa: boolean) => Resultado;
  volver?: () => void;
  continuar?: () => void;
}

export function Cuentas({ cuentas, inicioPiloto, crear, activar, volver, continuar }: PropsCuentas) {
  const [abierto, setAbierto] = useState(cuentas.length === 0);
  const [tipo, setTipo] = useState<TipoCuenta>("vista");
  const [nombre, setNombre] = useState("");
  const [institucion, setInstitucion] = useState("");
  const [ultimos4, setUltimos4] = useState("");
  const [saldo, setSaldo] = useState("");
  const [facturacion, setFacturacion] = useState("");
  const [pago, setPago] = useState("");
  const [cupo, setCupo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const tarjeta = tipo === "tarjeta_credito";
  const hayEfectivo = cuentas.some((c) => c.tipo === "billetera");

  async function guardar() {
    setExito(null);
    if (!nombre.trim()) return setError("Escribe un nombre, por ejemplo: Cuenta corriente Santander.");
    if (ultimos4 && !/^\d{4}$/.test(ultimos4)) return setError("Escribe solo los últimos 4 dígitos; nunca el número completo.");
    const dF = Number(facturacion);
    const dP = Number(pago);
    if (tarjeta && (!(dF >= 1 && dF <= 31) || !(dP >= 1 && dP <= 31))) return setError("Indica el día de facturación y el día de pago de la tarjeta (1 a 31).");
    setError(null);
    setOcupado(true);
    const nueva: NuevaCuenta = {
      nombre,
      tipo,
      institucion,
      ultimos4,
      saldoInicial: Math.abs(leerMonto(saldo) ?? 0) * (tarjeta ? 1 : Math.sign(leerMonto(saldo) ?? 0) || 1),
      fechaSaldoInicial: inicioPiloto,
    };
    if (tarjeta) {
      nueva.diaFacturacion = dF;
      nueva.diaPago = dP;
      const c = leerMonto(cupo);
      if (c) nueva.cupo = Math.abs(c);
    }
    const r = await crear(nueva);
    setOcupado(false);
    if (r.error) return setError(r.error.message);
    setExito(`${nombre.trim()} quedó registrada.`);
    setNombre(""); setInstitucion(""); setUltimos4(""); setSaldo(""); setFacturacion(""); setPago(""); setCupo("");
    setAbierto(false);
  }

  return (
    <Pantalla titulo="Cuentas y tarjetas" {...(volver ? { volver } : {})}>
      <Parrafo suave>{`Todas las cuentas registradas son del fondo común (D23). El saldo inicial es el del ${formatoFecha(inicioPiloto)}, inicio del piloto.`}</Parrafo>
      {cuentas.length === 0 ? (
        <Vacio texto="Aún no hay cuentas. Agrega tu cuenta corriente y tus tarjetas de crédito." />
      ) : (
        cuentas.map((c) => (
          <Tarjeta key={c.id}>
            <Fila
              etiqueta={c.nombre}
              detalle={`${TIPOS.find((t) => t.valor === c.tipo)?.texto ?? c.tipo}${c.ultimos4 ? ` ···${c.ultimos4}` : ""}${c.tipo === "tarjeta_credito" ? ` · factura el ${c.diaFacturacion}, paga el ${c.diaPago}` : ""}`}
              valor={c.saldo}
            />
            <Boton texto={c.activa ? "Desactivar" : "Activar"} secundario onPress={() => void activar(c.id, !c.activa)} />
          </Tarjeta>
        ))
      )}
      {!hayEfectivo && cuentas.length > 0 && (
        <Boton
          texto="Agregar Efectivo como billetera (R31)"
          secundario
          onPress={async () => {
            const r = await crear({ nombre: "Efectivo", tipo: "billetera", saldoInicial: 0, fechaSaldoInicial: inicioPiloto });
            setError(r.error?.message ?? null);
          }}
        />
      )}
      {abierto ? (
        <Tarjeta>
          <Subtitulo>Nueva cuenta</Subtitulo>
          <Opciones etiqueta="Tipo" opciones={TIPOS} valor={tipo} onCambio={setTipo} />
          <Campo etiqueta="Nombre" placeholder={tarjeta ? "Visa Santander" : "Cuenta corriente Santander"} value={nombre} onChangeText={setNombre} />
          <Campo etiqueta="Banco o emisor (opcional)" value={institucion} onChangeText={setInstitucion} />
          {tipo !== "billetera" && (
            <Campo etiqueta="Últimos 4 dígitos (opcional)" value={ultimos4} onChangeText={setUltimos4} keyboardType="numeric" inputMode="numeric" maxLength={4} />
          )}
          <Campo
            etiqueta={tarjeta ? "Deuda facturada pendiente al inicio del piloto" : "Saldo al inicio del piloto"}
            ayuda={tarjeta ? "Lo facturado antes del inicio que aún no se pagaba (se guarda como deuda)." : undefined}
            value={saldo}
            onChangeText={setSaldo}
            keyboardType="numeric"
            inputMode="numeric"
          />
          {tarjeta && (
            <View style={{ flexDirection: "row", gap: 8 }}>
              <View style={{ flex: 1 }}><Campo etiqueta="Día de facturación" value={facturacion} onChangeText={setFacturacion} keyboardType="numeric" inputMode="numeric" /></View>
              <View style={{ flex: 1 }}><Campo etiqueta="Día de pago" value={pago} onChangeText={setPago} keyboardType="numeric" inputMode="numeric" /></View>
            </View>
          )}
          {tarjeta && <Campo etiqueta="Cupo (opcional)" value={cupo} onChangeText={setCupo} keyboardType="numeric" inputMode="numeric" />}
          <Aviso texto={error} tipo="error" />
          <Boton texto="Guardar cuenta" onPress={guardar} ocupado={ocupado} />
        </Tarjeta>
      ) : (
        <Boton texto="Agregar otra cuenta o tarjeta" secundario onPress={() => setAbierto(true)} />
      )}
      <Aviso texto={exito} tipo="exito" />
      {continuar && cuentas.length > 0 && <Boton texto="Continuar" onPress={continuar} />}
    </Pantalla>
  );
}
