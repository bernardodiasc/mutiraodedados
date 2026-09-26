/**
 * Importação sob demanda, sem o painel:
 *
 *   bun run importar <tarefa>... <intervalo>       # janelas explícitas
 *   bun run importar <tarefa>... --pendentes       # só as sem conferência aprovada
 *   bun run importar --todas --pendentes           # todas as fontes, na ordem
 *   bun run importar <tarefa> … --param chave=valor  # parâmetro próprio da tarefa
 *
 * Fatia o intervalo nas janelas naturais da tarefa (mês, ano, período do
 * SICONFI ou a janela única do cadastro), da mais recente para a mais
 * antiga — ou pede à rota a lista de pendentes —, gera um `execucao_id` por
 * janela e chama o modo nomeado de `/api/cron-importar` até cada janela
 * responder `haMais: false`, quando a rota devolve a conferência. Aplica a
 * política de parada (`importar-cli.ts`). Com várias tarefas, roda uma fonte
 * por vez na ordem da tabela de dependências (`dependencias.ts`): a que para
 * bloqueia as que dependem dela, e a sem adaptador é pulada com aviso. Lê `CRON_SECRET` e `SITE_URL` do
 * `.env.local` na raiz do repositório — o arquivo não é versionado. Detalhes
 * em docs/automacao.md.
 *
 * Termina com o resumo por fonte. Código de saída: 0 quando todas as janelas
 * foram aprovadas (ou já estavam completas, sem `--reprocessar`); 1 quando
 * alguma ficou inconclusiva ou reprovada, uma fonte parou ou foi bloqueada,
 * ou nenhuma tarefa pedida tinha adaptador; 2 para uso incorreto; 3 quando a
 * cota da chave do Portal da Transparência acabou — as fontes da chave ficam
 * pausadas.
 */
import { readFileSync } from "node:fs";
import {
  codigoDeSaidaDasFontes,
  corpoDasPendentes,
  executarFontes,
  interpretarArgs,
  lerEnv,
  resumoDasFontes,
  temAdaptador,
  type CorpoNomeado,
  type RespostaRodada,
} from "../src/lib/data/automacao/importar-cli";
import type { RespostaPendentes } from "../src/lib/data/automacao/nomeado";

/** Acima dos ~180 s que uma rodada pode levar, com folga. */
const TIMEOUT_CHAMADA_MS = 300_000;

function configuracao(): { url: string; segredo: string } {
  let texto: string;
  try {
    texto = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
  } catch {
    throw new Error("sem .env.local na raiz do repositório (precisa de CRON_SECRET e SITE_URL)");
  }
  const env = lerEnv(texto);
  if (!env.CRON_SECRET || !env.SITE_URL) {
    throw new Error(".env.local precisa de CRON_SECRET e SITE_URL");
  }
  return { url: env.SITE_URL.replace(/\/+$/, ""), segredo: env.CRON_SECRET };
}

async function main(): Promise<number> {
  let args: ReturnType<typeof interpretarArgs>;
  let cfg: ReturnType<typeof configuracao>;
  try {
    args = interpretarArgs(process.argv.slice(2));
    cfg = configuracao();
  } catch (e) {
    console.error((e as Error).message);
    return 2;
  }

  const post = async <T>(corpo: unknown): Promise<T> => {
    const res = await fetch(`${cfg.url}/api/cron-importar`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-cron-secret": cfg.segredo },
      body: JSON.stringify(corpo),
      signal: AbortSignal.timeout(TIMEOUT_CHAMADA_MS),
    });
    const texto = await res.text();
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${texto.slice(0, 500)}`);
    return JSON.parse(texto) as T;
  };

  const desfechos = await executarFontes(args, {
    chamar: (corpo: CorpoNomeado) => post<RespostaRodada>(corpo),
    consultarPendentes: (tarefa, params) =>
      post<RespostaPendentes>(corpoDasPendentes(tarefa, params)),
    temAdaptador,
    novoExecucaoId: () => crypto.randomUUID(),
    esperar: (ms) => new Promise((r) => setTimeout(r, ms)),
    log: (linha) => console.log(linha),
  });

  console.log(`\nresumo\n${resumoDasFontes(desfechos)}`);
  return codigoDeSaidaDasFontes(desfechos);
}

process.exit(await main());
