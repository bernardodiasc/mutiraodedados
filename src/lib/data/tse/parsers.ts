/**
 * Normalização dos CSVs do TSE (2014→2024) — puro, sem I/O.
 *
 * Fatos confirmados por inspeção ao vivo dos zips (2026-07-06; ver
 * docs/fontes/tse.ia.md): o TSE republicou 2014–2024 no layout moderno
 * (colunas SQ_/NR_/DS_), EXCETO receitas/despesas de 2014/2016, que seguem no
 * layout legado com cabeçalhos humanos ("CPF/CNPJ do doador"). Por isso o
 * parser é dirigido pelo CABEÇALHO (com aliases por variação), nunca por
 * posição fixa.
 *
 * Latin-1 e separador `;` são tratados na camada de streaming (ckan/client).
 */

// ---------------------------------------------------------------------------
// Primitivos: sentinelas, valores, datas
// ---------------------------------------------------------------------------

/** Sentinelas do TSE que significam "não informado"/"não se aplica". */
const SENTINELAS = new Set([
  "#NULO#",
  "#NULO",
  "#NE#",
  "#NE",
  "-1",
  "-3",
  "-4",
  "NÃO DIVULGÁVEL",
  "NAO DIVULGAVEL",
]);

/** "" quando o campo é sentinela; senão o valor com espaços aparados. */
export function limparSentinela(v: string | undefined | null): string {
  const s = (v ?? "").trim();
  if (!s || SENTINELAS.has(s.toUpperCase())) return "";
  return s;
}

