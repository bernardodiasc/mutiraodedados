import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sanitizarTextoPublico } from "@/lib/sanitize";
import { regrasSenadoCeaps, flagQA } from "@/lib/data/qa";
import { parseValorSenado } from "@/lib/data/senado/parsers";

const BASE = "https://legis.senado.leg.br/dadosabertos";
const UA = "MutiraoDeDados/1.0 (+https://mutiraodedados.com.br)";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * GET na API do Senado com retry/backoff (500 → 1500 → 4500 ms) para 429/5xx e
 * erros de rede transitórios. 4xx são erros definitivos (sem retry).
 */
async function senadoGet<T = unknown>(path: string, tentativas = 4): Promise<T> {
  let ultimoErro = "sem resposta";
  for (let tent = 0; tent < tentativas; tent++) {
    if (tent > 0) await sleep(500 * 3 ** (tent - 1));
    let res: Response;
    try {
      res = await fetch(`${BASE}${path}`, {
        headers: { accept: "application/json", "user-agent": UA },
      });
    } catch (e) {
      ultimoErro = (e as Error).message;
      continue;
    }
    if (res.ok) return (await res.json()) as T;
    if (res.status === 429 || res.status >= 500) {
      ultimoErro = `${res.status}`;
      continue;
    }
    const body = await res.text().catch(() => "");
    throw new Error(`Senado API ${res.status}: ${body.slice(0, 200)}`);
  }
  throw new Error(`Senado API indisponível após ${tentativas} tentativas (último: ${ultimoErro}).`);
}

/** Garante que o caller é admin. */
async function ensureAdmin(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw new Error("Falha ao verificar permissão.");
  if (data?.role !== "admin") throw new Error("Acesso restrito: somente administradores.");
}

/** Normaliza arrays "Senado-style": campos podem ser objeto único ou array. */
function asArray<T>(v: T | T[] | null | undefined): T[] {
  if (v === null || v === undefined) return [];
  return Array.isArray(v) ? v : [v];
}

type Parlamentar = {
  IdentificacaoParlamentar?: {
    CodigoParlamentar?: string | number;
    NomeParlamentar?: string;
    NomeCompletoParlamentar?: string;
    SiglaPartidoParlamentar?: string;
    UfParlamentar?: string;
    UrlFotoParlamentar?: string;
    EmailParlamentar?: string;
  };
};

/** Legislatura corrente (52 = 2003–2007, +1 a cada 4 anos). 2023–2027 = 57. */
export function legislaturaAtualSenado(): number {
  return 52 + Math.floor((new Date().getFullYear() - 2003) / 4);
}
function anoInicioLegislatura(n: number): number {
  return 2003 + (n - 52) * 4;
}

/** Grava as linhas-filhas de mandato por legislatura e ignora erros de log. */
async function upsertSenadorLegislaturas(
  rows: Array<{
    codigo_parlamentar: number;
    legislatura: number;
    sigla_partido: string | null;
    sigla_uf: string | null;
    participacao: string | null;
    updated_at: string;
  }>,
) {
  for (let i = 0; i < rows.length; i += 100) {
    const { error } = await supabaseAdmin
      .from("senado_senador_legislaturas")
      .upsert(rows.slice(i, i + 100));
    if (error) throw new Error(`db: ${error.message}`);
  }
}

async function logImportacaoSenadores(legislatura: number, total: number, userId: string) {
  try {
    await supabaseAdmin.from("importacoes").insert({
      fonte: "senado_senadores",
      escopo: `legislatura ${legislatura}`,
      ano: anoInicioLegislatura(legislatura),
      mes: 1,
      total_bruto: total,
      importados: total,
      erros: [],
      user_id: userId,
      endpoint: `GET https://legis.senado.leg.br/dadosabertos/senador/lista/legislatura/${legislatura}`,
    });
  } catch (e) {
    console.error("[senado_senadores] falha ao registrar importacao", e);
  }
}

