// Config standalone do Vitest: NUNCA importe o vite.config.ts aqui.
// Com este arquivo presente, o Vitest o usa com precedência e não carrega o
// vite.config.ts — evitando o conflito Zod 4 × router-generator descrito em
// docs/padroes/debug-problemas.ia.md §1. O `vite build` ignora este arquivo.
import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    globals: true,
    include: ["src/**/*.test.ts"],
  },
});
