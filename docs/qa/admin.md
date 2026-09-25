# QA manual — painel admin

Roteiro permanente das telas do `/admin`, exceto importação de dados. Rode as seções afetadas sempre que uma release mudar a UI do admin — é o check "Fluxos afetados testados no preview; screenshots quando visual" da seção 2 do [WORKFLOW](../../WORKFLOW.md) — e o roteiro inteiro numa rodada completa de testes. Como usar os roteiros, registrar divergências e ler a coluna Cobertura está no [índice de QA](./README.md). O que cada aba faz está em [`docs/admin.md`](../admin.md); importação, limpeza e automação (incluindo a sub-aba Estados/Municípios de `/admin/dados`) ficam em [`importacao.md`](./importacao.md).

Quando a Cobertura diz entre parênteses o que o teste cobre, ele garante só aquela parte, e o resto do item continua manual. Muitas ações do admin têm reflexo nas páginas públicas: o item diz onde conferir, e o lado público está em [`paginas-publicas.md`](./paginas-publicas.md).

Para rodar é preciso duas contas: uma com papel de admin e uma comum, sem papel.

## Acesso e permissões

| #   | O quê                                                    | Esperado                                                                                                                                 | Cobertura                                                                    |
| --- | -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| 1   | Abrir `/admin` (ou qualquer aba) deslogado               | Redireciona para `/login`, levando a tela pedida no parâmetro `redirect`                                                                 | manual                                                                       |
| 2   | Entrar a partir desse redirecionamento                   | Depois do login, volta para a tela do admin que foi pedida; o retorno só leva a rotas internas do site                                   | coberto por `src/lib/destino-seguro.test.ts` (rotas aceitas); retorno manual |
| 3   | Abrir `/admin/*` logado com conta **sem** papel de admin | Redireciona para a home com o aviso "Acesso restrito a administradores."; nenhum dado do admin aparece, nem por um instante              | manual                                                                       |
| 4   | Conta comum no menu do site                              | Nenhum atalho para o admin; `/caderno` e `/minhas-marcacoes` funcionam normalmente                                                       | manual                                                                       |
| 5   | Ação de escrita do admin chamada por conta comum         | O servidor recusa (as funções do admin conferem o papel no servidor, não só na tela)                                                     | manual                                                                       |
| 6   | Sessão expirada com o admin aberto                       | A sessão é renovada ou a tela leva ao login; nenhuma ação fica girando sem resposta                                                      | manual                                                                       |
| 7   | Logado como admin, navegação                             | Barra do admin com Análises (em breve), Artigos, Dados, Lacunas, Marcações, Perguntas, Prompts, Qualidade, Roadmap e Sinais; todas abrem | manual                                                                       |

## Lacunas

