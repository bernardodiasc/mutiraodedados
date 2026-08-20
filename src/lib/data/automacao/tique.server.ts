import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { janelaDoMesCorrente, resumoDoTique } from "@/lib/data/automacao/janela";
import { rodadaContratosPNCP } from "@/lib/data/pncp/ingest.functions";
import { rodadaConvenios } from "@/lib/data/real/convenios.functions";
import { rodadaCEAPMes } from "@/lib/data/camara/ingest.functions";
import { rodadaCEAPSMes } from "@/lib/data/senado/ingest.functions";
import { rodadaVotacoesCamara } from "@/lib/data/camara/votacoes.functions";
import { rodadaVotacoesSenado } from "@/lib/data/senado/votacoes.functions";
import { rodadaMaterias } from "@/lib/data/senado/materias.functions";
import { rodadaProposicoes } from "@/lib/data/camara/proposicoes.functions";
import { rodadaConveniosOrigem } from "@/lib/data/convenios-origem/ingest.functions";
import { rodadaMunicipiosIBGE } from "@/lib/data/ibge/ingest.functions";

/**
 * Um TIQUE do agendador (v0.11.0): reivindica a próxima tarefa da fila,
 * executa UMA rodada com orçamento do núcleo daquela fonte e devolve o
 * resultado. Quem chama é `/api/cron-importar` — interceptada em
 * `src/server.ts`, protegida por `CRON_SECRET`.
 *
 * As rodadas são as MESMAS do painel (núcleos extraídos das server
 * functions): mesmo orçamento, mesma retomada, mesmo histórico — o
 * agendador é só mais um gatilho, como a visão do ROADMAP pedia desde a
 * v0.3.0. `user_id` fica nulo nas linhas de histórico: rodada sem operador.
 *
 * Concorrência: a fila é reivindicada com FOR UPDATE SKIP LOCKED (RPC), e um
 * claim expira em 15 min — tique que morreu não prende a tarefa. Rodada
 * manual do admin em paralelo é tolerada por desenho: upserts idempotentes e
 * checkpoint por chave fazem o pior caso ser trabalho repetido, não corrupção.
 */

type ResultadoRodadaTique = {
  importados?: number;
  erros?: string[];
  varredura?: { haMais: boolean };
};

const TAREFAS: Record<string, (params: Record<string, unknown>) => Promise<ResultadoRodadaTique>> =
  {
    pncp: () => {
      const j = janelaDoMesCorrente(new Date());
      return rodadaContratosPNCP(
        { dataInicial: j.dataInicial, dataFinal: j.dataFinal, maxPaginas: 2000 },
        null,
      );
    },
    convenios: () => {
      const j = janelaDoMesCorrente(new Date());
      return rodadaConvenios(
        {
          dataInicial: j.dataInicial,
          dataFinal: j.dataFinal,
          maxPaginas: 5000,
          delayMs: 800,
          orcamentoMs: 180_000,
        },
        null,
      ).then((r) => ({
        importados: r.meta.importados,
        erros: r.meta.erros,
        varredura: { haMais: r.meta.varredura.haMais },
      }));
    },
    camara_ceap: () => {
      const j = janelaDoMesCorrente(new Date());
      return rodadaCEAPMes({ ano: j.ano, mes: j.mes }, null);
    },
    senado_ceaps: () => {
      const j = janelaDoMesCorrente(new Date());
      return rodadaCEAPSMes({ ano: j.ano, mes: j.mes }, null);
    },
    camara_vot: () => {
      const j = janelaDoMesCorrente(new Date());
      return rodadaVotacoesCamara(
        { dataInicio: j.dataInicial, dataFim: j.dataFinal, maxPaginas: 2000 },
        null,
      ).then((r) => ({ importados: r.votos, erros: r.erros, varredura: r.varredura }));
    },
    senado_vot: () => {
      const j = janelaDoMesCorrente(new Date());
      return rodadaVotacoesSenado({ dataInicio: j.dataInicial, dataFim: j.dataFinal }, null).then(
        (r) => ({ importados: r.votos, erros: r.erros, varredura: r.varredura }),
      );
    },
    senado_mat: (params) => {
      const j = janelaDoMesCorrente(new Date());
      const sigla = typeof params.sigla === "string" ? params.sigla : "PL";
      return rodadaMaterias({ ano: j.ano, sigla }, null);
    },
    camara_props: (params) => {
      const j = janelaDoMesCorrente(new Date());
      const siglaTipo = typeof params.siglaTipo === "string" ? params.siglaTipo : "PL";
      return rodadaProposicoes({ ano: j.ano, siglaTipo, maxPaginas: 200 }, null);
    },
    convenios_origem: () => rodadaConveniosOrigem(null),
    ibge: () => rodadaMunicipiosIBGE(null),
  };

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

export async function executarTiqueAutomacao(request: Request): Promise<Response> {
  const segredo = process.env.CRON_SECRET;
  // Sem segredo configurado a rota está DESLIGADA — nunca aberta por engano.
  if (!segredo || request.headers.get("x-cron-secret") !== segredo) {
    return json(401, { erro: "não autorizado" });
  }
  if (request.method !== "POST") return json(405, { erro: "use POST" });

  const { data: claim, error: errClaim } = await supabaseAdmin.rpc("automacao_reivindicar_tarefa");
  if (errClaim) return json(500, { erro: `fila: ${errClaim.message}` });
  const tarefa = Array.isArray(claim) ? claim[0] : claim;
  if (!tarefa) return json(200, { tarefa: null, mensagem: "fila vazia ou tudo em execução" });

  const executar = TAREFAS[tarefa.id];
  const liberar = async (resultado: string) => {
    await supabaseAdmin
      .from("automacao_tarefas")
      .update({
        executando_desde: null,
        ultima_execucao: new Date().toISOString(),
        ultimo_resultado: resultado.slice(0, 500),
      })
      .eq("id", tarefa.id);
  };

  if (!executar) {
    await liberar("erro: tarefa sem executor no código");
    return json(200, { tarefa: tarefa.id, erro: "tarefa sem executor no código" });
  }

  try {
    const r = await executar((tarefa.params as Record<string, unknown>) ?? {});
    const resumo = resumoDoTique({
      importados: r.importados,
      haMais: r.varredura?.haMais,
      erros: r.erros?.length,
    });
    await liberar(resumo);
    return json(200, {
      tarefa: tarefa.id,
      importados: r.importados ?? 0,
      haMais: r.varredura?.haMais ?? false,
      erros: r.erros?.length ?? 0,
    });
  } catch (e) {
    await liberar(`erro: ${(e as Error).message}`);
    return json(200, { tarefa: tarefa.id, erro: (e as Error).message });
  }
}
