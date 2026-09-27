# RELEASES — histórico de entregas

Só releases entregues e validadas, em ordem descendente. Planos futuros moram no [ROADMAP.md](./ROADMAP.md); o processo de fechamento no [WORKFLOW.md](./WORKFLOW.md).

<!--
Template de entrada (copiar para o topo ao fechar uma release):

## vX.Y.Z — AAAA-MM-DD

**Resumo:** o que foi entregue, em 2–4 frases.

**Checks executados:** apenas os realmente rodados, com resultado
(ex.: `bun run lint` ✓ · `bun run build` ✓ · `bun run test` — N suítes, M verdes).

**Issues:** milestone `vX.Y.Z` do repositório privado (e mapa do wayfinder, se houver) — referência só para o mantenedor.

**PR de sync público:** link do PR `sync vX.Y.Z` no repositório público.

**Roadmap cidadão:** itens criados em /admin/roadmap (se houver impacto cidadão).

Regras de redação: referências por data e versão, nunca hash de commit
(este arquivo é espelhado no repositório público, cujo histórico não contém
os commits do privado); nada de vulnerabilidade não corrigida; nenhum segredo.
-->

## v0.16.0 — 2026-09-26

**Resumo:** segunda release do programa de busca unificada. A `/buscar` passa de 7 para 16 categorias: todo tipo público que o site já tinha entra no índice — parlamentares, órgãos e municípios, proposições, matérias, votações e votos, despesas da cota parlamentar, bens, contas e resultados eleitorais, relatórios fiscais do SICONFI, prompts do Kit, perguntas, roadmap, lacunas, alertas de qualidade e páginas do site —, e os sub-registros (voto, despesa, bem, lançamento de campanha) levam direto à linha dentro da ficha. A cobertura deixa de ser binária: cada janela de importação tem um de oito estados, lidos da mesma função pela `/cobertura`, pela matriz do admin e pela marca de "coleção desatualizada" na busca. O admin ganha o diagnóstico do índice por coleção e as referências entre artigos e registros, que alimentam o bloco "Aprenda a investigar este registro" nas fichas. A carga no índice dos votos, dos bens e dos relatórios fiscais já importados e o tutorial da release ficaram para a operação de cobertura (ver "Pendências").

**Entregas**

- **Cobertura estruturada** (migrations `0013` e `0014`):
  - `CATALOGO_COBERTURA` declara, por fonte, as tarefas da ferramenta de importação, as tabelas cache, a janela de disponibilidade, o recorte, as coleções do índice e o limiar de defasagem; testes-guarda cruzam o catálogo com a tabela de dependências, com as coleções do índice e com as janelas;
  - o estado de cada janela (fonte × recorte × período) é derivado na leitura, sem tabela nova, pela RPC `cobertura_janelas` e pelo módulo puro `src/lib/data/cobertura-estado.ts`, em oito estados por ordem de precedência: erro, indisponível, processando, parcial, vazio confirmado, concluído, concluído sem total da origem e não consultado; uma conferência mais antiga que a última rodada não vale;
  - `/cobertura`: por fonte, "X de Y janelas concluídas", a barra por estado com legenda, a última importação conferida e o selo "desatualizada", sem percentual de registros; a resposta leva só as células que a página pinta (o resumo continua calculado sobre o universo inteiro no servidor);
  - matriz do `/admin/dados`: a mesma função nas 13 fontes, com estado, motivo e execução da conferência por célula, contorno por estado sobre o volume e legenda;
  - `docs/importacao.md` e `docs/admin.md` descrevem o modelo; saiu o trecho que prometia estados que a página não mostrava.
- **Coleção desatualizada na `/buscar`:** a categoria cuja fonte tem a última conferência aprovada além do limiar do catálogo (45 dias nas mensais, 400 nas anuais, 30 nos cadastros), ou nunca conferida, ganha o selo "desatualizada" na visão geral e, dentro dela, um aviso com a data da última importação conferida e link para a `/cobertura`. Os resultados continuam visíveis, e a consulta das datas fica fora da busca: falhar nela não derruba a página.
- **Diagnóstico de busca no admin** (aba Busca do `/admin/dados`, migration `0015`): por coleção, registros no cache, publicáveis pela projeção e linhas no índice, com a conciliação (conciliada, faltam, sobram ou indisponível), o que fica fora da busca e a defasagem das fontes; cada contagem tem 6 s de orçamento. "Reindexar" chama `busca_indexar` para a coleção inteira ou para até 1.000 ids.
- **Todos os tipos públicos na busca** (migrations `0016` e `0017`, `0021` a `0027`), 16 das 20 categorias ativas:
  - **Pessoas e Organizações:** deputados e senadores, uma linha por pessoa (o mandato é faceta e resumo, não linha), sem e-mail nem foto; órgãos do catálogo SIAFI e municípios do IBGE, com o código como identificador exato ("26000" destaca o Ministério da Educação, "3550308" o município de São Paulo); faceta "Tipo" separa órgão federal, município e fornecedor;
  - **Propostas, Votações e Votos:** proposições da Câmara e matérias do Senado, com sigla, número e ano normalizados como identificador exato ("PL 1234/2024"); votações das duas Casas com a proposição ou matéria como registro-pai; um voto por linha, com a votação como registro-pai e destino na linha do parlamentar (`#voto-<id>`);
  - **Despesas:** CEAP e CEAPS, uma linha por despesa, com o parlamentar como registro-pai; a ficha do parlamentar aceita `?ano=&mes=`, abre filtrada no mês (e busca as despesas dele, porque a lista geral para em 1.000 linhas) e rola até a linha;
  - **Eleições e campanhas:** bens declarados, receitas, despesas e resultados eleitorais, com a candidatura como registro-pai; a ficha da candidatura aceita `bem`, `receita` e `despesa` na URL, destaca a linha e ganhou as listas de receitas e despesas lançamento a lançamento, 20 por página;
  - **Finanças públicas:** relatórios fiscais do SICONFI por relatório (ente × tipo × exercício × período), nunca por conta, pelo catálogo `siconfi_relatorios`, mantido por gatilhos no cache; `/relatorios-fiscais` aceita `codIbge` e `periodo` e mostra a faixa "Relatório de <ente>";
  - **Artigos:** os prompts do Kit de investigação, um resultado por vínculo prompt × mapa público, com destino no prompt dentro do mapa (aberto e destacado pelo `#prompt-<id>`);
  - **Perguntas e investigações:** investigações publicadas e modelos de pergunta ativos;
  - **Qualidade e sinais:** lacunas publicadas e os alertas de qualidade e lacunas detectados nas importações, com o mesmo filtro da lista pública e sem os detalhes internos;
  - **Páginas e ajuda:** o roadmap publicado e 46 páginas do site com 14 seções com âncora (ajuda, método, trilhas, referências, páginas de fonte), a partir de uma lista no código (`src/lib/paginas-publicas/lista.ts`) copiada para a tabela `paginas_publicas` pelo botão "Sincronizar páginas" do admin; um teste-guarda falha quando uma rota pública estática não está na lista nem na lista de exclusões;
  - âncoras novas nas listas de perguntas, roadmap, lacunas, trilhas e Aprender; toda âncora de destino da busca usa a mesma margem de rolagem, que passa da faixa fixa do topo;
  - "Salvar no caderno" com os tipos novos (parlamentar, órgão, ente, voto, despesa, bem, lançamentos e resultado eleitoral, relatório fiscal, prompt, pergunta, lacuna, alerta, página).
