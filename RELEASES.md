# RELEASES — histórico de entregas

Só releases entregues e validadas, em ordem descendente. Planos futuros moram no [ROADMAP.md](./ROADMAP.md); o processo de fechamento no [WORKFLOW.md](./WORKFLOW.md).

<!--
Template de entrada (copiar para o topo ao fechar uma release):

## vX.Y.Z — AAAA-MM-DD

**Resumo:** o que foi entregue, em 2–4 frases.

**Checks executados:** apenas os realmente rodados, com resultado
(ex.: `bun run lint` ✓ · `bun run build` ✓ · `bun run test` — N suítes, M verdes).

**Plano:** docs/planos/vX.Y.Z-<slug>.md (se houver)

**PR de sync público:** link do PR `sync vX.Y.Z` no repositório público.

**Roadmap cidadão:** itens criados em /admin/roadmap (se houver impacto cidadão).

Regras de redação: referências por data e versão, nunca hash de commit
(este arquivo é espelhado no repositório público, cujo histórico não contém
os commits do privado); nada de vulnerabilidade não corrigida; nenhum segredo.
-->

## v0.10.0 — 2026-08-20

**Resumo:** a origem do SICONV passa a enriquecer os convênios com o que só ela publica — situação corrente, valor empenhado e valor desembolsado — lida do CSV oficial do módulo Discricionárias e Legais, por varredura retomável. O recorte foi decidido por medição, a pedido do mantenedor, que questionou a premissa da release.

**Entregas**

- **Verificação de completude do espelho** (amostra estratificada de 30 códigos da origem): universo completo para convênios celebrados; campos de execução financeira ausentes; situação defasada em caso real (convênio rescindido exibido "em execução"). Registrada em `docs/fontes/transferegov.md` com o método.
- Ingest retomável de `siconv_convenio.zip` (18 MB, 287 mil linhas): Range sobre o payload deflate, streaming via `DecompressionStream`, cursor por lote de 500 linhas, um lote = uma chamada à RPC.
- Migration: colunas `situacao_origem`, `valor_empenhado`, `valor_desembolsado`, `atualizado_origem_em`; RPC `enriquecer_convenios_origem` (update por `codigo_siconv`, devolve atualizados/sem espelho, EXECUTE só para service_role); RPC de cobertura do enriquecimento; índice por `codigo_siconv`.
- **A origem enriquece, não corrige**: campos do espelho jamais sobrescritos; `data_assinatura` apenas preenchida quando falta.
- Ficha do convênio ganha o bloco "Na origem", com a divergência de situação exibida lado a lado quando existe. Promover a divergência a sinal do catálogo ficou no horizonte.
- Helpers de CSV puros e testados (BOM, `;`, datas BR, números em formato misto — vírgula e ponto decimais no mesmo arquivo).
- Acervo completo da origem (com convenente/município) descartado nesta infra: exigiria join com `siconv_proposta.zip` (205 MB); registrado no horizonte com a API nativa.

**Checks executados**

- `bun run test` ✓ — 72 arquivos, 768 testes.
- `bun run lint` ✓ 0 erros · `bunx tsc --noEmit` ✓ · `bun run build` ✓.
- Formato do zip conferido contra o arquivo real (deflate, tamanhos no cabeçalho, Range 206); CSV real baixado e analisado (286.945 linhas).
- Validação manual adiada — rodada única após a v0.11.0.

**Plano:** sem plano dedicado — investigação e recorte registrados no ROADMAP e em docs/fontes/transferegov.md.

**PR de sync público:** `sync v0.10.0`.

## v0.9.0 — 2026-08-20

**Resumo:** convênios passam a viver numa tabela única (`convenios_cache`) com coluna de fonte. As duas tabelas antigas guardavam o mesmo registro do mesmo endpoint, mapeado por dois códigos que divergiam em silêncio — foi a causa raiz dos rótulos e links errados corrigidos na v0.6.0.

**Entregas**

