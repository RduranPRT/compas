import * as SecureStore from "expo-secure-store";

// Dónde guarda Supabase Auth la sesión: llavero del sistema en iOS y Android,
// localStorage en la versión web (ADR-03).
export interface Almacenamiento {
  getItem(clave: string): Promise<string | null>;
  setItem(clave: string, valor: string): Promise<void>;
  removeItem(clave: string): Promise<void>;
}

export function crearAlmacenamientoSesion(os: string): Almacenamiento {
  if (os === "web") {
    return {
      getItem: async (clave) => globalThis.localStorage?.getItem(clave) ?? null,
      setItem: async (clave, valor) => globalThis.localStorage?.setItem(clave, valor),
      removeItem: async (clave) => globalThis.localStorage?.removeItem(clave),
    };
  }
  return {
    getItem: (clave) => SecureStore.getItemAsync(clave),
    setItem: (clave, valor) => SecureStore.setItemAsync(clave, valor),
    removeItem: (clave) => SecureStore.deleteItemAsync(clave),
  };
}