- **Referências entre artigo e registro** (migrations `0019` e `0020`):
  - tabela `artigo_referencias`: o artigo cita um registro (coleção + id de origem, a mesma identidade do índice) ou uma consulta (URL de `/buscar` normalizada); o público lê as referências de artigo publicado, e só o admin escreve;
  - no `/admin/artigos`, os links internos do texto viram sugestões para confirmar, com aviso de link ambíguo (`/contratos/$id` entre CGU e PNCP) ou não encontrado, e cadastro manual;
  - "necessita revisão", calculado na leitura, quando o registro citado sumiu, mudou depois da verificação ou a consulta citada ficou vazia; filtro na lista e "Verificado";
  - "Aprenda a investigar este registro" nas fichas de licitação, contrato (CGU e PNCP), emenda, convênio, fornecedor, candidatura, deputado, senador, órgão e município, só com artigos publicados;
  - as fontes do artigo viram lista controlada, em dois grupos: do acervo (CGU, PNCP, Transferegov, SICONFI, Câmara, Senado, TSE, IBGE) e oficiais externas (SIOP, Receita Federal, SICAF, Painel de Preços, CEIS, CNEP, TCU, MGI); a migration normalizou os valores de produção e guardou os retirados nas notas internas do artigo.

**Correções**

- A leitura pública de alertas de qualidade passou a seguir o mesmo filtro da lista pública (migration `0018`).
- Ficha de órgão: em produção, toda ficha mostrava "Órgão não encontrado", porque decidia antes de o dataset do cliente carregar. Agora mostra "Carregando…" até lá, como a ficha de contrato.
- `/buscar` com um termo só de dígitos (código de órgão, código IBGE, CNPJ sem pontuação) mostrava "Não consegui carregar a busca": o roteador converte o parâmetro em número. O termo volta a ser texto na validação da URL e no campo de busca.
- Âncoras dos destinos da busca (votos, despesas, roadmap, lacunas, modelos de pergunta, trilhas, Aprender) ficavam parcialmente atrás do cabeçalho fixo; todas passaram para a mesma margem dos bens eleitorais e do Kit.

**Decisões**

- **Modelo de cobertura:** o estado é derivado na leitura, a partir da última conferência, do resultado das rodadas e do cursor das varreduras; nenhuma tabela nova. A linha da cobertura é a entrada do catálogo, igual à tarefa da ferramenta, e a coleção da busca liga ao catálogo pela tabela cache. "Concluído sem total da origem" é um estado à parte e nunca vira percentual; a janela `fora_da_janela` não entra no universo. A etapa "indexado" é conciliada por coleção só no admin; a cobertura pública mostra só a etapa importado, e "extraído" não se aplica até a v0.18.0. SICONFI e TSE, que não têm universo enumerável sem parâmetro, resumem só as janelas já consultadas, e a página diz isso. As pendentes da ferramenta mantêm a regra "última conferência não aprovada": alinhá-las ao estado exigiria ler as rodadas em toda consulta, e a única diferença (janela aprovada com rodada nova ainda não conferida) está documentada.
- **Coleção desatualizada:** a última importação válida de uma fonte é a data da sua conferência aprovada mais recente; a categoria fica marcada quando qualquer fonte que a alimenta passa do limiar. Com a automação desligada, várias coleções aparecem desatualizadas, e isso é o esperado. O texto nunca diz "fonte fora do ar".
- **Referências entre artigo e registro:** a identidade de registro é a do índice (tabela de origem + id), que vale também para tipos ainda não indexados e resolve a ambiguidade de `/contratos/$id`. As referências nascem de sugestões tiradas dos links, confirmadas no admin; "necessita revisão" é calculado, sem coluna, e o texto do artigo nunca é reescrito. Leis, conceitos e a LOA ficam fora da lista de fontes: o artigo os cita no texto. Rascunho separado da versão publicada, histórico de versões e preview do `/admin/artigos` ficam para uma release posterior.
- **Capacidade do banco:** antes dos sub-registros, o índice foi medido em produção (242 MB para 88.841 linhas, ~2,8 KB por linha, dominado pelo texto dos contratos) e os candidatos da release somavam ~942 mil linhas, 663 mil delas votos. A projeção dava 0,9 a 2,5 GB a mais; com o banco em 2,68 GB de 8 GB no Lovable Cloud, os sub-registros entraram, com três proteções: projeções enxutas (voto = parlamentar + votação + voto; bem = tipo + candidato + eleição, sem descrição; despesa sem texto longo), índice trigram do título parcial, sem Votos e Despesas (o nome já está no `tsvector`), e medição do índice depois de cada carga. Se o banco passar de ~6 GB (75% do teto), o plano de capacidade volta à mesa antes da fatia seguinte.
- **Registro de coleções** (migration `0021`): a tabela `busca_colecoes` (coleção → função de projeção), lida por `busca_projetar` via `EXECUTE`, e a função `busca_registrar_colecao(tabela, chave, função)`, que grava o registro e cria os gatilhos. Antes, cada coleção nova redefinia `busca_projetar`, e duas fatias de índice sempre conflitavam; com o registro, nenhuma migration nova toca nela, e as fatias de votos, despesas, dados eleitorais, Kit, páginas, SICONFI e alertas foram feitas em paralelo, com as migrations renumeradas na integração.
- **Cargas grandes fora da migration:** votos (~663 mil), bens (~228 mil) e relatórios fiscais (sobre ~2,8 milhões de contas) não carregam na migration, para não travar a aplicação dela: vão por procedimentos com commit por período (`busca_carregar_votos`, `busca_carregar_eleitoral`, `busca_carregar_siconfi`), que podem ser repetidos sem duplicar. Registros novos entram pelos gatilhos a cada importação.
- **Alertas de qualidade no índice:** a importação regrava, linha a linha, os alertas abertos detectados de novo, e o gatilho por comando reindexaria um alerta por comando a cada reimportação. O gatilho de alteração virou um gatilho **por linha com `WHEN`** sobre as colunas publicadas: só reindexa quando fonte, entidade, regra, tipo, origem, situação ou data de detecção mudam de fato (o Postgres não aceita lista de colunas em gatilho com tabela de transição). Medido na reimportação de três meses da CEAPS (5.226 despesas), sem custo mensurável: a variação entre duas rodadas com o gatilho foi maior que a diferença para a rodada sem ele. Reimportar uma fonte com muitos alertas abertos (contratos) seria o pior caso, não medido.
- **Links da busca com `?` e `#`:** o `Link` do roteador só aceita o caminho no `to`; com parâmetros ou âncora no destino, o parâmetro da rota engolia o resto, e o destino dos votos, bens e lançamentos quebrava. O destino interno passou a ser separado em caminho, parâmetros e âncora antes do link.
- **Granularidade e destinos:** parlamentar é uma linha por pessoa, não por mandato; resultado eleitoral é uma linha por candidatura e turno (a soma dos municípios), com destino na candidatura, e o partido só aparece como faceta, sem virar cadastro; o mesmo prompt em dois mapas vira dois resultados, cada um no seu mapa; o id da Casa do parlamentar é pesquisável, mas não é identificador exato (número curto casaria com qualquer busca numérica); o número de nota fiscal da despesa também não.
- **Dados pessoais:** a política da v0.15.0 vale nas coleções novas. CPF nunca é pesquisável: fornecedor e doador pessoa física entram pelo nome, e o documento só aparece mascarado na faceta; a descrição dos bens fica fora do índice; cor/raça, gênero, grau de instrução e ocupação não entram; e-mail e foto dos parlamentares não entram; autoria privada de perguntas, notas internas do roadmap e autoria de lacunas ficam fora.
- **Exclusões explícitas do índice:** as anomalias são calculadas no navegador, sem registro para indexar; a transparência institucional é calculada por requisição a partir dos contratos, e a nota já aparece na ficha do órgão, que está no índice. As categorias Normas, Documentos e debates, Eventos e Estudos externos seguem inativas até as releases que importam esses dados, e não aparecem como categoria vazia. Conteúdo do próprio site (artigos, perguntas, roadmap, lacunas, Kit, páginas, alertas) fica fora do catálogo de cobertura e da marca de desatualizada, numa lista explícita.
- **Páginas do site pela lista no código:** semear as páginas na migration copiaria o texto no SQL, que é imutável, e a primeira edição deixaria duas cópias diferentes. A lista no código é a única cópia editável; o painel do admin mostra a diferença depois de cada deploy até alguém sincronizar.