- Migration: `convenios_cache` (superconjunto de colunas, nomes canônicos, `fonte` default `cgu`), dados migrados com merge por id, tabelas antigas removidas, RPCs de cobertura recriadas sobre a tabela única (calendário de referência × calendário de assinatura), allowlist `tabela_cache_limpavel` atualizada — incluindo a `ibge_municipios_cache` da v0.7.0, que ficara fora por engano.
- Mapeador único `convenio-row.ts`, compartilhado pelos dois ingests; absorve os fallbacks que cada lado tinha e o outro não (município via convenente, CNPJ cru, objeto de 1000 caracteres, esfera pelo IBGE).
- Consultas por ente re-escritas nos nomes canônicos; busca global faz uma consulta em vez de duas; limpeza vira entrada única que apaga acervo + histórico dos dois ids; poda de QA cobre as duas fontes de findings.
- Os ids de importação `cgu_convenios` e `transferegov` continuam distintos no Histórico e na cobertura: descrevem qual varredura trouxe o dado, não onde ele mora.

**Checks executados**

- `bun run test` ✓ — 71 arquivos, 763 testes.
- `bun run lint` ✓ 0 erros · `bunx tsc --noEmit` ✓ · `bun run build` ✓.
- Migração de dados validada contra o banco real antes de escrita: 23 linhas no ângulo por ente, 0 no outro, 0 conflitos de id; definições das RPCs e policies lidas do banco e recriadas equivalentes.
- Validação manual adiada — rodada única após a v0.11.0.

**Plano:** sem plano dedicado — desenho registrado no ROADMAP (v0.7.z→v0.9.0) desde a v0.6.0.

**PR de sync público:** `sync v0.9.0`.

## v0.8.0 — 2026-08-20

**Resumo:** as matérias do Senado saem do endpoint descontinuado `materia/pesquisa/lista` — que passou da data de desativação anunciada por ele mesmo (2026-02-01) e já quebrou o formato uma vez em silêncio — para o substituto oficial `/processo`, verificado contra a origem.

**Entregas**

- Ingest de matérias sobre `GET /processo?ano=&sigla=`: JSON estável, o ano inteiro de uma sigla numa chamada; runner, histórico e contagem de descartes idênticos aos anteriores.
- `parseIdentificacao` ("PL 8/2025" → sigla, número, ano) exportada e testada — a última quebra de formato passou despercebida justamente por o parse ser implícito.
- Autoria da lista alimenta `autor_principal` e a linha Principal de autores; a autoria estruturada do detalhe `/processo/{id}` foi avaliada e descartada (uma chamada por matéria), com o caminho documentado.
- Endpoint velho removido do código; `docs/fontes/senado.md` atualizado.

**Checks executados**

- `bun run test` ✓ — 71 arquivos, 764 testes (2 novos do parser).
- `bun run lint` ✓ 0 erros · `bunx tsc --noEmit` ✓ · `bun run build` ✓.
- API `/processo` exercitada contra a origem em 2026-08-20 (879 itens de PL/2025, campos conferidos um a um).
- Validação manual adiada — rodada única após a v0.11.0 (autorização registrada no WORKFLOW).

**Plano:** sem plano dedicado — escopo no ROADMAP.

**PR de sync público:** `sync v0.8.0`.

## v0.7.0 — 2026-08-20

**Resumo:** completa a tríade importar → medir → curar. A `/cobertura` passa a mostrar toda fonte que grava rodada (três estavam fora), com teste-guarda de paridade; o IBGE vira fonte de primeira classe sob o contrato padrão; e o escopo de qualidade do plano original sai do papel — `/admin/lacunas` fecha o fluxo finding→lacuna e o banner de qualidade chega às fichas de fornecedor, órgão, deputado e senador.

**Entregas**

