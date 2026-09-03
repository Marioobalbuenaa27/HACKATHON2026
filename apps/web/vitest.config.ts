import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  // El panel usa Tailwind v4 vía @tailwindcss/postcss, que Vitest no necesita
  // procesar para los tests de lógica/API. Se desactiva PostCSS explícitamente.
  css: { postcss: { plugins: [] } },
  test: {
    environment: "node",
    include: ["tests/**/*.{test,spec}.ts"],
    css: false,
    globals: false,
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },
});