**Pendências**

- **Cargas no índice**, no milestone de cobertura, pelo mantenedor: os votos já importados das duas Casas, os bens declarados e os relatórios fiscais do SICONFI. Até lá, votos, bens e relatórios importados antes da release não aparecem na busca; os novos entram pelos gatilhos. Cada carga termina com a conciliação na aba Busca e a medição do índice.
- **Tutorial "Quais dados a busca encontra e como conferir a cobertura":** o aceite da release pedia o tutorial executado em produção. O rascunho está pronto, mas os passos de votos, bens e da marca de desatualizada dependem das cargas acima; por decisão do mantenedor em 2026-09-26, a publicação saiu da release e segue com a operação de cobertura.

**Checks executados**

Na `main` com todas as entregas e correções (2026-09-26):

- `bun run lint`: 0 erros (17 warnings conhecidos);
- `bunx tsc --noEmit`: ok;
- `bun run build`: ok;
- `bun run test`: 139 arquivos, 1465 testes;
- migrations `0013` a `0027` aplicadas e registradas pelo mantenedor, uma a uma, com a conferência de cada PR; o journal tem 28 entradas (`0000` a `0027`).

**Homologação**

Ao longo da release, no preview local lendo o banco de produção (só leitura):

- `/cobertura`: contratos da CGU com 184 de 43.395 janelas concluídas e licitações com 87, os números das cargas da v0.15.0; votações do Senado com 285 de 285 e da Câmara com 37 de 285; SICONFI e TSE com "entre as já consultadas". A resposta caiu de 13.333 KB para 86 KB depois de limitar as células enviadas;
- `/buscar?q=serviços`: Pessoas (TSE), Contratos (PNCP nunca conferido), Emendas e Convênios marcados como desatualizados; Organizações e Licitações não, por terem conferências aprovadas no dia; dentro de Contratos, o aviso cita só o PNCP;
- `/buscar?q=3550308`: 43 registros, com o município de São Paulo destacado como identificador exato; `/buscar?q=26000` destaca o órgão SIAFI 26000;
- `/orgaos/26000` e `/orgaos/36000` abrem a ficha do ministério; `/orgaos/99999` segue "Órgão não encontrado";
- `/camara/votacoes/2611313-31#voto-160592`: a linha do voto abre destacada, abaixo do cabeçalho fixo;
- `/senado/senadores/5672?ano=2026&mes=1#despesa-2279778`: a ficha abre filtrada em 01/2026 e rola até a despesa destacada, também por navegação a partir da `/buscar`;
- `/eleicoes/candidatos/90001615125?ano=2022&bem=5#bem-5`: as 58 linhas de bens com âncora, a do bem 5 destacada e rolada;
- `/relatorios-fiscais?codIbge=35&exercicio=2023&tipo=RGF&periodo=3`: de 41.909 para 1.544 contas, com "Relatório de Governo do Estado de São Paulo · 3º período";
- `/mapas/auditar-cota-parlamentar#prompt-<id>` (servidor do branch): só o prompt indicado abre, destacado, na carga direta e na navegação;
- custo do gatilho dos alertas medido com a migration `0027` aplicada, na reimportação da CEAPS (resultado nas Decisões).

A nota "Por que uma busca sem resultados não encerra a investigação" recebeu o parágrafo sobre a marca de coleção desatualizada, pelo `/admin/artigos`.

**Confirmação do mantenedor:** fechar a v0.16.0 em 2026-09-26, com o tutorial e as cargas no índice como pendências registradas acima.

**Issues:** milestone `v0.16.0` do repositório privado e o mapa do wayfinder da busca unificada.

**PR de sync público:** `sync v0.16.0`.

## v0.15.0 — 2026-09-26

**Resumo:** primeira release do programa de busca unificada. A `/buscar` deixa de consultar 7 tabelas por `ilike`, somar listas truncadas em 50 como se fossem totais e esconder falhas: passa a ler um índice próprio no Postgres, com texto em português que casa com e sem acento e no singular e no plural, contagens e facetas calculadas sobre todo o resultado, categoria paginada estável por um corte de horário e falha parcial visível. A busca cobre as mesmas coleções de antes — contratos (CGU e PNCP), licitações, emendas, convênios, fornecedores, candidaturas e artigos publicados. Três pautas editoriais ensinam a usá-la, e as fichas e páginas de artigo deixaram de acusar erro de hidratação.

**Entregas**

