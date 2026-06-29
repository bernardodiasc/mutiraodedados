/**
 * Regras heurísticas de qualidade por fonte, executadas na ingestão.
 * Idempotente: upsert por (fonte, entidade_id, regra). Findings já
 * existentes NÃO são reabertos nem auto-resolvidos pela importação.
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
  /** Default: 'heuristica'. */
  origem?: string;
  /** Default: 'aberto'. */
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

/** CNPJ placeholder para contratos cuja API não informa o fornecedor (sigiloso
 * ou ausente). Não descartamos o contrato — salvamos com este marcador e
 * abrimos um alerta `fornecedor_ausente` para investigação. */
export const CNPJ_FORNECEDOR_AUSENTE = "SIGILOSO";

/**
 * Valor autoritativo do contrato a partir das duas leituras (listagem e
 * detalhe). O bug de escala (÷100/1000/10000) trunca o valor em QUALQUER um dos
 * dois endpoints (confirmado: já vimos tanto a listagem quanto o detalhe virem
 * truncados — ex.: contrato 17/2011 órgão 22000, listagem=5.760.000 correto,
 * detalhe=576 truncado). Quando um lado é um truncamento por escala do outro
 * (razão ≥ 100×), o correto — o que bate com o documento oficial — é o
 * NÃO-truncado (o maior). Senão, confia no detalhe (referência). Garante nunca
 * gravar o valor truncado, independentemente de qual endpoint veio defeituoso.
 * Usado tanto no ingest (varredura) quanto na re-checagem manual, para que a
 * manual nunca re-introduza um valor que a automática corrigiu.
 */
export function valorAutoritativoCgu(
  valorListagem: number,
  valorDetalhe: number,
): { valor: number; truncado: number | null } {
  const l = valorListagem > 0 ? valorListagem : 0;
  const d = valorDetalhe > 0 ? valorDetalhe : 0;
  if (l > 0 && d > 0) {
    const maior = Math.max(l, d);
    const menor = Math.min(l, d);
    if (maior / menor >= 100) return { valor: maior, truncado: menor };
    return { valor: d, truncado: null };
  }
  return { valor: d > 0 ? d : l, truncado: null };
}

/**
 * Alerta `valor_corrigido_listagem`: a varredura confere a LISTAGEM contra o
 * DETALHE (`/contratos/id`) de cada contrato. O bug de escala (÷100/1000/10000)
 * trunca o valor em QUALQUER um dos dois endpoints; gravamos sempre o valor
 * NÃO-truncado (o que bate com o documento oficial). Quando há essa correção,
 * este alerta fica como registro do defeito — já nasce resolvido
 * (`corrigido_automaticamente`). É criado no ingest, NÃO em `regrasCgu`.
 */
export function findingValorCorrigidoListagem(args: {
  id: string;
  orgao_cod?: string | null;
  /** Valor truncado/defeituoso descartado. */
  valor_truncado: number;
  /** Valor correto (não-truncado) gravado no cache. */
  valor_correto: number;
  /** Leituras cruas de cada endpoint (auditoria). */
  valor_listagem?: number | null;
  valor_detalhe?: number | null;
  pagina_varredura?: number | null;
}): QaFinding {
  return {
    fonte: "cgu",
    entidade_tipo: "contrato",
    entidade_id: args.id,
    regra: "valor_corrigido_listagem",
    severidade: "critico",
    // valor_armazenado = valor DEFEITUOSO (truncado); valor_esperado = valor
    // correto, já gravado no cache.
    valor_armazenado: args.valor_truncado,
    valor_esperado: args.valor_correto,
    status: "corrigido_automaticamente",
    detalhes: {
      orgao_cod: args.orgao_cod ?? null,
      pagina_varredura: args.pagina_varredura ?? null,
      valor_truncado: args.valor_truncado,
      valor_correto: args.valor_correto,
      valor_listagem: args.valor_listagem ?? null,
      valor_detalhe: args.valor_detalhe ?? null,
      campos_suspeitos: ["valorFinalCompra"],
      motivo:
        "a fonte (listagem ou detalhe) trouxe o valor truncado por escala; gravamos o valor não-truncado, que bate com o documento oficial",
    },
  };
}

/** Alerta `fornecedor_ausente`: contrato sem CNPJ/CPF do fornecedor (sigiloso
 * ou ausente). Salvamos o contrato (com fornecedor placeholder) e abrimos este
 * alerta para investigação. Criado no ingest. */
export function findingFornecedorAusente(args: {
  id: string;
  orgao_cod?: string | null;
  pagina_varredura?: number | null;
}): QaFinding {
  return {
    fonte: "cgu",
    entidade_tipo: "contrato",
    entidade_id: args.id,
    regra: "fornecedor_ausente",
    severidade: "aviso",
    status: "aberto",
    detalhes: {
      orgao_cod: args.orgao_cod ?? null,
      pagina_varredura: args.pagina_varredura ?? null,
      motivo:
        "a API não informou CNPJ/CPF do fornecedor (sigiloso ou ausente); contrato salvo para investigação",
    },
  };
}

