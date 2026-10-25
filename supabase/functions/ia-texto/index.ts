// ia-texto (specs 004, 006 y 010): redacta hallazgos o recomendaciones a partir de cifras ya calculadas por el
// dominio. La IA no calcula montos (P8): recibe métricas sin glosas ni nombres y devuelve texto con regla y fuente.
import { z } from "npm:zod@4";
import { atender, ErrorIA, exigirConsentimiento, MODELO_MAYOR, pedirJson } from "../_compartido/ia.ts";

const Entrada = z.object({
  tipo: z.enum(["perfil", "plan", "resumen"]),
  metricas: z.record(z.string(), z.unknown()),
  reglas: z.array(z.object({ codigo: z.string(), enunciado: z.string() })).max(60),
});

const Hallazgo = z.object({
  titulo: z.string().min(3).max(120),
  explicacion: z.string().min(10).max(600),
  cifra: z.string().max(60),
  regla_codigo: z.string().regex(/^R\d{2}$/),
  fuente_codigo: z.string().max(20),
  accion: z.string().min(5).max(300),
});

const LIMITES = { perfil: [3, 5], plan: [1, 3], resumen: [1, 3] } as const;

Deno.serve((req) =>
  atender(req, async (r) => {
    await exigirConsentimiento(r);
    const e = Entrada.safeParse(await r.json());
    if (!e.success) throw new ErrorIA(400, "entrada_invalida", "Datos no válidos");
    const [min, max] = LIMITES[e.data.tipo];
    const salida = (await pedirJson({
      modelo: MODELO_MAYOR(),
      sistema: `Eres el asistente del Método Compás para un hogar chileno. Redactas entre ${min} y ${max} hallazgos concretos y accionables a partir de las métricas entregadas. Cada uno cita una regla de la lista (regla_codigo) y su fuente. Tono sin culpa (R16): describe el hecho, la regla y una opción; nunca juzgues ni uses "deberían". Usa solo las cifras entregadas, en formato chileno ($12.345). Español de Chile.`,
      mensaje: JSON.stringify(e.data),
      esquema: {
        type: "object",
        properties: {
          resumen: { type: "string" },
          hallazgos: {
            type: "array",
            items: {
              type: "object",
              properties: {
                titulo: { type: "string" }, explicacion: { type: "string" }, cifra: { type: "string" },
                regla_codigo: { type: "string" }, fuente_codigo: { type: "string" }, accion: { type: "string" },
              },
              required: ["titulo", "explicacion", "cifra", "regla_codigo", "fuente_codigo", "accion"],
            },
          },
        },
        required: ["hallazgos"],
      },
    })) as { resumen?: string; hallazgos?: unknown[] };
    const reglas = new Set(e.data.reglas.map((x) => x.codigo));
    const hallazgos = (salida.hallazgos ?? [])
      .map((h) => Hallazgo.safeParse(h))
      .filter((p) => p.success && reglas.has(p.data.regla_codigo))
      .map((p) => p.data!)
      .slice(0, max);
    if (hallazgos.length < min) throw new ErrorIA(502, "ia_respuesta_invalida", "La IA no entregó suficientes hallazgos válidos");
    return { resumen: salida.resumen ?? null, hallazgos, modelo: MODELO_MAYOR() };
  })
);