- **Índice de busca unificado** (tabela `busca_indice`, migration `0010`):
  - extensões `unaccent` e `pg_trgm` e configuração de texto `busca_pt` (português sem acento);
  - uma linha por registro pesquisável, com categoria, fonte, título, identificador rotulado e normalizado, data principal com natureza e precisão, valor com natureza e unidade, resumo, destino interno, link oficial e facetas (universais em colunas; as de cada tipo em JSON indexado);
  - dois `tsvector` com pesos (título > identificador e nomes > resumo e texto): o `portuguese` padrão e o `busca_pt`, que tira o acento e troca "-ões" por "-ão" antes do radical — "licitacao", "licitacoes", "licitação" e "licitações" casam entre si;
  - uma função de projeção por coleção (o adaptador) e gatilhos nas 8 tabelas de origem: inclusão, correção, exclusão, TRUNCATE e despublicação de artigo valem na hora, na mesma transação da importação, sem mudar o código dela; reconstrução por coleção que preserva o horário de entrada no índice;
  - leitura só pelo servidor (RLS sem política para `anon` e `authenticated`);
  - registro das 20 categorias do programa em ordem fixa no código (`src/lib/busca/categorias.ts`), com as 7 da v0.15.0 ativas.
- **Política de dados pessoais na busca** (seção "Na busca" de [`docs/conceitos/lgpd-e-dados-publicos.md`](./docs/conceitos/lgpd-e-dados-publicos.md)): CPF e título de eleitor nunca entram no índice nem servem de termo de busca; CPF de pessoa física só mascarado (`***.456.789-**`); fornecedor cuja chave é CPF completo fica fora, porque o destino levaria o CPF na URL; cor/raça, gênero, grau de instrução e ocupação de candidatos não viram faceta nem texto pesquisável; artigo não público não entra.
- **Consulta no servidor** (migration `0011`, `busca_resumo`, `busca_lista`, `busca_opcoes_faceta` e as server functions de `src/lib/data/busca-indice.functions.ts`):
  - total exato por categoria, 3 prévias e registro de identificador exato destacado antes dos grupos, sem contar em dobro;
  - facetas sobre todo o resultado: OU dentro do filtro, E entre filtros, cada faceta ignora o próprio filtro, valor selecionado continua listado com zero, "Sem informação" para registros sem valor; filtro próprio de uma categoria não restringe as outras na visão geral; filtro que não vale para a categoria é recusado com motivo;
  - lista paginada com desempate estável e ordem por relevância, mais recente ou mais antigo; motivo ("casou no título…") e trecho destacado só nos itens da página;
  - corte `ate` pelo horário de entrada no índice, com a contagem de resultados novos; página numerada até o resultado 10.000;
  - orçamento de 3 s para a contagem completa: estourou, a chamada é repetida sem contagem e a interface mostra "contagem indisponível".
- **Nova `/buscar`** (Container/View/logic; a busca antiga saiu):
  - visão geral com as 7 categorias em ordem fixa, os dois primeiros grupos com resultado abertos, 3 prévias e "Ver todos os N";
  - categoria paginada em 20/50/100 (padrão 20), paginação acima e abaixo, corte na URL;
  - filtros na lateral com aplicação imediata; no mobile, painel "Filtrar (N)" com rascunho e Aplicar/Cancelar; 8 opções com "Ver mais" e pesquisa no servidor nas facetas longas; chips removíveis e "Limpar filtros"; filtro que vale só para algumas categorias aparece como chip com aviso ("só em Contratos e Licitações"); confirmação ao trocar para categoria onde o filtro não vale;
  - cartão com título, fonte, identificador, data na precisão da fonte, valor com natureza, trecho com destaque seguro (sem HTML), motivo, destino interno e link oficial separados;
  - estados antes da busca, carregando, nada encontrado, nada com os filtros, erro com "Tentar de novo", contagem indisponível e "N resultados novos · Atualizar";
  - estado inteiro na URL; `aria-live`, `aria-expanded`, teclado e 320 px;
  - `SeletorItensPorPagina` aceita opções próprias; as listagens seguem com 25/50/100;
  - 14 variantes no `/estilo` (composição "Buscar") e seção "Busca unificada" em [`docs/padroes-ui.md`](./docs/padroes-ui.md).
- **Ações da busca:**
  - salvar busca guarda a consulta sem página nem corte, e a busca salva abre sempre ao vivo;
  - "Salvar" em cada resultado leva o item ao caderno como link, sem snapshot (candidatura vira tipo novo do caderno);
  - seleção optativa, presa ao recorte (consulta, categoria e filtros): ao mudar o recorte, a página pede "Salvar no caderno" ou "Limpar seleção" antes de aceitar novas marcações; "Selecionar esta página" avisa que não seleciona o resultado inteiro;
  - copiar referências e exportar em CSV ou Markdown sobre a página, a seleção ou o conjunto completo (até 1.000 itens, com aviso de corte acima disso), com consulta, filtros, totais, corte do índice e data de geração no cabeçalho.
- **Pautas editoriais** (publicadas em 2026-09-26):
  - tutorial "Como pesquisar um assunto em várias fontes" (`/tutoriais/usar-busca-unificada`, reescrito para a nova busca);
  - mapa "Da licitação ao contrato: encontre os documentos" (`/mapas/contrato-federal-pncp`, recortado para licitação → contrato);
  - nota nova "Por que uma busca sem resultados não encerra a investigação" (`/notas/busca-sem-resultados`): falha, não coletado, não indexado e vazio confirmado;
  - Kit de prompts do mapa revisado.
- **Carga para a homologação:** contratos, fornecedores e licitações, vazios em produção até esta release, carregados pela ferramenta de importação numa janela que serve à homologação.
  - catálogo SIAFI: 633 órgãos, dos quais 263 com atividade recente;
  - contratos: 184 janelas órgão × mês aprovadas, com 93 contratos, principalmente de 2025-12, e os fornecedores deles;
  - licitações: 87 janelas aprovadas, com 186 licitações, principalmente de 2024-03.

**Correções**

- Contratos do PNCP: a faceta "Modalidade" mostrava o tipo do contrato ("Empenho", "Contrato (termo inicial)"), misturado com a modalidade de licitação da CGU. O tipo passa para uma faceta própria, "Tipo de contrato", e "Modalidade" fica só com a CGU (migration `0012`, com reconstrução das duas coleções).
- Candidaturas: o cartão repetia a eleição três vezes. Agora ela aparece só na data; o identificador é o número do candidato.
- Licitações da CGU: a linha gravava em `orgao_cod` o órgão máximo da unidade gestora (26000 para uma universidade 26231), e a conferência contava a célula pelo órgão pedido. Toda janela de órgão subordinado com licitações reprovava em "reflexo na cobertura". Agora a linha grava o órgão pedido, como os contratos já faziam.
- Hidratação: as páginas de artigo (`/notas`, `/mapas`, `/tutoriais`) e as 11 fichas de senador, deputado, votações da Câmara e do Senado, proposição, matéria, emenda, convênio, licitação, fornecedor e candidatura acusavam `Hydration failed` ao abrir a URL direto, e buscavam o registro de novo no cliente. O loader passa a devolver o registro nos dados da rota (`carregarFicha` e `carregarArtigo`), lança `notFound()` quando ele não existe e deixa a falha chegar ao `errorComponent`. Efeito colateral: "não encontrado" responde HTTP 404, não mais 200. A lição está na seção 7 de [`debug-problemas.ia.md`](./docs/padroes/debug-problemas.ia.md).