- **Catálogo de cobertura** (`cobertura-catalogo.ts`): módulo puro com toda fonte exibida em `/cobertura`, cruzado por teste-guarda com `FONTES_COM_HISTORICO` nas duas direções. Entram proposições da Câmara e matérias do Senado (as RPCs existiam; só o admin as consumia) e o catálogo de órgãos SIAFI.
- **IBGE como fonte**: migration `ibge_municipios_cache` (GRANT + RLS, leitura pública), importação retomável (um passo = uma UF) com linha no Histórico, entrada na limpeza e na cobertura, seção própria no painel Estados/Municípios. O combobox de ente e a varredura de municípios do SICONFI passam a ler do cache — antes o navegador baixava 5.570 registros do IBGE a cada uso, e cada rodada da varredura repetia a consulta externa.
- **`/admin/lacunas`**: UI para as server functions órfãs de lacunas — criar manual, mudar ciclo, publicar/despublicar, resolver, e converter findings em linguagem cidadã (candidatos já excluem os convertidos). No AdminNav e no style guide.
- **Banner de qualidade agregado**: `findingsPorAgregado` resolve os findings de uma pessoa/órgão a partir dos seus registros — fornecedor e órgão via contratos por CNPJ/código; deputado e senador pelo `detalhes` do finding. Banner nas 4 fichas; o modo por entidade exata segue intacto.
- **Explicador de fontes** (`ExplicadorFontes`): colapsível "de onde vêm estes dados?" em `/contratos` e `/convenios` — convênios explica sistema operacional (Transferegov) × portal de publicidade (CGU) e por que as abas são ângulos do mesmo acervo; contratos explica por que lá as fontes são duas de verdade e onde se sobrepõem.
- Cabeçalho de `/convenios` corrigido: todo convênio tem duas pontas no mesmo registro (verificado contra o endpoint: 9 de 9 itens com código SICONV, órgão e convenente juntos); o texto anterior sugeria conjuntos que se cruzam.

**Checks executados**

- `bun run test` ✓ — 71 arquivos, 762 testes, todos verdes (guardas novos: catálogo×histórico, limpeza cobrindo `ibge_municipios_cache`).
- `bun run lint` ✓ 0 erros · `bunx tsc --noEmit` ✓ · `bun run build` ✓.
- Migration com GRANT/RLS revisados em código; aplicação ocorre no deploy (pipeline gerenciado).
- **Validação manual adiada por decisão do mantenedor** (2026-08-20): as releases v0.7.0–v0.11.0 fecham sem testes manuais individuais; uma rodada única de testes e ajustes acontece depois da v0.11.0, em versão própria. Roteiro desta release preservado em `.claude/roteiro-testes-v0.7.0.md`.

**Plano:** docs/planos/v0.7.0-cobertura-ibge-qualidade.md

**PR de sync público:** `sync v0.7.0`.

## v0.6.0 — 2026-08-20

**Resumo:** padroniza a experiência de importação entre todas as fontes — histórico de rodada, retomada, classificação de resultado e recorte de escopo — e, no caminho, conserta seis fontes que estavam quebradas ou travando. Os testes manuais do mantenedor viraram a parte mais produtiva da release: cada log trazido revelou um defeito real, e todos foram corrigidos com teste.

**Entregas**

_Padronização_

- **Linha de rodada padronizada no Histórico**, gravada pelo servidor em todas as fontes: importados, ano/mês para a cobertura, motivo de parada (tempo, custo, fim), duração e consulta vazia. Os botões diretos do painel passaram a registrar de graça, e o job builder deixou de duplicar o log pelo cliente.
- **Coluna Resultado** classificando cada rodada em `com_dados`, `sem_dados`, `nao_publicado`, `fora_da_janela`, `erro_origem` ou `erro_nosso`. Antes, um zero no Histórico não distinguia "o governo não publicou" de "a importação falhou".
- **Retomada em todas as fontes**: matérias e votações do Senado, e votações da Câmara — esta última fora do diagnóstico original e o último ingest sem orçamento, checkpoint nem registro de rodada.
- **Orquestrador**: renovação de sessão por proximidade da expiração do JWT, e re-tentativa única de job com falha transitória.
- **Aba Estados/Municípios reorganizada** por ente e período, com varredura em massa do SICONFI (ente × exercício × relatório, retomável) e escopo compartilhado: as três fontes por ente passaram a usar o mesmo ente e a mesma janela. Antes cada uma tinha o seu recorte, e a tela chegava a _explicar_ a divergência.
- **Fatiamento automático de janela** nas entidades do Portal CGU que a API limita a um mês.

