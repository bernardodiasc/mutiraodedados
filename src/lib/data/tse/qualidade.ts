/**
 * Alertas de QUALIDADE da fonte TSE — defeitos técnicos do dado ou da
 * importação, detectados inspecionando o próprio registro/lote durante o
 * ingest (taxonomia em docs/qualidade-dados.md; tipo='qualidade').
 *
 * Lacunas ficam em lacunas.ts (pós-importação) e cruzamentos em
 * investigativos.ts — NUNCA aqui.
 */
import type { QaFinding } from "@/lib/data/qa";
import type { TseTipoArquivo } from "@/lib/data/tse/client-ckan";
import type {
  TseBemRow,
  TseCandidatoRow,
  TseDespesaRow,
  TseReceitaRow,
  TseResultadoRow,
} from "@/lib/data/tse/parsers";

// ---------------------------------------------------------------------------
// Dígito verificador de CPF/CNPJ
// ---------------------------------------------------------------------------

export function validarCpf(cpf: string): boolean {
  if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) return false;
  const dv = (base: string, pesoIni: number) => {
    let soma = 0;
    for (let i = 0; i < base.length; i++) soma += Number(base[i]) * (pesoIni - i);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  return dv(cpf.slice(0, 9), 10) === Number(cpf[9]) && dv(cpf.slice(0, 10), 11) === Number(cpf[10]);
}

export function validarCnpj(cnpj: string): boolean {
  if (!/^\d{14}$/.test(cnpj) || /^(\d)\1{13}$/.test(cnpj)) return false;
  const dv = (base: string) => {
    const pesos =
      base.length === 12
        ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
        : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    let soma = 0;
    for (let i = 0; i < base.length; i++) soma += Number(base[i]) * pesos[i];
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };
  return dv(cnpj.slice(0, 12)) === Number(cnpj[12]) && dv(cnpj.slice(0, 13)) === Number(cnpj[13]);
}

/** Documento não mascarado com tamanho de CPF/CNPJ e DV inválido. */
function documentoInvalido(doc: string | null | undefined): boolean {
  if (!doc || doc.includes("*")) return false; // mascarado na origem: não valida
  if (/^\d{11}$/.test(doc)) return !validarCpf(doc);
  if (/^\d{14}$/.test(doc)) return !validarCnpj(doc);
  return false; // outros tamanhos são tratados como ausentes, não inválidos
}

// ---------------------------------------------------------------------------
// Regras por lote
// ---------------------------------------------------------------------------

const RX_SENTINELA = /#NULO|#NE\b|N[AÃ]O DIVULG/i;

function camposTexto(row: Record<string, unknown>): string[] {
  return Object.values(row).filter((v): v is string => typeof v === "string");
}

type RowTse = TseCandidatoRow | TseBemRow | TseReceitaRow | TseDespesaRow | TseResultadoRow;

function idDe(tipo: TseTipoArquivo, row: RowTse): string {
  if ("id" in row) return row.id;
  if ("ordem_bem" in row) return `${row.sq_candidato}-${row.ano_eleicao}-${row.ordem_bem}`;
  if ("municipio_cod" in row && "votos_nominais" in row) {
    return `${row.sq_candidato}-${row.ano_eleicao}-${row.nr_turno}-${row.municipio_cod}`;
  }
  return `${row.sq_candidato}-${row.ano_eleicao}`;
}

const ENTIDADE_POR_TIPO: Record<TseTipoArquivo, string> = {
  candidatos: "candidato",
  bens: "bem",
  receitas: "receita",
  despesas: "despesa",
  resultados: "resultado",
};

/**
 * Roda sobre um lote já normalizado (mesma forma do upsert). Devolve findings
 * tipo='qualidade' — defeitos do dado em si.
 */
export function regrasQualidadeTse(
  tipo: TseTipoArquivo,
  rows: RowTse[],
  anoArquivo: number,
): QaFinding[] {
  const out: QaFinding[] = [];
  const entidade = ENTIDADE_POR_TIPO[tipo];
  const idsVistos = new Set<string>();

  const push = (
    row: RowTse,
    regra: string,
    severidade: "critico" | "aviso" | "info",
    detalhes: Record<string, unknown>,
  ) => {
    out.push({
      fonte: "tse",
      entidade_tipo: entidade,
      entidade_id: idDe(tipo, row),
      regra,
      tipo: "qualidade",
      severidade,
      detalhes: { ano_eleicao: anoArquivo, ...detalhes },
    });
  };

  for (const row of rows) {
    const id = idDe(tipo, row);

    // duplicata_importacao — colisão de chave dentro do mesmo lote.
    if (idsVistos.has(id)) {
      push(row, "duplicata_importacao", "aviso", { id });
    }
    idsVistos.add(id);

    // encoding_suspeito — caractere de substituição após decodificar Latin-1.
    if (camposTexto(row as never).some((s) => s.includes("�"))) {
      push(row, "encoding_suspeito", "info", {});
    }

    // sentinela_nao_tratada — sentinela vazando para campo normalizado.
    const vazada = camposTexto(row as never).find((s) => RX_SENTINELA.test(s));
    if (vazada) {
      push(row, "sentinela_nao_tratada", "aviso", { valor: vazada.slice(0, 60) });
    }

    // valor_invalido — negativo em doação/despesa/bem (impossível).
    if ("valor" in row && row.valor != null && row.valor < 0) {
      push(row, "valor_invalido", "critico", { valor: row.valor });
    }

    // data_impossivel + cpf_cnpj_invalido por tipo
    if (tipo === "receitas") {
      const r = row as TseReceitaRow;
      if (r.data) {
        const anoData = Number(r.data.slice(0, 4));
        if (anoData < anoArquivo - 1 || anoData > anoArquivo + 1) {
          push(row, "data_impossivel", "aviso", { data: r.data });
        }
      }
      if (documentoInvalido(r.cpf_cnpj_doador)) {
        push(row, "cpf_cnpj_invalido", "aviso", { documento: r.cpf_cnpj_doador });
      }
    } else if (tipo === "despesas") {
      const d = row as TseDespesaRow;
      if (d.data) {
        const anoData = Number(d.data.slice(0, 4));
        if (anoData < anoArquivo - 1 || anoData > anoArquivo + 1) {
          push(row, "data_impossivel", "aviso", { data: d.data });
        }
      }
      if (documentoInvalido(d.cnpj_fornecedor)) {
        push(row, "cpf_cnpj_invalido", "aviso", { documento: d.cnpj_fornecedor });
      }
    } else if (tipo === "candidatos") {
      const c = row as TseCandidatoRow;
      if (documentoInvalido(c.cpf)) {
        push(row, "cpf_cnpj_invalido", "aviso", { documento: c.cpf });
      }
    }
  }
  return out;
}
