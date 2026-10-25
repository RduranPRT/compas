import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["**/node_modules/**", "**/dist/**", "**/.expo/**", "packages/contratos/src/db.ts", "supabase/functions/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
);