**Decisões**

- **Diagnóstico de produção antes de desenhar o índice** (só leitura, 2026-09-26): Postgres 17.6 no Lovable Cloud, banco de 1,66 GB, 87% dele no SICONFI; fora o SICONFI, o acervo pesquisável tem menos de 250 MB. Três das sete coleções da busca — contratos da CGU, fornecedores e licitações — estavam vazias, o que tornou a carga um pré-requisito da homologação. `unaccent` e `pg_trgm` estavam disponíveis e foram instaladas por migration, pelo mesmo caminho já usado para `pg_cron` e `pg_net`; não foi preciso plano B para acento.
- **Arquitetura do índice:** tabela unificada, uma linha por registro com destino próprio. Consulta federada por coleção e views materializadas foram descartadas (a primeira multiplica consultas e esquemas de faceta quando os tipos passarem de 20; a segunda recalcula tudo a cada carga). O índice copia só o necessário para buscar e exibir o cartão; o registro completo continua na tabela de origem, e a ficha lê de lá. Só a `/buscar` usa o índice; as listagens seguem nas próprias tabelas.
- **Granularidade para as próximas versões:** sub-registros (votos individuais, despesas, bens) viram linhas próprias a partir da v0.16.0; SICONFI entra por relatório, nunca por célula; texto integral de documentos, em tabela-filha, na v0.18.0. O tamanho medido na implementação (126 MB para 87 mil linhas, com dados sintéticos) superou a estimativa: antes de indexar sub-registros, medir com amostra real. Se passar do que o banco comporta, a resposta é planejar capacidade, não tirar votos do índice.
- **Acento e plural:** o stemmer português com `unaccent` antes do radical separa "licitação" de "licitações", e o padrão não acha "licitacao". A decisão foram dois `tsvector` consultados com OU, aceitando uma combinação sem casar; na implementação, a falha aparecia nos dois sentidos, e a troca de "-ões" por "-ão" antes do radical resolveu as quatro combinações.
- **Falha parcial reinterpretada:** a busca lê só o índice local, então não existe "fonte fora do ar" na consulta. Falha parcial é "contagem indisponível" (orçamento de tempo estourado, nunca zero). A marca de "coleção desatualizada" passou para a v0.16.0, junto com o modelo de cobertura: o critério de atraso por coleção depende dele.
- **Corte e estabilidade:** a "edição" do índice é um corte global por horário de entrada, sem versões (versões duplicariam linhas e mostrariam em edição antiga um registro removido por lei). Remoções — despublicação, limpeza, dado pessoal — valem na hora, também dentro do corte; uma correção durante a navegação pode mudar a posição de um registro, e o aceite passou a ser "nenhuma duplicata causada por registro novo". Além do resultado 10.000, a interface pede para refinar ou exportar.
- **Busca salva ao vivo, exportação como retrato:** a busca salva não guarda o corte e sempre reabre ao vivo; a exportação e a cópia de referências registram corte, data, consulta e totais, porque o arquivo é a prova. Exportação integral acima de 1.000 itens, por job, fica para a v0.23.0.
- **Contrato do adaptador e taxonomia:** cada tipo entra na busca com duas peças — a função de projeção no banco e o registro de categorias no código — mais teste com exemplos da coleção. A ordem das 20 categorias é fixa para todas as versões, legislativo antes do dinheiro (Propostas, Normas, Votações, Votos, Documentos e debates, Eventos, Pessoas, Organizações, Contratos, Licitações, Emendas orçamentárias, Convênios e transferências, Despesas, Eleições e campanhas, Finanças públicas, Estudos externos, Artigos, Perguntas e investigações, Qualidade e sinais, Páginas e ajuda); categoria vazia aparece só como título e contagem. Cada registro tem uma data principal de natureza fechada (assinatura, apresentação, publicação, fato, exercício, eleição) e precisão de dia, mês ou ano. Nada é fundido entre fontes até o modelo de identidade da v0.17.0.
- **Dados pessoais: segurança jurídica primeiro.** O índice nunca expõe mais do que a ficha pública mostra; buscar candidato por CPF permitiria montar perfil cruzando fontes, então a candidatura é achada por nome, UF e ano. Doador pessoa física (v0.16.0) entra pelo nome, com CPF mascarado como vem do TSE; descrição de bens fica fora do texto pesquisável; participantes de eventos e documentos (v0.18.0) só são indexados como pessoa com papel público documentado. Fora da busca, a ficha de contrato exibe o documento do fornecedor como vem da fonte e a listagem de fornecedores busca por CPF exato; isso não mudou agora e segue para uma investigação sobre o uso de dados pessoais publicados por fontes oficiais em cruzamentos.
- **UX pelo protótipo:** três layouts foram navegados com dados fictícios, e a especificação literal (lateral de filtros, grupos colapsáveis) venceu a de categorias como navegação e a de coluna única com filtros no topo. A `/buscar` usa 20/50/100 por página, e não o kit das listagens, porque cada cartão tem trecho destacado e a busca é por relevância: quem não acha nos primeiros refina. No mobile, as contagens do painel são as da busca aplicada, sem prévia calculada a cada toque. O código do protótipo não foi aproveitado.
- **Orçamento de tempo cortado no servidor:** os 3 s abortam a requisição no Worker, mas o banco pode seguir com a consulta até o tempo-limite da `service_role` (8 s), porque o PostgREST não permite um tempo-limite menor por chamada. Nas medições com volume de produção sintético, o pior caso ficou em 0,85 s.
- **Item salvo sem snapshot:** o item do índice é uma projeção, não o registro completo; a prova fica na ficha.
- **Pautas:** o inventário dos 21 artigos contra as 19 pautas do programa deu 4 revisões e 15 criações; as revisões mantêm o slug existente, para não quebrar links. O mapa da licitação ao contrato perdeu a parte de execução (empenho, liquidação, pagamento), que passa ao mapa "Rastreando o DNA da despesa", junto com o prompt "Contrato assinado x dinheiro que saiu"; perdeu também o diagrama, que desenhava até o pagamento; e a afirmação sobre aditivos acima de 25% passou a citar a regra do art. 125 da Lei 14.133/2021. O tutorial foi publicado sem os screenshots dos passos, por decisão do mantenedor: o texto não depende deles.
- **Carga completa fora da release:** a carga desta versão serve à homologação; a janela completa das três coleções segue no plano de cobertura completa das fontes, fora de release.
- **Limitação conhecida:** "Entrar para salvar" leva ao login e volta para `/buscar` sem a consulta. Vale também para as listagens e fica para uma correção à parte.

