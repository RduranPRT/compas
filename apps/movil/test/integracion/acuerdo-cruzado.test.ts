import { describe, expect, it } from "vitest";
import { firmarAcuerdo, pantallaAcuerdo, proponerAcuerdoV1 } from "../../src/datos/acuerdo";
import { crearHogar, estadoAlta, guardarConsentimientos, invitarIntegrante } from "../../src/datos/alta";
import { usuarioDePrueba } from "./entorno";

// Caso real de marcha blanca (25-10-2026): la co-administradora propuso el Acuerdo antes que el organizador.
describe("Acuerdo propuesto por el CAD: lo firma el ORG (E1)", () => {
  it("el otro administrador ve 'firmar', firma y el Acuerdo queda vigente", async () => {
    const { db: org } = await usuarioDePrueba("rodrigo");
    const { db: cad, correo: correoCad } = await usuarioDePrueba("romina");
    await crearHogar(org, "Durán Damann", "Rodrigo");
    await invitarIntegrante(org, correoCad, "Romina", "CAD");
    await guardarConsentimientos(org, ["uso_app"], "v1");

    expect(await estadoAlta(cad)).toBe("consentimientos");
    await guardarConsentimientos(cad, ["uso_app"], "v1");
    const paraCad = await pantallaAcuerdo(cad);
    expect(paraCad.modo).toBe("proponer");
    expect(paraCad.otro).toEqual({ nombre: "Rodrigo", tieneCuenta: true });
    expect((await proponerAcuerdoV1(cad, { urgente: false })).error).toBeNull();
    expect(await estadoAlta(cad)).toBe("listo");

    expect(await estadoAlta(org)).toBe("acuerdo");
    const paraOrg = await pantallaAcuerdo(org);
    expect(paraOrg.modo).toBe("firmar");
    expect(paraOrg.otro?.nombre).toBe("Romina");
    expect((await firmarAcuerdo(org, paraOrg.pendiente!, paraOrg.yo!.id)).error).toBeNull();
    expect(await estadoAlta(org)).toBe("listo");
    const { data } = await org.schema("gob").from("acuerdo_hogar").select("estado");
    expect(data).toEqual([{ estado: "vigente" }]);
  });
});
