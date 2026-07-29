import { createServerFn } from "@tanstack/react-start";

export type StatusFonte = { updatedAt: string | null; count: number };
export type StatusFontesResult = {
  pncp: StatusFonte;
  siconfi: StatusFonte;
  transferegov: StatusFonte;
  camara: StatusFonte;
  senado: StatusFonte;
  contratosPorOrgao: Record<string, StatusFonte>;
};

// A lógica que usa `supabaseAdmin` mora em `status.server.ts`, carregada via
// `await import` dentro dos handlers — nunca no escopo de módulo. Assim rotas
// cliente que importam estes server fns (ex.: /orgaos, /admin) não arrastam
// `client.server` para o bundle (ver docs/padroes/debug-problemas.ia.md #3/#5).

export const orgaosComDados = createServerFn({ method: "GET" }).handler(
  async (): Promise<string[]> => {
    const { codigosComDados } = await import("@/lib/data/status.server");
    return codigosComDados();
  },
);

export const statusFontes = createServerFn({ method: "GET" }).handler(
  async (): Promise<StatusFontesResult> => {
    const { coletarStatusFontes } = await import("@/lib/data/status.server");
    return coletarStatusFontes();
  },
);
