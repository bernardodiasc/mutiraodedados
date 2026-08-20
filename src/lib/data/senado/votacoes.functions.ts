import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { rodarComOrcamento } from "@/lib/data/runner";
import { checkpointImportacao } from "@/lib/data/checkpoint.server";
import { reacaoAoErroDeLista } from "@/lib/data/erro-origem";
import { registrarRodadaImportacao } from "@/lib/data/historico.server";
import { anoMesDaJanela } from "@/lib/data/historico-rodada";
import { JANELA_ORCAMENTO_MS, JANELA_TETO_SUBREQUISICOES } from "@/lib/data/janela-varredura";

const BASE = "https://legis.senado.leg.br/dadosabertos";
const UA = "MutiraoDeDados/1.0 (+https://mutiraodedados.com.br)";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// GET com retry/backoff (500 → 1500 → 4500 ms) para 429/5xx e erros de rede
// transitórios; 4xx é erro definitivo.
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

function asArray<T>(v: T | T[] | null | undefined): T[] {
  if (v == null) return [];
  return Array.isArray(v) ? v : [v];
}

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

type VotacaoItem = {
  CodigoSessaoVotacao?: string | number;
  CodigoSessao?: string | number;
  SessaoPlenaria?: { CodigoSessao?: string | number };
  DataSessao?: string;
  DescricaoVotacao?: string;
  Resultado?: string;
  Materia?: {
    CodigoMateria?: string | number;
    DescricaoIdentificacao?: string;
    SiglaMateria?: string;
  };
  Votos?: { VotoParlamentar?: VotoItem | VotoItem[] };
};

type VotoItem = {
  CodigoParlamentar?: string | number;
  NomeParlamentar?: string;
  SiglaPartido?: string;
  SiglaUF?: string;
  Voto?: string;
};

function ymd(s: string): string {
  // "2025-05-12" → "20250512"
  return s.replace(/-/g, "");
}

