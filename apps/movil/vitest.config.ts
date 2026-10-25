import { defineConfig } from "vitest/config";

// Componentes con react-native-web en jsdom: mismas pantallas que la versión web (ADR-03).
export default defineConfig({
  resolve: {
    alias: [{ find: /^react-native$/, replacement: "react-native-web" }],
    extensions: [".web.tsx", ".web.ts", ".tsx", ".ts", ".js"],
  },
  define: { __DEV__: "false" },
  test: {
    environment: "jsdom",
    include: ["test/**/*.test.{ts,tsx}"],
    exclude: ["test/integracion/**"],
    setupFiles: ["test/setup.ts"],
  },
});
