import { Platform } from "react-native";

// Elegir y descargar archivos. La Beta corre en la web (ADR-03): se usa el selector del navegador.
// En la app nativa se reemplazará por expo-document-picker y expo-sharing.

export interface ArchivoElegido {
  nombre: string;
  contenido: ArrayBuffer;
}

export function elegirArchivo(aceptar = ".xlsx,.xls,.csv,.pdf"): Promise<ArchivoElegido | null> {
  if (Platform.OS !== "web" || typeof document === "undefined") {
    return Promise.reject(new Error("Por ahora la carga de cartolas está disponible en la versión web."));
  }
  return new Promise((resolver) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = aceptar;
    input.onchange = async () => {
      const archivo = input.files?.[0];
      if (!archivo) return resolver(null);
      resolver({ nombre: archivo.name, contenido: await archivo.arrayBuffer() });
    };
    input.click();
  });
}

export function descargarTexto(nombre: string, contenido: string, tipo = "application/json"): void {
  if (Platform.OS !== "web" || typeof document === "undefined") {
    throw new Error("La descarga está disponible en la versión web.");
  }
  const url = URL.createObjectURL(new Blob([contenido], { type: `${tipo};charset=utf-8` }));
  const a = document.createElement("a");
  a.href = url;
  a.download = nombre;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