_Correções de importação_

- **PNCP** consultava um endpoint inexistente (`/v1/contratos/publicacao`); passou para `/v1/contratos`, e os campos que não existem nessa API foram trocados pelos que existem.
- **CEAPS** migrou para a fonte que está no ar, em `adm.senado.gov.br`.
- **CEAP** varria o cache inteiro de deputados, que acumula todas as legislaturas — centenas de requisições garantidamente vazias por importação. Agora recorta pelo mandato do ano pedido.
- **Matérias do Senado** vinham zeradas: a API mudou o formato sem trocar de URL e todas as matérias eram descartadas em silêncio. O ingest aceita os dois formatos, e descarte total agora vira erro explícito em vez de "consultado, sem dados".
- **Convênios do Transferegov** não tinham onde aparecer no site; passaram a `/convenios` com seletor de recorte.
- **Erro definitivo** deixou de travar varredura: no runner, no motor do Portal CGU e no laço do painel. Um 504 do PNCP fazia o botão girar por horas; um 400 permanente do Portal anunciava "continue para baixar o restante".

_Precisão do que dizemos_

- **Convênios não vêm do Transferegov.** Os dois ângulos de `/convenios` chamam o mesmo endpoint do Portal da Transparência. A página afirmava duas fontes distintas e que os números diferiam — nenhuma das duas coisas era verdade. Verificado contra o portal de APIs do Transferegov: o módulo onde os convênios vivem só publica CSV, com API prevista para 2027.
- **Rótulo de fonte nomeia a API consultada**, não o sistema de origem, com teste-guarda. Seis fontes não tinham rótulo nenhum e vazavam o id cru no Histórico.
- **Contrato de repasse não é contrato administrativo** — aviso recíproco entre `/convenios` e `/contratos`, que são vizinhos no menu.
- Cada convênio mostra os **dois portais oficiais** em toda superfície, por uma função única.

**Checks executados**

- `bun run test` ✓ — 70 arquivos, 756 testes, todos verdes.
- `bun run lint` ✓ 0 erros · `bunx tsc --noEmit` ✓ · `bun run build` ✓.
- **Testes manuais do mantenedor** ✓ — importações reais por fonte em `/admin/dados`, conferindo Histórico, cobertura e retomada. Foram eles que revelaram as falhas de PNCP, CEAP, matérias do Senado, votações da Câmara e Portal CGU listadas acima.

**Pendências conhecidas, registradas no ROADMAP**

- `/cobertura` tem fontes e dados faltando (v0.7.0).
- `materia/pesquisa/lista` do Senado já passou da data de desativação que o próprio serviço anuncia (v0.8.0).
- Convênios ainda vivem em duas tabelas alimentadas pelo mesmo endpoint (v0.9.0).

**Plano:** sem plano dedicado — escopo detalhado no ROADMAP.

**PR de sync público:** `sync v0.6.0`.

## v0.5.0 — 2026-08-19

**Resumo:** põe PNCP, Transferegov e as proposições da Câmara em condição de carga em massa. Nenhuma das três era retomável, e a interface contornava isso limitando a três páginas por rodada — o que impedia importar um ano inteiro.

**Entregas**

- PNCP e Transferegov passam a processar **uma página por passo**, com orçamento de tempo e de subrequisições. Antes o laço ia até 2000 páginas numa chamada só, e um erro de banco lançava e perdia a rodada inteira; agora interrompe sem avançar o cursor, e a rodada seguinte refaz aquela página.
- Proposições da Câmara: o teto de 5 páginas escondia um problema maior — depois de listar, a função buscava detalhe e autores de cada proposição, cerca de 4 subrequisições por item, ou ~2000 numa única chamada. Elevar o teto sem tornar retomável pioraria o estouro. O cursor passou a ser a proposição, com as páginas da listagem em cache dentro da rodada, o que rende uma busca de listagem por rodada em vez de uma por proposição.
- Trava de `maxPaginas: 3` removida da interface; painel e job builder repetem as rodadas até a varredura fechar, como já faziam com a CGU.
- `src/lib/data/janela-varredura.ts`: chave de varredura para fontes que importam por janela de datas, distinguindo fonte, janela e filtros — se duas importações da mesma janela com filtros diferentes dividissem chave, a segunda retomaria do cursor da primeira e pularia páginas que nunca leu.

