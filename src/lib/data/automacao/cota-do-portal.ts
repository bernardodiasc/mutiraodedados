/**
 * Cota da chave do Portal da Transparência, na ferramenta `bun run importar`.
 *
 * Contratos, catálogo SIAFI, atividade dos órgãos, licitações, emendas e
 * convênios (por período e por ente) usam a MESMA chave da API do Portal,
 * com cota compartilhada. O cliente HTTP já re-tenta
 * o 429 com espera (`http-retry.ts`); um 429 que sobrevive a isso é a cota
 * acabando. Insistir — re-tentar a janela, seguir para a próxima, passar a
 * outra fonte da chave — só gasta o que sobrou.
 *
 * Política: a fonte para na hora, sem re-tentar a janela, e todas as fontes
 * da chave ficam pausadas até a cota voltar. Ficar pendente é o estado
 * natural: a janela não ganhou conferência aprovada, e a próxima execução
 * com `--pendentes` a retoma.
 */

/** Tarefas do modo nomeado que usam a chave do Portal. */
export const TAREFAS_DA_CHAVE_DO_PORTAL: readonly string[] = [
  "cgu_contratos",
  "cgu_siafi",
  "cgu_atividade",
  "cgu_licitacoes",
  "cgu_emendas",
  "convenios",
  "transferegov",
];

export const usaChaveDoPortal = (tarefa: string) => TAREFAS_DA_CHAVE_DO_PORTAL.includes(tarefa);

/** Código de saída da ferramenta quando a cota acabou: pausar as fontes da chave. */
export const SAIDA_COTA_DO_PORTAL = 3;

/** O que a ferramenta precisa ver de cada rodada. */
type RodadaVista = { parada: string; erros: readonly string[] };

/**
 * A tentativa esbarrou na cota: alguma rodada foi interrompida (falha
 * passageira, `parada: "erro"`) com um 429 do Portal nos erros.
 */
export function esbarrouNaCota(tarefa: string, rodadas: readonly RodadaVista[]): boolean {
  return (
    usaChaveDoPortal(tarefa) &&
    rodadas.some((r) => r.parada === "erro" && r.erros.some((e) => /Portal 429\b/.test(e)))
  );
}

export const MOTIVO_COTA =
  "O Portal da Transparência respondeu 429 mesmo depois das novas tentativas: a cota da chave acabou.";

export function avisoDePausa(tarefa: string): string {
  return `Cota da chave do Portal da Transparência esgotada: a fonte ${tarefa} para aqui, e as fontes da chave (${TAREFAS_DA_CHAVE_DO_PORTAL.join(", ")}) ficam pausadas até a cota voltar. As janelas continuam pendentes.`;
}