/** Importa votações nominais em um intervalo de datas (até ~30 dias por chamada). */
export const importarVotacoesSenado = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        dataInicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        dataFim: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.userId);

    let totalVotos = 0;
    const erros: string[] = [];
    const inicioRodada = Date.now();

    // A lista da janela vem numa chamada só, mas cada votação custa ~3
    // operações de banco (upsert + limpeza + insert dos votos) — uma pauta
    // cheia estoura o limite de subrequisições do Worker numa chamada única.
    // O cursor é a votação; a lista é buscada uma vez por rodada e ordenada
    // por código de sessão para a retomada não pular nem repetir.
    let listaRodada: VotacaoItem[] | null = null;
    const carregarLista = async (): Promise<VotacaoItem[]> => {
      if (listaRodada) return listaRodada;
      const json = await senadoGet<{
        ListaVotacoes?: { Votacoes?: { Votacao?: VotacaoItem | VotacaoItem[] } };
      }>(`/plenario/lista/votacao/${ymd(data.dataInicio)}/${ymd(data.dataFim)}`);
      listaRodada = asArray(json.ListaVotacoes?.Votacoes?.Votacao).sort((a, b) => {
        const ca = String(
          a.CodigoSessaoVotacao ?? a.CodigoSessao ?? a.SessaoPlenaria?.CodigoSessao ?? "",
        );
        const cb = String(
          b.CodigoSessaoVotacao ?? b.CodigoSessao ?? b.SessaoPlenaria?.CodigoSessao ?? "",
        );
        return ca.localeCompare(cb);
      });
      return listaRodada;
    };

    const rodada = await rodarComOrcamento({
      chave: `senado_vot#${data.dataInicio}#${data.dataFim}`,
      checkpoint: checkpointImportacao,
      orcamentoMs: JANELA_ORCAMENTO_MS,
      orcamentoCusto: JANELA_TETO_SUBREQUISICOES,
      maxPassos: 5000,
      passo: async (cursor) => {
        let custo = 0;
        let lista: VotacaoItem[];
        try {
          const antes = listaRodada;
          lista = await carregarLista();
          if (!antes) custo++;
        } catch (e) {
          // Sem a lista não há item a processar: passageiro refaz, definitivo
          // encerra a rodada em vez de gastar centenas de tentativas inúteis.
          const r = reacaoAoErroDeLista(e);
          return {
            processados: 0,
            fim: r.fim,
            custo: 1,
            interromper: r.interromper,
            erros: [`lista: ${(e as Error).message}`],
          };
        }
        if (cursor > lista.length) return { processados: 0, fim: true, custo };
        const v = lista[cursor - 1];

        try {
          const codSessao =
            v.CodigoSessaoVotacao ?? v.CodigoSessao ?? v.SessaoPlenaria?.CodigoSessao;
          if (!codSessao) return { processados: 0, fim: false, custo };
          const id = String(codSessao);

          const votos = asArray(v.Votos?.VotoParlamentar);
          const tally = { sim: 0, nao: 0, outros: 0 };
          for (const x of votos) {
            const t = (x.Voto ?? "").toLowerCase().trim();
            if (t === "sim" || t.startsWith("sim")) tally.sim++;
            else if (t === "não" || t === "nao" || t.startsWith("nã") || t.startsWith("na"))
              tally.nao++;
            else tally.outros++;
          }

          const row = {
            id,
            data:
              v.DataSessao && /^\d{4}-\d{2}-\d{2}/.test(v.DataSessao)
                ? v.DataSessao.slice(0, 10)
                : null,
            descricao: (v.DescricaoVotacao ?? "").slice(0, 2000) || null,
            resultado: v.Resultado ?? null,
            materia_id: v.Materia?.CodigoMateria ? Number(v.Materia.CodigoMateria) : null,
            materia_titulo:
              v.Materia?.DescricaoIdentificacao ??
              (v.Materia?.SiglaMateria ? String(v.Materia.SiglaMateria) : null),
            sigla_orgao: "SF",
            votos_sim: tally.sim,
            votos_nao: tally.nao,
            votos_outros: tally.outros,
            updated_at: new Date().toISOString(),
          };
          const { error: e1 } = await supabaseAdmin.from("senado_votacoes_cache").upsert(row);
          custo++;
          if (e1) throw new Error(e1.message);

          const votoRows = votos
            .filter((x) => x.CodigoParlamentar)
            .map((x) => ({
              votacao_id: id,
              senador_id: Number(x.CodigoParlamentar),
              tipo_voto: (x.Voto ?? "—").slice(0, 40),
              sigla_partido: x.SiglaPartido ?? null,
              sigla_uf: x.SiglaUF ?? null,
              updated_at: new Date().toISOString(),
            }));

          if (votoRows.length > 0) {
            // limpa votos antigos desta votação para upsert idempotente (PK composta inexistente)
            await supabaseAdmin.from("senado_votos_cache").delete().eq("votacao_id", id);
            custo++;
            for (let i = 0; i < votoRows.length; i += 500) {
              const { error: e2 } = await supabaseAdmin
                .from("senado_votos_cache")
                .insert(votoRows.slice(i, i + 500));
              custo++;
              if (e2) throw new Error(`votos: ${e2.message}`);
            }
            totalVotos += votoRows.length;
          }
          return { processados: 1, fim: false, custo };
        } catch (e) {
          // Uma votação com problema não interrompe a varredura — segue para a
          // seguinte, com o erro registrado.
          return { processados: 0, fim: false, custo, erros: [`vot: ${(e as Error).message}`] };
        }
      },
    });

    erros.push(...rodada.erros);

    // Linha de rodada no Histórico — inclui consulta vazia e motivo de parada.
    const avisoHistorico = await registrarRodadaImportacao(
      {
        fonte: "senado_vot",
        ...anoMesDaJanela(data.dataInicio, data.dataFim),
        endpoint: `GET ${BASE}/plenario/lista/votacao/${ymd(data.dataInicio)}/${ymd(data.dataFim)}`,
        unidade: "votações",
        userId: context.userId,
        duracaoMs: Date.now() - inicioRodada,
      },
      rodada,
    );
    if (avisoHistorico) erros.push(avisoHistorico);

    return {
      votacoes: rodada.processados,
      votos: totalVotos,
      erros,
      varredura: {
        haMais: !rodada.concluido,
        cursor: rodada.cursorFinal,
        totalAcumulado: rodada.totalAcumulado,
        orcamentoEsgotado: rodada.orcamentoEsgotado,
        custoEsgotado: rodada.custoEsgotado,
      },
    };
  });