**Checks executados**

- `bun run test` ✓ — 63 arquivos, 595 testes, todos verdes (6 novos).
- `bun run lint` ✓ 0 erros · `bunx tsc --noEmit` ✓ · `bun run build` ✓.
- Bundle do cliente conferido: sem código server-only ✓.
- Janelas de `src/lib/data/janelas.ts` revisadas: **nenhuma alterada**. Cada uma já tem justificativa documentada; a única candidata a ampliação (TSE, que começa em 1998 embora haja dados desde 1994) é decisão deliberada registrada em comentário, e mudá-la exigiria verificar a disponibilidade real no CDN.
- **Pendente:** a importação real de um ano-calendário prevista nos critérios de aceite **não foi executada** — o mantenedor optou por verificar manualmente depois.

**Plano:** sem plano dedicado — escopo detalhado no ROADMAP.

**Roadmap cidadão:** sem item público — infraestrutura interna.

## v0.4.0 — 2026-08-19

**Resumo:** resolve a fragilidade mais séria do diagnóstico. As despesas de gabinete (CEAP na Câmara, CEAPS no Senado) eram importadas percorrendo todos os parlamentares em cache dentro de uma única chamada — centenas deles, cada um com até 30 páginas, sem orçamento, sem retomada e sem teto de subrequisições. Com o histórico de várias legislaturas, era o candidato mais provável a estourar os limites de execução do Worker.

**Entregas**

- Cada passo passa a processar **um parlamentar**, com checkpoint por (casa, ano, mês). Erro de banco ou de rede interrompe a rodada sem avançar o cursor, então a seguinte refaz aquele parlamentar em vez de dá-lo por importado; a lista vem ordenada por id para a retomada não pular nem repetir ninguém.
- O runner ganhou **orçamento de subrequisições**: tempo sozinho não protege do limite por invocação do Workers, porque um passo pode ser rápido e caro. O passo reporta seu custo e a rodada para ao atingir o teto (45 na CEAP, com orçamento de 150s).
- Tabela `importacao_varredura`: o formato de checkpoint do runner genérico, para fonte nova não precisar de tabela própria. RLS ligada, só admin lê, escrita pelo servidor via `service_role` — mesma política das varreduras existentes.
- `src/lib/data/ceap-varredura.ts`: módulo puro com a chave de varredura e o mapeamento cursor→parlamentar, coberto por teste porque o erro que ele evita (pular um parlamentar por um off-by-one) é silencioso.
- O job builder e os botões do painel repetem as rodadas até o mês fechar, como já faziam com as varreduras da CGU.

**Checks executados**

- `bun run test` ✓ — 62 arquivos, 589 testes, todos verdes (13 novos).
- `bun run lint` ✓ 0 erros · `bunx tsc --noEmit` ✓ · `bun run build` ✓.
- Migration aplicada; RLS conferida contra o banco (política única de SELECT para admin, sem política de escrita) ✓.
- Round-trip do checkpoint testado contra o banco real, incluindo a segunda gravação sobre a mesma chave, e a linha de teste removida em seguida ✓.
- **Pendente:** a importação real de um mês de CEAP e CEAPS prevista nos critérios de aceite **não foi executada** — o mantenedor optou por verificar manualmente depois.

**Plano:** sem plano dedicado — escopo detalhado no ROADMAP.

**Roadmap cidadão:** sem item público — infraestrutura interna.

## v0.3.0 — 2026-08-19

