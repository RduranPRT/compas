import { beforeEach, describe, expect, it, vi } from "vitest";

const secureStore = vi.hoisted(() => ({
  getItemAsync: vi.fn(async () => "valor-seguro"),
  setItemAsync: vi.fn(async () => undefined),
  deleteItemAsync: vi.fn(async () => undefined),
}));
vi.mock("expo-secure-store", () => secureStore);

import { crearAlmacenamientoSesion } from "../src/lib/almacenamiento";

describe("Almacenamiento de la sesión (T010, ADR-03)", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it("en web usa localStorage", async () => {
    const a = crearAlmacenamientoSesion("web");
    await a.setItem("sesion", "abc");
    expect(localStorage.getItem("sesion")).toBe("abc");
    expect(await a.getItem("sesion")).toBe("abc");
    await a.removeItem("sesion");
    expect(await a.getItem("sesion")).toBeNull();
    expect(secureStore.setItemAsync).not.toHaveBeenCalled();
  });

  it.each(["ios", "android"] as const)("en %s usa expo-secure-store", async (os) => {
    const a = crearAlmacenamientoSesion(os);
    await a.setItem("sesion", "abc");
    expect(secureStore.setItemAsync).toHaveBeenCalledWith("sesion", "abc");
    expect(await a.getItem("sesion")).toBe("valor-seguro");
    await a.removeItem("sesion");
    expect(secureStore.deleteItemAsync).toHaveBeenCalledWith("sesion");
    expect(localStorage.length).toBe(0);
  });
});
