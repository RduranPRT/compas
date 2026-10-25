import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TEXTO_CONSENTIMIENTO, VERSION_CONSENTIMIENTO } from "../src/legal/consentimiento";
import { Consentimientos } from "../src/pantallas/Consentimientos";

function preparar(menores: string[] = []) {
  const guardar = vi.fn(async () => ({ error: null }));
  const continuar = vi.fn();
  render(<Consentimientos menores={menores} guardar={guardar} continuar={continuar} />);
  return { guardar, continuar };
}

describe("Texto versionado del consentimiento (T013)", () => {
  it("es idéntico a docs/legal/consentimiento-v1.md", () => {
    const md = readFileSync(resolve(__dirname, "../../../docs/legal/consentimiento-v1.md"), "utf8")
      .replace(/\r\n/g, "\n");
    for (const [finalidad, texto] of Object.entries(TEXTO_CONSENTIMIENTO)) {
      expect(md).toContain(`## ${finalidad}\n\n${texto}\n`);
    }
    expect(VERSION_CONSENTIMIENTO).toBe("v1");
  });
});

describe("Consentimientos al primer ingreso (HU-001-5, S5)", () => {
  it("informa que los datos se alojan en Brasil y que la IA procesa datos minimizados en Estados Unidos", () => {
    preparar();
    expect(screen.getByText(/se alojan en servidores de Supabase en São Paulo, Brasil/)).toBeTruthy();
    expect(screen.getByText(/los datos minimizados se procesan en Estados Unidos/)).toBeTruthy();
  });

  it("sin aceptar uso_app no se puede continuar", async () => {
    const { guardar, continuar } = preparar();
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    expect(await screen.findByText("Para usar Compás necesitamos que aceptes el uso de la app.")).toBeTruthy();
    expect(guardar).not.toHaveBeenCalled();
    expect(continuar).not.toHaveBeenCalled();
  });

  it("con uso_app y sin analitica_ia guarda solo uso_app e indica que la app funciona sin IA", async () => {
    const { guardar, continuar } = preparar();
    fireEvent.click(screen.getByRole("checkbox", { name: "Acepto el uso de la app" }));
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    await waitFor(() => expect(guardar).toHaveBeenCalledWith(["uso_app"], "v1"));
    expect(
      await screen.findByText("Listo. Compás funcionará sin funciones de IA; puedes activarlas después en Ajustes."),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Seguir" }));
    expect(continuar).toHaveBeenCalled();
  });

  it("con ambos guarda uso_app y analitica_ia y continúa", async () => {
    const { guardar, continuar } = preparar();
    fireEvent.click(screen.getByRole("checkbox", { name: "Acepto el uso de la app" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Acepto el análisis con IA (opcional)" }));
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    await waitFor(() => expect(guardar).toHaveBeenCalledWith(["uso_app", "analitica_ia"], "v1"));
    await waitFor(() => expect(continuar).toHaveBeenCalled());
  });

  it("muestra el consentimiento datos_menor ya otorgado por cada hijo registrado (R25, D26)", () => {
    preparar(["Hijo 1", "Hijo 2"]);
    expect(screen.getByText("Hijo 1: datos de menor autorizados")).toBeTruthy();
    expect(screen.getByText("Hijo 2: datos de menor autorizados")).toBeTruthy();
  });
});