/** Valor monetário TSE: "1500,00" → 1500; "162" → 162; sentinela/inválido → null. */
export function parseValorTse(v: string | undefined | null): number | null {
  const s = limparSentinela(v);
  if (!s) return null;
  const n = Number(s.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

/**
 * Data TSE → ISO. Formatos reais: "05/10/2014", "10/10/201400:00:00" (2014,
 * sem espaço antes da hora), "16/08/2018". Inválida/sentinela → null.
 */
export function parseDataTse(v: string | undefined | null): string | null {
  const s = limparSentinela(v);
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (!m) return null;
  const [, d, mo, y] = m;
  const dia = Number(d);
  const mes = Number(mo);
  if (dia < 1 || dia > 31 || mes < 1 || mes > 12) return null;
  return `${y}-${mo}-${d}`;
}

export function parseIntTse(v: string | undefined | null): number | null {
  const s = limparSentinela(v);
  if (!s || !/^-?\d+$/.test(s)) return null;
  return Number(s);
}

/** Só dígitos de um CPF/CNPJ (mantém máscara *** de CPF de doador PF). */
export function normalizarCpfCnpj(v: string | undefined | null): string {
  const s = limparSentinela(v);
  if (!s) return "";
  // CPF de doador PF vem mascarado da origem ("***.123.456-**") — preserva.
  if (s.includes("*")) return s;
  return s.replace(/\D/g, "");
}

/** Hash FNV-1a 64 bits (hex) — id determinístico p/ receitas/despesas 2014/2016. */
export function hashDedup(partes: Array<string | number | null | undefined>): string {
  const texto = partes.map((p) => String(p ?? "")).join("|");
  let h1 = 0x811c9dc5;
  let h2 = 0xcbf29ce4;
  for (let i = 0; i < texto.length; i++) {
    const c = texto.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ ((c << 1) | 1), 0x01000193) >>> 0;
  }
  return h1.toString(16).padStart(8, "0") + h2.toString(16).padStart(8, "0");
}

// ---------------------------------------------------------------------------
// Cabeçalho: normalização + índice com aliases
// ---------------------------------------------------------------------------

/** "Sigla  Partido" → "SIGLA_PARTIDO"; "CPF/CNPJ do doador" → "CPF_CNPJ_DO_DOADOR". */
export function normalizarChaveCabecalho(nome: string): string {
  return nome
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

export class IndiceCabecalho {
  private idx = new Map<string, number>();

  constructor(cabecalho: string[]) {
    cabecalho.forEach((nome, i) => {
      const k = normalizarChaveCabecalho(nome);
      if (!this.idx.has(k)) this.idx.set(k, i);
    });
  }

  /** Valor bruto do primeiro alias presente na linha ("" se nenhum). */
  get(campos: string[], ...aliases: string[]): string {
    for (const a of aliases) {
      const i = this.idx.get(a);
      if (i !== undefined) return campos[i] ?? "";
    }
    return "";
  }

  tem(...aliases: string[]): boolean {
    return aliases.some((a) => this.idx.has(a));
  }
}

// ---------------------------------------------------------------------------
// Linhas normalizadas (mesma forma do upsert nos caches)
// ---------------------------------------------------------------------------

export type TseCandidatoRow = {
  sq_candidato: string;
  ano_eleicao: number;
  nr_turno: number;
  cargo_cod: number | null;
  cargo_nome: string | null;
  uf: string | null;
  municipio_cod: string | null;
  nome_completo: string | null;
  nome_urna: string | null;
  cpf: string | null;
  titulo_eleitoral: string | null;
  partido_sigla: string | null;
  partido_numero: number | null;
  numero_candidato: string | null;
  situacao_candidatura: string | null;
  situacao_totalizacao: string | null;
  ocupacao: string | null;
  grau_instrucao: string | null;
  genero: string | null;
  cor_raca: string | null;
};

export type TseBemRow = {
  sq_candidato: string;
  ano_eleicao: number;
  ordem_bem: number;
  tipo_bem: string | null;
  descricao: string | null;
  valor: number | null;
};

export type TseResultadoRow = {
  sq_candidato: string;
  ano_eleicao: number;
  nr_turno: number;
  uf: string;
  municipio_cod: string;
  municipio_nome: string | null;
  votos_nominais: number;
  votos_nominais_validos: number;
  situacao_totalizacao: string | null;
};

export type TseReceitaRow = {
  id: string;
  sq_candidato: string;
  ano_eleicao: number;
  cpf_cnpj_doador: string | null;
  nome_doador: string | null;
  tipo_doador: string | null;
  cnpj_doador_originario: string | null;
  valor: number | null;
  data: string | null;
  tipo_receita: string | null;
  forma_recebimento: string | null;
  uf: string | null;
};

export type TseDespesaRow = {
  id: string;
  sq_candidato: string;
  ano_eleicao: number;
  cnpj_fornecedor: string | null;
  nome_fornecedor: string | null;
  valor: number | null;
  data: string | null;
  tipo_despesa: string | null;
  descricao: string | null;
  uf: string | null;
};

// ---------------------------------------------------------------------------
// Mappers (header-driven)
// ---------------------------------------------------------------------------

const vazioNull = (s: string): string | null => (s === "" ? null : s);

export function mapearCandidato(idx: IndiceCabecalho, campos: string[]): TseCandidatoRow | null {
  const sq = limparSentinela(idx.get(campos, "SQ_CANDIDATO"));
  const ano = parseIntTse(idx.get(campos, "ANO_ELEICAO"));
  if (!sq || !ano) return null;
  return {
    sq_candidato: sq,
    ano_eleicao: ano,
    nr_turno: parseIntTse(idx.get(campos, "NR_TURNO")) ?? 1,
    cargo_cod: parseIntTse(idx.get(campos, "CD_CARGO")),
    cargo_nome: vazioNull(limparSentinela(idx.get(campos, "DS_CARGO"))),
    uf: vazioNull(limparSentinela(idx.get(campos, "SG_UF"))),
    municipio_cod: vazioNull(limparSentinela(idx.get(campos, "SG_UE"))),
    nome_completo: vazioNull(limparSentinela(idx.get(campos, "NM_CANDIDATO"))),
    nome_urna: vazioNull(limparSentinela(idx.get(campos, "NM_URNA_CANDIDATO"))),
    cpf: vazioNull(normalizarCpfCnpj(idx.get(campos, "NR_CPF_CANDIDATO"))),
    titulo_eleitoral: vazioNull(limparSentinela(idx.get(campos, "NR_TITULO_ELEITORAL_CANDIDATO"))),
    partido_sigla: vazioNull(limparSentinela(idx.get(campos, "SG_PARTIDO"))),
    partido_numero: parseIntTse(idx.get(campos, "NR_PARTIDO")),
    numero_candidato: vazioNull(limparSentinela(idx.get(campos, "NR_CANDIDATO"))),
    situacao_candidatura: vazioNull(limparSentinela(idx.get(campos, "DS_SITUACAO_CANDIDATURA"))),
    situacao_totalizacao: vazioNull(limparSentinela(idx.get(campos, "DS_SIT_TOT_TURNO"))),
    ocupacao: vazioNull(limparSentinela(idx.get(campos, "DS_OCUPACAO"))),
    grau_instrucao: vazioNull(limparSentinela(idx.get(campos, "DS_GRAU_INSTRUCAO"))),
    genero: vazioNull(limparSentinela(idx.get(campos, "DS_GENERO"))),
    cor_raca: vazioNull(limparSentinela(idx.get(campos, "DS_COR_RACA"))),
  };
}

export function mapearBem(idx: IndiceCabecalho, campos: string[]): TseBemRow | null {
  const sq = limparSentinela(idx.get(campos, "SQ_CANDIDATO"));
  const ano = parseIntTse(idx.get(campos, "ANO_ELEICAO"));
  if (!sq || !ano) return null;
  return {
    sq_candidato: sq,
    ano_eleicao: ano,
    // 2016 usa NR_ORDEM_CANDIDATO; demais anos NR_ORDEM_BEM_CANDIDATO.
    ordem_bem: parseIntTse(idx.get(campos, "NR_ORDEM_BEM_CANDIDATO", "NR_ORDEM_CANDIDATO")) ?? 0,
    tipo_bem: vazioNull(limparSentinela(idx.get(campos, "DS_TIPO_BEM_CANDIDATO"))),
    descricao: vazioNull(limparSentinela(idx.get(campos, "DS_BEM_CANDIDATO"))),
    valor: parseValorTse(idx.get(campos, "VR_BEM_CANDIDATO")),
  };
}

export function mapearResultado(idx: IndiceCabecalho, campos: string[]): TseResultadoRow | null {
  const sq = limparSentinela(idx.get(campos, "SQ_CANDIDATO"));
  const ano = parseIntTse(idx.get(campos, "ANO_ELEICAO"));
  const municipio = limparSentinela(idx.get(campos, "CD_MUNICIPIO"));
  const uf = limparSentinela(idx.get(campos, "SG_UF"));
  if (!sq || !ano || !municipio || !uf) return null;
  return {
    sq_candidato: sq,
    ano_eleicao: ano,
    nr_turno: parseIntTse(idx.get(campos, "NR_TURNO")) ?? 1,
    uf,
    municipio_cod: municipio,
    municipio_nome: vazioNull(limparSentinela(idx.get(campos, "NM_MUNICIPIO"))),
    votos_nominais: parseIntTse(idx.get(campos, "QT_VOTOS_NOMINAIS")) ?? 0,
    votos_nominais_validos: parseIntTse(idx.get(campos, "QT_VOTOS_NOMINAIS_VALIDOS")) ?? 0,
    situacao_totalizacao: vazioNull(limparSentinela(idx.get(campos, "DS_SIT_TOT_TURNO"))),
  };
}

/**
 * Classifica o doador para filtros públicos. Regra: origem textual primeiro
 * (partido/próprio/fundo), depois o documento (14 dígitos = PJ; máscara ou 11
 * dígitos = PF).
 */
export function classificarTipoDoador(origem: string, doc: string): string {
  const o = origem.toLowerCase();
  if (o.includes("fundo")) return "fundo";
  if (o.includes("partid")) return "partido";
  if (o.includes("próprio") || o.includes("proprio")) return "proprio";
  const digitos = doc.replace(/\D/g, "");
  if (doc.includes("*") || digitos.length === 11) return "pf";
  if (digitos.length === 14) return "pj";
  return origem ? "outro" : "";
}

/**
 * Receita de campanha — layout moderno (2018+) OU legado (2014/2016),
 * decidido pelo cabeçalho. Moderno tem SQ_RECEITA (id natural); legado usa
 * hash determinístico (sq, ano, data, doador, valor, recibo/documento).
 */
export function mapearReceita(
  idx: IndiceCabecalho,
  campos: string[],
  anoArquivo: number,
): TseReceitaRow | null {
  if (idx.tem("SQ_RECEITA")) {
    const sq = limparSentinela(idx.get(campos, "SQ_CANDIDATO"));
    const ano = parseIntTse(idx.get(campos, "AA_ELEICAO", "ANO_ELEICAO")) ?? anoArquivo;
    const sqReceita = limparSentinela(idx.get(campos, "SQ_RECEITA"));
    if (!sq || !sqReceita) return null;
    const origem = limparSentinela(idx.get(campos, "DS_ORIGEM_RECEITA"));
    const doador = normalizarCpfCnpj(idx.get(campos, "NR_CPF_CNPJ_DOADOR"));
    return {
      id: `${ano}-${sqReceita}`,
      sq_candidato: sq,
      ano_eleicao: ano,
      cpf_cnpj_doador: vazioNull(doador),
      nome_doador: vazioNull(limparSentinela(idx.get(campos, "NM_DOADOR"))),
      tipo_doador: vazioNull(classificarTipoDoador(origem, doador)),
      cnpj_doador_originario: null, // layout moderno não traz doador originário
      valor: parseValorTse(idx.get(campos, "VR_RECEITA")),
      data: parseDataTse(idx.get(campos, "DT_RECEITA")),
      tipo_receita: vazioNull(origem),
      forma_recebimento: vazioNull(limparSentinela(idx.get(campos, "DS_ESPECIE_RECEITA"))),
      uf: vazioNull(limparSentinela(idx.get(campos, "SG_UF"))),
    };
  }
  // Legado 2014/2016
  const sq = limparSentinela(idx.get(campos, "SEQUENCIAL_CANDIDATO"));
  if (!sq) return null;
  const doador = normalizarCpfCnpj(idx.get(campos, "CPF_CNPJ_DO_DOADOR"));
  const valor = parseValorTse(idx.get(campos, "VALOR_RECEITA"));
  const data = parseDataTse(idx.get(campos, "DATA_DA_RECEITA"));
  const recibo = limparSentinela(idx.get(campos, "NUMERO_RECIBO_ELEITORAL"));
  const documento = limparSentinela(idx.get(campos, "NUMERO_DO_DOCUMENTO"));
  const tipo = limparSentinela(idx.get(campos, "TIPO_RECEITA"));
  return {
    id: `${anoArquivo}-${hashDedup([sq, anoArquivo, data, doador, valor, recibo || documento])}`,
    sq_candidato: sq,
    ano_eleicao: anoArquivo,
    cpf_cnpj_doador: vazioNull(doador),
    nome_doador: vazioNull(limparSentinela(idx.get(campos, "NOME_DO_DOADOR"))),
    tipo_doador: vazioNull(classificarTipoDoador(tipo, doador)),
    cnpj_doador_originario: vazioNull(
      normalizarCpfCnpj(idx.get(campos, "CPF_CNPJ_DO_DOADOR_ORIGINARIO")),
    ),
    valor,
    data,
    tipo_receita: vazioNull(tipo),
    forma_recebimento: vazioNull(limparSentinela(idx.get(campos, "ESPECIE_RECURSO"))),
    uf: vazioNull(limparSentinela(idx.get(campos, "UF"))),
  };
}

/** Despesa de campanha — moderno (despesas_contratadas, 2018+) ou legado (2014/2016). */
export function mapearDespesa(
  idx: IndiceCabecalho,
  campos: string[],
  anoArquivo: number,
): TseDespesaRow | null {
  if (idx.tem("SQ_DESPESA")) {
    const sq = limparSentinela(idx.get(campos, "SQ_CANDIDATO"));
    const ano = parseIntTse(idx.get(campos, "AA_ELEICAO", "ANO_ELEICAO")) ?? anoArquivo;
    const sqDespesa = limparSentinela(idx.get(campos, "SQ_DESPESA"));
    if (!sq || !sqDespesa) return null;
    return {
      id: `${ano}-${sqDespesa}`,
      sq_candidato: sq,
      ano_eleicao: ano,
      cnpj_fornecedor: vazioNull(normalizarCpfCnpj(idx.get(campos, "NR_CPF_CNPJ_FORNECEDOR"))),
      nome_fornecedor: vazioNull(limparSentinela(idx.get(campos, "NM_FORNECEDOR"))),
      valor: parseValorTse(idx.get(campos, "VR_DESPESA_CONTRATADA")),
      data: parseDataTse(idx.get(campos, "DT_DESPESA")),
      tipo_despesa: vazioNull(limparSentinela(idx.get(campos, "DS_ORIGEM_DESPESA"))),
      descricao: vazioNull(limparSentinela(idx.get(campos, "DS_DESPESA"))),
      uf: vazioNull(limparSentinela(idx.get(campos, "SG_UF"))),
    };
  }
  const sq = limparSentinela(idx.get(campos, "SEQUENCIAL_CANDIDATO"));
  if (!sq) return null;
  const fornecedor = normalizarCpfCnpj(idx.get(campos, "CPF_CNPJ_DO_FORNECEDOR"));
  const valor = parseValorTse(idx.get(campos, "VALOR_DESPESA"));
  const data = parseDataTse(idx.get(campos, "DATA_DA_DESPESA"));
  const documento = limparSentinela(idx.get(campos, "NUMERO_DO_DOCUMENTO"));
  return {
    id: `${anoArquivo}-${hashDedup([sq, anoArquivo, data, fornecedor, valor, documento])}`,
    sq_candidato: sq,
    ano_eleicao: anoArquivo,
    cnpj_fornecedor: vazioNull(fornecedor),
    nome_fornecedor: vazioNull(limparSentinela(idx.get(campos, "NOME_DO_FORNECEDOR"))),
    valor,
    data,
    tipo_despesa: vazioNull(limparSentinela(idx.get(campos, "TIPO_DESPESA"))),
    // "Descriçao da despesa" (typo real da origem) normaliza p/ DESCRICAO_DA_DESPESA
    descricao: vazioNull(limparSentinela(idx.get(campos, "DESCRICAO_DA_DESPESA"))),
    uf: vazioNull(limparSentinela(idx.get(campos, "UF"))),
  };
}
