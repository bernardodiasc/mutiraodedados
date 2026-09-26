/**
 * Tipos de proposição da Câmara e siglas de matéria do Senado que o painel
 * importa — a lista do seletor e do "Sincronizar tudo", e as que a
 * ferramenta `bun run importar` percorre quando o pedido não restringe a
 * sigla. Um lugar só, para as três não divergirem.
 */
export const TIPOS_PROPOSICAO_CAMARA = ["PL", "PEC", "PLP", "MPV", "PDL", "PRC"] as const;

export const SIGLAS_MATERIA_SENADO = ["PL", "PLS", "PEC", "PLP", "PDL", "PRC", "MPV"] as const;
