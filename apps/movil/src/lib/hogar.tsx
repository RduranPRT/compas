import { PARAMETROS_POR_DEFECTO, esEtapa, type Etapa, type ParametrosAcuerdo } from "@compas/dominio";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { integranteActual, type IntegranteActual } from "../datos/integrante";
import { hogar as leerHogar, integrantes, parametros, type Hogar, type Persona } from "../datos/hogar";
import { supabase } from "./supabase";

// Datos del hogar que casi todas las pantallas necesitan: quién soy, el Acuerdo vigente y los integrantes.

export interface EstadoHogar {
  yo: IntegranteActual | null;
  hogar: Hogar | null;
  etapa: Etapa;
  parametros: ParametrosAcuerdo;
  personas: Persona[];
  esAdmin: boolean;
  recargar: () => Promise<void>;
}

const vacio: EstadoHogar = {
  yo: null,
  hogar: null,
  etapa: "E0",
  parametros: PARAMETROS_POR_DEFECTO,
  personas: [],
  esAdmin: false,
  recargar: async () => {},
};

const Contexto = createContext<EstadoHogar>(vacio);

export function ProveedorHogar({ children }: { children: ReactNode }) {
  const [estado, setEstado] = useState<Omit<EstadoHogar, "recargar">>(vacio);

  const recargar = useCallback(async () => {
    const [yo, h, p, personas] = await Promise.all([integranteActual(supabase), leerHogar(supabase), parametros(supabase), integrantes(supabase)]);
    setEstado({
      yo,
      hogar: h,
      etapa: h && esEtapa(h.etapa) ? h.etapa : "E0",
      parametros: p,
      personas,
      esAdmin: yo?.rol === "ORG" || yo?.rol === "CAD",
    });
  }, []);

  useEffect(() => {
    void recargar();
  }, [recargar]);

  return <Contexto.Provider value={{ ...estado, recargar }}>{children}</Contexto.Provider>;
}

export const useHogar = () => useContext(Contexto);