// ── Mandatos: exercícios (afastamentos) + cadeia de suplência ────────────────
type ExercicioRaw = {
  DataInicio?: string;
  DataFim?: string;
  SiglaCausaAfastamento?: string;
  DescricaoCausaAfastamento?: string;
};
type SuplenteRaw = {
  DescricaoParticipacao?: string;
  NomeParlamentar?: string;
  CodigoParlamentar?: string | number;
};
type MandatoDetalhe = {
  UfParlamentar?: string;
  DescricaoParticipacao?: string;
  PrimeiraLegislaturaDoMandato?: { NumeroLegislatura?: string | number };
  SegundaLegislaturaDoMandato?: { NumeroLegislatura?: string | number };
  Exercicios?: { Exercicio?: ExercicioRaw | ExercicioRaw[] };
  Suplentes?: { Suplente?: SuplenteRaw | SuplenteRaw[] };
};

async function mandatosSenador(cod: number): Promise<MandatoDetalhe[]> {
  try {
    const j = await senadoGet<{
      MandatoParlamentar?: {
        Parlamentar?: { Mandatos?: { Mandato?: MandatoDetalhe | MandatoDetalhe[] } };
      };
    }>(`/senador/${cod}/mandatos`);
    return asArray(j.MandatoParlamentar?.Parlamentar?.Mandatos?.Mandato);
  } catch {
    return [];
  }
}

/**
 * Ingere, para um conjunto de senadores, os períodos em exercício (com causa de
 * afastamento) e a cadeia de suplência (os suplentes de cada titular, por
 * legislatura). Lotes paralelos; delete+insert por código (idempotente). É de
 * `Exercicios` que se lê quando/por que alguém deixou o cargo, e de `Suplentes`
 * quem entra no lugar.
 */
async function ingerirMandatosSenadores(codigos: number[]): Promise<void> {
  const LOTE = 6;
  const now = new Date().toISOString();
  for (let i = 0; i < codigos.length; i += LOTE) {
    const lote = codigos.slice(i, i + LOTE);
    const res = await Promise.all(
      lote.map((cod) => mandatosSenador(cod).then((m) => [cod, m] as const)),
    );
    const exRows: Array<{
      codigo_parlamentar: number;
      data_inicio: string | null;
      data_fim: string | null;
      sigla_causa: string | null;
      descricao_causa: string | null;
      participacao: string | null;
      uf: string | null;
      updated_at: string;
    }> = [];
    const supRows: Array<{
      titular_codigo: number;
      legislatura: number;
      ordem: string | null;
      suplente_codigo: number | null;
      suplente_nome: string | null;
      updated_at: string;
    }> = [];
    const situacaoUpd: Array<{ cod: number; situacao: string }> = [];
    for (const [cod, mandatos] of res) {
      // Situação atual derivada dos exercícios: em exercício se há período aberto;
      // já ocupou mas encerrou → "Fora de exercício"; nenhum exercício em toda a
      // trajetória → "Nunca exerceu" (suplente que jamais assumiu a cadeira — sem
      // posse e, em geral, sem foto oficial). Distingue esses do "Fora de exercício".
      const exs = mandatos.flatMap((m) => asArray(m.Exercicios?.Exercicio));
      const situacao = exs.some((e) => !e.DataFim)
        ? "Exercício"
        : exs.length > 0
          ? "Fora de exercício"
          : "Nunca exerceu";
      situacaoUpd.push({ cod, situacao });
      for (const m of mandatos) {
        const uf = m.UfParlamentar ?? null;
        const participacao = m.DescricaoParticipacao ?? null;
        for (const e of asArray(m.Exercicios?.Exercicio)) {
          exRows.push({
            codigo_parlamentar: cod,
            data_inicio: e.DataInicio ?? null,
            data_fim: e.DataFim ?? null,
            sigla_causa: e.SiglaCausaAfastamento ?? null,
            descricao_causa: e.DescricaoCausaAfastamento ?? null,
            participacao,
            uf,
            updated_at: now,
          });
        }
        const legs = [
          Number(m.PrimeiraLegislaturaDoMandato?.NumeroLegislatura),
          Number(m.SegundaLegislaturaDoMandato?.NumeroLegislatura),
        ].filter((n) => Number.isFinite(n) && n > 0);
        for (const s of asArray(m.Suplentes?.Suplente)) {
          const sc = Number(s.CodigoParlamentar);
          for (const leg of legs) {
            supRows.push({
              titular_codigo: cod,
              legislatura: leg,
              ordem: s.DescricaoParticipacao ?? null,
              suplente_codigo: Number.isFinite(sc) && sc > 0 ? sc : null,
              suplente_nome: s.NomeParlamentar ?? null,
              updated_at: now,
            });
          }
        }
      }
    }
    await supabaseAdmin.from("senado_exercicios").delete().in("codigo_parlamentar", lote);
    await supabaseAdmin.from("senado_suplencia").delete().in("titular_codigo", lote);
    for (let j = 0; j < exRows.length; j += 200) {
      const { error } = await supabaseAdmin
        .from("senado_exercicios")
        .insert(exRows.slice(j, j + 200));
      if (error) throw new Error(`db exercicios: ${error.message}`);
    }
    for (let j = 0; j < supRows.length; j += 200) {
      const { error } = await supabaseAdmin
        .from("senado_suplencia")
        .insert(supRows.slice(j, j + 200));
      if (error) throw new Error(`db suplencia: ${error.message}`);
    }
    for (const { cod, situacao } of situacaoUpd) {
      await supabaseAdmin.from("senado_senadores_cache").update({ situacao }).eq("id", cod);
    }
  }
}

