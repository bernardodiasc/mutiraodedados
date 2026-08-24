import type { ContratoDoFornecedor, FichaFornecedor } from "@/lib/data/fornecedores.functions";

/**
 * Derivações puras da ficha do fornecedor. A ficha tem três estados:
 * - "completo": há contratos federais (CGU) — radar, série e grafo fazem sentido;
 * - "degradado": nada na CGU, mas o CNPJ existe em outra fonte (PNCP, cota
 *   parlamentar, doações) — mostra o que se sabe, com lacuna explicada;
 * - "inexistente": nenhuma fonte conhece o CNPJ — notFound.
 */
export type EstadoFicha = "completo" | "degradado" | "inexistente";

export function derivarEstadoFicha(f: FichaFornecedor): EstadoFicha {
  if (f.contratos.length > 0) return "completo";
  if (f.pncp.total > 0 || f.ceapCamara.total > 0 || f.ceapSenado.total > 0 || f.doacoes.total > 0)
    return "degradado";
  return f.cadastro ? "degradado" : "inexistente";
}

export type EixoRadar = { label: string; valor: number; descricao: string };
export type NoGrafo = { id: string; label: string; valor: number };

export function serieAnualDe(contratos: ContratoDoFornecedor[]): { ano: number; valor: number }[] {
  const porAno = new Map<number, number>();
  for (const c of contratos) porAno.set(c.ano, (porAno.get(c.ano) ?? 0) + c.valor);
  return [...porAno.entries()]
    .map(([ano, valor]) => ({ ano, valor }))
    .sort((a, b) => a.ano - b.ano);
}

export function montarNosGrafo(contratos: ContratoDoFornecedor[]): NoGrafo[] {
  const porOrgao = new Map<string, { label: string; valor: number }>();
  for (const c of contratos) {
    const atual = porOrgao.get(c.orgao_cod);
    porOrgao.set(c.orgao_cod, {
      label: c.orgao_sigla ?? c.orgao_cod,
      valor: (atual?.valor ?? 0) + c.valor,
    });
  }
  return [...porOrgao.entries()].map(([id, x]) => ({ id, label: x.label, valor: x.valor }));
}

export function sinaisSimples(contratos: ContratoDoFornecedor[]) {
  const total = contratos.reduce((s, c) => s + c.valor, 0);
  const orgaos = new Set(contratos.map((c) => c.orgao_cod));
  const pctDispensa = contratos.length
    ? contratos.filter((c) => c.modalidade === "dispensa").length / contratos.length
    : 0;
  const dispAltoValor = contratos.filter(
    (c) => c.modalidade === "dispensa" && c.valor >= 50_000,
  ).length;
  return { total, nOrgaos: orgaos.size, orgaoUnico: orgaos.size === 1, pctDispensa, dispAltoValor };
}

// Radar de risco — eixos 0..1 a partir dos contratos DESTE fornecedor (sinal, nunca prova).
export function calcularRadar(contratos: ContratoDoFornecedor[], fmtBRL: (n: number) => string) {
  const { total, pctDispensa, dispAltoValor } = sinaisSimples(contratos);
  const porOrgao = montarNosGrafo(contratos);
  const maiorOrgao = porOrgao.length > 0 ? Math.max(...porOrgao.map((n) => n.valor)) : 0;
  const ticketMedio = contratos.length > 0 ? total / contratos.length : 0;
  const eixos: EixoRadar[] = [
    {
      label: "Concentração",
      valor: total > 0 ? maiorOrgao / total : 0,
      descricao: `Maior órgão = ${total > 0 ? ((maiorOrgao / total) * 100).toFixed(0) : "0"}% do recebido.`,
    },
    {
      label: "% Dispensa",
      valor: pctDispensa,
      descricao: `${(pctDispensa * 100).toFixed(0)}% dos contratos sem licitação.`,
    },
    {
      label: "Ticket médio",
      valor: Math.min(1, ticketMedio / 500_000),
      descricao: `${fmtBRL(ticketMedio)} por contrato (ref. R$ 500k).`,
    },
    {
      label: "Dispensa alto valor",
      valor: contratos.length ? Math.min(1, dispAltoValor / contratos.length) : 0,
      descricao: `${dispAltoValor} dispensa(s) ≥ R$ 50k.`,
    },
  ];
  return eixos;
}
