import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Ingresar } from "../src/pantallas/Ingresar";

type Ingreso = (correo: string, clave: string) => Promise<{ error: { message: string } | null }>;

function preparar(ingresar = vi.fn<Ingreso>(async () => ({ error: null }))) {
  render(<Ingresar ingresar={ingresar} />);
  return ingresar;
}

function escribir(correo: string, clave: string) {
  fireEvent.change(screen.getByLabelText("Correo"), { target: { value: correo } });
  fireEvent.change(screen.getByLabelText("Contraseña"), { target: { value: clave } });
  fireEvent.click(screen.getByRole("button", { name: "Ingresar" }));
}

describe("Ingreso con correo y contraseña (HU-001-3, D28)", () => {
  it("ingresa con el correo normalizado y la contraseña tal cual", async () => {
    const ingresar = preparar();
    escribir(" Rodrigo@Ejemplo.cl ", " Clave Con Espacios ");
    await waitFor(() => expect(ingresar).toHaveBeenCalledWith("rodrigo@ejemplo.cl", " Clave Con Espacios "));
  });

  it("la contraseña no se muestra en pantalla", () => {
    preparar();
    expect(screen.getByLabelText("Contraseña").getAttribute("type")).toBe("password");
  });

  it("no envía si el correo no es válido", async () => {
    const ingresar = preparar();
    escribir("rodrigo", "una-clave");
    expect(await screen.findByText("Revisa el correo: debe tener la forma nombre@dominio.cl.")).toBeTruthy();
    expect(ingresar).not.toHaveBeenCalled();
  });

  it("pide la contraseña", async () => {
    const ingresar = preparar();
    escribir("a@b.cl", "");
    expect(await screen.findByText("Escribe tu contraseña.")).toBeTruthy();
    expect(ingresar).not.toHaveBeenCalled();
  });

  it("si no coinciden, lo dice sin culpa y sugiere pedir el cambio al organizador (R16)", async () => {
    preparar(vi.fn(async () => ({ error: { message: "Invalid login credentials" } })));
    escribir("a@b.cl", "mala");
    expect(
      await screen.findByText(
        "El correo o la contraseña no coinciden. Si no la recuerdas, pídele al organizador del hogar que te asigne una nueva.",
      ),
    ).toBeTruthy();
  });

  it("no ofrece crear cuenta: el registro es solo por el organizador", () => {
    preparar();
    expect(screen.queryByRole("button", { name: /crear cuenta|registr/i })).toBeNull();
    expect(screen.getByText(/La cuenta te la crea el organizador del hogar/)).toBeTruthy();
  });
});