**Checks executados**

Na `main` com todas as correções da release (2026-09-26):

- `bun run lint`: 0 erros (17 warnings conhecidos);
- `bunx tsc --noEmit`: ok;
- `bun run build`: ok;
- `bun run test`: 130 arquivos, 1380 testes;
- journal = banco: `drizzle.__drizzle_migrations` com 13 entradas, de `0000` a `0012`, conferido pelo mantenedor.

**Homologação em produção**

Em 2026-09-26, em `mutiraodedados.com.br`:

- `/buscar?q=serviços`, em Contratos: 4.445 resultados de duas fontes (PNCP 4.378 e CGU 67), com facetas calculadas sobre o resultado inteiro e paginação 1–20;
- `/buscar?q=pregão`, em Licitações: 185 resultados, com facetas de UF, órgão, situação, município e modalidade.

Uma timeout isolada do banco numa janela de licitações não se repetiu na reexecução nem nas 87 janelas seguintes. A investigação da causa segue fora da release.

**Issues:** milestone `v0.15.0` do repositório privado e o mapa do wayfinder da busca unificada.

**PR de sync público:** `sync v0.15.0`.

## v0.14.0 — 2026-09-26

**Resumo:** as importações oficiais passam a rodar sem o painel. A rota do agendador aceita fonte e janela nomeadas para todas as fontes do roteiro de importação; cada janela termina com uma conferência gravada (aprovada, inconclusiva ou reprovada); e uma ferramenta de linha de comando e uma skill de agente conduzem as importações até a cobertura desejada. A rodada manual pendente desde a v0.7.0 foi feita com essa ferramenta, que serviu de QA dela: cada divergência virou correção nesta release. Evals de dados e e2e de UI saíram da versão, porque dependem de um banco isolado.

**Entregas**

- **Importação sob demanda** (`/api/cron-importar` + `bun run importar`):
  - Sem corpo, a rota segue a fila do agendador como antes. Com `{tarefa, params}`, executa uma rodada da janela pedida, validada pelos mesmos schemas do painel. Janela já completa só é refeita com `reprocessar`.
  - 27 tarefas com adaptador: votações, proposições, matérias, CEAP e CEAPS, cadastros de deputados e senadores, trajetória, PNCP, convênios (período, por ente e CSV da origem), CGU (catálogo SIAFI, atividade, contratos e licitações por órgão, emendas), SICONFI (relatório, ano de um ente, varredura por conjunto), IBGE, TSE (arquivo por tipo × eleição × UF, vínculo parlamentar↔candidato) e as tarefas de cruzamento do TSE.
  - A ferramenta fatia o intervalo em janelas, repete rodadas até o fim, segue a ordem das dependências entre fontes, aplica a política de parada (reprovada para a fonte; inconclusiva é refeita; 429 persistente do Portal pausa as fontes da mesma chave) e retoma sozinha pelas pendentes que o servidor aponta.
  - Skill `mutirao-de-dados-importar`: pedido por meta, por janela ou por roteiro numa issue; relatório e issues de correção.
- **Conferência da janela:** terminou, log limpo, contagem igual ao total da origem onde a origem informa (PNCP, Câmara, Senado, IBGE), reflexo na cobertura e findings novos (só informativo). Janela completa importada antes pelo painel é só conferida, sem reimportar.
- **Log de importações:** colunas novas de gatilho (`painel`, `cron`, `ferramenta`), execução por janela, conferência e métricas de desempenho de cada rodada (duração, itens, subrequisições, motivo de parada). Toda fonte passa a gravar o resultado da rodada, e CGU e SICONFI passam a aparecer na cobertura.
- **Histórico do admin:** filtros no topo (fonte, gatilho, resultado, conferência, período, execução, motivo de parada), aplicados no servidor e refletidos na URL; colunas de gatilho, conferência e desempenho; resumo do recorte filtrado.
- **Desempenho:** teto de subrequisições das varreduras ajustado ao plano pago do Workers (PNCP e Transferegov seguem no teto antigo, pela cota da origem); votações da Câmara (5 por vez) e SICONFI em lote (3 por vez) processam itens em paralelo, sem pular item com falha passageira na retomada.
- **Qualidade de dados:** alerta novo "Votação listada sem detalhe", para votação que a Câmara lista mas cujo detalhe responde 404. A regra geral foi documentada: erro nosso se corrige no código; problema do dado na origem vira sinal e conta como descartado na conferência.
- **Migrations:** passam a nascer no PR (`drizzle-kit generate --custom`) e são aplicadas pelo mantenedor, registradas em `drizzle.__drizzle_migrations` na mesma transação. O Lovable não participa mais.

**Correções**

- TSE: o total de bens do candidato ficava com a soma da última rodada numa importação retomada, e cada corte por tempo perdia uma linha (bens, receitas e despesas).
- Câmara: consulta que seguia falhando depois das novas tentativas não era tratada como passageira (a CEAP pulava o deputado; proposições encerravam a varredura; falha de rede virava erro nosso).
- Trajetória dos deputados e cadastro de senadores: falha na consulta de um parlamentar apagava os dados dele sem registrar erro (no Senado, também o marcava como "Nunca exerceu").
- Limpeza por fonte: passa a apagar os checkpoints de varredura da fonte limpa, em vez de deixar a janela "completa" sem dados.
- Conferência de janela vazia importada antes do Histórico existir: deixa de ser reprovada quando a origem confirma zero.
- SICONFI em lote: a rodada com 3 consultas por vez derrubava o Worker (502), e passou a ter teto de custo próprio; a contagem da conferência estourava o tempo do banco, e ganhou um índice por exercício e ente. Erros do banco nas conferências passam a trazer código e mensagem.
- Sync com o repositório público a partir de um git worktree.

**Decisões**

- **Sem teste de importação contra o banco de produção no workflow.** Com um banco só (o preview e a produção compartilham o mesmo), evals de dados e e2e de UI esperam um banco isolado e voltaram ao backlog. A necessidade real da versão era operar as importações oficiais sem o painel, e a verificação passou a ser parte da importação (a conferência), não um teste à parte.
- **Agendamento continua desligado.** A rota foi exercida pela ferramenta; ligar o pg_cron fica para depois.
- **Nada destrutivo pela ferramenta.** Limpeza segue manual no painel.
- **Cobertura completa das fontes fora da versão.** O plano (ordem em ondas, comandos, estimativas, decisões pendentes sobre CGU por órgão, municípios do SICONFI e TSE 2026) segue em paralelo ao programa do ROADMAP, sem versão.
- **Limite de CPU do Worker a confirmar.** O `wrangler.jsonc` declara 5 minutos de CPU por requisição, mas a queda do SICONFI com paralelismo indica que o teto efetivo em produção pode ser o padrão de 30 s. Confirmar com a plataforma antes da carga histórica do TSE.
- **Commits do Lovable revisados:** a migration das colunas de gatilho foi aplicada pelo Lovable e ganhou uma cópia (`0006` e `0007`, SQL idêntico e idempotente, as duas mantidas); os tipos foram regenerados a partir do banco; e a sessão do preview do Lovable passou a sincronizar o valor devolvido pelo editor.

