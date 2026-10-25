// Compartido por las funciones ia-*: sesión del usuario, consentimiento, minimización y llamada a Claude.
// ADR-04: la clave vive en los secretos de Supabase; sin clave o sin `analitica_ia` se responde 503 y la app
// sigue con sus reglas (D31). Nunca se registran montos ni glosas en los logs.
import { createClient } from "npm:@supabase/supabase-js@2";

export const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export function json(cuerpo: unknown, estado = 200): Response {
  return new Response(JSON.stringify(cuerpo), { status: estado, headers: { ...CORS, "Content-Type": "application/json" } });
}

export class ErrorIA extends Error {
  constructor(public estado: number, public codigo: string, mensaje: string) {
    super(mensaje);
  }
}

/** Usuario autenticado con consentimiento analitica_ia vigente (S5). */
export async function exigirConsentimiento(req: Request): Promise<{ integranteId: string }> {
  const auth = req.headers.get("Authorization") ?? "";
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false },
  });
  const { data: usuario } = await db.auth.getUser(auth.replace(/^Bearer\s+/i, ""));
  if (!usuario.user) throw new ErrorIA(401, "sin_sesion", "Necesitas iniciar sesión");
  const { data: yo } = await db.schema("gob").from("integrante").select("id").eq("usuario_auth_id", usuario.user.id)
    .eq("activo", true).maybeSingle();
  if (!yo) throw new ErrorIA(403, "sin_hogar", "No perteneces a un hogar");
  const { data: vigente } = await db.schema("app").rpc("consentimiento_vigente", { p_integrante: yo.id, p_finalidad: "analitica_ia" });
  if (!vigente) throw new ErrorIA(503, "sin_consentimiento", "Sin consentimiento de análisis con IA: la app sigue en modo manual");
  if (!Deno.env.get("ANTHROPIC_API_KEY")) throw new ErrorIA(503, "ia_no_configurada", "La IA aún no está configurada");
  return { integranteId: yo.id };
}

// Segunda barrera de minimización (la app ya minimiza): RUT, números largos, correos y teléfonos (R43)
export function minimizar(texto: string): string {
  return texto
    .replace(/\b\d{1,2}\.?\d{3}\.?\d{3}\s?-\s?[\dkK]\b/g, "[RUT]")
    .replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, "[correo]")
    .replace(/(\+?56\s?)?\b9[\s.-]?\d{4}[\s.-]?\d{4}\b/g, "[teléfono]")
    .replace(/\b\d(?:[\d\s-]*\d){8,}\b/g, (n) => {
      const d = n.replace(/\D/g, "");
      return d.length >= 9 ? `****${d.slice(-4)}` : n;
    });
}

export const MODELO_LIVIANO = () => Deno.env.get("CLAUDE_MODELO_LIVIANO") ?? "claude-haiku-5-5";
export const MODELO_MAYOR = () => Deno.env.get("CLAUDE_MODELO_MAYOR") ?? "claude-sonnet-5-5";

/** Llamada con salida estructurada: Claude debe usar la herramienta `responder` con el esquema dado. */
export async function pedirJson(opciones: {
  modelo: string;
  sistema: string;
  mensaje: string;
  esquema: Record<string, unknown>;
  maxTokens?: number;
}): Promise<unknown> {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": Deno.env.get("ANTHROPIC_API_KEY")!,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: opciones.modelo,
      max_tokens: opciones.maxTokens ?? 4096,
      system: opciones.sistema,
      tools: [{ name: "responder", description: "Entrega la respuesta estructurada.", input_schema: opciones.esquema }],
      tool_choice: { type: "tool", name: "responder" },
      messages: [{ role: "user", content: opciones.mensaje }],
    }),
  });
  if (!r.ok) {
    console.error(`Claude respondió ${r.status}`);   // sin contenido del hogar en el log
    throw new ErrorIA(502, "ia_error", "La IA no respondió; inténtalo más tarde");
  }
  const cuerpo = await r.json();
  const uso = (cuerpo.content ?? []).find((b: { type: string }) => b.type === "tool_use");
  if (!uso) throw new ErrorIA(502, "ia_sin_respuesta", "La IA no entregó una respuesta válida");
  return uso.input;
}

export async function atender(req: Request, manejar: (req: Request) => Promise<unknown>): Promise<Response> {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    return json(await manejar(req));
  } catch (e) {
    if (e instanceof ErrorIA) return json({ error: e.codigo, mensaje: e.message }, e.estado);
    console.error("error inesperado", e instanceof Error ? e.name : "desconocido");
    return json({ error: "interno", mensaje: "No pudimos procesar la solicitud" }, 500);
  }
}
