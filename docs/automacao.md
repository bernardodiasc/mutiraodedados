# Automação periódica das importações

Desde a v0.11.0 as importações podem rodar sem operador. O desenho tem três peças, e a regra que as une: **o agendador é só mais um gatilho** — as rodadas são exatamente as do painel (mesmos núcleos, mesmo orçamento, mesma retomada, mesmo Histórico). Cada linha de rodada em `importacoes` diz qual [gatilho](./importacao.md#gatilho-e-execução) a disparou: `painel`, `cron` ou `ferramenta`.

## As peças

1. **Rota `/api/cron-importar`** (POST) — interceptada em `src/server.ts`, antes do framework. Exige o header `x-cron-secret` igual ao secret `CRON_SECRET` do ambiente; sem o secret configurado, responde 401 para tudo (desligada por padrão). Tem dois modos:
   - **Modo fila** (sem corpo, ou corpo `{}` — o que o `pg_net` manda): reivindica a próxima tarefa da fila, executa **uma rodada com orçamento** e devolve `{tarefa, importados, haMais, erros}`. As linhas saem com `gatilho = cron`.
   - **Modo nomeado** (corpo com `tarefa`): executa uma rodada da tarefa e da janela pedidas, sem passar pela fila. É o que a ferramenta `bun run importar` usa — seção [Importação sob demanda](#importação-sob-demanda-modo-nomeado).
2. **Fila `automacao_tarefas`** — declarativa, semeada pela migration com a rotação v1 (PNCP, convênios, CEAP, CEAPS, votações das duas casas, matérias, proposições, origem SICONV, IBGE). `ativo` liga/desliga por tarefa; `params` guarda escolhas (ex.: sigla das matérias); o claim usa `FOR UPDATE SKIP LOCKED` com lock que expira em 15 minutos. As janeladas importam sempre o **mês corrente (UTC)** — o mês anterior foi varrido nos tiques dele, e a coluna Resultado sabe ler zero de período recente.
3. **Agendador `pg_cron` + `pg_net`** — um tique a cada 5 minutos, que só dispara quando `automacao_config` (service_role only) tem linha ativa com a URL do site e o mesmo segredo. **Nada disso vive no repositório.**

## Ativação (papel do mantenedor)

1. Criar o secret **`CRON_SECRET`** no painel do Lovable Cloud (mesmo caminho dos demais secrets), com um valor longo e aleatório.
2. Inserir a config no banco (SQL no editor do Supabase/Lovable):

   ```sql
   INSERT INTO automacao_config (url, segredo)
   VALUES ('https://mutiraodedados.com.br', '<o mesmo valor de CRON_SECRET>');
   ```

3. Conferir: em ~5 min, `SELECT * FROM automacao_tarefas ORDER BY ultima_execucao DESC NULLS LAST;` deve mostrar `ultimo_resultado` preenchendo. Cada tique também grava a linha de rodada normal no Histórico de `/admin/dados`.

Para **pausar tudo**: `UPDATE automacao_config SET ativo = false;`. Uma tarefa só: `UPDATE automacao_tarefas SET ativo = false WHERE id = '...';`.

## Alternativa sem pg_cron (ex.: Make)

Qualquer agendador externo funciona: um cenário que faça `POST https://mutiraodedados.com.br/api/cron-importar` com o header `x-cron-secret` a cada N minutos. A resposta traz `haMais` — o cenário pode repetir a chamada até `false` se quiser esvaziar uma fonte no mesmo dia.

## Importação sob demanda (modo nomeado)

Para importar uma janela qualquer sem o painel. Cada tarefa tem um adaptador registrado em `src/lib/data/automacao/nomeado.ts`, uma linha por tarefa. O contrato do adaptador fica em `adaptador.ts`; os adaptadores de fonte, cada um no seu módulo (`adaptadores/<fonte>.ts` e `nomeado-<tarefa>.ts`).

| Tarefa                         | Fonte no Histórico                  | Janela natural                                                         | Recorte ou parâmetro                                                                 | Total da origem                                                                      | Pendentes                              |
| ------------------------------ | ----------------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ | -------------------------------------- |
| `camara_vot`                   | `camara_vot`                        | um mês                                                                 | —                                                                                    | `X-Total-Count` da listagem (votações sem detalhe na origem descartadas, com alerta) | por mês                                |
| `senado_vot`                   | `senado_vot`                        | um mês                                                                 | —                                                                                    | tamanho da lista (sessões sem código descartadas)                                    | por mês                                |
| `cgu_contratos`                | `cgu`                               | um mês de um órgão (início de vigência no mês)                         | órgão ou lista (`--orgao`); sem ele, com `--pendentes`, os órgãos ativos do catálogo | não informa                                                                          | por órgão e mês                        |
| `cgu_licitacoes`               | `cgu_licitacoes`                    | um mês de um órgão                                                     | órgão ou lista (`--orgao`); sem ele, com `--pendentes`, os órgãos ativos do catálogo | não informa                                                                          | por órgão e mês                        |
| `cgu_siafi`                    | `orgaos_siafi` (escopo `nomes`)     | o catálogo inteiro, uma página por passo                               | —                                                                                    | não informa                                                                          | cadastro (uma janela)                  |
| `cgu_atividade`                | `orgaos_siafi` (escopo `atividade`) | a sonda de todos os órgãos, um por passo                               | —                                                                                    | não informa                                                                          | cadastro (uma janela)                  |
| `cgu_emendas`                  | `cgu_emendas`                       | um ano                                                                 | —                                                                                    | não informa                                                                          | por ano                                |
| `transferegov`                 | `transferegov`                      | um mês                                                                 | município ou UF (`--municipio`, `--uf`)                                              | não informa                                                                          | por mês, do ente                       |
| `pncp`                         | `pncp`                              | um mês                                                                 | `uf`, `municipioIbge`, `cnpjOrgao` (`--param`)                                       | `totalRegistros`, só sem filtro de UF ou município                                   | por mês                                |
| `convenios`                    | `cgu_convenios`                     | um mês                                                                 | —                                                                                    | não informa                                                                          | por mês                                |
| `camara_ceap`                  | `camara_ceap`                       | um mês (exige o cadastro da legislatura)                               | `deputadoId` (`--param`)                                                             | não informa (só por deputado)                                                        | por mês                                |
| `senado_ceaps`                 | `senado_ceaps`                      | um mês                                                                 | `senadorId` (`--param`)                                                              | tamanho da lista do mês (despesas ilegíveis descartadas)                             | por mês                                |
| `senado_mat`                   | `senado_mat`                        | um ano de uma sigla                                                    | `sigla` (`--param`; sem ele, as do painel)                                           | tamanho da lista (itens ilegíveis descartados)                                       | por ano e sigla                        |
| `camara_props`                 | `camara_props`                      | um ano de um tipo                                                      | `siglaTipo` (`--param`; sem ele, os do painel)                                       | `X-Total-Count` da listagem                                                          | por ano e tipo                         |
| `ibge`                         | `ibge`                              | o cadastro inteiro                                                     | —                                                                                    | lista nacional de municípios, buscada na última rodada                               | cadastro (uma janela)                  |
| `camara_cadastro`              | `camara_deputados`                  | uma legislatura (padrão: a atual)                                      | `idLegislatura` (`--param`)                                                          | `X-Total-Count` da listagem (repetições de titular e suplente descartadas)           | cadastro (uma janela)                  |
| `siconfi_relatorio`            | `siconfi`                           | um relatório de um ente: exercício e período do tipo                   | `codIbge` e `tipoRelatorio` (`--param`), obrigatórios                                | não informa (só `hasMore`)                                                           | por período, de um ente e um relatório |
| `senado_cadastro`              | `senado_senadores`                  | os senadores em exercício                                              | —                                                                                    | tamanho da lista (itens sem código e repetições descartados)                         | cadastro (uma janela)                  |
| `camara_trajetoria`            | `camara_trajetoria`                 | uma legislatura (padrão: a atual), exige o cadastro dela               | `idLegislatura` (`--param`)                                                          | não informa (a lista é o nosso cadastro)                                             | cadastro (uma janela)                  |
| `siconfi_ano`                  | `siconfi`                           | os 10 relatórios padrão de um ente num exercício                       | `codIbge` (`--param`), obrigatório                                                   | não informa (só `hasMore`)                                                           | por exercício encerrado, de um ente    |
| `siconfi_varredura`            | `siconfi`                           | os 10 relatórios padrão de um conjunto num exercício                   | `conjunto` (`--param`), obrigatório; `uf` nos municípios, `codIbge` no ente          | não informa (só `hasMore`)                                                           | por exercício encerrado, do conjunto   |
| `convenios_origem`             | `convenios_origem`                  | o CSV inteiro, em lotes de linhas (exige o acervo de convênios)        | —                                                                                    | não informa                                                                          | cadastro (uma janela)                  |
| `tse_arquivo`                  | `tse_<tipo>` (escopo `<ano>-<UF>`)  | um arquivo: tipo × eleição × UF                                        | `tipo`, `uf` (`--param`; sem eles, a matriz inteira)                                 | não informa                                                                          | por eleição, tipo e UF                 |
| `tse_ponte`                    | `tse_ponte` (escopo = a casa)       | o cadastro de uma casa, em lotes de 40 (exige candidatos e o cadastro) | `casa` (`--param`; sem ele, as duas)                                                 | não informa                                                                          | cadastro, uma janela por casa          |
| `tse_lacunas`                  | `tse_lacunas`                       | uma eleição (chamada única)                                            | —                                                                                    | não se aplica (conferência mínima)                                                   | por eleição                            |
| `tse_sinais`                   | `tse_sinais`                        | uma eleição (chamada única)                                            | —                                                                                    | não se aplica (conferência mínima)                                                   | por eleição                            |
| `cruzamento_doador_fornecedor` | `tse_doador_fornecedor`             | uma eleição (chamada única; exige os contratos da CGU)                 | —                                                                                    | não se aplica (conferência mínima)                                                   | por eleição                            |

Nas tarefas com recorte, cada órgão ou ente é uma linha própria da matriz de cobertura: as rodadas gravam `escopo` = código do órgão nos contratos e nas licitações, e `municipio:<ibge>` ou `uf:<código>` nos convênios por ente (sem ente, `escopo` vazio — o mês do país inteiro). A conferência e a consulta de pendentes olham só a linha pedida. No SICONFI, a linha da matriz é o tipo de relatório (no `escopo`) e o ente vai em `orgao_cod`.

**CGU por órgão e órgãos ativos do catálogo.** Contratos e licitações são órgão × mês: cada janela é um mês de um órgão, com o órgão no `escopo` da janela, das rodadas e da conferência. Com `--orgao COD` (ou uma lista, `--orgao 26000,36000`), a ferramenta percorre só esses órgãos. Sem `--orgao`, no modo `--pendentes` (inclusive com `--todas`), percorre os **órgãos ativos do catálogo SIAFI**: os de `orgaos_cache` cobertos pelo Portal que a sonda de atividade já verificou e achou com execução recente. A lista é montada pela rota, na consulta de pendentes — por isso `cgu_contratos` e `cgu_licitacoes` dependem de `cgu_siafi` e `cgu_atividade` na tabela de dependências. Com intervalo explícito, `--orgao` é obrigatório. A sonda de atividade verifica todo o catálogo, mais os órgãos que já aparecem em documentos importados: órgão nunca sondado não entra na lista.

**Custo dos contratos.** Cada contrato custa um GET de detalhe (`/contratos/id`, o valor autoritativo), então a rodada dos contratos tem, além do orçamento de tempo, um **teto de custo** em subrequisições (`TETO_SUBREQUISICOES_PORTAL`, em `src/lib/data/real/sweep.ts`): listagem, detalhes e uma estimativa das gravações de cada página. Parar pelo teto é `parada: "subrequisicoes"`, e a rodada seguinte segue da página onde parou. O catálogo SIAFI e a sonda de atividade usam o mesmo teto e o orçamento de tempo das demais fontes. Um detalhe que falha de forma passageira (429 persistente, 5xx, rede) interrompe a rodada sem avançar a página, e a próxima a refaz; detalhe com erro definitivo cai para o valor da listagem, com o erro no log.

Matérias e proposições gravam a sigla ou o tipo no `escopo`: cada (ano, sigla) é uma varredura e uma conferência próprias, e aprovar as PL de 2024 não tira as PEC de 2024 das pendentes. Sem `--param sigla` (ou `siglaTipo`), a ferramenta e a consulta de pendentes percorrem as siglas e os tipos que o painel importa (`src/lib/data/siglas-legislativas.ts`); com ele, só o pedido. A matriz de cobertura continua com uma linha anual por fonte, sem separar sigla: a célula (e o reflexo na conferência) conta todas as siglas do ano.

**SICONFI em lote.** A varredura (`siconfi_varredura`) percorre os 10 relatórios padrão (RREO 1 a 6, RGF 1 a 3, DCA) de cada ente de um conjunto — `ufs`, `capitais`, `municipios` de uma UF (`uf`, a sigla; a lista vem do cadastro do IBGE, que por isso vem antes na tabela de dependências) ou um `ente` (`codIbge`) —, uma consulta por passo, retomável pelo cursor da mesma varredura do painel. A janela da ferramenta é **um exercício** do conjunto; intervalo maior é recusado. O ano todo de um ente (`siconfi_ano`) é essa mesma varredura com o conjunto `ente`: mesma chave, mesmas conferências. Cada consulta grava a sua linha como o relatório avulso (tipo no `escopo`, exercício e período em `ano`/`mes`, ente em `orgao_cod`), casando com a matriz de cobertura; a rodada grava mais uma, com o conjunto no `escopo` (`varredura:<conjunto>[:<filtro>]`) e o exercício em `ano` com `mes` 0 — é nela que a conferência da janela fica, e é por ela que as pendentes são lidas. A célula contada na conferência são as linhas do exercício nos entes do conjunto. Uma rodada roda 3 consultas por vez e vai até o orçamento de tempo (150 s) ou o teto de custo de 400 (~80 mil linhas; mais que isso numa chamada derrubou o Worker, [detalhe](./importacao.ia.md#teto-do-siconfi)): o ano todo de um ente cabe no teto padrão de rodadas, mas um conjunto grande não — os municípios de MG num exercício são 8.530 consultas —, então suba o teto com `--teto-rodadas`, senão a janela é reprovada por laço.

**Trajetória dos deputados.** O progresso não fica numa varredura do servidor: cada rodada processa um lote de 60 deputados a partir de `params.offset` e devolve o próximo no `cursor`; a ferramenta o manda de volta em `offset` na rodada seguinte, até `haMais: false`. Uma execução nova (inclusive a re-tentativa de uma inconclusiva) começa do offset 0. Sem o cadastro da legislatura, a rodada falha pedindo o cadastro antes.

**TSE.** `tse_arquivo` é uma tarefa só para os cinco tipos de arquivo (candidatos, bens, receitas, despesas, resultados): cada janela é um arquivo — tipo × eleição × UF —, com o arquivo no `escopo` da janela da ferramenta (`bens/AC`). O intervalo é por eleição (`AAAA` ou `AAAA..AAAA`; anos sem eleição ficam de fora), e em cada eleição a ferramenta e a consulta de pendentes vão de candidatos para os demais tipos (os outros referenciam o catálogo de candidatos), UF a UF, só nas combinações que o TSE publica (`src/lib/data/tse/matriz.ts`). A rota recusa com 400 ano sem eleição, ano fora da janela e combinação não publicada. As linhas gravam `fonte = tse_<tipo>`, `escopo = <ano>-<UF>` e `mes` 1 (a âncora da janela anual; o Histórico mostra só o ano). Bens, receitas e despesas retomam do cursor em `tse_varredura`; candidatos e resultados leem o arquivo inteiro numa rodada. A célula contada na conferência são os registros da eleição e da UF no cache — em bens, as fichas de candidato da UF com o total declarado.

**Vínculo parlamentar↔candidato.** Como a trajetória: cada rodada processa um lote de 40 parlamentares da casa a partir de `params.offset` e devolve o próximo no `cursor` (`parada: "subrequisicoes"`), que a ferramenta manda de volta. Uma linha `tse_ponte` por rodada, com a casa no `escopo`; a contagem da conferência é o total de parlamentares percorridos.

**Cruzamentos.** `tse_lacunas` (eleito sem prestação de contas, candidato sem bens, série histórica incompleta, parlamentar sem vínculo), `tse_sinais` (evolução patrimonial atípica, fornecedor de campanha concentrado) e `cruzamento_doador_fornecedor` rodam os mesmos runners dos botões do painel, restritos à eleição pedida, numa chamada só. Não importam de uma origem — cruzam o que já está no banco —, então a conferência é a **mínima** ([conferência](./importacao.md#conferência)): terminou e log limpo; contagem e reflexo na cobertura "não se aplicam", e o motivo informa os findings novos. Runner que falha vira erro da rodada; os demais da tarefa rodam. A confirmação de "eleito sem prestação de contas" consulta até 60 eleitos por chamada, como o botão: o excedente fica no aviso `info:`.

**CSV da origem.** `convenios_origem` é o arquivo inteiro, em lotes de 500 linhas, retomável pelo cursor em `importacao_varredura`. Cada rodada infla o zip de novo e pula até o cursor — cerca de um segundo de CPU no fim do arquivo.

Nas fontes anuais, o ano corrente conta como janela recente (a origem ainda pode crescer). No SICONFI, o período é o bimestre do RREO (1 a 6), o quadrimestre do RGF (1 a 3), o semestre do RGF simplificado (1 e 2); o DCA é anual, sem período.

### A ferramenta

```sh
bun run importar camara_vot 2024-03              # um mês
bun run importar senado_vot 2024-01..2024-06     # vários meses
bun run importar camara_vot 2023                 # o ano
bun run importar camara_vot 2024-03 --reprocessar
bun run importar camara_vot --pendentes          # só as janelas sem conferência aprovada
bun run importar camara_vot --pendentes 2024     # idem, restrito a 2024
bun run importar cgu_licitacoes 2024-03 --orgao 26000          # licitações de um órgão
bun run importar cgu_licitacoes --pendentes 2024 --orgao 26000
bun run importar cgu_contratos 2024-03 --orgao 26000,36000      # contratos: um mês de cada órgão
bun run importar cgu_contratos --pendentes 2024                 # órgãos ativos do catálogo
bun run importar cgu_siafi cgu_atividade                        # catálogo SIAFI e atividade: sem intervalo
bun run importar cgu_emendas 2020..2023                         # emendas: um ano por janela
bun run importar transferegov 2024-03                           # convênios do país no mês
bun run importar transferegov 2024-03 --uf 35                   # só um estado (ou --municipio 3550308)
bun run importar camara_vot senado_vot --pendentes 2024   # várias fontes
bun run importar --todas --pendentes             # todas as fontes, na ordem das dependências
bun run importar --todas --pendentes --orgao 26000   # idem, com contratos e licitações só desse órgão
bun run importar senado_mat 2022..2024 --param sigla=PEC      # fonte anual
bun run importar camara_cadastro --param idLegislatura=56     # cadastro: sem intervalo
bun run importar siconfi_relatorio 2023 --param codIbge=35 --param tipoRelatorio=RGF
bun run importar siconfi_relatorio --pendentes --param codIbge=35 --param tipoRelatorio=DCA
bun run importar senado_cadastro camara_cadastro camara_trajetoria   # os cadastros, na ordem
bun run importar siconfi_ano 2020..2023 --param codIbge=3550308      # ano todo de um ente, um exercício por janela
bun run importar siconfi_varredura 2023 --param conjunto=municipios --param uf=AC
bun run importar siconfi_varredura --pendentes --param conjunto=capitais
bun run importar tse_arquivo 2022 --param uf=AC                     # os cinco arquivos de uma UF, candidatos primeiro
bun run importar tse_arquivo 2022 --param tipo=receitas --param uf=SP
bun run importar tse_arquivo --pendentes 2024 --param tipo=candidatos
bun run importar tse_ponte                                          # as duas casas; --param casa=camara para uma
bun run importar tse_lacunas tse_sinais cruzamento_doador_fornecedor 2022
bun run importar convenios_origem                                   # o CSV inteiro: sem intervalo
```

Quem opera a ferramenta a pedido do mantenedor — por meta ("toda janela aprovada"), por fonte + janela ou por um roteiro numa issue — é a skill `mutirao-de-dados-importar` (`.agents/skills/`): ela monta as chamadas, roda a ferramenta, publica o relatório na issue indicada e abre uma issue de correção por fonte + causa quando alguma janela é reprovada.

- Lê `CRON_SECRET` e `SITE_URL` (ex.: `https://mutiraodedados.com.br`) do `.env.local` na raiz do repositório. O arquivo não é versionado nem vai para o repositório público; o valor de `CRON_SECRET` é o mesmo cadastrado no ambiente do site.
- `--param chave=valor` manda um parâmetro próprio da tarefa em toda janela (e, no SICONFI, na consulta de pendentes) — ver a tabela acima; no `siconfi_relatorio`, `codIbge` e `tipoRelatorio` são obrigatórios (e `anexo`, opcional); no `siconfi_ano`, `codIbge`; no `siconfi_varredura`, `conjunto` (com `uf` nos municípios e `codIbge` no ente). Com várias tarefas, cada uma usa só as chaves que conhece; com `--todas`, a tarefa sem um `--param` obrigatório é pulada com aviso e não pesa no código de saída, como a sem o recorte obrigatório.
- Fatia o intervalo nas janelas naturais de cada tarefa, da mais recente para a mais antiga: meses (`AAAA-MM`, `AAAA-MM..AAAA-MM`, `AAAA` ou `AAAA..AAAA`); anos nas fontes anuais — emendas, matérias e proposições, estas uma janela por sigla ou tipo — (`AAAA` ou `AAAA..AAAA`); os períodos do relatório em cada exercício no SICONFI (idem); o cadastro não tem intervalo. Gera um `execucao_id` por janela. Com `--pendentes`, a lista de janelas vem da rota ([consulta de pendentes](#consulta-de-pendentes)). Só vai com `reprocessar` a janela cuja última conferência foi reprovada ou inconclusiva. A nunca conferida vai sem: se a varredura já a dá como completa (ex.: importada pelo painel), a rota só a confere, sem reimportar; se está parcial, segue do cursor; se nunca foi tentada, importa normalmente. `--reprocessar` junto com `--pendentes` força a reimportação de todas.
- Repete rodadas da janela até a rota responder `haMais: false`, quando a resposta traz a [conferência](./importacao.md#conferência) da janela. Espera até 300 s por chamada, acima dos ~180 s que uma rodada pode levar.
- **Várias fontes** (várias tarefas, ou `--todas`): a ferramenta importa uma fonte por vez, na ordem da **tabela de dependências** (`src/lib/data/automacao/dependencias.ts`) — cadastros → dados de base → enriquecimento pela origem → TSE (candidatos antes de bens, receitas, despesas e resultados) → vínculo parlamentar↔candidato → cruzamentos. A tabela declara todas as tarefas previstas no modo nomeado: a que ainda não tem adaptador é **pulada com aviso**, e ganhar o adaptador basta para ela entrar na rodada. A fonte que para (ou cuja lista de pendentes não pôde ser lida) **bloqueia só as que dependem dela**; as demais seguem.
  - **Recorte com várias fontes:** `--orgao` vale só para `cgu_contratos` e `cgu_licitacoes`, e `--uf`/`--municipio` só para `transferegov`; as demais tarefas o ignoram. Opção que nenhuma tarefa pedida aceita é recusada. Sem `--orgao`, com `--pendentes`, as tarefas por órgão percorrem os órgãos ativos do catálogo; com intervalo explícito e `--todas`, elas são **puladas** com o motivo no resumo (pedidas pelo nome, é erro de uso).
  - **Cota do Portal com várias fontes:** quando uma fonte esbarra na cota da chave do Portal (abaixo), as fontes seguintes que usam a mesma chave são **puladas** nesta execução, com o motivo no resumo; as que não usam a chave seguem normalmente. A saída é o código 3.
- **Política de parada** (por fonte):
  - janela **reprovada** → a fonte para na hora;
  - janela **inconclusiva** → re-tenta uma vez, após 60 s, com uma execução nova e `reprocessar`; persistindo, a janela fica pendente e a ferramenta segue. **3 janelas inconclusivas seguidas** param a fonte (a origem parece fora do ar);
  - **teto de rodadas** por janela estourado (30, mudável com `--teto-rodadas N`) → reprovada (laço). Com 5 votações em paralelo e o teto de 6.000 subrequisições por rodada ([importação](./importacao.md#paralelismo-nas-rodadas)), um mês cheio de votações da Câmara (~1.500) termina em cerca de 2 rodadas, e 30 sobra; PNCP e Transferegov seguem com o teto de 45 por causa da cota da origem, então uma janela muito grande delas pode pedir `--teto-rodadas` maior;
  - rodada **interrompida** por falha passageira da origem (`parada: "erro"`) encerra a tentativa como inconclusiva, em vez de gastar o teto insistindo;
  - chamada à rota que falha (HTTP fora de 200, rede, tempo) → reprovada;
  - **429 persistente do Portal da Transparência** (a rodada foi interrompida por um 429 que sobreviveu às novas tentativas do cliente HTTP) → a cota da chave acabou: a fonte para na hora, sem re-tentar a janela nem seguir para a próxima, e a ferramenta sai com o código **3**. As fontes que usam a mesma chave — `cgu_contratos`, `cgu_siafi`, `cgu_atividade`, `cgu_licitacoes`, `cgu_emendas`, `convenios` e `transferegov` (lista em `src/lib/data/automacao/cota-do-portal.ts`) — ficam pausadas até a cota voltar; as janelas continuam pendentes.
- **Sem estado local:** as pendências vêm do servidor. Interromper e rodar de novo com `--pendentes` continua de onde parou — as janelas aprovadas saem da lista, e a janela interrompida segue do cursor da varredura. Os vereditos que a própria ferramenta dá (teto, rodada interrompida, chamada que falhou) não são gravados: a janela só continua pendente.
- Imprime cada rodada, com os erros por extenso e os avisos `info:` à parte, e a conferência de cada janela. Problema do dado na origem que já tem regra (ex.: votação da Câmara listada sem detalhe) aparece nos avisos, não nos erros, e o motivo da conferência aprovada soma os descartados ("780 de 784 registros da origem (4 descartados)"). Problema da origem sem regra ainda chega como erro e reprova: é o sinal que falta ([problema da origem na conferência](./importacao.md#problema-da-origem-na-conferência)). No fim, o **resumo** traz uma linha por fonte (janelas por estado, importados, findings novos) e, abaixo dela, cada janela inconclusiva ou reprovada com o `execucao_id`, as rodadas, o motivo e os erros; também as fontes puladas e por quê. Sai com código 0 quando todas as janelas foram aprovadas (ou já estavam completas e aprovadas); 1 quando alguma ficou inconclusiva ou reprovada, uma fonte parou ou foi bloqueada, ou nenhuma tarefa pedida tinha adaptador; 2 para uso incorreto (tarefa fora da tabela, intervalo mal escrito, recorte que nenhuma tarefa pedida aceita, tarefa pedida pelo nome sem o recorte que exige); 3 quando a cota da chave do Portal acabou.

### O contrato da rota

`POST /api/cron-importar` com o header `x-cron-secret` e o corpo:

```json
{
  "tarefa": "camara_vot",
  "params": { "dataInicio": "2024-03-01", "dataFim": "2024-03-31" },
  "execucao_id": "7d1f3c2a-9b8e-4f6d-a5c4-3b2a1f0e9d8c",
  "reprocessar": false
}
```

- **Uma rodada por chamada**, de uma janela no tamanho natural da fonte (tabela acima; nas anuais, `params` leva o ano, ex.: `{"ano": 2023}`). Quem chama repete até `haMais: false`. Os cadastros de deputados e de senadores e o relatório do SICONFI são chamadas únicas: a primeira rodada já responde `haMais: false`.
- `params` é validado pelo **mesmo schema zod da server function do painel**, exportado de lá; a rota só acrescenta a checagem da janela natural e da [janela de disponibilidade](./conceitos/janelas-de-disponibilidade.md). Janela maior que um mês, invertida ou fora da disponibilidade — ou, no SICONFI, período que o tipo não tem — responde 400 sem rodar nada.
- **Não passa pela fila**, mas divide o cursor com painel e fila pela mesma chave de varredura: uma janela começada num gatilho pode terminar em outro.
- **Janela completa não é refeita** (menos nas chamadas únicas, que sempre rodam — a gravação é idempotente): sem `reprocessar`, a rota devolve o estado da varredura (`parada: "janela_completa"`) sem importar nada. Se a janela ainda não tem conferência aprovada, a rota **só a confere**, sem reimportar ([conferência sem reimportação](./importacao.md#conferência-sem-reimportação)): uma chamada à origem para o total, uma linha nova em `importacoes` com o veredito e a conferência na resposta. Se já tem conferência aprovada, não grava nada. Com `reprocessar: true`, a varredura recomeça do zero. Janela parcial sempre segue do cursor.

Resposta (200):

| Campo                      | O quê                                                                                                                                                                                                                                                                                    |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tarefa`, `params`         | O pedido, com os padrões do schema aplicados                                                                                                                                                                                                                                             |
| `execucao_id`              | A execução a que a rodada pertence                                                                                                                                                                                                                                                       |
| `importados`               | Quantidade por unidade, explícita: `{ "votacoes": 12, "votos": 5130 }`                                                                                                                                                                                                                   |
| `erros` / `avisos`         | Texto dos erros da rodada; os avisos `info:` vêm separados, como no Histórico                                                                                                                                                                                                            |
| `haMais`                   | `true` enquanto a janela não terminou                                                                                                                                                                                                                                                    |
| `cursor`, `totalAcumulado` | Onde a varredura da janela parou e quanto ela processou somando todas as rodadas                                                                                                                                                                                                         |
| `parada`                   | `fim`, `tempo`, `subrequisicoes`, `erro` (rodada interrompida) ou `janela_completa`                                                                                                                                                                                                      |
| `conferencia`              | Na última rodada, o veredito sobre a janela, o mesmo gravado em `importacoes.conferencia` ([formato](./importacao.md#conferência)); em `janela_completa` sem conferência aprovada, o da conferência sem reimportação; `null` nas rodadas intermediárias e na janela completa já aprovada |

Na última rodada a rota lê as linhas do `execucao_id`, conta os registros da janela no cache e grava a conferência na linha dessa rodada. Se não conseguir ler ou gravar, responde 500 e a janela continua pendente.

### Consulta de pendentes

`POST /api/cron-importar` com o mesmo header e o corpo `{"consulta": "pendentes", "tarefa": "camara_vot"}` — no SICONFI, com `"params": {"codIbge": "35", "tipoRelatorio": "RGF"}`, porque as pendentes são de um ente e um relatório (no `siconfi_ano`, `{"codIbge": "35"}`; no `siconfi_varredura`, `{"conjunto": "municipios", "uf": "AC"}`). Só lê: não importa nem grava nada. Responde 200 com as janelas da tarefa dentro da janela de disponibilidade cuja última conferência não é aprovada, da mais recente para a mais antiga:

```json
{
  "consulta": "pendentes",
  "tarefa": "camara_vot",
  "janelas": [
    {
      "ano": 2024,
      "mes": 3,
      "dataInicio": "2024-03-01",
      "dataFim": "2024-03-31",
      "ultima": {
        "estado": "inconclusiva",
        "motivo": "…",
        "execucao_id": "…",
        "consultado_em": "…"
      }
    }
  ]
}
```

`ultima` é nula na janela nunca conferida — inclusive a importada pelo painel ou pela fila, que não conferem. Tarefa sem modo nomeado (ou o SICONFI sem o ente e o relatório) responde 400.

A granularidade segue a da tarefa (tabela acima):

- **Mês:** `mes` é o mês.
- **Ano:** uma janela por ano, com `mes` 1 (a âncora da célula anual) e as datas de 1º de janeiro a 31 de dezembro; o ano corrente entra. Nas matérias e proposições, uma janela por ano e sigla (ou tipo), com a sigla em `escopo`; a consulta aceita `params` com `sigla` (ou `siglaTipo`) para restringir.
- **Cadastro:** uma janela só, com `ano` e `mes` 0 e datas vazias, pendente enquanto a última conferência da fonte não for aprovada.
- **Período do SICONFI:** `mes` é o período (0 no DCA), só os já encerrados; as conferências são as do ente (`orgao_cod`) e da família do relatório (`escopo`).
- **Exercício do SICONFI em lote** (`siconfi_ano`, `siconfi_varredura`): uma janela por exercício já encerrado, com `mes` 0 e as datas do ano inteiro; as conferências são as da linha de rodada da varredura (`escopo` = `varredura:<conjunto>[:<filtro>]`).

Nas tarefas com recorte, o corpo leva os parâmetros dele em `params` — `{"consulta":"pendentes","tarefa":"cgu_contratos","params":{"codigoOrgao":"26000"}}` ou `{"codigosOrgao":["26000","36000"]}` nos contratos e licitações (sem `params`, os órgãos ativos do catálogo; cada janela traz o órgão em `escopo`, e a lista vai do mês mais recente ao mais antigo, órgão a órgão dentro do mês), ou `{"codigoUF":"35"}` / `{"codigoIbgeMunicipio":"3550308"}` nos convênios por ente (sem `params`, o país inteiro) — e a lista é a daquela linha. Nas emendas, uma janela por ano (`mes: 1`, as datas do ano inteiro).

## Concorrência e limites

- Dois tiques simultâneos nunca pegam a mesma tarefa (SKIP LOCKED); um tique que morrer solta a tarefa em 15 min.
- Rodada manual do admin em paralelo é tolerada por desenho: upserts idempotentes + checkpoint por chave → o pior caso é trabalho repetido, nunca corrupção.
- Dentro de uma rodada, as votações da Câmara (5 por vez) e a varredura do SICONFI (3 por vez, com teto de ~80 mil linhas por rodada) processam itens em paralelo; o cursor só avança sobre o trecho contínuo de itens concluídos ([paralelismo](./importacao.md#paralelismo-nas-rodadas)). PNCP e Portal da Transparência seguem um item por vez, por causa da cota da origem.
- **CPU por chamada:** o `wrangler.jsonc` declara `limits.cpu_ms` = 300.000 (5 min, o máximo), no lugar do padrão de 30 s. Espera de rede não conta; o que pesa é a retomada de um arquivo grande do TSE, que descomprime e relê o arquivo desde o começo a cada rodada. Contas em [tse.ia.md](./fontes/tse.ia.md#importação-sob-demanda-e-cpu). A varredura do SICONFI indica que o teto efetivo em produção é menor que o declarado: rodadas de mais de 140 mil linhas derrubaram o Worker ([teto do SICONFI](./importacao.ia.md#teto-do-siconfi)).
- Fora da rotação v1 (documentado, rodada de ajustes): SICONFI (varredura por conjunto de entes) e CGU contratos/licitações/emendas por órgão — exigem rotação própria de alvos. Contratos, licitações e emendas já podem ser importados sob demanda pela ferramenta.
