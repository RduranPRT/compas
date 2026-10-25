import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { PARAMETROS_POR_DEFECTO } from "@compas/dominio";
import { describe, expect, it, vi } from "vitest";
import { Acuerdo, type PropsAcuerdo } from "../src/pantallas/Acuerdo";

function preparar(over: Partial<PropsAcuerdo> = {}) {
  const props: PropsAcuerdo = {
    modo: "proponer",
    otro: { nombre: "Ana", tieneCuenta: true },
    proponer: vi.fn(async () => ({ error: null })),
    firmar: vi.fn(async () => ({ error: null })),
    continuar: vi.fn(),
    ...over,
  };
  render(<Acuerdo {...props} />);
  return props;
}

describe("Acuerdo v1: lista legible de parámetros (spec 001, interfaz)", () => {
  it("muestra cada parámetro con su valor y su regla", () => {
    preparar();
    expect(screen.getAllByTestId("parametro")).toHaveLength(Object.keys(PARAMETROS_POR_DEFECTO).length);
    expect(screen.getByText("Plazo para responder")).toBeTruthy();
    expect(screen.getByText("48 h · R39")).toBeTruthy();
    expect(screen.getByText("Diferencia aceptada al conciliar")).toBeTruthy();
    expect(screen.getByText("$1.000 · R34")).toBeTruthy();
    expect(screen.getByText("Igual para cada adulto · D25")).toBeTruthy();
    expect(screen.getByText(/Vigente desde el 01-10-2026/)).toBeTruthy();
  });
});

describe("Firmar el Acuerdo v1 (HU-001-4, E1)", () => {
  it("el ORG lo propone y pide la firma del CAD", async () => {
    const p = preparar();
    fireEvent.click(screen.getByRole("button", { name: "Pedir la firma de Ana" }));
    await waitFor(() => expect(p.proponer).toHaveBeenCalledWith({ urgente: false }));
    expect(await screen.findByText("Listo. El Acuerdo v1 queda vigente cuando Ana lo firme.")).toBeTruthy();
  });

  it("si el CAD aún no tiene cuenta, el ORG puede activarlo ahora y la firma queda pendiente", async () => {
    const p = preparar({ otro: { nombre: "Ana", tieneCuenta: false } });
    expect(screen.getByText("Ana aún no ingresa a Compás: puedes activar el Acuerdo ahora y su firma quedará pendiente.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Activar ahora" }));
    await waitFor(() => expect(p.proponer).toHaveBeenCalledWith({ urgente: true }));
    await waitFor(() => expect(p.continuar).toHaveBeenCalled());
  });

  it("el CAD firma un Acuerdo propuesto", async () => {
    const p = preparar({ modo: "firmar" });
    fireEvent.click(screen.getByRole("button", { name: "Firmar el Acuerdo v1" }));
    await waitFor(() => expect(p.firmar).toHaveBeenCalled());
    await waitFor(() => expect(p.continuar).toHaveBeenCalled());
  });

  it("si falla, lo informa sin culpa y permite reintentar (R16)", async () => {
    preparar({ proponer: vi.fn(async () => ({ error: { message: "x" } })) });
    fireEvent.click(screen.getByRole("button", { name: "Pedir la firma de Ana" }));
    expect(await screen.findByText("No pudimos guardar el Acuerdo. Revisa tu conexión e inténtalo de nuevo.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Pedir la firma de Ana" })).toBeTruthy();
  });
});
