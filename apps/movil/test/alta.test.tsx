import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AltaHogar } from "../src/pantallas/AltaHogar";
import { AltaIntegrantes, type PropsAltaIntegrantes } from "../src/pantallas/AltaIntegrantes";

const ok = async () => ({ error: null });

describe("Asistente de alta, paso 1: hogar (HU-001-1)", () => {
  it("crea el hogar con su nombre y el del organizador", async () => {
    const crear = vi.fn(ok);
    const continuar = vi.fn();
    render(<AltaHogar crear={crear} continuar={continuar} />);
    fireEvent.change(screen.getByLabelText("Nombre del hogar"), { target: { value: " Durán Damann " } });
    fireEvent.change(screen.getByLabelText("Tu nombre"), { target: { value: "Rodrigo" } });
    fireEvent.click(screen.getByRole("button", { name: "Crear hogar" }));
    await waitFor(() => expect(crear).toHaveBeenCalledWith("Durán Damann", "Rodrigo"));
    await waitFor(() => expect(continuar).toHaveBeenCalled());
  });

  it("pide ambos nombres", async () => {
    const crear = vi.fn(ok);
    render(<AltaHogar crear={crear} continuar={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Crear hogar" }));
    expect(await screen.findByText("Escribe el nombre del hogar y el tuyo.")).toBeTruthy();
    expect(crear).not.toHaveBeenCalled();
  });
});

function integrantes(over: Partial<PropsAltaIntegrantes> = {}) {
  const props: PropsAltaIntegrantes = {
    invitar: vi.fn(ok),
    registrarHijos: vi.fn(ok),
    continuar: vi.fn(),
    ...over,
  };
  render(<AltaIntegrantes {...props} />);
  return props;
}

describe("Asistente de alta, paso 2: integrantes (HU-001-1, HU-001-2, D26)", () => {
  it("invita a la pareja como co-administradora y registra a los hijos con el consentimiento datos_menor", async () => {
    const p = integrantes();
    fireEvent.change(screen.getByLabelText("Nombre de tu pareja"), { target: { value: "Ana" } });
    fireEvent.change(screen.getByLabelText("Correo de tu pareja"), { target: { value: "ana@ejemplo.cl" } });
    fireEvent.click(screen.getByRole("button", { name: "Agregar un hijo o hija" }));
    fireEvent.click(screen.getByRole("button", { name: "Agregar un hijo o hija" }));
    expect(screen.getByText("¿Cuántos hijos tienen? 2")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Nombre o apodo del hijo 1"), { target: { value: "Hijo 1" } });
    fireEvent.change(screen.getByLabelText("Nombre o apodo del hijo 2"), { target: { value: "Hijo 2" } });
    expect(screen.getByText(/autorizas registrar a tu hijo o hija/)).toBeTruthy();
    fireEvent.click(screen.getByRole("checkbox", { name: "Autorizo registrar a mis hijos" }));
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    await waitFor(() => expect(p.invitar).toHaveBeenCalledWith("ana@ejemplo.cl", "Ana"));
    await waitFor(() => expect(p.registrarHijos).toHaveBeenCalledWith(["Hijo 1", "Hijo 2"], "v1"));
    await waitFor(() => expect(p.continuar).toHaveBeenCalled());
  });

  it("sin el consentimiento no registra a los hijos (R25)", async () => {
    const p = integrantes();
    fireEvent.click(screen.getByRole("button", { name: "Agregar un hijo o hija" }));
    fireEvent.change(screen.getByLabelText("Nombre o apodo del hijo 1"), { target: { value: "Hijo 1" } });
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    expect(await screen.findByText("Para registrar a tus hijos necesitamos tu autorización.")).toBeTruthy();
    expect(p.registrarHijos).not.toHaveBeenCalled();
  });

  it("se puede quitar un hijo y seguir sin pareja ni hijos", async () => {
    const p = integrantes();
    fireEvent.click(screen.getByRole("button", { name: "Agregar un hijo o hija" }));
    fireEvent.click(screen.getByRole("button", { name: "Quitar el último" }));
    expect(screen.getByText("¿Cuántos hijos tienen? 0")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    await waitFor(() => expect(p.continuar).toHaveBeenCalled());
    expect(p.invitar).not.toHaveBeenCalled();
    expect(p.registrarHijos).not.toHaveBeenCalled();
  });

  it("pide el correo de la pareja si escribió su nombre", async () => {
    integrantes();
    fireEvent.change(screen.getByLabelText("Nombre de tu pareja"), { target: { value: "Ana" } });
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    expect(await screen.findByText("Revisa el correo de tu pareja: debe tener la forma nombre@dominio.cl.")).toBeTruthy();
  });

  it("cada hijo necesita nombre o apodo", async () => {
    integrantes();
    fireEvent.click(screen.getByRole("button", { name: "Agregar un hijo o hija" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Autorizo registrar a mis hijos" }));
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    expect(await screen.findByText("Escribe el nombre o apodo de cada hijo.")).toBeTruthy();
  });
});
