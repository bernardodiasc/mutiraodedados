import {
  TSE_ANOS_ELEICAO,
  TSE_UFS,
  combinacaoValida,
  anoInicioTipo,
  origemDisponivel,
  type TseTipoArquivo,
} from "@/lib/data/tse/client-ckan";

export const TIPOS_TSE: Array<{ id: TseTipoArquivo; label: string; nota: string }> = [
  { id: "candidatos", label: "Candidatos", nota: "Catálogo eleitoral — importe primeiro." },
  { id: "bens", label: "Bens de candidatos", nota: "Também agrega o total declarado na ficha." },
  {
    id: "resultados",
    label: "Resultados (votação)",
    nota: "Votos por município (zonas agregadas).",
  },
  {
    id: "receitas",
    label: "Receitas de campanha",
    nota: "Arquivos grandes — rode com auto-continuar.",
  },
  { id: "despesas", label: "Despesas de campanha", nota: "Despesas contratadas pelos candidatos." },
];

export const ANOS_TSE = [...TSE_ANOS_ELEICAO].sort((a, b) => b - a);
export const UFS_TSE = [...TSE_UFS];

export type JobTse = { tipo: TseTipoArquivo; ano: number; uf: string };

/**
 * Por que esta combinação não pode ser importada agora — ou `null` se pode.
 *
 * Numa eleição em curso o TSE publica os arquivos em etapas. Sem este aviso o
 * botão "Importar" ficaria ativo e a rodada terminaria em 404 sem explicação.
 */
export function motivoIndisponivel(tipo: TseTipoArquivo, ano: number): string | null {
  if (origemDisponivel(tipo, ano)) return null;
  const rotulo = rotuloTipo(tipo).toLowerCase();
  // Borda de baixo: o TSE nunca publicou esse tipo tão atrás. Diferente de
  // "ainda não saiu" — aqui esperar não resolve.
  const inicio = anoInicioTipo(tipo);
  if (ano < inicio) {
    return `O TSE só publica ${rotulo} a partir de ${inicio}; em ${ano} esse arquivo não existe.`;
  }
  if (tipo === "resultados") {
    return `A votação de ${ano} só é publicada depois da apuração — o arquivo existe no CDN, mas ainda vem só com o cabeçalho.`;
  }
  return `A prestação de contas de ${ano} ainda não foi publicada pelo TSE (o arquivo de ${rotulo} responde 404).`;
}

/** Expande a seleção do formulário em jobs (1 job = 1 arquivo ano×UF). */
export function montarJobsTse(sel: { tipo: TseTipoArquivo; ano: number; uf: string }): JobTse[] {
  const ufs = sel.uf === "TODAS" ? UFS_TSE : [sel.uf];
  return ufs
    .filter((uf) => combinacaoValida(sel.tipo, sel.ano, uf))
    .map((uf) => ({ tipo: sel.tipo, ano: sel.ano, uf }));
}

export type ProgressoLinha = {
  chave: string;
  linhas: number;
  importados: number;
  completa: boolean;
  atualizadoEm: string;
};

export type ProgressoResumo = {
  tipo: TseTipoArquivo;
  ano: number;
  ufsCompletas: number;
  ufsIniciadas: number;
  importados: number;
  pendentes: string[]; // UFs iniciadas e não completas
};

/** Agrupa as linhas de tse_varredura (chave `tipo#ano#uf`) por (tipo, ano). */
export function resumirProgresso(linhas: ProgressoLinha[]): ProgressoResumo[] {
  const grupos = new Map<string, ProgressoResumo>();
  for (const l of linhas) {
    const [tipo, anoStr, uf] = l.chave.split("#");
    const ano = Number(anoStr);
    if (!tipo || !ano || !uf) continue;
    const k = `${tipo}#${ano}`;
    const g =
      grupos.get(k) ??
      ({
        tipo: tipo as TseTipoArquivo,
        ano,
        ufsCompletas: 0,
        ufsIniciadas: 0,
        importados: 0,
        pendentes: [],
      } satisfies ProgressoResumo);
    g.ufsIniciadas++;
    g.importados += l.importados;
    if (l.completa) g.ufsCompletas++;
    else g.pendentes.push(uf);
    grupos.set(k, g);
  }
  return [...grupos.values()].sort((a, b) => b.ano - a.ano || a.tipo.localeCompare(b.tipo));
}

export function rotuloTipo(tipo: TseTipoArquivo): string {
  return TIPOS_TSE.find((t) => t.id === tipo)?.label ?? tipo;
}
