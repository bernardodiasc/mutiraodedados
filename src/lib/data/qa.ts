/**
 * Regras heurísticas de qualidade por fonte, executadas na ingestão.
 * Idempotente: upsert por (fonte, entidade_id, regra). Findings já
 * resolvidos/falsos positivos NÃO são reabertos.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { AnomaliaSeveridade } from "@/lib/anomalia";

export type QaFonte =
  | "cgu"
  | "pncp"
  | "camara_ceap"
  | "senado_ceaps"
  | "transferegov"
  | "siconfi";

export type QaFinding = {
  fonte: QaFonte;
  entidade_tipo: string;
  entidade_id: string;
  regra: string;
  severidade: AnomaliaSeveridade;
  valor_armazenado?: number | null;
  valor_esperado?: number | null;
  detalhes?: Record<string, unknown>;
  /** Default: 'heuristica'. Use 'auto_correcao' quando o ingest auto-corrigir. */
  origem?: string;
  /** Default: 'aberto'. Use 'corrigido_origem' p/ findings já resolvidos no ingest. */
  status?: string;
};

// -------------------------------------------------------------
// Heurísticas por fonte. Cada uma recebe os registros já normalizados
// (mesma forma que vai pro upsert) e devolve findings detectados.
// -------------------------------------------------------------

export type CguContratoLike = {
  id: string;
  valor?: number | null;
  valor_inicial?: number | null;
  orgao_cod?: string | null;
};

export function regrasCgu(rows: CguContratoLike[]): QaFinding[] {
  const out: QaFinding[] = [];
  for (const r of rows) {
    const final = Number(r.valor ?? 0);
    const inicial = Number(r.valor_inicial ?? 0);
    // Valor final menor que o inicial é comum (aditivos, rescisões parciais,
    // execução parcial). Só sinaliza quando a diferença é absurda — inicial
    // pelo menos 1000× maior que o final — o que normalmente indica erro de
    // escala/digitação em um dos campos e merece investigação.
    if (inicial > 0 && final > 0 && inicial >= final * 1000) {
      out.push({
        fonte: "cgu",
        entidade_tipo: "contrato",
        entidade_id: r.id,
        regra: "discrepancia_extrema_inicial_final",
        severidade: "critico",
        valor_armazenado: inicial,
        valor_esperado: final,
        detalhes: {
          valor_inicial: inicial,
          valor_final: final,
          razao_inicial_final: inicial / final,
          orgao_cod: r.orgao_cod,
        },
      });
      continue;
    }
    if (final > 0 && final < 100 && inicial > 1000) {
      out.push({
        fonte: "cgu",
        entidade_tipo: "contrato",
        entidade_id: r.id,
        regra: "valor_final_truncado_suspeito",
        severidade: "aviso",
        valor_armazenado: final,
        detalhes: { valor_inicial: inicial, orgao_cod: r.orgao_cod },
      });
      continue;
    }
    // Regra autônoma: valor muito baixo (independe de valor_inicial, que
    // pode não estar disponível para registros antigos). Revalidação via
    // endpoint de detalhe confirma ou descarta como falso positivo.
    if (final > 0 && final < 100) {
      out.push({
        fonte: "cgu",
        entidade_tipo: "contrato",
        entidade_id: r.id,
        regra: "valor_muito_baixo",
        severidade: "aviso",
        valor_armazenado: final,
        detalhes: { orgao_cod: r.orgao_cod, limite: 100 },
      });
    }
  }
  return out;
}

export type PncpContratoLike = {
  id: string;
  valor_global?: number | null;
  valor_inicial?: number | null;
};

