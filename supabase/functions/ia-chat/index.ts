// ia-chat (spec 005, HU-005-2): frase de captura → propuesta {monto, sobre, cuenta, fecha, intención, cuotas}.
// Nunca propone sobres de Futuro, emergencia ni cuotas (R36): la app no los envía como opciones.
import { z } from "npm:zod@4";
import { atender, ErrorIA, exigirConsentimiento, MODELO_LIVIANO, minimizar, pedirJson } from "../_compartido/ia.ts";

const Entrada = z.object({
  frase: z.string().min(2).max(500),
  hoy: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  sobres: z.array(z.object({ id: z.string(), nombre: z.string() })).min(1).max(80),
  cuentas: z.array(z.object({ id: z.string(), nombre: z.string(), tipo: z.string() })).min(1).max(30),
});

const Salida = z.object({
  intent: z.enum(["gasto", "otro"]),
  monto: z.number().int().positive().nullable(),
  sobre_id: z.string().nullable(),
  cuenta_id: z.string().nullable(),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  intencion: z.enum(["supervivencia", "deseo", "cultura", "imprevisto"]).nullable(),
  n_cuotas: z.number().int().min(1).max(48),
  comercio: z.string().nullable(),
  confianza: z.number().min(0).max(1),
});

Deno.serve((req) =>
  atender(req, async (r) => {
    await exigirConsentimiento(r);
    const e = Entrada.safeParse(await r.json());
    if (!e.success) throw new ErrorIA(400, "entrada_invalida", "Frase no válida");
    const salida = await pedirJson({
      modelo: MODELO_LIVIANO(),
      sistema:
        "Interpretas frases de gastos de un hogar chileno ('12 lucas' = 12000, 'luca' = 1000, 'débito' = cuenta corriente o vista, 'crédito' = tarjeta). Montos en pesos enteros. Usa solo ids de las listas. Hoy es la fecha indicada.",
      mensaje: JSON.stringify({ ...e.data, frase: minimizar(e.data.frase) }),
      esquema: {
        type: "object",
        properties: {
          intent: { type: "string", enum: ["gasto", "otro"] },
          monto: { type: ["integer", "null"] },
          sobre_id: { type: ["string", "null"] },
          cuenta_id: { type: ["string", "null"] },
          fecha: { type: ["string", "null"] },
          intencion: { type: ["string", "null"], enum: ["supervivencia", "deseo", "cultura", "imprevisto", null] },
          n_cuotas: { type: "integer" },
          comercio: { type: ["string", "null"] },
          confianza: { type: "number" },
        },
        required: ["intent", "monto", "sobre_id", "cuenta_id", "fecha", "intencion", "n_cuotas", "comercio", "confianza"],
      },
      maxTokens: 512,
    });
    const p = Salida.safeParse(salida);
    if (!p.success) throw new ErrorIA(502, "ia_respuesta_invalida", "La IA no entregó una propuesta válida");
    const sobres = new Set(e.data.sobres.map((s) => s.id));
    const cuentas = new Set(e.data.cuentas.map((c) => c.id));
    return {
      ...p.data,
      sobre_id: p.data.sobre_id && sobres.has(p.data.sobre_id) ? p.data.sobre_id : null,
      cuenta_id: p.data.cuenta_id && cuentas.has(p.data.cuenta_id) ? p.data.cuenta_id : null,
      modelo: MODELO_LIVIANO(),
    };
  })
);
