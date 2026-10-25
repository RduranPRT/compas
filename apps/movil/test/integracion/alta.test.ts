import { describe, expect, it } from "vitest";
import { firmaPendienteDelAcuerdo, nombreHogar } from "../../src/datos/hogar";
import { firmarAcuerdo, pantallaAcuerdo, proponerAcuerdoV1 } from "../../src/datos/acuerdo";
import {
  crearHogar,
  estadoAlta,
  guardarConsentimientos,
  integranteActual,
  invitarIntegrante,
  registrarHijos,
} from "../../src/datos/alta";
import { usuarioDePrueba, type Cliente } from "./entorno";

describe("Alta del hogar contra Supabase local (T012, T014)", () => {
  let org: Cliente;
  let cad: Cliente;
  let correoCad: string;

  it("Crear el hogar: el usuario nuevo parte por el hogar y queda como ORG", async () => {
    ({ db: org } = await usuarioDePrueba("rodrigo"));
    expect(await estadoAlta(org)).toBe("hogar");
    expect((await crearHogar(org, "Durán Damann", "Rodrigo")).error).toBeNull();
    expect((await integranteActual(org))?.rol).toBe("ORG");
    expect(await nombreHogar(org)).toBe("Durán Damann");
    expect(await estadoAlta(org)).toBe("integrantes");
  });

  it("Invitar a la co-administradora y registrar 2 hijos sin cuenta (R39, R25, D26)", async () => {
    ({ db: cad, correo: correoCad } = await usuarioDePrueba("ana"));
    expect((await invitarIntegrante(org, correoCad.toUpperCase(), "Ana", "CAD")).error).toBeNull();
    expect((await registrarHijos(org, ["Hijo 1", "Hijo 2"], "v1")).error).toBeNull();
    const { data } = await org.schema("gob").from("integrante").select("nombre, rol, usuario_auth_id").order("nombre");
    expect(data).toEqual([
      { nombre: "Ana", rol: "CAD", usuario_auth_id: null },
      { nombre: "Hijo 1", rol: "MEN", usuario_auth_id: null },
      { nombre: "Hijo 2", rol: "MEN", usuario_auth_id: null },
      expect.objectContaining({ nombre: "Rodrigo", rol: "ORG" }),
    ]);
    expect(await estadoAlta(org)).toBe("consentimientos");
  });

  it("Consentimientos y propuesta del Acuerdo v1: queda esperando la firma de Ana", async () => {
    expect((await guardarConsentimientos(org, ["uso_app"], "v1")).error).toBeNull();
    expect(await estadoAlta(org)).toBe("acuerdo");
    expect((await proponerAcuerdoV1(org, { urgente: false })).error).toBeNull();
    expect(await estadoAlta(org)).toBe("listo");
    expect(await firmaPendienteDelAcuerdo(org)).toEqual({ nombre: "Ana", vigente: false });
  });

  it("Ana inicia sesión: queda como CAD, consiente, firma y el Acuerdo v1 queda vigente desde 2026-10-01", async () => {
    expect(await estadoAlta(cad)).toBe("consentimientos");
    expect((await integranteActual(cad))?.rol).toBe("CAD");
    expect((await guardarConsentimientos(cad, ["uso_app", "analitica_ia"], "v1")).error).toBeNull();
    expect(await estadoAlta(cad)).toBe("acuerdo");
    const pantalla = await pantallaAcuerdo(cad);
    expect(pantalla.modo).toBe("firmar");
    expect((await firmarAcuerdo(cad, pantalla.pendiente!, pantalla.yo!.id)).error).toBeNull();
    expect(await estadoAlta(cad)).toBe("listo");
    expect(await firmaPendienteDelAcuerdo(org)).toBeNull();
    const { data } = await org.schema("gob").from("acuerdo_hogar").select("version, estado, vigencia_desde");
    expect(data).toEqual([{ version: 1, estado: "vigente", vigencia_desde: "2026-10-01" }]);
  });

  it("Aislamiento entre hogares por PostgREST: otro usuario no ve ni modifica nada del hogar", async () => {
    const { db: otro } = await usuarioDePrueba("otra");
    expect((await crearHogar(otro, "Hogar Otra", "Otra")).error).toBeNull();
    const integrantes = await otro.schema("gob").from("integrante").select("nombre");
    expect(integrantes.data).toEqual([{ nombre: "Otra" }]);
    const reglas = await otro.schema("gob").from("regla_hogar").select("codigo");
    expect(reglas.data).toEqual([]);
    const hogarAjeno = await otro.schema("gob").from("hogar").select("nombre").eq("nombre", "Durán Damann");
    expect(hogarAjeno.data).toEqual([]);
    const insercion = await otro
      .schema("gob")
      .from("consentimiento")
      .insert({ hogar_id: (await integranteActual(org))!.hogar_id, titular_id: (await integranteActual(org))!.id,
                otorgado_por_id: (await integranteActual(otro))!.id, finalidad: "analitica_ia", version_texto: "v1" });
    expect(insercion.error).not.toBeNull();
  });
});
