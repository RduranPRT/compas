import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { Tabla } from "@compas/dominio";
import { describe, expect, it, vi } from "vitest";
import type { Sobre } from "../src/datos/finanzas";
import { encolar, leerCola, sincronizar, type Almacen } from "../src/lib/cola";
import { Bandeja } from "../src/pantallas/Bandeja";
import { CargarCartola } from "../src/pantallas/CargarCartola";
import { CierreSemanal } from "../src/pantallas/CierreSemanal";
import { Plan } from "../src/pantallas/Plan";
import { Registrar } from "../src/pantallas/Registrar";
import { SobreDetalle } from "../src/pantallas/SobreDetalle";
import { Sobres } from "../src/pantallas/Sobres";
import { cicloDe } from "../src/pantallas/TarjetaDetalle";

function sobre(over: Partial<Sobre>): Sobre {
  return {
    id: "s", periodoId: "p", mes: "2026-11-01", tipo: "variable", nombre: "Sobre", bloque: "VIDA", categoriaId: "c",
    integranteId: null, fondoId: null, cuentaId: null, cuatroParedes: false, cerrado: false, intencion: null,
    disponible: 0, gastado: 0, saldo: 0, ...over,
  };
}

const alim = sobre({ id: "alim", nombre: "Alimentación", bloque: "ESENCIALES", categoriaId: "c-alim", gastado: 50000, disponible: 400000, saldo: 350000 });
const ocio = sobre({ id: "ocio", nombre: "Ocio y salidas", categoriaId: "c-ocio", disponible: 200000, saldo: -8000, gastado: 208000 });
const futuro = sobre({ id: "fut", nombre: "Ahorro e inversión", tipo: "futuro", bloque: "FUTURO", disponible: 300000, saldo: 300000 });
const cuentas = [{ id: "cc", nombre: "Cuenta corriente", tipo: "vista" }, { id: "visa", nombre: "Visa", tipo: "tarjeta_credito" }];

