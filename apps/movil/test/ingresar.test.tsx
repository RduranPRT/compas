import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Ingresar } from "../src/pantallas/Ingresar";

function preparar(over: Partial<Parameters<typeof Ingresar>[0]> = {}) {
  const enviarCodigo = vi.fn(async () => ({ error: null }));
  const verificarCodigo = vi.fn(async () => ({ error: null }));
  render(<Ingresar enviarCodigo={enviarCodigo} verificarCodigo={verificarCodigo} {...over} />);
  return { enviarCodigo, verificarCodigo };
}

describe("Ingreso con correo y código de 6 dígitos (HU-001-3)", () => {
  it("envía el código al correo y luego lo verifica", async () => {
    const { enviarCodigo, verificarCodigo } = preparar();
    fireEvent.change(screen.getByLabelText("Correo"), { target: { value: " Rodrigo@Ejemplo.cl " } });
    fireEvent.click(screen.getByRole("button", { name: "Enviar código" }));
    await waitFor(() => expect(enviarCodigo).toHaveBeenCalledWith("rodrigo@ejemplo.cl"));

    const codigo = await screen.findByLabelText("Código de 6 dígitos");
    expect(screen.getByText(/rodrigo@ejemplo.cl/)).toBeTruthy();
    fireEvent.change(codigo, { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: "Ingresar" }));
    await waitFor(() => expect(verificarCodigo).toHaveBeenCalledWith("rodrigo@ejemplo.cl", "123456"));
  });

  it("no envía si el correo no es válido", async () => {
    const { enviarCodigo } = preparar();
    fireEvent.change(screen.getByLabelText("Correo"), { target: { value: "rodrigo" } });
    fireEvent.click(screen.getByRole("button", { name: "Enviar código" }));
    expect(await screen.findByText("Revisa el correo: debe tener la forma nombre@dominio.cl.")).toBeTruthy();
    expect(enviarCodigo).not.toHaveBeenCalled();
  });

  it("exige un código de exactamente 6 dígitos", async () => {
    const { verificarCodigo } = preparar();
    fireEvent.change(screen.getByLabelText("Correo"), { target: { value: "a@b.cl" } });
    fireEvent.click(screen.getByRole("button", { name: "Enviar código" }));
    const codigo = await screen.findByLabelText("Código de 6 dígitos");
    fireEvent.change(codigo, { target: { value: "12a4" } });
    fireEvent.click(screen.getByRole("button", { name: "Ingresar" }));
    expect(await screen.findByText("El código tiene 6 dígitos; revisa el último correo que te enviamos.")).toBeTruthy();
    expect(verificarCodigo).not.toHaveBeenCalled();
  });

  it("si el código no sirve, lo dice sin culpa y ofrece pedir otro (R16)", async () => {
    const verificarCodigo = vi.fn(async () => ({ error: { message: "Token has expired or is invalid" } }));
    preparar({ verificarCodigo });
    fireEvent.change(screen.getByLabelText("Correo"), { target: { value: "a@b.cl" } });
    fireEvent.click(screen.getByRole("button", { name: "Enviar código" }));
    fireEvent.change(await screen.findByLabelText("Código de 6 dígitos"), { target: { value: "000000" } });
    fireEvent.click(screen.getByRole("button", { name: "Ingresar" }));
    expect(
      await screen.findByText("Ese código ya no sirve: vence o se reemplaza al pedir otro. Puedes pedir uno nuevo."),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "Pedir otro código" })).toBeTruthy();
  });

  it("si falla el envío, informa y permite reintentar", async () => {
    const enviarCodigo = vi.fn(async () => ({ error: { message: "network" } }));
    preparar({ enviarCodigo });
    fireEvent.change(screen.getByLabelText("Correo"), { target: { value: "a@b.cl" } });
    fireEvent.click(screen.getByRole("button", { name: "Enviar código" }));
    expect(await screen.findByText("No pudimos enviar el código. Revisa tu conexión e inténtalo de nuevo.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Enviar código" })).toBeTruthy();
  });
});
