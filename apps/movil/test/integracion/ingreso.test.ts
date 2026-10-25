import type { Database } from "@compas/contratos";
import { createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { usuarioDePrueba } from "./entorno";

const anonimo = () =>
  createClient<Database>(process.env.SUPABASE_API_URL!, process.env.SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

describe("Ingreso con correo y contraseña contra Supabase local (D28)", () => {
  it("una cuenta creada por el organizador ingresa con su contraseña", async () => {
    const { db } = await usuarioDePrueba("cuenta");
    const { data } = await db.auth.getUser();
    expect(data.user?.email).toMatch(/@prueba\.test$/);
  });

  it("la app no puede crear cuentas: registro público cerrado", async () => {
    const { error } = await anonimo().auth.signUp({ email: `intruso.${Date.now()}@prueba.test`, password: "clave-larga-123" });
    expect(error?.message).toMatch(/signups not allowed/i);
  });

  it("con una contraseña equivocada no entra", async () => {
    const { correo } = await usuarioDePrueba("equivocada");
    const { error } = await anonimo().auth.signInWithPassword({ email: correo, password: "no-es-la-clave" });
    expect(error).not.toBeNull();
  });
});