**Resumo:** dá às importações a base de resiliência de que a carga histórica depende. Unifica a política de retry, que variava por fonte (e no SICONFI simplesmente não existia), e extrai a mecânica de orçamento, checkpoint e retomada num runner sem nenhuma fonte dentro — a mesma peça que a automação periódica vai consumir mais adiante.

**Entregas**

- `src/lib/data/http-retry.ts`: política única — 4 tentativas, backoff exponencial 500ms → 1,5s → 4,5s, teto de 10s, jitter de ±25% e precedência para o `Retry-After` do servidor. O wrapper devolve a `Response` mesmo com status ruim, para cada fonte manter sua mensagem e o prefixo `TRANSIENT:` que o painel admin usa no circuit breaker.
- Adotam a política: CGU, PNCP, SICONFI, TSE/CKAN e Transferegov (via `portalGet`). O SICONFI, que não tinha retry nenhum, deixa de perder a rodada inteira em qualquer 503 do Tesouro.
- `src/lib/data/runner.ts`: `rodarComOrcamento` roda passos até esgotar o orçamento, grava o checkpoint depois de cada passo e devolve `{concluido, proximoCursor}`. Passo interrompido não avança o cursor — a próxima rodada refaz a página que falhou em vez de dá-la por importada. Todo o estado vive no banco, nada em memória entre rodadas.
- `varrerPaginado` (CGU) delega orçamento, checkpoint e retomada ao runner, com um adaptador de `Checkpoint` sobre `cgu_varredura` — primeiro uso real do runner.
- `docs/importacao.ia.md` documenta a política única e o contrato do runner; o guia de nova fonte deixa de mandar criar wrapper de retry próprio.

**Checks executados**

- `bun run test` ✓ — 61 arquivos, 576 testes, todos verdes (31 novos: 18 do wrapper, 13 do runner, com fetch e relógio injetados).
- `bun run lint` ✓ 0 erros · `bunx tsc --noEmit` ✓ · `bun run build` ✓.
- Bundle do cliente conferido: sem `supabaseAdmin`, sem chave da CGU ✓.
- **Pendente:** a rodada real de importação em `/admin/dados` prevista nos critérios de aceite **não foi executada** — o mantenedor optou por verificar manualmente depois. Até lá, a ausência de regressão no caminho de ingestão está apoiada apenas na suíte e na revisão do código.

**Plano:** sem plano dedicado — escopo detalhado no ROADMAP.

**Roadmap cidadão:** sem item público — infraestrutura interna.

## v0.2.0 — 2026-08-19

**Resumo:** torna o `bun run lint` utilizável como sinal de regressão — ele falhava desde antes do versionamento, com milhares de erros de formatação que escondiam qualquer problema real. Remove duas server functions expostas sem uso e faz o espelhamento para o repositório público recusar-se a reverter contribuições externas.

**Entregas**

- Formatação da base com Prettier em commit mecânico isolado (327 arquivos), com o hash registrado em `.git-blame-ignore-revs` para não poluir o `git blame`. `.prettierignore` passa a ignorar a mesma lista de tooling e caches que o ESLint.
- Erros de lint remanescentes zerados: componentes nomeados nas rotas de artigo (mapas, notas, tutoriais), cast estrutural no lugar de `any` em fixture de teste, e justificativa explícita nos quatro escapes de tipo legítimos (nome de tabela dinâmico contra o `Database` gerado do Supabase, `.or()` fora do tipo do builder, registry heterogêneo).
- `aplicarHeuristicasFonte` e `revalidarFindingsCgu` removidas — endpoints sem caller no app (protegidos por auth de admin, não eram brecha). A re-checagem unitária `revalidarFindingCgu`, que tem UI, permanece.
- `scripts/sync-opensource.mjs` aborta se o `main` público tiver commits posteriores à última tag de release que não vieram de uma sincronização, listando-os — o `rsync --delete` os reverteria em silêncio. Flag `--allow-unported` para o caso deliberado.

**Checks executados**