describe("Captura rápida (HU-005-1, HU-005-2)", () => {
  it("monto y sobre en dos toques: guarda con la fecha de hoy y el último medio usado", async () => {
    const guardar = vi.fn(async () => ({ error: null, data: { movimiento_id: "m", estado: "confirmado" } }));
    render(<Registrar hoy="2026-11-03" sobres={[alim, ocio]} cuentas={cuentas} medioPorDefecto="visa" tratamientoPorDefecto="por_cuota" guardar={guardar} interpretar={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Monto"), { target: { value: "12.990" } });
    fireEvent.click(screen.getByRole("radio", { name: "Alimentación" }));
    fireEvent.click(screen.getByRole("button", { name: "Guardar gasto" }));
    await waitFor(() => expect(guardar).toHaveBeenCalledWith(expect.objectContaining({ monto: 12990, sobreId: "alim", cuentaId: "visa", fecha: "2026-11-03", nCuotas: 1 })));
    expect(await screen.findByText(/Listo: \$12\.990 en Alimentación/)).toBeTruthy();
  });

  it("con tarjeta y cuotas permite elegir el tratamiento (D08)", async () => {
    const guardar = vi.fn(async () => ({ error: null, data: { movimiento_id: "m", estado: "confirmado" } }));
    render(<Registrar hoy="2026-11-03" sobres={[alim]} cuentas={cuentas} medioPorDefecto="visa" tratamientoPorDefecto="por_cuota" guardar={guardar} interpretar={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Monto"), { target: { value: "300000" } });
    fireEvent.click(screen.getByRole("radio", { name: "Alimentación" }));
    fireEvent.change(screen.getByLabelText("Cuotas"), { target: { value: "3" } });
    fireEvent.click(screen.getByRole("radio", { name: "Todo este mes" }));
    fireEvent.click(screen.getByRole("button", { name: "Guardar gasto" }));
    await waitFor(() => expect(guardar).toHaveBeenCalledWith(expect.objectContaining({ nCuotas: 3, tratamiento: "total" })));
  });

  it("una frase se interpreta y queda para confirmar antes de guardar", async () => {
    const interpretar = vi.fn(async () => ({ monto: 12000, sobreId: "alim", cuentaId: "cc", fecha: "2026-11-03", comercio: "feria", nCuotas: 1, confianza: 0.85, conIA: false }));
    const guardar = vi.fn();
    render(<Registrar hoy="2026-11-03" sobres={[alim]} cuentas={cuentas} medioPorDefecto={null} tratamientoPorDefecto="por_cuota" guardar={guardar} interpretar={interpretar} />);
    fireEvent.click(screen.getByRole("radio", { name: "Escribir una frase" }));
    fireEvent.change(screen.getByLabelText("¿Qué gastaste?"), { target: { value: "12 lucas en la feria con débito" } });
    fireEvent.click(screen.getByRole("button", { name: "Interpretar" }));
    expect(await screen.findByText("Revisa la propuesta y confirma.")).toBeTruthy();
    expect((screen.getByLabelText("Monto") as HTMLInputElement).value).toBe("12000");
    expect(guardar).not.toHaveBeenCalled();
  });
});

describe("Cola sin conexión (D11)", () => {
  it("guarda con su identificador y al reconectar envía cada captura una sola vez", async () => {
    const datos = new Map<string, string>();
    const a: Almacen = { getItem: (k) => datos.get(k) ?? null, setItem: (k, v) => void datos.set(k, v) };
    encolar({ clienteOp: "op1", cuentaId: "cc", sobreId: "alim", monto: 1000, fecha: "2026-11-03" }, a);
    encolar({ clienteOp: "op2", cuentaId: "cc", sobreId: "alim", monto: 2000, fecha: "2026-11-03" }, a);
    let red = false;
    const enviar = vi.fn(async () => (red ? { error: null } : { error: { message: "Failed to fetch" } }));
    expect(await sincronizar(enviar, a)).toEqual({ enviados: 0, pendientes: 2 });
    red = true;
    expect(await sincronizar(enviar, a)).toEqual({ enviados: 2, pendientes: 0 });
    expect(leerCola(a)).toEqual([]);
  });
});

describe("Bandeja del CAD (HU-005-3, R35)", () => {
  it("muestra el posible duplicado y lo resuelve", async () => {
    const m = { id: "a", fecha: "2026-11-03", tipo: "gasto", estado: "confirmado", origen: "manual", monto: 12990, comercio: "Feria", nota: null, cuentaId: "visa", cuenta: "Visa", tipoCuenta: "tarjeta_credito", sobreId: "alim", sobre: "Alimentación", intencion: null, confianza: null, nCuotas: null };
    const resolver = vi.fn(async () => ({ error: null }));
    render(<Bandeja movimientos={[]} duplicados={[{ id: "d", a: m, b: { ...m, id: "b", fecha: "2026-11-04", estado: "por_confirmar" } }]} sobres={[alim]} confirmar={vi.fn()} descartar={vi.fn()} resolverDuplicado={resolver} recargar={vi.fn()} />);
    expect(screen.getByText("Posibles duplicados (R35)")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Es el mismo" }));
    await waitFor(() => expect(resolver).toHaveBeenCalledWith("d", true));
  });

  it("un pendiente con categoría sugerida se confirma con su sobre", async () => {
    const m = { id: "m1", fecha: "2026-10-04", tipo: "gasto", estado: "por_confirmar", origen: "cartola", monto: 23000, comercio: "JUMBO", nota: null, cuentaId: "cc", cuenta: "Cuenta corriente", tipoCuenta: "vista", sobreId: null, sobre: null, intencion: null, confianza: 0.85, nCuotas: null, categoriaSugeridaId: "c-alim" };
    const confirmar = vi.fn(async () => ({ error: null }));
    render(<Bandeja movimientos={[m]} duplicados={[]} sobres={[alim, ocio]} confirmar={confirmar} descartar={vi.fn()} resolverDuplicado={vi.fn()} recargar={vi.fn()} />);
    expect(screen.getByText("Sugerido (85 %): Alimentación")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));
    await waitFor(() => expect(confirmar).toHaveBeenCalledWith("m1", "alim"));
  });
});

describe("Sobres y N1 (spec 009)", () => {
  it("en línea base muestra lo gastado sin pedir cubrir; con plan, el negativo ofrece cubrirse (R10)", () => {
    const { unmount } = render(<Sobres mes="2026-10-01" sobres={[sobre({ id: "por", tipo: "por_asignar", nombre: "Por asignar", bloque: null }), ocio]} cambiarMes={vi.fn()} abrir={vi.fn()} registrar={vi.fn()} lineaBase />);
    expect(screen.queryByText(/toca para cubrirlo/)).toBeNull();
    expect(screen.getByText("Gastado $208.000")).toBeTruthy();
    unmount();
    render(<Sobres mes="2026-12-01" sobres={[sobre({ id: "por", tipo: "por_asignar", nombre: "Por asignar", bloque: null }), ocio]} cambiarMes={vi.fn()} abrir={vi.fn()} registrar={vi.fn()} />);
    expect(screen.getByText("Quedó negativo: toca para cubrirlo (R10)")).toBeTruthy();
  });

  it("cubrir desde Vida se autoaprueba bajo el umbral; desde Futuro avisa la doble firma (R38, R37)", async () => {
    const vida = sobre({ id: "vest", nombre: "Vestuario", disponible: 200000, saldo: 200000 });
    const reasignar = vi.fn(async () => ({ error: null, estado: "aplicada" as const }));
    render(<SobreDetalle sobre={ocio} otros={[ocio, vida, futuro]} movimientos={[]} esAdmin umbralPct={5} reasignar={reasignar} volver={vi.fn()} />);
    expect(screen.getByText(/Hasta el 5 % del sobre de origen se aplica de inmediato/)).toBeTruthy();
    fireEvent.click(screen.getByRole("radio", { name: /Ahorro e inversión/ }));
    expect(screen.getByText(/requiere la firma de ambos administradores \(R37\)/)).toBeTruthy();
    fireEvent.click(screen.getByRole("radio", { name: /Vestuario/ }));
    fireEvent.click(screen.getByRole("button", { name: "Mover dinero" }));
    await waitFor(() => expect(reasignar).toHaveBeenCalledWith("vest", "ocio", 8000, ""));
    expect(await screen.findByText(/Listo: se movieron \$8\.000/)).toBeTruthy();
  });
});

describe("Plan base cero (spec 006)", () => {
  it("muestra Por asignar en cero, el semáforo y permite enviar a aprobación", async () => {
    const enviar = vi.fn(async () => ({ error: null }));
    render(
      <Plan
        mes="2026-12-01"
        mesPrimerPlan="2026-12-01"
        cargando={false}
        plan={{ id: "p", version: 1, estado: "borrador", ingreso: 1000, lineas: [{ sobreId: "alim", monto: 600, regla: "R04", explicacion: "Promedio" }, { sobreId: "fut", monto: 400, regla: "R07", explicacion: "Mínimo" }] }}
        sobres={[alim, futuro]}
        semaforo={() => [{ bloque: "ESENCIALES", monto: 600, pct: 60, limitePct: 50, color: "rojo", regla: "R06", mensaje: "Esenciales usa el 60 % del ingreso; el método sugiere hasta 50 % (R06)." }]}
        esAdmin
        cambiarMes={vi.fn()}
        generar={vi.fn()}
        guardar={vi.fn(async () => ({ error: null }))}
        enviar={enviar}
      />,
    );
    expect(screen.getByText("Cada peso tiene una tarea (P1)")).toBeTruthy();
    expect(screen.getByText(/el método sugiere hasta 50 % \(R06\)/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Enviar a aprobación" }));
    await waitFor(() => expect(enviar).toHaveBeenCalled());
  });
});

describe("Cartolas (spec 003, D30)", () => {
  it("un PDF recibe el mensaje para descargar en Excel o CSV", async () => {
    render(
      <CargarCartola
        cuentas={[{ id: "cc", nombre: "Cuenta corriente", tipo: "vista" }]}
        inicioPiloto="2026-10-01"
        elegirArchivo={async () => ({ nombre: "cartola.pdf", formato: "pdf", sha256: "x", tabla: [] })}
        leerConIA={vi.fn()}
        importar={vi.fn()}
        revisar={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Elegir archivo Excel o CSV" }));
    expect(await screen.findByText("Por ahora Compás lee cartolas en Excel o CSV. Descárgala en ese formato desde tu banco.")).toBeTruthy();
  });

  it("propone las columnas, resume lo anterior y lo posterior al inicio del piloto e importa", async () => {
    const tabla: Tabla = [["Fecha", "Descripción", "Cargos", "Abonos"], ["15/09/2026", "JUMBO", "50.000", ""], ["03/10/2026", "JUMBO", "23.000", ""]];
    const importar = vi.fn(async () => ({ error: null, resultado: { importacionId: "i", historicos: 1, movimientos: 1, duplicados: 0, transferencias: 0, calzados: 0 } }));
    render(
      <CargarCartola
        cuentas={[{ id: "cc", nombre: "Cuenta corriente", tipo: "vista" }]}
        inicioPiloto="2026-10-01"
        elegirArchivo={async () => ({ nombre: "c.xlsx", formato: "xlsx", sha256: "x", tabla })}
        leerConIA={vi.fn()}
        importar={importar}
        revisar={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Elegir archivo Excel o CSV" }));
    expect(await screen.findByText("Antes del 01-10-2026 (solo perfil, R41)")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Importar 2 movimientos" }));
    await waitFor(() => expect(importar).toHaveBeenCalledWith(expect.anything(), expect.anything(), [
      { fecha: "2026-09-15", monto: -50000, glosa: "JUMBO" },
      { fecha: "2026-10-03", monto: -23000, glosa: "JUMBO" },
    ], "mapeo_columnas"));
    expect(await screen.findByText("Cartola importada")).toBeTruthy();
  });
});

describe("Cierre semanal (R34)", () => {
  it("una diferencia exige motivo antes de cerrar", async () => {
    const cerrar = vi.fn(async () => ({ error: null, conciliados: 3 }));
    render(<CierreSemanal hoy="2026-11-08" ultimoCierre={null} cuentas={[{ id: "cc", nombre: "Cuenta corriente", tipo: "vista", saldo: 330000 }]} pendientes={0} irBandeja={vi.fn()} cerrar={cerrar} />);
    fireEvent.change(screen.getByLabelText("Saldo real de Cuenta corriente"), { target: { value: "327.500" } });
    fireEvent.click(screen.getByRole("button", { name: "Cerrar la semana" }));
    expect(await screen.findByText("En Cuenta corriente hay diferencia; escribe el motivo (R34).")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Motivo de la diferencia en Cuenta corriente"), { target: { value: "Comisión" } });
    fireEvent.click(screen.getByRole("button", { name: "Cerrar la semana" }));
    await waitFor(() => expect(cerrar).toHaveBeenCalledWith("2026-11-08", [{ cuentaId: "cc", saldoReal: 327500, motivo: "Comisión" }]));
  });
});

describe("Ciclo de la tarjeta (spec 008)", () => {
  it("con facturación el 25 y pago el 5, el ciclo va del 26 al 25 y vence el 5 del mes siguiente", () => {
    expect(cicloDe("2026-11-10", 25, 5)).toEqual({ desde: "2026-10-26", hasta: "2026-11-25", vence: "2026-12-05" });
    expect(cicloDe("2026-11-27", 25, 5)).toEqual({ desde: "2026-11-26", hasta: "2026-12-25", vence: "2027-01-05" });
  });
});