/** Importa os 81 senadores em exercício. */
export const importarSenadores = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({}).parse(input ?? {}))
  .handler(async ({ context }) => {
    await ensureAdmin(context.userId);

    const json = await senadoGet<{
      ListaParlamentarEmExercicio?: {
        Parlamentares?: { Parlamentar?: Parlamentar | Parlamentar[] };
      };
    }>("/senador/lista/atual");

    const arr = asArray(json.ListaParlamentarEmExercicio?.Parlamentares?.Parlamentar);
    if (arr.length === 0) throw new Error("Senado retornou lista vazia.");

    const rowsBrutos = arr
      .map((p) => {
        const i = p.IdentificacaoParlamentar ?? {};
        const id = Number(i.CodigoParlamentar);
        if (!Number.isFinite(id) || id <= 0) return null;
        return {
          id,
          codigo_parlamentar: id,
          nome: i.NomeParlamentar ?? `Senador ${id}`,
          nome_completo: i.NomeCompletoParlamentar ?? null,
          sigla_partido: i.SiglaPartidoParlamentar ?? null,
          sigla_uf: i.UfParlamentar ?? null,
          url_foto: i.UrlFotoParlamentar ?? null,
          email: i.EmailParlamentar ?? null,
          situacao: "Exercício",
          updated_at: new Date().toISOString(),
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);

    // Dedupe defensivo por código do parlamentar (a lista pode repetir o mesmo
    // senador), para o upsert não afetar a mesma linha duas vezes.
    const rows = [...new Map(rowsBrutos.map((r) => [r.id, r])).values()];

    for (let i = 0; i < rows.length; i += 100) {
      const { error } = await supabaseAdmin
        .from("senado_senadores_cache")
        .upsert(rows.slice(i, i + 100));
      if (error) throw new Error(`db: ${error.message}`);
    }

    // Linha-filha da legislatura atual (histórico de mandatos).
    const legAtual = legislaturaAtualSenado();
    const now = new Date().toISOString();
    await upsertSenadorLegislaturas(
      rows.map((r) => ({
        codigo_parlamentar: r.codigo_parlamentar,
        legislatura: legAtual,
        sigla_partido: r.sigla_partido,
        sigla_uf: r.sigla_uf,
        participacao: "Exercício",
        updated_at: now,
      })),
    );
    await logImportacaoSenadores(legAtual, rows.length, context.userId);
    await ingerirMandatosSenadores(rows.map((r) => r.codigo_parlamentar));

    return { importados: rows.length };
  });

/**
 * Item da lista por legislatura: além da identificação, traz os mandatos (de onde
 * vêm UF e participação para a legislatura consultada).
 */
type ParlamentarLegislatura = Parlamentar & {
  Mandatos?: {
    Mandato?: MandatoRaw | MandatoRaw[];
  };
};
type LegRef = { NumeroLegislatura?: string | number };
type MandatoRaw = {
  UfParlamentar?: string;
  DescricaoParticipacao?: string;
  PrimeiraLegislaturaDoMandato?: LegRef;
  SegundaLegislaturaDoMandato?: LegRef;
};

/** Extrai UF + participação do mandato que cobre a legislatura consultada. */
function mandatoDaLegislatura(
  p: ParlamentarLegislatura,
  legislatura: number,
): { uf: string | null; participacao: string | null } {
  const mandatos = asArray(p.Mandatos?.Mandato);
  const alvo =
    mandatos.find(
      (m) =>
        Number(m.PrimeiraLegislaturaDoMandato?.NumeroLegislatura) === legislatura ||
        Number(m.SegundaLegislaturaDoMandato?.NumeroLegislatura) === legislatura,
    ) ?? mandatos[0];
  return {
    uf: alvo?.UfParlamentar ?? null,
    participacao: alvo?.DescricaoParticipacao ?? null,
  };
}

/**
 * Importa o cadastro de senadores de UMA legislatura passada.
 * Endpoint: /senador/lista/legislatura/{n}.
 * Roster: só identidade (não sobrescreve o estado atual); partido/UF/participação
 * da legislatura vão para `senado_senador_legislaturas`.
 */
async function ingerirSenadoresLegislatura(
  legislatura: number,
  userId: string,
): Promise<{ importados: number; legislatura: number }> {
  const json = await senadoGet<{
    ListaParlamentarLegislatura?: {
      Parlamentares?: { Parlamentar?: ParlamentarLegislatura | ParlamentarLegislatura[] };
    };
  }>(`/senador/lista/legislatura/${legislatura}`);

  const arrBruto = asArray(json.ListaParlamentarLegislatura?.Parlamentares?.Parlamentar);
  if (arrBruto.length === 0) return { importados: 0, legislatura };

  // A lista por legislatura pode repetir o mesmo parlamentar; dedupe por código
  // para o upsert (roster e mandato) não afetar a mesma linha duas vezes.
  const arr = [
    ...new Map(
      arrBruto
        .filter((p) => Number(p.IdentificacaoParlamentar?.CodigoParlamentar) > 0)
        .map((p) => [Number(p.IdentificacaoParlamentar?.CodigoParlamentar), p] as const),
    ).values(),
  ];

  const now = new Date().toISOString();

  const identidades = arr
    .map((p) => {
      const i = p.IdentificacaoParlamentar ?? {};
      const id = Number(i.CodigoParlamentar);
      if (!Number.isFinite(id) || id <= 0) return null;
      return {
        id,
        codigo_parlamentar: id,
        nome: i.NomeParlamentar ?? `Senador ${id}`,
        nome_completo: i.NomeCompletoParlamentar ?? null,
        updated_at: now,
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  for (let i = 0; i < identidades.length; i += 100) {
    const { error } = await supabaseAdmin
      .from("senado_senadores_cache")
      .upsert(identidades.slice(i, i + 100));
    if (error) throw new Error(`db: ${error.message}`);
  }

  const legRows = arr
    .map((p) => {
      const i = p.IdentificacaoParlamentar ?? {};
      const id = Number(i.CodigoParlamentar);
      if (!Number.isFinite(id) || id <= 0) return null;
      const { uf, participacao } = mandatoDaLegislatura(p, legislatura);
      return {
        codigo_parlamentar: id,
        legislatura,
        sigla_partido: i.SiglaPartidoParlamentar ?? null,
        sigla_uf: uf,
        participacao,
        updated_at: now,
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  await upsertSenadorLegislaturas(legRows);
  await logImportacaoSenadores(legislatura, identidades.length, userId);
  await ingerirMandatosSenadores(identidades.map((r) => r.codigo_parlamentar));

  return { importados: identidades.length, legislatura };
}

/** Importa o cadastro de senadores de UMA legislatura passada. */
export const importarSenadoresLegislatura = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ legislatura: z.number().int().min(50).max(100) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.userId);
    return ingerirSenadoresLegislatura(data.legislatura, context.userId);
  });

/** Importa o histórico de senadores de uma FAIXA de legislaturas (inclusive). */
export const importarSenadoresHistorico = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        legIni: z.number().int().min(50).max(100),
        legFim: z.number().int().min(50).max(100),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.userId);
    const ini = Math.min(data.legIni, data.legFim);
    const fim = Math.max(data.legIni, data.legFim);
    let importados = 0;
    const legislaturas: number[] = [];
    const erros: string[] = [];
    for (let n = fim; n >= ini; n--) {
      try {
        const r = await ingerirSenadoresLegislatura(n, context.userId);
        importados += r.importados;
        legislaturas.push(n);
      } catch (e) {
        erros.push(`leg ${n}: ${(e as Error).message}`);
        console.error(`[senado_senadores] legislatura ${n} falhou`, e);
      }
    }
    return { importados, legislaturas, erros };
  });

type DespesaRaw = {
  Ano?: string | number;
  Mes?: string | number;
  TipoDespesa?: string;
  CnpjCpfFornecedor?: string;
  Fornecedor?: string;
  Documento?: string;
  DataDocumento?: string;
  ValorReembolsado?: string | number;
  Detalhamento?: string;
  CodigoDocumento?: string | number;
};

/**
 * Importa CEAPS (cota dos senadores) de um ano/mês para TODOS os senadores em cache.
 * Endpoint: /senador/{cod}/despesas/{ano} (filtra mês client-side).
 */
export const importarCEAPSMes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        ano: z.number().int().min(2008).max(2100),
        mes: z.number().int().min(1).max(12),
        senadorId: z.number().int().positive().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.userId);

    let senadorIds: number[] = [];
    if (data.senadorId) {
      senadorIds = [data.senadorId];
    } else {
      const { data: sens, error } = await supabaseAdmin.from("senado_senadores_cache").select("id");
      if (error) throw new Error(`db: ${error.message}`);
      senadorIds = (sens ?? []).map((s) => s.id as number);
    }
    if (senadorIds.length === 0) {
      throw new Error("Nenhum senador em cache. Importe o cadastro primeiro.");
    }

    let totalImportados = 0;
    const erros: string[] = [];

    for (const senId of senadorIds) {
      try {
        const json = await senadoGet<{
          DespesasParlamentares?: {
            Senador?: {
              Despesas?: { Despesa?: DespesaRaw | DespesaRaw[] };
            };
          };
        }>(`/senador/${senId}/despesas/${data.ano}`);

        const lista = asArray(json.DespesasParlamentares?.Senador?.Despesas?.Despesa);
        const doMes = lista.filter((d) => Number(d.Mes) === data.mes);
        if (doMes.length === 0) continue;

        const rows = doMes.map((d, idx) => {
          const cod = d.CodigoDocumento ?? d.Documento ?? `${idx}`;
          return {
            id: `${senId}-${data.ano}-${data.mes}-${cod}`,
            senador_id: senId,
            ano: Number(d.Ano ?? data.ano),
            mes: Number(d.Mes ?? data.mes),
            tipo_despesa:
              sanitizarTextoPublico((d.TipoDespesa ?? "").slice(0, 200)) || "(sem tipo)",
            fornecedor_nome: sanitizarTextoPublico((d.Fornecedor ?? "").slice(0, 240)) || null,
            fornecedor_cnpj: d.CnpjCpfFornecedor ?? null,
            data_documento:
              d.DataDocumento && /^\d{4}-\d{2}-\d{2}/.test(d.DataDocumento)
                ? d.DataDocumento.slice(0, 10)
                : null,
            num_documento: d.Documento ?? null,
            valor_reembolsado: parseValorSenado(d.ValorReembolsado),
            detalhamento: sanitizarTextoPublico((d.Detalhamento ?? "").slice(0, 500)) || null,
            updated_at: new Date().toISOString(),
          };
        });

        for (let i = 0; i < rows.length; i += 200) {
          const { error } = await supabaseAdmin
            .from("senado_despesas_cache")
            .upsert(rows.slice(i, i + 200));
          if (error) throw new Error(error.message);
        }
        totalImportados += rows.length;
        try {
          await flagQA(
            regrasSenadoCeaps(
              rows.map((r) => ({
                id: r.id,
                valor_reembolsado: r.valor_reembolsado,
                senador_id: r.senador_id,
              })),
            ),
          );
        } catch (e) {
          // Não interrompe a ingestão, mas o erro de QA fica visível.
          erros.push(`qa sen ${senId}: ${(e as Error).message}`);
        }
      } catch (e) {
        erros.push(`sen ${senId}: ${(e as Error).message}`);
      }
    }

    return { importados: totalImportados, senadoresProcessados: senadorIds.length, erros };
  });