export function regrasPncp(rows: PncpContratoLike[]): QaFinding[] {
  const out: QaFinding[] = [];
  for (const r of rows) {
    const global = Number(r.valor_global ?? 0);
    const inicial = Number(r.valor_inicial ?? 0);
    if (inicial > 0 && global > 0 && global < inicial * 0.5) {
      out.push({
        fonte: "pncp",
        entidade_tipo: "contrato",
        entidade_id: r.id,
        regra: "valor_global_menor_inicial",
        severidade: "critico",
        valor_armazenado: global,
        detalhes: { valor_inicial: inicial },
      });
      continue;
    }
    if (global === 0 && inicial > 0) {
      out.push({
        fonte: "pncp",
        entidade_tipo: "contrato",
        entidade_id: r.id,
        regra: "valor_global_zerado",
        severidade: "aviso",
        valor_armazenado: global,
        detalhes: { valor_inicial: inicial },
      });
    }
  }
  return out;
}

export type CamaraDespesaLike = {
  id: string;
  valor_liquido?: number | null;
  valor_documento?: number | null;
  deputado_id?: number | null;
};

export function regrasCamaraCeap(rows: CamaraDespesaLike[]): QaFinding[] {
  const out: QaFinding[] = [];
  for (const r of rows) {
    const liq = Number(r.valor_liquido ?? 0);
    const doc = Number(r.valor_documento ?? 0);
    if (doc > 0 && liq > doc * 1.01) {
      out.push({
        fonte: "camara_ceap",
        entidade_tipo: "despesa",
        entidade_id: r.id,
        regra: "liquido_maior_documento",
        severidade: "critico",
        valor_armazenado: liq,
        valor_esperado: doc,
        detalhes: { deputado_id: r.deputado_id },
      });
    }
  }
  return out;
}

export type SenadoDespesaLike = {
  id: string;
  valor_reembolsado?: number | null;
  senador_id?: number | null;
};

export function regrasSenadoCeaps(rows: SenadoDespesaLike[]): QaFinding[] {
  const out: QaFinding[] = [];
  for (const r of rows) {
    const v = Number(r.valor_reembolsado ?? 0);
    if (v < 0) {
      out.push({
        fonte: "senado_ceaps",
        entidade_tipo: "despesa",
        entidade_id: r.id,
        regra: "valor_negativo",
        severidade: "aviso",
        valor_armazenado: v,
        detalhes: { senador_id: r.senador_id },
      });
    }
  }
  return out;
}

export type TransferegovLike = {
  id: string;
  valor_repasse?: number | null;
  valor_global?: number | null;
};

export function regrasTransferegov(rows: TransferegovLike[]): QaFinding[] {
  const out: QaFinding[] = [];
  for (const r of rows) {
    const rep = Number(r.valor_repasse ?? 0);
    const glob = Number(r.valor_global ?? 0);
    if (glob > 0 && rep > glob * 1.01) {
      out.push({
        fonte: "transferegov",
        entidade_tipo: "instrumento",
        entidade_id: r.id,
        regra: "repasse_maior_global",
        severidade: "critico",
        valor_armazenado: rep,
        valor_esperado: glob,
      });
      continue;
    }
    // Convênios/instrumentos com valor global ínfimo (< R$ 100, mas > 0)
    // costumam ser efeito colateral de parser que leu pontuação BR como
    // separador decimal (ex.: "1.234" virou 1.234). Marca pra revisão.
    if (glob > 0 && glob < 100) {
      out.push({
        fonte: "transferegov",
        entidade_tipo: "instrumento",
        entidade_id: r.id,
        regra: "valor_truncado_suspeito",
        severidade: "aviso",
        valor_armazenado: glob,
        detalhes: { limite: 100, valor_repasse: rep },
      });
    }
  }
  return out;
}

export type TransferegovEmendaLike = {
  id: string;
  valor?: number | null;
  valor_pago?: number | null;
  modalidade?: string | null;
};

