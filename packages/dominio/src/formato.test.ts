import { describe, expect, it } from "vitest";
import { formatoFecha, formatoPesos } from "./formato";

describe("Formato de montos (CLAUDE.md: $12.345)", () => {
  it.each([
    [0, "$0"],
    [1000, "$1.000"],
    [12345, "$12.345"],
    [1234567, "$1.234.567"],
    [-5000, "-$5.000"],
  ])("%i → %s", (monto, texto) => {
    expect(formatoPesos(monto)).toBe(texto);
  });

  it("rechaza montos no enteros (I3)", () => {
    expect(() => formatoPesos(10.5)).toThrow();
  });
});

describe("Formato de fecha", () => {
  it("AAAA-MM-DD → DD-MM-AAAA", () => {
    expect(formatoFecha("2026-10-01")).toBe("01-10-2026");
  });
});