- `bun run lint` ✓ — 0 erros (16 warnings do padrão shadcn/ui, que não bloqueiam).
- `bun run test` ✓ — 59 arquivos, 545 testes, todos verdes.
- `bun run build` ✓ · `bunx tsc --noEmit` ✓.
- `diff -rq .claude/skills .agents/skills` vazio ✓ — o reformat preservou os espelhos byte a byte.
- Detecção de commits não portados validada em cenário simulado ✓ (lógica de detecção; a integração com `origin/main` não foi exercida ponta a ponta para não escrever no repositório público).
- Validação em staging pelo mantenedor ✓.

**Plano:** [docs/planos/v0.2.0-lint-e-protecao-do-sync.md](./docs/planos/v0.2.0-lint-e-protecao-do-sync.md) — inclui o registro das decisões tomadas.

**Roadmap cidadão:** sem item público — infraestrutura interna.

## v0.1.0 — 2026-08-19

**Resumo:** implanta o processo de desenvolvimento do projeto em quatro documentos vivos (WORKFLOW, ROADMAP, RELEASES e AGENTS), com versionamento SemVer escopado pelo roadmap e releases sincronizadas entre o repositório privado e o espelho público. Destrava a suíte de testes, que existia mas não tinha runner configurado — 545 testes passaram a rodar por um comando padrão. Alinha a documentação ao comportamento real do código em seis pontos divergentes.

**Entregas**

- `WORKFLOW.md`, `ROADMAP.md`, `RELEASES.md` e `AGENTS.md` estendido; `docs/planos/` para planos de release; seção "Como seu PR é lançado" no `CONTRIBUTING.md`.
- `vitest.config.ts` standalone (evita o conflito Zod 4 × router-generator sem workaround manual) + scripts `test` e `test:watch`; `docs/padroes/debug-problemas.ia.md` §1 passa de contorno temporário a resolvido.
- Correções docs×código: severidade de `valor_corrigido_listagem` e semântica de `mes_referencia` (`docs/fontes/portal-cgu.ia.md`); política de retry real por fonte (`docs/importacao.ia.md`); exceção de lote de 500 dos contratos (`docs/importacao.md`); referência a `src/routes/api/public/` inexistente (`README.md` e `docs/padroes/server-functions.md`); janela do TSE em 1998 (`docs/fontes/README.md`); rota do Roadmap no `AdminNav`.
- ESLint passa a ignorar `.claude/`, `.wrangler/` e `.tanstack/` — metadata de tooling e caches, não código do produto.

**Checks executados**

- `bun run test` ✓ — 59 arquivos, 545 testes, todos verdes.
- `bun run build` ✓ — com `vitest.config.ts` presente, comprovando que não interfere no build de produção.
- `bunx eslint` ✓ — sem erros nos arquivos tocados pela release.
- Links relativos dos quatro documentos resolvem ✓ · `diff -rq .claude/skills .agents/skills` vazio ✓.
- Validação em staging pelo mantenedor ✓.
- Conhecido e triado: `bun run lint` completo ainda acusa ~4,9 mil erros `prettier/prettier` pré-existentes em `src/` — escopo da v0.2.0.

**Plano:** [docs/planos/v0.1.0-workflow.md](./docs/planos/v0.1.0-workflow.md)

**Roadmap cidadão:** sem item público — infraestrutura interna.

## Baseline (pré-versionamento) — 2026-08-19

O projeto adotou versionamento formal nesta data; todo o trabalho anterior é a baseline sem versão retroativa. O que existia:

- Plataforma no ar com 7 fontes de dados integradas (Portal da Transparência/CGU, TSE, Câmara, Senado, PNCP, Transferegov, SICONFI) e ~79 rotas públicas.
- Sistema de sinais com catálogo central de 45 regras em três tipos (qualidade, lacuna, investigativo), com teste-guarda.
- Admin de importação multi-fonte com orçamento de tempo e retomada (CGU e TSE), log de auditoria em `importacoes` e controles de limpeza.
- 59 arquivos de teste unitário existentes, ainda sem runner configurado.
- Espelhamento privado→público via `scripts/sync-opensource.mjs`.

A primeira release versionada é a **v0.1.0** ([escopo](./ROADMAP.md)).
