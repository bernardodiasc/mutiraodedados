# Pipeline de importação

Esta página descreve o que **toda fonte** faz quando dados oficiais são trazidos para o cache do Supabase. Particularidades de cada fonte ficam em [`fontes/`](./fontes/).

## Quem dispara

Nenhum usuário comum dispara importação, e nenhuma página pública chama API oficial ao vivo. As rodadas são sempre as mesmas (mesmos núcleos, orçamento, retomada e Histórico); o que muda é quem as dispara.

### Gatilho e execução

- **Rodada** — uma chamada a um núcleo de importação: trabalha até esgotar o orçamento de tempo e grava uma linha em `importacoes`.
- **Gatilho** — quem disparou a rodada, gravado na coluna `importacoes.gatilho`:
  - `painel` — o admin, pela tela [`/admin/dados`](./admin.md);
  - `cron` — a fila da [automação](./automacao.md), sem operador;
  - `ferramenta` — a ferramenta de linha de comando `bun run importar`, pelo [modo nomeado](./automacao.md#importação-sob-demanda-modo-nomeado) de `/api/cron-importar`.
- **Execução** — as rodadas de uma mesma janela pedida pela ferramenta. A ferramenta gera um `execucao_id` por janela e o manda em todas as chamadas; as linhas dessas rodadas levam o mesmo valor em `importacoes.execucao_id`. Painel e fila deixam a coluna nula.

Linhas anteriores a essas colunas ficam com `gatilho` nulo; nelas, `user_id` nulo é a única marca de rodada sem operador.

### Métricas da rodada

Toda linha de rodada (as que o runner retomável produz, inclusive as varreduras da CGU) grava o desempenho em colunas próprias de `importacoes`, exibidas no [Histórico](./admin.md#admindados--ingestão) com soma e média do recorte filtrado:

| Coluna              | O que mede                                                                                                     |
| ------------------- | -------------------------------------------------------------------------------------------------------------- |
| `duracao_ms`        | duração da rodada                                                                                              |
| `itens_processados` | passos concluídos na rodada: votações, consultas, páginas ou parlamentares, conforme a fonte                   |
| `subrequisicoes`    | subrequisições que os passos contaram (chamadas à origem e gravações em lote), contra o teto da rodada         |
| `motivo_parada`     | `fim` (a origem acabou), `tempo`, `subrequisicoes`, `erro` (falha que interrompeu) ou `passos` (limite pedido) |

Itens por segundo é derivado na tela (itens ÷ duração). Linhas anteriores a essas colunas, e as linhas por consulta do SICONFI, ficam nulas.

### Paralelismo nas rodadas

Por padrão, a rodada processa um item por vez. Nas fontes em que o tempo é quase todo espera pela origem e a origem não tem cota conhecida, até N itens rodam ao mesmo tempo, sem mudar a retomada: o cursor só avança sobre o trecho contínuo de itens concluídos, e um item com falha passageira nunca é pulado — a próxima rodada o refaz, e os que estavam à frente dele também (os upserts são idempotentes). Detalhe em [importacao.ia.md](./importacao.ia.md#paralelismo).

| Fonte                            | N   | Por quê                                                                                                   |
| -------------------------------- | --- | --------------------------------------------------------------------------------------------------------- |
| Votações da Câmara               | 5   | ~0,55 s por votação, quase tudo espera pela API; o Worker abre até 6 conexões, uma fica para o checkpoint |
| SICONFI em lote                  | 3   | com um teto de ~80 mil linhas por rodada: mais que isso numa chamada derrubou o Worker                    |
| PNCP, Transferegov, Portal (CGU) | 1   | a origem limita requisições por minuto                                                                    |
| Demais fontes                    | 1   | sem medida de ganho ainda                                                                                 |

Um mês grande de votações da Câmara (maio de 2026, 1.535 votações) levava 6 rodadas de ~270 votações; com N = 5, leva 2 (medido com a origem simulada em `votacoes-rodadas.test.ts`).

### Conferência

- **Conferência** — o veredito sobre a janela inteira de uma execução. A rota calcula na última rodada (`haMais: false`), lendo as linhas do `execucao_id`, grava em `importacoes.conferencia` (jsonb) **na linha da última rodada** e devolve na resposta. As outras linhas da execução ficam com a coluna nula, assim como as de painel e fila. Janela já completa sem conferência aprovada é conferida sem reimportar, numa linha própria ([abaixo](#conferência-sem-reimportação)). Regras em `src/lib/data/automacao/conferencia.ts` (lógica pura, com o tipo `Conferencia`).

| Checagem             | Passa quando                                                                                                                                                                                           |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Terminou             | A janela chegou ao fim (`haMais: false`).                                                                                                                                                              |
| Log limpo            | Nenhuma rodada da execução com erro; avisos `info:` à parte, como no Histórico (inclusive o de descarte por problema do dado na origem). Sem reimportação, só a última rodada da janela (mais frouxo). |
| Contagem             | Acumulado da janela > 0, ou vazio com `resultado` legítimo (sem dados, não publicado, fora da janela). Onde a origem informa o total, acumulado + descartados = total, exato.                          |
| Reflexo na cobertura | A célula da janela tem registros no cache ou, se a janela veio vazia, há rodada ancorada nela (mesmo ano e mês) com `resultado` sem erro.                                                              |
| Findings             | Só informa quantos sinais novos a janela gerou; não aprova nem reprova.                                                                                                                                |

Estados, do mais grave ao mais leve — vale o mais grave encontrado:

- **Reprovada** — rodada com falha nossa (`erro_nosso`, ou erro sem classificação), contagem divergente em janela fechada, zero onde a origem diz que há registros, vazio sem explicação, cobertura não refletida ou janela sem fim.
- **Inconclusiva** — rodada que terminou em `erro_origem` depois das novas tentativas, ou contagem divergente em **janela recente** (até dois meses, a mesma folga do "ainda não publicado"). Com falha da origem no log, contagem e cobertura em falta também ficam inconclusivas: a falha as explica.
- **Aprovada** — nenhuma das anteriores. Janela vazia com `resultado` legítimo também aprova.

#### Classificação de `resultado`

Cada linha de rodada grava em `importacoes.resultado` uma de seis classes (`src/lib/data/resultado-rodada.ts`): `com_dados`, `sem_dados`, `nao_publicado`, `fora_da_janela`, `erro_origem` e `erro_nosso`. Com erro no log, a classe sai do texto dos erros: 5xx, 429, timeout e o prefixo `TRANSIENT:` são `erro_origem` (a origem não respondeu); 404, 401, 403, parse e banco são `erro_nosso`, assim como o erro que não se sabe atribuir. Os avisos `info:` ficam **fora** da classificação: uma rodada só com avisos é `com_dados`, `sem_dados` ou `nao_publicado`, como se não tivesse erro.

#### Problema da origem na conferência

A regra de negócio está em [qualidade de dados](./qualidade-dados.md#problema-da-origem--erro-nosso): erro nosso se corrige no código; problema do dado na origem vira sinal. Na conferência, os casos ficam assim:

- **Erro nosso** — erro no log, rodada `erro_nosso`: reprova (log limpo).
- **Origem indisponível** — falha passageira que sobrou das novas tentativas, rodada `erro_origem`: inconclusiva.
- **Problema do dado na origem com regra própria** — o registro fica de fora, a rodada registra um aviso `info:` e grava o sinal. O log continua limpo, e o registro conta como **descartado** na contagem, que fecha: acumulado + descartados = total da origem. A janela aprova.
- **Problema do dado na origem sem regra ainda** — cai como erro (um 404 do detalhe, por exemplo, é lido como erro nosso) e reprova. É o sinal que falta: a correção é criar a regra, não contornar o dado.

**Descartados** são os registros que a origem conta no total e a importação deixa de fora de propósito: itens ilegíveis ou repetidos da lista (a regra de cada fonte está no parágrafo abaixo) e registros com problema do dado na origem. Nas votações da Câmara, a votação que a listagem traz e cujo detalhe responde 404 é descartada com o alerta `votacao_listada_sem_detalhe`. O alerta é o registro do descarte: na última rodada (e na conferência sem reimportação), os descartados da janela são as votações com esse alerta e data na janela que não estão no cache. Assim a conta fecha mesmo quando o descarte aconteceu numa rodada ou execução anterior, e a votação que voltar a ter detalhe e for importada deixa de contar como descartada.

**Conferência mínima.** As tarefas de cruzamento (`tse_lacunas`, `tse_sinais`, `cruzamento_doador_fornecedor`) não importam de uma origem: cruzam o que já está no banco. Nelas só valem **terminou** e **log limpo**; contagem e reflexo na cobertura ficam como `nao_se_aplica`, e o motivo da aprovada informa os findings novos ("Tarefa concluída: 3 findings novos.", também em `findingsNovos`).

Total da origem por fonte (tabela completa em [automacao.md](./automacao.md#importação-sob-demanda-modo-nomeado)): pelo header `X-Total-Count` nas votações (votações sem detalhe na origem descartadas, com alerta) e nas proposições da Câmara e no cadastro de deputados (as repetições de titular e suplente contam como descartadas); pelo tamanho da lista, que vem inteira, nas votações do Senado (sessões sem código descartadas), na CEAPS (despesas ilegíveis descartadas), nas matérias (itens ilegíveis descartados) e no cadastro de senadores (itens sem código e repetições descartados); pelo `totalRegistros` no PNCP, só sem filtro de UF ou município; pela lista nacional no cadastro do IBGE, buscada na última rodada — se essa chamada falha, a conferência fica inconclusiva. A API do Portal da Transparência (licitações, emendas, convênios por período e por ente) **não informa total** — a paginação acaba numa página com menos de 15 itens —, nem a CEAP (só por deputado), nem o SICONFI (só `hasMore`, no relatório avulso e em lote), nem a trajetória dos deputados (a lista é o nosso cadastro), nem o TSE (o índice do zip dá o tamanho descomprimido, não a contagem de linhas), nem o vínculo parlamentar↔candidato, nem o CSV da origem; nelas a contagem contra a origem **não se aplica** (`sem_total_da_origem`, que não pesa contra): vale acumulado > 0 ou vazio legítimo. `findingsNovos` fica nulo em todas as importações (só os cruzamentos o preenchem): os alertas que elas gravam não são somados por janela — nas votações da Câmara, o alerta de votação sem detalhe aparece como descartado na contagem.

A célula contada no reflexo da cobertura é a da fonte: licitações, pelo órgão e pelo mês de abertura; emendas, matérias e proposições, pelo ano; SICONFI em lote (ano todo e varredura), pelas linhas do exercício nos entes do conjunto; convênios por ente, pelo ano e mês de **referência** (o calendário em que a API filtra), restritos ao ente quando há um. A matriz de cobertura de convênios por ente agrupa pela data de assinatura, que pode cair fora da janela consultada — contar por ela reprovaria janelas que importaram certo. No TSE, a célula são os registros da eleição e da UF no cache (em bens, as fichas de candidato da UF com o total declarado). Fontes sem célula no tempo (cadastros de deputados, de senadores e de municípios, trajetória dos deputados, vínculo parlamentar↔candidato, CSV da origem) têm `registrosNaCelula` nulo: a cobertura exige contagem > 0.

Todas as linhas de rodada das tarefas do modo nomeado gravam `resultado`, inclusive as dos cadastros de deputados e de senadores e as do SICONFI (cada consulta, avulsa ou da varredura), que antes saíam sem ele; nelas, a consulta que falha também grava a linha, com o erro. A trajetória dos deputados, que antes não gravava linha nenhuma, grava uma por rodada (fonte `camara_trajetoria`). No TSE, a linha de cada arquivo passa a gravar `resultado`, o gatilho e a execução, e `mes` 1 como âncora da eleição; o arquivo ausente na origem vai como aviso `info:` (sem dados, não erro), e a falha ao ler o arquivo grava a linha com o erro em vez de derrubar a chamada. O vínculo parlamentar↔candidato (`tse_ponte`) e os cruzamentos (`tse_lacunas`, `tse_sinais` e, no doador↔fornecedor, `tse_doador_fornecedor`), que não gravavam linha, gravam uma por rodada quando chamados pela ferramenta.

Formato gravado em `importacoes.conferencia`:

```json
{
  "estado": "aprovada",
  "motivo": "Janela completa: 819 de 819 registros da origem.",
  "rodadas": 4,
  "semReimportacao": false,
  "janelaRecente": false,
  "checagens": {
    "terminou": true,
    "log": {
      "situacao": "limpo",
      "escopo": "execucao",
      "rodadasComErroNosso": 0,
      "rodadasComErroDaOrigem": 0,
      "avisos": 0
    },
    "contagem": { "situacao": "confere", "acumulado": 819, "descartados": 0, "totalOrigem": 819 },
    "cobertura": { "situacao": "refletida", "registrosNaCelula": 819 }
  },
  "findingsNovos": null
}
```

- `estado`: `aprovada` | `inconclusiva` | `reprovada`; `motivo`: frase curta para exibir. Estes dois são o contrato de quem lê; o resto detalha as checagens.
- `checagens.log.situacao`: `limpo` | `erro_da_origem` | `erro_nosso`.
- `checagens.contagem.situacao`: `confere` | `sem_total_da_origem` (a comparação não se aplica) | `vazia_legitima` | `divergente` | `zero_com_origem` | `vazia_sem_explicacao` | `nao_se_aplica` (conferência mínima). `totalOrigem` é nulo quando a origem não informa.
- `checagens.cobertura`: `refletida` | `nao_refletida` | `nao_se_aplica` (conferência mínima); `registrosNaCelula` é nulo em fonte sem célula mensal (lá a cobertura exige contagem > 0).

- `semReimportacao`: `true` na [conferência sem reimportação](#conferência-sem-reimportação); o `motivo` também termina com "Conferida sem reimportar.".
- `checagens.log.escopo`: `execucao` (as rodadas da execução) ou `ultima_rodada_da_janela` (sem reimportação).

#### Conferência sem reimportação

Janela que a varredura já dá como completa, mas sem conferência aprovada — tipicamente a importada pelo painel antes de existir a conferência —, não é baixada de novo: quando a ferramenta a pede sem `reprocessar`, a rota só a confere.

- **Acumulado**: o `totalAcumulado` do checkpoint da varredura.
- **Total da origem**: uma chamada só — na Câmara, a listagem com um item, pelo `X-Total-Count`; no PNCP, uma página de dez itens, pelo `totalRegistros`; no Senado, a lista da janela (na CEAPS, o ano inteiro); no IBGE, a lista nacional. Se essa chamada falha, a conferência é inconclusiva. Nas fontes que não informam total (Portal da Transparência, CEAP) não há chamada.
- **Log**: as rodadas antigas não têm `execucao_id`; são achadas por fonte + ano/mês da janela (e pelo escopo, nas fontes com várias linhas na matriz — o órgão dos contratos e das licitações, o ente dos convênios, a rotina do catálogo SIAFI; no cadastro, pela fonte e, quando há, pelo escopo), como a cobertura casa as tentativas. O log limpo é **mais frouxo** aqui: vale só a última rodada da janela (a que a completou), porque as antigas misturam varreduras refeitas e tentativas já superadas. Um item perdido numa rodada anterior não passa despercebido: aparece na contagem contra a origem.
- **Reflexo na cobertura**: igual ao da execução, com uma diferença: janela vazia que a origem, consultada agora, confirma vazia (total zero) está refletida — a própria conferência consultou a janela sem erro, e a linha que ela grava, com `ano`/`mes`, ancora a célula na cobertura.
- **Janela sem nenhuma rodada no Histórico**: o checkpoint diz que a janela está completa, mas a linha da rodada que a completou não existe mais (o checkpoint sobreviveu a ela). O que só faltaria por isso — o vazio sem explicação e a cobertura não refletida — deixa a conferência **inconclusiva**, com o motivo "Nenhuma rodada da janela no Histórico", e não reprovada: não há defeito à vista, falta evidência. A ferramenta re-tenta a inconclusiva com `reprocessar`, e a reimportação grava a rodada que faltava. Divergência contra a origem continua reprovando.
- **Gravação**: numa linha nova de `importacoes`, com `gatilho = ferramenta`, o `execucao_id` da chamada, `ano`/`mes` da janela, `importados = 0`, `log_kind = conferencia` e o veredito em `conferencia`. Ela aparece no Histórico; `log_kind` a separa das rodadas quando outra conferência lê o log da janela.
- Janela completa que **já tem** conferência aprovada não é conferida de novo: a rota não grava nada.

**Pendente** é a janela da fonte, dentro da [janela de disponibilidade](./conceitos/janelas-de-disponibilidade.md), cuja última conferência não é aprovada — nunca conferida, reprovada ou inconclusiva. A rota responde a lista numa consulta só de leitura ([contrato](./automacao.md#consulta-de-pendentes)).

## Etapas comuns

1. **Validação de janela** — se o período pedido está fora da [janela conhecida](./conceitos/janelas-de-disponibilidade.md) daquela fonte (definida em `src/lib/data/janelas.ts`), a requisição é pulada.
2. **Chamada HTTP** — com retries exponenciais e backoff em erros 429/5xx.
3. **Parse** — números brasileiros (com vírgula) e datas DD/MM/AAAA são normalizados (ver `portal-client.ts`).
4. **Sanitização de PII** — textos livres (objeto do contrato, justificativas) passam por `src/lib/sanitize.ts` antes de gravar. CPF, e-mail, telefone com DDD entre parênteses e CEP viram máscara. CNPJ permanece (dado empresarial público). Veja [LGPD e dados públicos](./conceitos/lgpd-e-dados-publicos.md).
5. **Conferência de valores (Portal CGU, contratos)** — a varredura confere cada contrato da listagem contra o endpoint de detalhe (`/contratos/id`); quando as leituras divergem em ≥ 100× (bug de escala ÷10000 da API), grava o valor **não-truncado** e registra o alerta `valor_corrigido_listagem` (`info`, já resolvido, com evidência bruta). Entidades sem detalhe por item (licitações, convênios, emendas) apenas sinalizam valores ínfimos (`valor_truncado_suspeito`). Ver [qualidade-dados](./qualidade-dados.md#valores-suspeitos-do-portal-cgu).
6. **Upsert em lote** — grava em tabelas `*_cache` em blocos de ~200 registros (contratos do Portal CGU usam blocos de 500).
7. **QA findings** — regras por fonte (em `src/lib/data/qa.ts`) detectam valores inconsistentes, datas absurdas, etc., e gravam em `qa_findings`. É também aqui que o problema do dado na origem deixa de ser erro: vira sinal, e o registro afetado conta como descartado ([acima](#problema-da-origem-na-conferência)). Veja [qualidade-dados](./qualidade-dados.md).
8. **Log de auditoria** — cada chamada à API oficial vira uma linha em `importacoes`.

## Quem é cliente HTTP

- **Portal CGU e Transferegov** usam o cliente compartilhado em `src/lib/data/real/portal-client.ts` (mesma autenticação e parser de valores).
- **Câmara, Senado, PNCP, SICONFI** têm clientes próprios em `src/lib/data/<fonte>/ingest.functions.ts`. PNCP e SICONFI usam a mesma política de retry das demais fontes; Câmara e Senado têm laço próprio equivalente.

## Throttling

- Portal CGU: retry com backoff em 5xx/429/rede. A ingestão de contratos varre o histórico completo do órgão (paginação de 15 em 15).
- Câmara/Senado: paginação respeitando limites da API; retries em 429.
- PNCP: 500 registros por página; sem chave de API.

## Cobertura

A tela [`/cobertura`](./dominios/busca-e-exploracao.md) cruza o log de `importacoes` com os caches para mostrar: meses sincronizados, meses com dados, meses sem dados confirmados, meses ainda não consultados.

## Limpeza

`src/lib/data/limpeza.ts` cataloga rotinas de limpeza seletiva — usadas quando o admin precisa rederivar uma fonte. Não apaga `qa_findings` resolvidos.

Duas garantias que a limpeza precisa manter, ambas aprendidas na prática:

- **Tamanho não pode derrubar a operação.** Apagar cada fonte com um `DELETE` único pelo PostgREST estourava o `statement_timeout` (492 mil candidaturas do TSE já bastavam). O caminho hoje são as RPCs `truncar_cache` e `limpar_cache_por_ano` (migration `20260808140000`), com orçamento de tempo próprio de 55 s — abaixo do corte do gateway HTTP, para que o erro chegue nomeando a fonte em vez de virar um 504 de desfecho desconhecido. `TRUNCATE` não percorre linhas, então "apagar tudo" independe do volume. Continuam no `DELETE` direto os casos que a RPC não cobre: `importacoes` (filtros de sub-modo), fontes com `extraEq` e recortes por data. **A RPC é preferência, não dependência**: se ela ainda não existe no banco (`PGRST202`), a limpeza cai no `DELETE` e avisa no resultado que as migrations estão pendentes. Sem isso, a janela entre o merge do código e o `db push` deixaria a manutenção inteira quebrada — foi o que aconteceu na primeira versão desta mudança.
- **Apagar o cache tem que apagar o que foi derivado dele.** Sinais (`qa_findings` + `lacunas`), estado de varredura e tabelas derivadas viram lixo silencioso se sobrarem — uma limpeza completa do TSE deixava 319 vínculos em `tse_parlamentar_candidato` apontando para candidaturas inexistentes e 167 sinais vivos, entre eles 147 `ponte_baixa_confianca` gerados por esses mesmos vínculos. Ao adicionar uma fonte, verifique os três: `QA_FONTE_MAP`, o reset de varredura e eventuais tabelas derivadas.
- **Os checkpoints de varredura saem junto.** Sem isso, a janela limpa continua `completa` sem registros no cache e sem rodada no Histórico. O TSE zera `tse_varredura` pelo tipo da entidade. As demais fontes declaram no próprio catálogo (`checkpoints` em `FONTES_LIMPEZA`) quais chaves são delas em `importacao_varredura` e em `cgu_varredura`. É o único lugar desse mapeamento, e `checkpointsALimpar` escolhe as chaves a apagar:

  | Fonte de limpeza                   | Checkpoints apagados                                                                                                       |
  | ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
  | `cgu` (contratos)                  | `cgu_varredura`: chave legada por órgão (`<órgão>` ou `<órgão>#<ini>#<fim>`)                                               |
  | `cgu_licitacoes`                   | `cgu_varredura`: `licitacoes#…`                                                                                            |
  | `cgu_emendas`                      | `cgu_varredura`: `emendas#<ano>` (o plano de ação do Transferegov não tem checkpoint próprio)                              |
  | `convenios` (tabela única)         | `cgu_varredura`: `convenios#…`; `importacao_varredura`: `transferegov#…` (por ente) e `convenios_origem#…` (CSV da origem) |
  | `camara_ceap`, `senado_ceaps`      | `importacao_varredura`: `<fonte>#<ano>#<mês>[#<parlamentar>]`                                                              |
  | `camara_vot`, `senado_vot`, `pncp` | `importacao_varredura`: `<fonte>#<ini>#<fim>[#filtros]`                                                                    |
  | `camara_props`, `senado_mat`       | `importacao_varredura`: `<fonte>#<ano>#<tipo>`                                                                             |
  | `siconfi`                          | `importacao_varredura`: `siconfi_varredura#<conjunto>#<ini>-<fim>[#filtro]`                                                |
  | `ibge`                             | `importacao_varredura`: `ibge#…`                                                                                           |
  | `orgaos`                           | `importacao_varredura`: `orgaos_siafi#…` (catálogo SIAFI e atividade)                                                      |

  Na limpeza por ano, sai só o checkpoint cuja janela toca o período — a que atravessa a virada do ano pertence aos dois anos. Chave sem período (contratos por órgão sem janela, CSV da origem, IBGE, catálogo SIAFI) cobre todos os anos e sai em qualquer limpeza por ano: a varredura recomeça do zero, e os upserts são idempotentes. O resultado lista os apagados como `<tabela>:<fonte>`. Fonte nova que grave checkpoint precisa da entrada `checkpoints` no catálogo.

- **Uma fonte que falha não leva as outras.** Cada fonte roda dentro do próprio `try`, e a resposta traz `falhas` por fonte além de `removed`. Antes, o primeiro erro abortava a função inteira: as fontes seguintes da seleção nunca rodavam, as anteriores já estavam commitadas (cada `DELETE` do PostgREST é uma transação própria) e o admin via um toast citando uma tabela só. `resumirLimpeza` (`src/lib/admin-import/logic.ts`) monta a mensagem com as falhas em primeiro plano.

## Para detalhes de contratos, parsers e tipos

Veja [`importacao.ia.md`](./importacao.ia.md).
