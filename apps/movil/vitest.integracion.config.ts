import { defineConfig } from "vitest/config";

// Pruebas de integración contra `supabase start` (no corren en `pnpm test`).
export default defineConfig({
  test: {
    environment: "node",
    include: ["test/integracion/**/*.test.ts"],
    globalSetup: ["test/integracion/global.ts"],
    fileParallelism: false,
    testTimeout: 20000,
  },
});