export function regrasTransferegovEmendas(
  rows: TransferegovEmendaLike[],
): QaFinding[] {
  const out: QaFinding[] = [];
  for (const r of rows) {
    const v = Number(r.valor ?? 0);
    const pago = Number(r.valor_pago ?? 0);
    // Pago não pode ser maior que empenhado/disponibilizado (margem 1%).
    if (v > 0 && pago > v * 1.01) {
      out.push({
        fonte: "transferegov",
        entidade_tipo: "emenda",
        entidade_id: r.id,
        regra: "pago_maior_empenhado",
        severidade: "critico",
        valor_armazenado: pago,
        valor_esperado: v,
        detalhes: { modalidade: r.modalidade },
      });
      continue;
    }
    // Emendas com valor < R$ 100 são extremamente improváveis — costuma ser
    // efeito de parser confundindo separador BR ("1.234" lido como 1.234).
    if (v > 0 && v < 100) {
      out.push({
        fonte: "transferegov",
        entidade_tipo: "emenda",
        entidade_id: r.id,
        regra: "valor_truncado_suspeito",
        severidade: "aviso",
        valor_armazenado: v,
        detalhes: { limite: 100, modalidade: r.modalidade, valor_pago: pago },
      });
    }
  }
  return out;
}

export type SiconfiLike = {
  id: string;
  valor?: number | null;
  conta?: string | null;
  tipo_relatorio?: string | null;
};

export function regrasSiconfi(rows: SiconfiLike[]): QaFinding[] {
  const out: QaFinding[] = [];
  for (const r of rows) {
    const v = Number(r.valor ?? 0);
    const conta = (r.conta ?? "").toLowerCase();
    // contas de receita/transferência não devem ser negativas
    if (v < 0 && (conta.includes("receita") || conta.includes("transfer"))) {
      out.push({
        fonte: "siconfi",
        entidade_tipo: "linha_relatorio",
        entidade_id: r.id,
        regra: "valor_negativo_em_conta_positiva",
        severidade: "aviso",
        valor_armazenado: v,
        detalhes: { conta: r.conta, tipo_relatorio: r.tipo_relatorio },
      });
    }
  }
  return out;
}

// -------------------------------------------------------------
// Persistência: upsert idempotente. Não reabre findings resolvidos.
// -------------------------------------------------------------

export async function flagQA(findings: QaFinding[]): Promise<number> {
  if (findings.length === 0) return 0;

  // Buscar findings existentes para essas chaves
  const keys = findings.map((f) => ({
    fonte: f.fonte,
    entidade_id: f.entidade_id,
    regra: f.regra,
  }));

  // Postgres não tem upsert por tupla composta direto via supabase-js, então
  // usamos uma estratégia simples: SELECT em lote + INSERT só dos novos.
  const orFilter = keys
    .map(
      (k) =>
        `and(fonte.eq.${k.fonte},entidade_id.eq.${k.entidade_id},regra.eq.${k.regra})`,
    )
    .join(",");

  // Quando o filtro fica gigante, processamos em lotes.
  const LOTE = 50;
  let inseridos = 0;
  for (let i = 0; i < findings.length; i += LOTE) {
    const slice = findings.slice(i, i + LOTE);
    const filtroLote = slice
      .map(
        (k) =>
          `and(fonte.eq.${k.fonte},entidade_id.eq.${k.entidade_id},regra.eq.${k.regra})`,
      )
      .join(",");
    const { data: existentes } = await supabaseAdmin
      .from("qa_findings")
      .select("fonte,entidade_id,regra,status")
      .or(filtroLote);
    const existSet = new Set(
      (existentes ?? []).map(
        (e) => `${e.fonte}|${e.entidade_id}|${e.regra}`,
      ),
    );
    const novos = slice.filter(
      (f) => !existSet.has(`${f.fonte}|${f.entidade_id}|${f.regra}`),
    );
    if (novos.length > 0) {
      const { error } = await supabaseAdmin.from("qa_findings").insert(
        novos.map((f) => ({
          fonte: f.fonte,
          entidade_tipo: f.entidade_tipo,
          entidade_id: f.entidade_id,
          regra: f.regra,
          severidade: f.severidade,
          origem: f.origem ?? "heuristica",
          valor_armazenado: f.valor_armazenado ?? null,
          valor_esperado: f.valor_esperado ?? null,
          detalhes: (f.detalhes ?? {}) as never,
          status: f.status ?? "aberto",
          resolvido_em: f.status === "corrigido_origem" ? new Date().toISOString() : null,
        })),
      );
      if (!error) inseridos += novos.length;
    }
  }
  void orFilter;
  return inseridos;
}