export function regrasCgu(
  rows: CguContratoLike[],
  paginaPorId?: Map<string, number>,
): QaFinding[] {
  const out: QaFinding[] = [];
  for (const r of rows) {
    const final = Number(r.valor ?? 0);
    const inicial = Number(r.valor_inicial ?? 0);
    // Página da varredura onde o contrato apareceu — anexada para a verificação
    // manual (a CGU não é filtrável por data de assinatura; localiza-se por página).
    const pagina_varredura = paginaPorId?.get(r.id) ?? null;
    // NOTA: as regras `valor_precisao_suspeita` (sub-centavo) e
    // `valor_final_truncado_suspeito` foram removidas. Elas eram heurísticas
    // sobre o valor da LISTAGEM para inferir o bug ÷10000. Agora a varredura
    // confere o DETALHE de cada contrato e grava o valor correto no cache —
    // este `regrasCgu` lê o cache pós-upsert, então sempre vê o valor
    // autoritativo. A correção em si vira o alerta `valor_corrigido_listagem`
    // (criado no ingest). As regras abaixo seguem válidas: pegam anomalias
    // reais do próprio valor oficial (ex.: contrato genuinamente < R$100).
    // Discrepância extrema entre inicial e final (≥ 1000×).
    // - inicial ≫ final: redução grande, pode ser LEGÍTIMA (rescisão/aditivo/
    //   execução parcial) → aviso.
    // - final ≫ inicial: o contrato "inflou" 1000× → anômalo/ilegítimo → crítico.
    if (inicial > 0 && final > 0 && (inicial >= final * 1000 || final >= inicial * 1000)) {
      const finalMaior = final > inicial;
      out.push({
        fonte: "cgu",
        entidade_tipo: "contrato",
        entidade_id: r.id,
        regra: "discrepancia_extrema_inicial_final",
        severidade: finalMaior ? "critico" : "aviso",
        valor_armazenado: finalMaior ? final : inicial,
        valor_esperado: finalMaior ? inicial : final,
        detalhes: {
          valor_inicial: inicial,
          valor_final: final,
          razao_inicial_final: inicial / final,
          orgao_cod: r.orgao_cod,
          pagina_varredura,
          campos_suspeitos: ["valorInicialCompra", "valorFinalCompra"],
        },
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
        detalhes: {
          orgao_cod: r.orgao_cod,
          limite: 100,
          pagina_varredura,
          campos_suspeitos: ["valorFinalCompra"],
        },
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
// Persistência: insert idempotente por chave. Não reabre findings resolvidos.
// -------------------------------------------------------------

export async function flagQA(findings: QaFinding[]): Promise<number> {
  if (findings.length === 0) return 0;

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
      .select("id,fonte,entidade_id,regra,status")
      .or(filtroLote);
    const existentesPorChave = new Map(
      (existentes ?? []).map((e) => [
        `${e.fonte}|${e.entidade_id}|${e.regra}`,
        { id: e.id as string, status: e.status as string },
      ]),
    );
    const novos = slice.filter(
      (f) => !existentesPorChave.has(`${f.fonte}|${f.entidade_id}|${f.regra}`),
    );
    const existentesAbertos = slice
      .map((f) => ({
        finding: f,
        existente: existentesPorChave.get(`${f.fonte}|${f.entidade_id}|${f.regra}`),
      }))
      .filter((x): x is { finding: QaFinding; existente: { id: string; status: string } } =>
        x.existente?.status === "aberto",
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
          // Findings que já nascem resolvidos carregam a data de resolução.
          // `corrigido_origem` = a API corrigiu numa reimportação;
          // `corrigido_automaticamente` = a conferência por detalhe corrigiu o
          // valor no site (ex.: alerta `valor_corrigido_listagem`).
          resolvido_em:
            f.status === "corrigido_origem" || f.status === "corrigido_automaticamente"
              ? new Date().toISOString()
              : null,
        })),
      );
      if (!error) inseridos += novos.length;
    }
    for (const { finding, existente } of existentesAbertos) {
      await supabaseAdmin
        .from("qa_findings")
        .update({
          severidade: finding.severidade,
          valor_armazenado: finding.valor_armazenado ?? null,
          valor_esperado: finding.valor_esperado ?? null,
          detalhes: (finding.detalhes ?? {}) as never,
        })
        .eq("id", existente.id);
    }
  }
  return inseridos;
}

