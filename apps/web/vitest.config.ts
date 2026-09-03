import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  // El panel usa Tailwind v4 vía @tailwindcss/postcss, que Vitest no necesita
  // procesar para los tests de lógica/API. Se desactiva PostCSS explícitamente.
  css: { postcss: { plugins: [] } },
  test: {
    environment: "node",
    include: ["tests/**/*.{test,spec}.ts"],
    setupFiles: ["tests/setup.ts"],
    css: false,
    globals: false,
    // Todos los archivos comparten el mismo schema `turnero_test`: se corren en
    // serie para que el TRUNCATE de un archivo no borre los datos de otro.
    fileParallelism: false,
    hookTimeout: 30_000,
    testTimeout: 30_000,
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },
});
