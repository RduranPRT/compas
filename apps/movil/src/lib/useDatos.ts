import { useFocusEffect } from "expo-router";
import { useCallback, useRef, useState } from "react";

// Carga datos al entrar a la pantalla (y al volver a ella), con estado de carga, error y recarga.
export function useDatos<T>(cargar: () => Promise<T>, deps: unknown[] = []) {
  const [datos, setDatos] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const vigente = useRef(0);

  const recargar = useCallback(async () => {
    const turno = ++vigente.current;
    setCargando(true);
    try {
      const d = await cargar();
      if (turno === vigente.current) {
        setDatos(d);
        setError(null);
      }
    } catch (e) {
      if (turno === vigente.current) setError(e instanceof Error ? e.message : "No pudimos cargar los datos.");
    } finally {
      if (turno === vigente.current) setCargando(false);
    }
  }, deps);

  useFocusEffect(
    useCallback(() => {
      void recargar();
    }, [recargar]),
  );

  return { datos, error, cargando, recargar, setDatos };
}