export const listarVotacoesSenado = createServerFn({ method: "GET" })
  .inputValidator((input) =>
    z
      .object({
        termo: z.string().max(120).optional(),
        limit: z.number().int().min(1).max(500).default(200),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data }) => {
    let q = supabaseAdmin
      .from("senado_votacoes_cache")
      .select(
        "id,data,descricao,resultado,materia_id,materia_titulo,votos_sim,votos_nao,votos_outros",
      )
      .order("data", { ascending: false, nullsFirst: false })
      .limit(data.limit);
    if (data.termo) q = q.ilike("descricao", `%${data.termo}%`);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r) => ({
      id: r.id as string,
      data: r.data as string | null,
      descricao: r.descricao as string | null,
      resultado: r.resultado as string | null,
      materiaId: r.materia_id as number | null,
      materiaTitulo: r.materia_titulo as string | null,
      votosSim: r.votos_sim as number,
      votosNao: r.votos_nao as number,
      votosOutros: r.votos_outros as number,
    }));
  });

export const getVotacaoSenadoDetalhe = createServerFn({ method: "GET" })
  .inputValidator((input) => z.object({ id: z.string().min(1) }).parse(input))
  .handler(async ({ data }) => {
    const { data: v, error } = await supabaseAdmin
      .from("senado_votacoes_cache")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!v) return null;
    const { data: votos } = await supabaseAdmin
      .from("senado_votos_cache")
      .select("senador_id,tipo_voto,sigla_partido,sigla_uf")
      .eq("votacao_id", data.id);

    const porPartido = new Map<string, Map<string, number>>();
    const porUf = new Map<string, Map<string, number>>();
    for (const x of votos ?? []) {
      const part = (x.sigla_partido as string | null) ?? "—";
      const uf = (x.sigla_uf as string | null) ?? "—";
      const t = (x.tipo_voto as string) ?? "—";
      if (!porPartido.has(part)) porPartido.set(part, new Map());
      porPartido.get(part)!.set(t, (porPartido.get(part)!.get(t) ?? 0) + 1);
      if (!porUf.has(uf)) porUf.set(uf, new Map());
      porUf.get(uf)!.set(t, (porUf.get(uf)!.get(t) ?? 0) + 1);
    }
    const disciplina = [...porPartido.entries()]
      .map(([part, m]) => {
        const total = [...m.values()].reduce((s, n) => s + n, 0);
        const entradas = [...m.entries()].sort((a, b) => b[1] - a[1]);
        const [majTipo, majN] = entradas[0] ?? ["—", 0];
        return {
          partido: part,
          total,
          majTipo,
          indice: total ? majN / total : 0,
          detalhe: entradas,
        };
      })
      .sort((a, b) => b.total - a.total);
    const porUfArr = [...porUf.entries()]
      .map(([uf, m]) => ({
        uf,
        total: [...m.values()].reduce((s, n) => s + n, 0),
        entradas: [...m.entries()].sort((a, b) => b[1] - a[1]),
      }))
      .sort((a, b) => a.uf.localeCompare(b.uf));

    const ids = [...new Set((votos ?? []).map((x) => x.senador_id as number))];
    const { data: sens } = await supabaseAdmin
      .from("senado_senadores_cache")
      .select("id,nome")
      .in("id", ids.length ? ids : [0]);
    const nomes = new Map((sens ?? []).map((s) => [s.id as number, s.nome as string]));

    return {
      votacao: {
        id: v.id as string,
        data: v.data as string | null,
        descricao: v.descricao as string | null,
        resultado: v.resultado as string | null,
        materiaId: v.materia_id as number | null,
        materiaTitulo: v.materia_titulo as string | null,
        votosSim: v.votos_sim as number,
        votosNao: v.votos_nao as number,
        votosOutros: v.votos_outros as number,
      },
      votos: (votos ?? []).map((x) => ({
        senadorId: x.senador_id as number,
        nome: nomes.get(x.senador_id as number) ?? `Senador ${x.senador_id}`,
        tipoVoto: x.tipo_voto as string,
        siglaPartido: x.sigla_partido as string | null,
        siglaUf: x.sigla_uf as string | null,
      })),
      disciplina,
      porUf: porUfArr,
    };
  });

export const senadoVotacoesOverview = createServerFn({ method: "GET" }).handler(async () => {
  const [{ count: nVot }, { count: nVotos }, ultRes] = await Promise.all([
    supabaseAdmin.from("senado_votacoes_cache").select("id", { count: "exact", head: true }),
    supabaseAdmin.from("senado_votos_cache").select("votacao_id", { count: "exact", head: true }),
    supabaseAdmin
      .from("senado_votacoes_cache")
      .select("data")
      .order("data", { ascending: false, nullsFirst: false })
      .limit(1),
  ]);
  return {
    totalVotacoes: nVot ?? 0,
    totalVotos: nVotos ?? 0,
    ultimaData: (ultRes.data?.[0]?.data as string | null) ?? null,
  };
});