function cguAindaSuspeito(regra: string, final: number, inicial: number): boolean {
  if (regra === "discrepancia_extrema_inicial_final") return inicial > 0 && final > 0 && (inicial >= final * 1000 || final >= inicial * 1000);
  if (regra === "valor_muito_baixo") return final > 0 && final < 100;
  // `valor_corrigido_listagem` é um registro histórico já resolvido — a
  // reconciliação só roda sobre findings 'aberto', então nunca chega aqui;
  // por segurança, nunca o reabrimos. Regras legadas/desconhecidas
  // (valor_precisao_suspeita, valor_final_truncado_suspeito) caem no default
  // conservador e não são fechadas automaticamente.
  if (regra === "valor_corrigido_listagem") return false;
  return true; // regra desconhecida: conservador, não fecha automaticamente
}

/**
 * Sincroniza os achados CGU contra o estado atual de `contratos_cache`.
 * A heurística lê o cache pós-upsert para manter o `valor_armazenado` do
 * finding idêntico ao valor persistido do contrato.
 *
 * Importação não reabre nem resolve findings existentes — só insere novos;
 * findings abertos já existentes têm apenas a evidência numérica sincronizada.
 */
export async function sincronizarQaCgu(
  ids: string[],
  paginaPorId?: Map<string, number>,
): Promise<{
  inseridos: number;
  atualizados: number;
  resolvidos: number;
}> {
  const idsUnicos = [...new Set(ids.filter(Boolean))];
  if (idsUnicos.length === 0) {
    return { inseridos: 0, atualizados: 0, resolvidos: 0 };
  }
  const cacheRows: CguContratoLike[] = [];
  const cacheById = new Map<string, { valor: number | null; valor_inicial: number | null }>();
  const LOTE = 500;
  for (let i = 0; i < idsUnicos.length; i += LOTE) {
    const slice = idsUnicos.slice(i, i + LOTE);
    const { data } = await supabaseAdmin
      .from("contratos_cache")
      .select("id, valor, valor_inicial, orgao_cod")
      .in("id", slice);
    for (const r of data ?? []) {
      const v = r.valor == null ? null : Number(r.valor);
      const vi = r.valor_inicial == null ? null : Number(r.valor_inicial);
      cacheRows.push({
        id: String(r.id),
        valor: v,
        valor_inicial: vi,
        orgao_cod: r.orgao_cod ?? null,
      });
      cacheById.set(String(r.id), { valor: v, valor_inicial: vi });
    }
  }
  const inseridos = await flagQA(regrasCgu(cacheRows, paginaPorId));

  // Reconciliação: para qualquer finding CGU AINDA ABERTO desses ids,
  // atualiza `valor_armazenado` com o valor atual do cache e verifica se a
  // heurística ainda se aplica. Se o cache já tem um valor que não dispara
  // mais a regra (ex.: upsert posterior trouxe valor correto), fecha
  // automaticamente como "corrigido_automaticamente".
  let atualizados = 0;
  let resolvidos = 0;
  for (let i = 0; i < idsUnicos.length; i += LOTE) {
    const slice = idsUnicos.slice(i, i + LOTE);
    const { data: abertos } = await supabaseAdmin
      .from("qa_findings")
      .select("id, entidade_id, regra, valor_armazenado")
      .eq("fonte", "cgu")
      .eq("entidade_tipo", "contrato")
      .eq("status", "aberto")
      .in("entidade_id", slice);
    for (const f of abertos ?? []) {
      const cache = cacheById.get(String(f.entidade_id));
      if (!cache) continue;
      const final = Number(cache.valor ?? 0);
      const inicial = Number(cache.valor_inicial ?? 0);
      // Verifica se a heurística ainda se aplica ao valor atual do cache.
      const aindaSuspeito = cguAindaSuspeito(f.regra, final, inicial);
      if (!aindaSuspeito) {
        await supabaseAdmin
          .from("qa_findings")
          .update({
            status: "corrigido_automaticamente",
            valor_armazenado: f.regra === "discrepancia_extrema_inicial_final" ? inicial : final,
            resolvido_em: new Date().toISOString(),
            revalidado_em: new Date().toISOString(),
          })
          .eq("id", f.id);
        resolvidos++;
        continue;
      }
      const atual =
        f.regra === "discrepancia_extrema_inicial_final" ? cache.valor_inicial : cache.valor;
      if (atual == null) continue;
      const antigo = f.valor_armazenado == null ? null : Number(f.valor_armazenado);
      if (antigo != null && Math.abs(antigo - atual) < 0.005) continue;
      await supabaseAdmin
        .from("qa_findings")
        .update({
          valor_armazenado: atual,
          revalidado_em: new Date().toISOString(),
        })
        .eq("id", f.id);
      atualizados++;
    }
  }
  return { inseridos, atualizados, resolvidos };
}
