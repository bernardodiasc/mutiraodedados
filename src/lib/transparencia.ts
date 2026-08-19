import type { Dataset } from "./data/source";
import type { Contrato } from "./data/types";

/**
 * Índice de Transparência Institucional (ITI) — 0 a 100.
 *
 * Construído sobre os dados já carregados na plataforma para o órgão.
 * NÃO mede legalidade, eficiência ou qualidade administrativa: mede a
 * **clareza informacional** do que o órgão publica em contratos. Quanto
 * maior, mais fácil para a sociedade interpretar o gasto.
 *
 * Cinco componentes, cada um normalizado em 0..1 e ponderado:
 *  - completude (25%)        — % de contratos com objeto descrito de forma específica.
 *  - competitividade (25%)   — % de contratos por modalidade competitiva (pregão/concorrência) vs dispensa/inexigibilidade.
 *  - diversidade (20%)       — 1 - HHI normalizado dos fornecedores (concentração inversa).
 *  - volume (15%)            — proxy de cobertura: log do nº de contratos, saturado em 200.
 *  - atualidade (15%)        — último contrato firmado nos últimos 12 meses corridos.
 */

const TERMOS_GENERICOS = [
  "serviços diversos",
  "servicos diversos",
  "aquisição de bens",
  "aquisicao de bens",
  "apoio operacional",
  "apoio administrativo",
  "prestação de serviços",
  "prestacao de servicos",
  "fornecimento de materiais",
  "serviços gerais",
  "servicos gerais",
  "outros serviços",
  "outros servicos",
];

export type ComponenteITI = {
  chave: "completude" | "competitividade" | "diversidade" | "volume" | "atualidade";
  label: string;
  valor: number; // 0..1
  peso: number; // 0..1
  detalhe: string;
};

export type NotaTransparencia = {
  nota: number; // 0..100
  faixa: "alta" | "media" | "baixa" | "insuficiente";
  componentes: ComponenteITI[];
  amostra: number; // nº de contratos usados
};

function objetoEspecifico(c: Contrato): boolean {
  const obj = (c.objeto || "").toLowerCase().trim();
  if (obj.length < 30) return false;
  if (TERMOS_GENERICOS.some((t) => obj.includes(t))) return false;
  return true;
}

function hhi(valoresPorFornecedor: number[], total: number): number {
  if (total <= 0) return 1;
  let s = 0;
  for (const v of valoresPorFornecedor) {
    const share = v / total;
    s += share * share;
  }
  return s; // 0..1
}

function faixaDe(nota: number, amostra: number): NotaTransparencia["faixa"] {
  if (amostra < 5) return "insuficiente";
  if (nota >= 70) return "alta";
  if (nota >= 45) return "media";
  return "baixa";
}

export function calcularNotaTransparencia(ds: Dataset, orgaoCod: string): NotaTransparencia {
  const contratos = ds.contratos.filter((c) => c.orgaoCod === orgaoCod);
  const amostra = contratos.length;

  if (amostra === 0) {
    return {
      nota: 0,
      faixa: "insuficiente",
      amostra: 0,
      componentes: [],
    };
  }

  // 1. Completude
  const esp = contratos.filter(objetoEspecifico).length;
  const completude = esp / amostra;

  // 2. Competitividade
  const competitivos = contratos.filter(
    (c) => c.modalidade === "pregao" || c.modalidade === "concorrencia",
  ).length;
  const competitividade = competitivos / amostra;

  // 3. Diversidade — 1 - HHI
  const porForn = new Map<string, number>();
  let total = 0;
  for (const c of contratos) {
    porForn.set(c.fornecedorCnpj, (porForn.get(c.fornecedorCnpj) ?? 0) + c.valor);
    total += c.valor;
  }
  const diversidade = Math.max(0, 1 - hhi([...porForn.values()], total));

  // 4. Volume — log saturado em 200 contratos
  const volume = Math.min(1, Math.log10(amostra + 1) / Math.log10(201));

  // 5. Atualidade — último contrato nos últimos 365 dias
  const ultimoMs = contratos.reduce((max, c) => {
    const t = new Date(c.dataAssinatura).getTime();
    return Number.isFinite(t) && t > max ? t : max;
  }, 0);
  const diasDesdeUltimo = ultimoMs > 0 ? (Date.now() - ultimoMs) / 86_400_000 : 9999;
  const atualidade = diasDesdeUltimo <= 365 ? 1 : diasDesdeUltimo <= 730 ? 0.5 : 0.1;

  const componentes: ComponenteITI[] = [
    {
      chave: "completude",
      label: "Descrição dos objetos",
      valor: completude,
      peso: 0.25,
      detalhe: `${esp} de ${amostra} contratos têm objeto específico (descrição > 30 caracteres e sem termo genérico).`,
    },
    {
      chave: "competitividade",
      label: "Competitividade do certame",
      valor: competitividade,
      peso: 0.25,
      detalhe: `${competitivos} de ${amostra} foram firmados por pregão ou concorrência (modalidades competitivas).`,
    },
    {
      chave: "diversidade",
      label: "Diversidade de fornecedores",
      valor: diversidade,
      peso: 0.2,
      detalhe: `${porForn.size} fornecedores únicos. Quanto mais distribuído o gasto, maior este eixo.`,
    },
    {
      chave: "volume",
      label: "Volume de cobertura",
      valor: volume,
      peso: 0.15,
      detalhe: `${amostra} contratos carregados. Volume baixo limita a representatividade do índice.`,
    },
    {
      chave: "atualidade",
      label: "Atualidade da publicação",
      valor: atualidade,
      peso: 0.15,
      detalhe:
        diasDesdeUltimo > 9000
          ? "Sem data de assinatura válida nos contratos carregados."
          : `Último contrato firmado há ${Math.round(diasDesdeUltimo)} dias.`,
    },
  ];

  const nota = Math.round(componentes.reduce((s, c) => s + c.valor * c.peso, 0) * 100);

  return { nota, faixa: faixaDe(nota, amostra), componentes, amostra };
}

/** Faixa de cor (token semântico) para a nota. */
export function corDaFaixa(faixa: NotaTransparencia["faixa"]): string {
  switch (faixa) {
    case "alta":
      return "text-emerald-400";
    case "media":
      return "text-amber-400";
    case "baixa":
      return "text-rose-400";
    default:
      return "text-muted-foreground";
  }
}

export function rotuloDaFaixa(faixa: NotaTransparencia["faixa"]): string {
  switch (faixa) {
    case "alta":
      return "Transparência alta";
    case "media":
      return "Transparência média";
    case "baixa":
      return "Transparência baixa";
    default:
      return "Amostra insuficiente";
  }
}
