/**
 * Leitura do CSV da origem (SICONV/Transferegov) — helpers PUROS.
 *
 * O arquivo `siconv_convenio.csv` vem com BOM, separador `;`, datas
 * DD/MM/YYYY e números em formato misto: "98191,86" (decimal com vírgula,
 * pontos de milhar) convive com "688.44" (decimal com ponto) no MESMO
 * arquivo. Cada parser aqui existe porque um formato desses já produziu
 * valor errado em alguma fonte do projeto — e por isso todos têm teste.
 */

/** Divide uma linha por `;`, respeitando aspas duplas (defensivo). */
export function dividirLinhaCsv(linha: string): string[] {
  if (!linha.includes('"')) return linha.split(";");
  const out: string[] = [];
  let atual = "";
  let dentro = false;
  for (let i = 0; i < linha.length; i++) {
    const ch = linha[i];
    if (ch === '"') {
      if (dentro && linha[i + 1] === '"') {
        atual += '"';
        i++;
      } else dentro = !dentro;
    } else if (ch === ";" && !dentro) {
      out.push(atual);
      atual = "";
    } else atual += ch;
  }
  out.push(atual);
  return out;
}

/** "17/09/2021" → "2021-09-17"; vazio/inesperado → null. */
export function parseDataBR(v: string | undefined): string | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec((v ?? "").trim());
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

/**
 * Número no formato misto do arquivo: com vírgula, ela é o decimal e pontos
 * são milhar ("1.234,56"); sem vírgula, ponto é decimal ("688.44").
 */
export function parseValorBR(v: string | undefined): number | null {
  const s = (v ?? "").trim();
  if (!s) return null;
  const n = s.includes(",") ? Number(s.replace(/\./g, "").replace(",", ".")) : Number(s);
  return Number.isFinite(n) ? n : null;
}

/** O que a origem sabe de um convênio e o espelho da CGU não traz. */
export type RegistroOrigem = {
  codigo_siconv: string;
  situacao_origem: string | null;
  data_assinatura: string | null;
  valor_empenhado: number | null;
  valor_desembolsado: number | null;
};

/** Índices das colunas usadas, resolvidos pelo cabeçalho (à prova de reordenação). */
export type ColunasOrigem = {
  nr: number;
  sit: number;
  assin: number;
  empenhado: number;
  desembolsado: number;
};

export function resolverColunas(cabecalho: string): ColunasOrigem | null {
  // BOM na frente do primeiro nome — remover antes de indexar.
  const nomes = dividirLinhaCsv(cabecalho.replace(/^\uFEFF/, "")).map((n) => n.trim());
  const idx = (nome: string) => nomes.indexOf(nome);
  const cols = {
    nr: idx("NR_CONVENIO"),
    sit: idx("SIT_CONVENIO"),
    assin: idx("DIA_ASSIN_CONV"),
    empenhado: idx("VL_EMPENHADO_CONV"),
    desembolsado: idx("VL_DESEMBOLSADO_CONV"),
  };
  // Sem o número do convênio não há chave; as demais podem faltar.
  return cols.nr >= 0 ? cols : null;
}

export function mapearLinhaOrigem(linha: string, cols: ColunasOrigem): RegistroOrigem | null {
  const c = dividirLinhaCsv(linha);
  const codigo = (c[cols.nr] ?? "").trim();
  if (!/^\d{5,7}$/.test(codigo)) return null;
  return {
    codigo_siconv: codigo,
    situacao_origem: (c[cols.sit] ?? "").trim() || null,
    data_assinatura: parseDataBR(c[cols.assin]),
    valor_empenhado: parseValorBR(c[cols.empenhado]),
    valor_desembolsado: parseValorBR(c[cols.desembolsado]),
  };
}
