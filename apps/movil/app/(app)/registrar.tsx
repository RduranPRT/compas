import { hoyIso, interpretarFrase, r18_horasVida } from "@compas/dominio";
import { router } from "expo-router";
import { useEffect } from "react";
import { categorias, cuentas, ingresosEsperados } from "../../src/datos/configuracion";
import { mensajeError, nuevoId } from "../../src/datos/cliente";
import { registrarGasto, sobresDeGasto, sobresDelMes, type Gasto } from "../../src/datos/finanzas";
import { llamarIA } from "../../src/datos/ia";
import { encolar, recordarMedio, sincronizar, ultimoMedio } from "../../src/lib/cola";
import { useHogar } from "../../src/lib/hogar";
import { supabase } from "../../src/lib/supabase";
import { useDatos } from "../../src/lib/useDatos";
import { Registrar } from "../../src/pantallas/Registrar";
import { Cargando, ErrorCarga } from "../../src/ui";

const enviar = (g: Gasto) => registrarGasto(supabase, g);

export default function RutaRegistrar() {
  const { parametros, yo, personas } = useHogar();
  const hoy = hoyIso();
  const { datos, error, recargar } = useDatos(async () => {
    const [sobres, ctas, cats, esperados] = await Promise.all([sobresDelMes(supabase, hoy), cuentas(supabase), categorias(supabase), ingresosEsperados(supabase)]);
    return { sobres: sobresDeGasto(sobres), ctas, cats, esperados };
  }, [hoy]);

  // D11: al abrir, se reenvía lo capturado sin conexión
  useEffect(() => {
    void sincronizar(enviar);
  }, []);

  if (error) return <ErrorCarga texto={error} reintentar={recargar} />;
  if (!datos) return <Cargando />;
  const codigo = new Map(datos.cats.map((c) => [c.id, c.codigo]));
  const yoPersona = personas.find((p) => p.id === yo?.id);
  const miBase = datos.esperados.filter((i) => i.integranteId === yo?.id && i.esBase).reduce((s, i) => s + i.monto, 0);

  return (
    <Registrar
      hoy={hoy}
      sobres={datos.sobres}
      cuentas={datos.ctas.map((c) => ({ id: c.id, nombre: c.nombre, tipo: c.tipo }))}
      medioPorDefecto={ultimoMedio()}
      tratamientoPorDefecto={parametros.tratamiento_cuotas_default}
      horasDeVida={(monto) => (yoPersona?.horasMes ? r18_horasVida(monto, miBase, yoPersona.horasMes) : null)}
      interpretar={async (frase) => {
        const sobres = datos.sobres.map((s) => ({ id: s.id, nombre: s.nombre, codigo: s.categoriaId ? codigo.get(s.categoriaId) ?? null : null }));
        const local = interpretarFrase(frase, sobres, datos.ctas.map((c) => ({ id: c.id, nombre: c.nombre, tipo: c.tipo })), hoy);
        // Sin IA disponible, se usa lo que entendieron las reglas (D31)
        const ia = await llamarIA<{ monto: number | null; sobre_id: string | null; cuenta_id: string | null; fecha: string | null; n_cuotas: number; comercio: string | null; confianza: number }>(
          supabase, "ia-chat", {
            frase, hoy,
            sobres: datos.sobres.filter((s) => !["futuro", "emergencia", "cuota"].includes(s.tipo)).map((s) => ({ id: s.id, nombre: s.nombre })),
            cuentas: datos.ctas.map((c) => ({ id: c.id, nombre: c.nombre, tipo: c.tipo })),
          });
        if (!ia.ok) return { ...local, conIA: false };
        return {
          monto: ia.datos.monto ?? local.monto,
          sobreId: ia.datos.sobre_id ?? local.sobreId,
          cuentaId: ia.datos.cuenta_id ?? local.cuentaId,
          fecha: ia.datos.fecha ?? local.fecha,
          comercio: ia.datos.comercio ?? local.comercio,
          nCuotas: ia.datos.n_cuotas || local.nCuotas,
          confianza: ia.datos.confianza,
          conIA: true,
        };
      }}
      guardar={async (g) => {
        const conId = { ...g, clienteOp: nuevoId() };
        recordarMedio(g.cuentaId);
        const r = await enviar(conId);
        if (r.error && /fetch|network/i.test(r.error.message)) {
          encolar(conId);
          return { error: null, data: null, enCola: true };
        }
        if (!r.error) void recargar();
        return { error: r.error ? { message: mensajeError(r.error) ?? r.error.message } : null, data: r.data };
      }}
      volver={() => (router.canGoBack() ? router.back() : router.replace("/"))}
    />
  );
}
