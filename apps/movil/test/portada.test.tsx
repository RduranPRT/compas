import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Portada } from "../src/pantallas/Portada";

describe("Portada vacía con siguiente paso (spec 001, interfaz)", () => {
  it("muestra el hogar y el siguiente paso: cargar tus cuentas (spec 002)", () => {
    render(<Portada nombreHogar="Durán Damann" firmaPendienteDe={null} />);
    expect(screen.getByText("Durán Damann")).toBeTruthy();
    expect(screen.getByText("Siguiente paso: cargar tus cuentas")).toBeTruthy();
  });

  it("informa si la firma del CAD del Acuerdo está pendiente", () => {
    render(<Portada nombreHogar="Durán Damann" firmaPendienteDe="Ana" />);
    expect(screen.getByText("El Acuerdo v1 está vigente; falta la firma de Ana.")).toBeTruthy();
  });

  it("sin firma pendiente no muestra el aviso", () => {
    render(<Portada nombreHogar="Durán Damann" firmaPendienteDe={null} />);
    expect(screen.queryByText(/falta la firma/)).toBeNull();
  });
});