Tela `/admin/lacunas`. Ciclo e origem das lacunas em [laboratorio-civico.md](../dominios/laboratorio-civico.md#como-lacunas-nascem). Reflexo público em `/lacunas`.

| #   | O quê                                              | Esperado                                                                                                                                    | Cobertura |
| --- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| 1   | Abrir a tela                                       | Lista todas as lacunas, inclusive as não publicadas e as resolvidas                                                                         | manual    |
| 2   | "Criar lacuna" com título curto ou descrição curta | Botão desabilitado (título com menos de 4 caracteres ou descrição com menos de 10)                                                          | manual    |
| 3   | Criar lacuna manual válida                         | Entra na lista na hora, com ciclo "nasce"                                                                                                   | manual    |
| 4   | Mudar o ciclo                                      | Aceita nasce, qualificada, evolui, conecta e encerra; reflete na lista sem recarregar                                                       | manual    |
| 5   | Publicar                                           | A lacuna aparece em `/lacunas`                                                                                                              | manual    |
| 6   | Despublicar                                        | Some de `/lacunas`; continua no admin                                                                                                       | manual    |
| 7   | Marcar resolvida / Reabrir                         | Resolvida continua pública (se publicada) com selo de resolvida; reabrir tira o selo                                                        | manual    |
| 8   | Converter um finding candidato                     | Mensagem "Finding convertido em lacuna."; o finding some da lista de candidatos; a lacuna nasce com ciclo "qualificada" e ligada ao finding | manual    |
| 9   | Tentar converter o mesmo finding de novo           | Não é possível: ele já não está entre os candidatos, e não surge lacuna duplicada                                                           | manual    |

## Qualidade

Tela `/admin/qualidade`. Taxonomia, severidades e status em [qualidade-dados.md](../qualidade-dados.md). Reflexo público em `/qualidade`, `/qualidade/$id` e nos banners das fichas.

| #   | O quê                                                | Esperado                                                                                                                | Cobertura                                                   |
| --- | ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| 1   | Abrir a tela                                         | Filtro de status começa em "aberto"; filtros de fonte, status, regra e tipo combinam entre si                           | manual                                                      |
| 2   | Filtro de fonte                                      | Oferece toda fonte que tem regra persistida, incluindo TSE                                                              | coberto por `src/lib/admin-qualidade/logic.test.ts`         |
| 3   | Filtro de tipo `investigativo`                       | Mostra os sinais investigativos persistidos (cruzamentos TSE, licitações sem desfecho)                                  | manual                                                      |
| 4   | "Re-checar" num finding de valor do Portal CGU       | Só aparece para findings da CGU; leitura concordante resolve, leitura única divergente fica inconclusiva e nada muda    | manual                                                      |
| 5   | Comandos de reprodução de um finding de contrato CGU | Vêm prontos para copiar, com o contexto do registro; fonte sem suporte não mostra o bloco                               | coberto por `src/lib/admin-qualidade/logic.test.ts`         |
| 6   | "Confirmar"                                          | Status muda para confirmado; finding crítico confirmado gera lacuna automaticamente (conferir em `/admin/lacunas`)      | manual                                                      |
| 7   | "Preparar reporte oficial"                           | Abre o texto-base do chamado com a evidência preenchida e o canal oficial da fonte                                      | coberto por `src/lib/reporte-oficial/logic.test.ts` (texto) |
| 8   | "Corrigido na origem"                                | Status muda; o finding sai da fila de abertos                                                                           | manual                                                      |
| 9   | "Falso positivo"                                     | Status muda; o finding continua listado em `/qualidade` com o rótulo "Falso positivo" e some do banner da ficha afetada | manual                                                      |
| 10  | Notas do finding                                     | Salvam e reaparecem ao reabrir o finding                                                                                | manual                                                      |

## Sinais

Tela `/admin/sinais`: só os sinais de contratos calculados em memória ([anomalias-e-sinais.md](../dominios/anomalias-e-sinais.md)). Reflexo público em `/anomalias`.

| #   | O quê                                          | Esperado                                                                                                                        | Cobertura                                                         |
| --- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| 1   | Abrir a tela                                   | Sinais ordenados por severidade; filtros de severidade, status e regra; contadores batem com a lista filtrada                   | coberto por `src/lib/admin-sinais/logic.test.ts`                  |
| 2   | Cada sinal                                     | Link para o registro no site e comandos de reprodução                                                                           | coberto por `src/lib/admin-sinais/logic.test.ts`                  |
| 3   | "Abrir investigação manualmente" num sinal     | O sinal vira investigação persistida com severidade "aviso" por padrão; a tela passa a mostrar a investigação no lugar do botão | coberto por `src/lib/investigacao-inline/logic.test.ts` (payload) |
| 4   | Marcar falso positivo, confirmado, investigado | Status persiste ao recarregar e respeita o filtro de status                                                                     | manual                                                            |

## Artigos

Tela `/admin/artigos` ([artigos-e-aprendizado.md](../dominios/artigos-e-aprendizado.md)). Reflexo público em `/mapas`, `/tutoriais` e `/notas`.

| #   | O quê                                  | Esperado                                                                                                  | Cobertura                                                |
| --- | -------------------------------------- | --------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| 1   | Novo artigo: digitar o título          | Slug gerado do título, sem acentos nem espaços; editar o slug à mão só aceita minúsculas, dígitos e hífen | coberto por `src/lib/admin-artigos/logic.test.ts`        |
| 2   | Salvar uma nota                        | Dificuldade e tempo de leitura não se aplicam e ficam vazios                                              | coberto por `src/lib/admin-artigos/logic.test.ts`        |
| 3   | Salvar como rascunho                   | Não aparece no índice público da categoria                                                                | manual                                                   |
| 4   | Publicar                               | Aparece na rota pública da categoria certa (mapa, tutorial ou nota)                                       | coberto por `src/lib/admin-artigos/logic.test.ts` (rota) |
| 5   | Editar um artigo que tem capa e salvar | A capa é preservada                                                                                       | coberto por `src/lib/data/artigos-payload.test.ts`       |
| 6   | Editar um artigo publicado e salvar    | A data de publicação é mantida                                                                            | coberto por `src/lib/data/artigos-payload.test.ts`       |
| 7   | Abas por categoria e contadores        | Batem com a lista                                                                                         | coberto por `src/lib/admin-artigos/logic.test.ts`        |
| 8   | "Baixar CSV" e "Copiar texto"          | CSV da lista filtrada; texto com título, resumo, fontes e conteúdo                                        | coberto por `src/lib/admin-artigos/logic.test.ts`        |

## Prompts e Kit de investigação

Tela `/admin/prompts` ([laboratorio-civico.md](../dominios/laboratorio-civico.md#kit-de-investigação-mapas--prompts)). Reflexo público no Kit de `/mapas/$slug`.

| #   | O quê                                               | Esperado                                                                                             | Cobertura                                            |
| --- | --------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| 1   | Criar prompt com título ou texto curtos             | Não salva (título com menos de 5 caracteres ou texto com menos de 10)                                | coberto por `src/lib/admin-prompts/logic.test.ts`    |
| 2   | Variáveis: adicionar, editar dica e link, remover   | Variável sem nome é descartada ao salvar; editar e reabrir mostra os mesmos valores                  | coberto por `src/lib/admin-prompts/logic.test.ts`    |
| 3   | Link de variável externo (`https://…`)              | Recusado — o link precisa ser rota interna; no Kit público nenhuma variável aponta para fora do site | coberto por `src/lib/kit-investigacao/logic.test.ts` |
| 4   | Prompt com variáveis no formato antigo              | Abre e salva sem erro                                                                                | coberto por `src/lib/admin-prompts/logic.test.ts`    |
| 5   | Prompt ativo vinculado a mapa publicado             | Aparece no Kit do mapa                                                                               | manual                                               |
| 6   | Prompt inativo, ou sem vínculo, ou mapa em rascunho | Não aparece em nenhum Kit público                                                                    | manual                                               |
| 7   | Desvincular de um mapa                              | Some do Kit daquele mapa e continua nos outros                                                       | manual                                               |
| 8   | Filtro por status, CSV e "Copiar"                   | Filtro e contadores batem; CSV achata variáveis e tags                                               | coberto por `src/lib/admin-prompts/logic.test.ts`    |

## Perguntas

Tela `/admin/perguntas`, abas Modelos, Moderação e Publicadas. Ciclo em [laboratorio-civico.md](../dominios/laboratorio-civico.md#estados-pergunta_status). Reflexo público em `/perguntas`.

| #   | O quê                                  | Esperado                                                                | Cobertura                                           |
| --- | -------------------------------------- | ----------------------------------------------------------------------- | --------------------------------------------------- |
| 1   | Criar ou editar modelo                 | Título com menos de 5 caracteres não salva; editar envia só o que mudou | coberto por `src/lib/admin-perguntas/logic.test.ts` |
| 2   | Modelo ativo                           | Aparece em `/perguntas` e em `/caderno/nova`; inativo não               | manual                                              |
| 3   | Moderação: aprovar pergunta em revisão | Vira publicada e aparece em `/perguntas` sem o autor                    | manual                                              |
| 4   | Moderação: rejeitar                    | Exige motivo; a pergunta volta a privada no caderno do autor            | manual                                              |
| 5   | Despublicar uma publicada              | Some de `/perguntas`; volta a privada para o autor                      | manual                                              |

## Marcações e contestações

Tela `/admin/marcacoes`.

| #   | O quê                                          | Esperado                                                            | Cobertura                                                                   |
| --- | ---------------------------------------------- | ------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| 1   | Contestação enviada por `/contestar`           | Aparece na tela com página, tipo, descrição e protocolo             | manual                                                                      |
| 2   | Tratar uma contestação                         | Mudança de status e resposta salvam; sem alteração, nada é enviado  | coberto por `src/lib/admin-marcacoes/logic.test.ts` (detecção de alteração) |
| 3   | Marcações cidadãs em registros                 | Listadas com a severidade derivada dos votos e link para o registro | coberto por `src/lib/admin-marcacoes/logic.test.ts`                         |
| 4   | "Abrir investigação manualmente" numa marcação | Vira investigação persistida, como em Sinais                        | manual                                                                      |

## Roadmap

Tela `/admin/roadmap` ([seção 4 do WORKFLOW](../../WORKFLOW.md#4-os-dois-roadmaps)). Reflexo público em `/roadmap`.

| #   | O quê                            | Esperado                                                                                                        | Cobertura                                         |
| --- | -------------------------------- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| 1   | Criar item                       | Entra no fim da ordem; campos vazios salvos como vazios, não "null"; o cabeçalho da tela aponta para `/roadmap` | coberto por `src/lib/admin-roadmap/logic.test.ts` |
| 2   | Arrastar para reordenar          | A nova ordem persiste ao recarregar e vale também em `/roadmap`                                                 | manual                                            |
| 3   | Mudar status para concluído      | Vai para Concluídos, ordenado por data de conclusão                                                             | coberto por `src/lib/admin-roadmap/logic.test.ts` |
| 4   | Desmarcar "público"              | Some de `/roadmap`; continua no admin                                                                           | manual                                            |
| 5   | Notas internas                   | Aparecem só no admin, nunca em `/roadmap`                                                                       | manual                                            |
| 6   | Abas, contadores, CSV e "Copiar" | Batem com a lista; CSV traduz status e público                                                                  | coberto por `src/lib/admin-roadmap/logic.test.ts` |

## Análises e dashboard

| #   | O quê             | Esperado                                         | Cobertura |
| --- | ----------------- | ------------------------------------------------ | --------- |
| 1   | `/admin`          | Atalhos para todas as abas; nenhum link quebrado | manual    |
| 2   | `/admin/analises` | Marcada como "em breve"; abre sem erro           | manual    |
