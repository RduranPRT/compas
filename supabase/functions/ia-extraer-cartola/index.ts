// ia-extraer-cartola (spec 003, D27): texto minimizado de cualquier cartola → LineaCartola[].
import { z } from "npm:zod@4";
import { atender, ErrorIA, exigirConsentimiento, MODELO_LIVIANO, minimizar, pedirJson } from "../_compartido/ia.ts";

const Entrada = z.object({ texto: z.string().min(10).max(200_000), tipoCuenta: z.string().optional() });

const Linea = z.object({
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  monto: z.number().int().refine((n) => n !== 0),
  glosa: z.string().min(1).max(300),
  moneda_original: z.string().optional(),
  monto_original: z.number().optional(),
  cuota: z.object({ numero: z.number().int(), total: z.number().int() }).optional(),
});

const SISTEMA = `Recibes el contenido de una cartola bancaria o estado de cuenta de tarjeta chileno, en cualquier formato y de cualquier banco. Transfórmalo en una lista de movimientos con el esquema LineaCartola: fecha de operación (AAAA-MM-DD), monto en pesos enteros con signo (cargo negativo, abono positivo), glosa tal como aparece, moneda original y monto original si la línea no es en pesos, y número de cuota si aparece. Ignora encabezados, saldos, subtotales y publicidad. Si el documento informa totales de cargos y abonos, devuélvelos aparte. No inventes líneas; si una fila es ilegible, inclúyela en filas_no_leidas.`;

const ESQUEMA = {
  type: "object",
  properties: {
    lineas: {
      type: "array",
      items: {
        type: "object",
        properties: {
          fecha: { type: "string" },
          monto: { type: "integer" },
          glosa: { type: "string" },
          moneda_original: { type: "string" },
          monto_original: { type: "number" },
          cuota: { type: "object", properties: { numero: { type: "integer" }, total: { type: "integer" } } },
        },
        required: ["fecha", "monto", "glosa"],
      },
    },
    totales: { type: "object", properties: { cargos: { type: "integer" }, abonos: { type: "integer" } } },
    filas_no_leidas: { type: "array", items: { type: "string" } },
  },
  required: ["lineas"],
};

Deno.serve((req) =>
  atender(req, async (r) => {
    await exigirConsentimiento(r);
    const entrada = Entrada.safeParse(await r.json());
    if (!entrada.success) throw new ErrorIA(400, "entrada_invalida", "El contenido de la cartola no es válido");
    const salida = (await pedirJson({
      modelo: MODELO_LIVIANO(),
      sistema: SISTEMA,
      mensaje: `Tipo de cuenta: ${entrada.data.tipoCuenta ?? "desconocido"}\n\n${minimizar(entrada.data.texto)}`,
      esquema: ESQUEMA,
      maxTokens: 16000,
    })) as { lineas?: unknown[]; totales?: { cargos?: number; abonos?: number }; filas_no_leidas?: string[] };
    // Validación con zod: las filas inválidas se informan y no se importan
    const lineas: z.infer<typeof Linea>[] = [];
    const invalidas: number[] = [];
    (salida.lineas ?? []).forEach((l, i) => {
      const p = Linea.safeParse(l);
      if (p.success) lineas.push(p.data);
      else invalidas.push(i + 1);
    });
    return {
      lineas,
      totales: salida.totales ?? null,
      filas_no_leidas: [...(salida.filas_no_leidas ?? []), ...invalidas.map((n) => `respuesta ${n}`)],
      modelo: MODELO_LIVIANO(),
    };
  })
);