**Checks executados**

- `bun run lint` ✓ 0 erros (17 warnings do padrão shadcn/ui).
- `bunx tsc --noEmit` ✓.
- `bun run build` ✓.
- `bun run test` ✓ — 125 arquivos, 1344 testes.
- Rodadas reais pela ferramenta contra o site publicado: votações do Senado de 2003 a 2026-09 (285 janelas aprovadas); votações da Câmara de 2023-09 a 2026-09; SICONFI em lote das UFs (2023 a 2025) e das capitais (2025). Migrations da versão aplicadas: `0006`/`0007` pelo Lovable (hashes conferidos contra `drizzle.__drizzle_migrations`), `0008` e `0009` pelo mantenedor, registradas na mesma transação.
- Rodada manual de telas (convênios, enriquecimento pela origem, `/cobertura`, qualidade, fluxos da v0.12.0 e Histórico filtrado) conferida pelo mantenedor.

**Issues:** milestone `v0.14.0` do repositório privado e o mapa do wayfinder da importação operável.

**PR de sync público:** `sync v0.14.0`.

## v0.13.0 — 2026-09-25

**Resumo:** rodada de correções, endurecimento e processo antes do programa de busca unificada. Importadores de votações e do RGF voltaram a funcionar, valor ausente deixou de virar zero, permissões de leitura e escrita foram apertadas, e o projeto ganhou um processo com issues, milestones, PRs e roteiros permanentes de QA. Os títulos de aba passaram a seguir o H1 em todas as fichas públicas.

**Entregas**

- **Importação:**
  - Votações da Câmara (votos sem paginação, listagem ordenada por id).
  - Votações do Senado migradas para o endpoint `/votacao`.
  - RGF do SICONFI pedido por poder e periodicidade.
  - Valor ausente do Portal da Transparência gravado como vazio, não como zero; somas e médias ignoram registros sem valor, e a tela mostra "Não informado".
- **Histórico de importações:** as rodadas do TSE aparecem com nome legível e ano da eleição. A limpeza de proposições da Câmara e de matérias do Senado apaga também as linhas do Histórico.
- **Permissões e banco:**
  - Leitura pública de dados pessoais endurecida (CPF do TSE oculto, perfis só para autenticados).
  - Grants redundantes de `anon`/`authenticated` revogados nas tabelas de varredura.
  - Tabelas antigas de convênios (`cgu_convenios_cache`, `transferegov_instrumentos_cache`) apagadas.
  - Migrations passam a nascer em `drizzle/migrations/`, e `supabase/migrations/` vira histórico congelado.
- **Admin:**
  - Salvar um artigo preserva a capa e a data de publicação.
  - Login a partir do admin volta para a página pedida.
  - Conta sem papel de admin vê um aviso antes do redirecionamento.
- **Páginas públicas:**
  - Título da aba = H1 + " — Mutirão de Dados" nas fichas de contratos, convênios, licitações, emendas, fornecedores, órgãos, entes, Câmara, Senado, eleições e artigos, já no primeiro carregamento. Fichas com loader ganharam telas próprias de erro e de "não encontrado".
  - `/sobre`, `/roadmap` e `/lacunas` passam a ter como H1 o nome da página, com o slogan como subtítulo.
  - Corte de estabilidade `ate` em `/eleicoes/candidatos` e `/fornecedores`; este último usa a coluna nova `fornecedores_cache.created_at`.
  - A aba "Por ente" de `/convenios` linka a ficha do convênio.
- **QA e processo:**
  - Roteiros permanentes de QA manual em [`docs/qa/`](./docs/qa/README.md), por área (importação, páginas públicas, admin), com cada item marcado como manual ou coberto por teste.
  - Testes novos para a autorização da rota de automação, a divergência de situação do convênio, o banner de qualidade e a cobertura por ano.
  - Workflow com issues, milestones, PRs e `wayfinder`; nome de branch `issue-<n>-<slug>`; versão de cada trabalho decidida por regra.
  - Programa v0.14.0–v0.22.0 planejado e resumido no ROADMAP.
- **Lint:** o ESLint e o Prettier passam a ignorar `src/integrations/supabase/types.ts` e `previewAuthStorage.ts`, gerados e reescritos pelo Lovable.

**Decisões**

- **Rodadas reais de importação fora do aceite.** Câmara (votações e votos desde 2003), Senado e SICONFI (RGF) saíram do critério de aceite por decisão do mantenedor e seguem como rodada de testes à parte, pelos roteiros de `docs/qa/`.
- **Migrations aplicadas direto no banco.** As quatro alterações desta release (valor nulo em `contratos_cache`, revogação de grants, remoção das tabelas antigas de convênios e `fornecedores_cache.created_at`) foram aplicadas pelo mantenedor com SQL idempotente e conferidas por consulta. Ainda não estão registradas em `drizzle/migrations/`.

**Checks executados**

- `bun run lint` ✓ 0 erros (17 warnings do padrão shadcn/ui).
- `bunx tsc --noEmit` ✓.
- `bun run build` ✓.
- `bun run test` ✓ — 94 arquivos, 918 testes.
- Estado do banco conferido por consulta: `contratos_cache.valor` aceita nulo, nenhum grant sobrando nas tabelas de varredura, tabelas antigas de convênios ausentes, `fornecedores_cache.created_at` presente.
- Não executados: rodadas reais de importação e conferência no preview dos fluxos alterados.

**Issues:** milestone `v0.13.0` do repositório privado.

**PR de sync público:** `sync v0.13.0`.

## v0.12.0 — 2026-08-24

**Resumo:** revisão completa das páginas públicas do grupo Explorar, pedida antes da rodada de testes de importação. A auditoria achou registros de lista sem página própria, vínculos entre fontes que existiam só no banco, textos escritos para quem tem acesso ao admin, quatro mecanismos concorrentes de painel explicativo, divergências entre nome na navegação, H1 e título SEO, rotas órfãs e um bug que impedia dois detalhes de renderizar. Tudo isso foi corrigido em sete frentes, e a conexão entre fontes — funcionalidade central do projeto — passou a ser visível na interface.

**Entregas**

