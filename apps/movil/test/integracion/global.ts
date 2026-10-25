import { execSync } from "node:child_process";
import { resolve } from "node:path";

// Lee URL y claves de la instancia local (`supabase status -o env`). Solo para pruebas locales.
export default function () {
  let salida: string;
  try {
    salida = execSync("corepack pnpm exec supabase status -o env", {
      cwd: resolve(__dirname, "../../../.."),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
  } catch {
    throw new Error("Supabase local no está corriendo: ejecuta `supabase start` antes de las pruebas de integración.");
  }
  for (const linea of salida.split(/\r?\n/)) {
    const m = /^(API_URL|ANON_KEY|SERVICE_ROLE_KEY)="?([^"]*)"?$/.exec(linea);
    if (m) process.env[`SUPABASE_${m[1]}`] = m[2];
  }
}
