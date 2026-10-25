import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Portada } from "../src/pantallas/Portada";

describe("Portada vacía con siguiente paso (spec 001, interfaz)", () => {
  it("muestra el hogar y el siguiente paso: cargar tus cuentas (spec 002)", () => {
    render(<Portada nombreHogar="Durán Damann" firmaPendiente={null} />);
    expect(screen.getByText("Durán Damann")).toBeTruthy();
    expect(screen.getByText("Siguiente paso: cargar tus cuentas")).toBeTruthy();
  });

  it("si el Acuerdo se activó con urgencia, informa que falta la firma del CAD", () => {
    render(<Portada nombreHogar="Durán Damann" firmaPendiente={{ nombre: "Ana", vigente: true }} />);
    expect(screen.getByText("El Acuerdo v1 está vigente; falta la firma de Ana.")).toBeTruthy();
  });

  it("si el Acuerdo espera la firma para regir, lo informa", () => {
    render(<Portada nombreHogar="Durán Damann" firmaPendiente={{ nombre: "Ana", vigente: false }} />);
    expect(screen.getByText("El Acuerdo v1 queda vigente cuando Ana lo firme.")).toBeTruthy();
  });

  it("sin firma pendiente no muestra aviso", () => {
    render(<Portada nombreHogar="Durán Damann" firmaPendiente={null} />);
    expect(screen.queryByText(/firm/)).toBeNull();
  });
});