- **Consertos estruturais:** `/convenios/$id` e `/qualidade/$id` voltaram a renderizar (a rota-pai declarava filhas sem `<Outlet/>`; viraram pares `index.tsx`+`$id.tsx`); a lista de licitações e a de alertas de qualidade passaram a linkar o próprio detalhe; resultados internos da busca navegam pelo router.
- **Padrões de UI novos, registrados em `/estilo`:** `PainelExplicar` (colapsável fechado no fluxo — absorveu o `ExplicadorFontes` e o banner fixo `AvisoMetodologico`, cujo aviso de sinais virou rodapé opcional do painel), `PainelInvestigar` (Sheet lateral com roteiro cidadão e prompts do banco), `SecaoVinculos` (padrão visual único de vínculo entre fontes, com aviso de homônimo em match deduzido), `TrilhaDeNavegacao` (breadcrumb canônico no lugar dos "← Voltar" ad-hoc), `Cartao`/`Estatistica`/`CampoDado` e o kit de listagem. `RodapeInvestigativo` e `PainelModosLeitura` removidos; `BlocoRastreabilidade` e `BlocoLacuna` adotados.
- **Passada de conteúdo cidadã:** 12 estados vazios deixaram de instruir o visitante a importar dados pelo admin (um deles linkava `/admin/dados`); "em cache" virou "no acervo" em ~20 pontos; referências a arquivos `docs/*.md` e a nomes de endpoint saíram dos textos e das meta descriptions; a home perdeu os rótulos de placeholder de imagem; `/transferencias` virou prévia honesta sem o relato de erro HTTP; o bloco de comandos do TSE virou passo do painel Investigar.
- **Padrão de listagem** em todas as listas do grupo: paginação numérica acima e abaixo, com página, filtros e ordenação na URL; **corte de estabilidade** (`ate`) fixado nos links de página, de modo que a mesma URL mostra sempre os mesmos registros mesmo depois de novas importações; totais exibidos passam a ser o `count` real com os mesmos filtros, nunca o tamanho da amostra; filtros novos (contratos por fornecedor, convênios por convenente, emendas por autor, candidatos por partido e UF).
- **Vínculos entre fontes na interface:** busca unificada passou a cobrir contratos da CGU, fornecedores e candidatos; página do órgão mostra licitações e convênios do mesmo código; autor de emenda vira link para a ficha do parlamentar (match por nome, sempre sinalizado); CNPJs de doadores e fornecedores de campanha linkam a ficha de fornecedor nos dois sentidos, com a seção nova "Contas de campanha" na ficha do candidato.
- **Páginas novas:** `/entes/$codigo` dá endereço próprio a cada estado e município (aceita sigla de UF ou código IBGE de 2 ou 7 dígitos), reunindo as três fontes que se conectam pelo código IBGE — e `/explorar` virou o seletor que leva até elas; `/fornecedores` virou porta de entrada do cadastro; contratos do PNCP ganharam página de detalhe (`/contratos/$id` resolve as duas fontes); a ficha do fornecedor passou a **degradar** em vez de dar 404 quando o CNPJ existe só em outra fonte; as duas rotas órfãs de eleições ganharam entrada.
- **Nomenclatura e SEO:** regra canônica `título = H1 + " — Mutirão de Dados"` aplicada, com o rótulo da navegação igual ao nome da página; `head()` dinâmico nos três detalhes que herdavam o título do site; sitemap reescrito cobrindo as rotas públicas por grupo, incluindo as 27 páginas de estado.

**Checks executados**

- `bun run test` ✓ — 77 arquivos, 799 testes.
- `bun run lint` ✓ 0 erros (17 warnings do padrão shadcn/ui) · `bunx tsc --noEmit` ✓ · `bun run build` ✓.
- Smoke em dev das 34 rotas públicas do grupo Explorar — todas HTTP 200; paginação, corte de estabilidade e totais conferidos no navegador (`/emendas` página 2 = "101–200 de 2.310"; `/contratos?fonte=pncp` = 17.077); ficha degradada verificada com CNPJ presente só no PNCP.
- Sem migration: os vínculos usam índices, RPCs e a view `v_fornecedor_doador` que já existiam.

**PR de sync público:** `sync v0.12.0`.

## v0.11.0 — 2026-08-20

**Resumo:** automação periódica das importações — a promessa arquitetural mantida desde a v0.3.0 (runners chamáveis sem browser) vira produto. Nove fontes rodam sozinhas em rotação, pelo MESMO código do painel; o agendador nasce dormente e a ativação é uma decisão explícita do mantenedor.

**Entregas**

- **Núcleos chamáveis sem browser** em nove ingests (PNCP, convênios, CEAP, CEAPS, votações Câmara/Senado, matérias, proposições, origem SICONV, IBGE); server functions viram cascas autenticadas. `user_id` nulo no histórico = rodada sem operador.
- **Rota `/api/cron-importar`** interceptada em `src/server.ts`: `x-cron-secret` contra `CRON_SECRET` (sem secret, 401 — desligada por padrão); cada chamada executa uma rodada com orçamento da próxima tarefa e devolve `{tarefa, importados, haMais}`.
- **Fila `automacao_tarefas`** com claim atômico (`FOR UPDATE SKIP LOCKED`, lock expira em 15 min) e rotação v1 semeada por migration. Janeladas importam o mês corrente (UTC), com helper puro testado.
- **Agendador `pg_cron`+`pg_net`** (disponibilidade verificada no banco): tique de 5 min, dormente até `automacao_config` (service_role only) ter URL e segredo — nunca no repositório. Alternativa externa (Make) documentada.
- `docs/automacao.md` com ativação, pausa, concorrência e o que ficou fora da rotação v1 (SICONFI e CGU por órgão — rodada de ajustes).

**Checks executados**

- `bun run test` ✓ — 74 arquivos, 771 testes.
- `bun run lint` ✓ 0 erros · `bunx tsc --noEmit` ✓ · `bun run build` ✓.
- Extensões `pg_cron`/`pg_net` confirmadas disponíveis no banco do projeto; `importacoes.user_id` confirmado anulável.
- **Ativação pendente do mantenedor** (por desenho): criar `CRON_SECRET` e inserir a linha de `automacao_config`. Validação manual na rodada única pós-release.

**Plano:** sem plano dedicado — desenho no ROADMAP, operação em docs/automacao.md.

**PR de sync público:** `sync v0.11.0`.

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

**Roadmap cidadão:** sem item público — infraestrutura interna.

## Baseline (pré-versionamento) — 2026-08-19

O projeto adotou versionamento formal nesta data; todo o trabalho anterior é a baseline sem versão retroativa. O que existia:

- Plataforma no ar com 7 fontes de dados integradas (Portal da Transparência/CGU, TSE, Câmara, Senado, PNCP, Transferegov, SICONFI) e ~79 rotas públicas.
- Sistema de sinais com catálogo central de 45 regras em três tipos (qualidade, lacuna, investigativo), com teste-guarda.
- Admin de importação multi-fonte com orçamento de tempo e retomada (CGU e TSE), log de auditoria em `importacoes` e controles de limpeza.
- 59 arquivos de teste unitário existentes, ainda sem runner configurado.
- Espelhamento privado→público via `scripts/sync-opensource.mjs`.

A primeira release versionada é a **v0.1.0** ([escopo](./ROADMAP.md)).
