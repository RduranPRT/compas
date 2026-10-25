// ia-clasificar (spec 003, R36): sugiere clase, categoría e intención por comercio. Nunca confirma ni imputa:
// la app guarda la sugerencia con app.guardar_sugerencias y una persona confirma.
import { z } from "npm:zod@4";
import { atender, ErrorIA, exigirConsentimiento, MODELO_LIVIANO, minimizar, pedirJson } from "../_compartido/ia.ts";

const Entrada = z.object({
  items: z.array(z.object({ clave: z.string(), comercio: z.string(), glosa: z.string(), monto: z.number().int(), sentido: z.enum(["cargo", "abono"]) }))
    .min(1).max(300),
  // Futuro, emergencia y deudas no se ofrecen: la IA no imputa a esos sobres (R36)
  categorias: z.array(z.object({ id: z.string(), nombre: z.string(), bloque: z.string() })).min(1).max(80),
});

const Salida = z.object({
  clave: z.string(),
  clase: z.enum(["gasto", "ingreso", "transferencia_interna", "pago_tarjeta", "comision", "interes", "reembolso", "otro"]),
  categoria_id: z.string().nullable(),
  intencion: z.enum(["supervivencia", "deseo", "cultura", "imprevisto"]).nullable(),
  confianza: z.number().min(0).max(1),
  razon_corta: z.string().max(200),
});

Deno.serve((req) =>
  atender(req, async (r) => {
    await exigirConsentimiento(r);
    const e = Entrada.safeParse(await r.json());
    if (!e.success) throw new ErrorIA(400, "entrada_invalida", "Datos de clasificación no válidos");
    const ids = new Set(e.data.categorias.map((c) => c.id));
    const salida = (await pedirJson({
      modelo: MODELO_LIVIANO(),
      sistema:
        "Clasificas movimientos bancarios de un hogar chileno. Para cada ítem eliges clase, una categoría de la lista (o null si ninguna calza), la intención Kakeibo y una confianza entre 0 y 1. Sé conservador: si dudas, baja la confianza.",
      mensaje: JSON.stringify({
        categorias: e.data.categorias,
        items: e.data.items.map((i) => ({ ...i, glosa: minimizar(i.glosa), comercio: minimizar(i.comercio) })),
      }),
      esquema: {
        type: "object",
        properties: {
          resultados: {
            type: "array",
            items: {
              type: "object",
              properties: {
                clave: { type: "string" },
                clase: { type: "string", enum: ["gasto", "ingreso", "transferencia_interna", "pago_tarjeta", "comision", "interes", "reembolso", "otro"] },
                categoria_id: { type: ["string", "null"] },
                intencion: { type: ["string", "null"], enum: ["supervivencia", "deseo", "cultura", "imprevisto", null] },
                confianza: { type: "number" },
                razon_corta: { type: "string" },
              },
              required: ["clave", "clase", "categoria_id", "intencion", "confianza", "razon_corta"],
            },
          },
        },
        required: ["resultados"],
      },
    })) as { resultados?: unknown[] };
    const resultados = (salida.resultados ?? [])
      .map((x) => Salida.safeParse(x))
      .filter((p) => p.success)
      .map((p) => p.data!)
      .map((x) => ({ ...x, categoria_id: x.categoria_id && ids.has(x.categoria_id) ? x.categoria_id : null }));
    return { resultados, modelo: MODELO_LIVIANO() };
  })
);
