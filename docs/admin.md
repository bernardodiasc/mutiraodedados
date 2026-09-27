# Painel admin

Acesso em `/admin`. Restrito a usuários com papel `admin` em `user_roles`. O primeiro usuário a se cadastrar vira admin automaticamente; admins subsequentes precisam ser promovidos via banco.

## Layout

- `src/routes/_authenticated.tsx` — exige sessão; redireciona para `/login`.
- `src/components/AdminNav.tsx` — barra de navegação entre as abas do admin.
- `src/lib/admin-guard.ts` — `ensureAdminBeforeLoad` confere o papel antes de renderizar.

## Abas

### `/admin` — Dashboard

Atalhos para as outras seções e visão rápida do estado da ingestão.

### `/admin/dados` — Ingestão

Tela principal de importação. Componente: `AdminImportPanel`. Permite disparar ingestão por fonte, intervalo de datas e filtros (UF, IBGE, órgão). Cada fonte aparece como uma seção própria — veja [`importacao.md`](./importacao.md) para o fluxo comum.

A aba **Busca** é o diagnóstico do índice de busca, por coleção:

- **Contagens:** linhas no cache, linhas que a projeção publica (rascunho, despublicado e dado pessoal ficam fora; a diferença aparece como "fora da busca") e linhas em `busca_indice`.
- **Conciliação:** "conciliada" quando o índice é igual aos publicáveis; senão, "faltam" ou "sobram" no índice, com a diferença. Diferença indica gatilho que falhou ou coleção ainda não reconstruída.
- **Importação conferida:** por fonte que alimenta a coleção, a data da última conferência aprovada, a defasagem em dias e o selo "desatualizada" pelo limiar do catálogo (o mesmo da `/buscar`).
- **Orçamento de tempo:** cada contagem vem da função `busca_diagnostico(colecao, medida)` com 6 s de orçamento. A que estoura aparece como "indisponível", sem derrubar as outras.
- **"Reindexar":** chama `busca_indexar` para a coleção inteira ou para uma lista de ids de origem. Grava o que a projeção devolve e retira o que ela não devolve mais. A coleção grande pode passar do tempo-limite do banco (8 s); nesse caso, reindexe por ids ou reconstrua pelo SQL (`busca_reconstruir`).
- **Páginas do site na busca:** confere a tabela `paginas_publicas` com a lista de páginas estáticas do código (`src/lib/paginas-publicas/lista.ts`) e mostra as entradas novas, alteradas e que saíram da lista. **"Sincronizar páginas"** grava as novas e alteradas e apaga as que saíram; os gatilhos atualizam o índice. Rode depois de todo deploy que muda a lista (e uma vez depois de aplicar a migration que cria a tabela).

As facetas e os trechos da `/buscar` saem só do índice (`busca_casados`), então o que a projeção deixa de publicar (artigo despublicado, registro limpo) some também deles quando o gatilho ou o "Reindexar" o retira.

A aba **Histórico** lista as linhas de rodada de `importacoes`, da mais recente para a mais antiga, com o [gatilho](./importacao.md#gatilho-e-execução) de cada uma e, na última rodada de uma execução, o veredito da conferência com o motivo. Os filtros do topo são aplicados no servidor (a rolagem continua carregando páginas do mesmo recorte) e ficam na URL, então um link já abre o Histórico filtrado:

| Parâmetro     | Valores                                                                  |
| ------------- | ------------------------------------------------------------------------ |
| `fonte`       | id da fonte em `importacoes.fonte` (ex.: `camara_vot`)                   |
| `gatilho`     | `painel`, `cron` ou `ferramenta`                                         |
| `resultado`   | classificação da rodada (ex.: `erro_nosso`, `erro_origem`, `sem_dados`)  |
| `conferencia` | `aprovada`, `inconclusiva` ou `reprovada` (`conferencia->>estado`)       |
| `de` / `ate`  | período de `consultado_em`, `AAAA-MM-DD`, dias de Brasília, fim incluído |
| `execucao`    | `execucao_id` da janela pedida pela ferramenta                           |
| `parada`      | motivo de parada: `fim`, `tempo`, `subrequisicoes`, `erro` ou `passos`   |

Cada linha de rodada mostra também as [métricas de desempenho](./importacao.md#métricas-da-rodada): duração, itens, itens por segundo (derivado na tela), subrequisições e motivo de parada. Linhas anteriores a essas colunas, e as linhas por consulta do SICONFI, mostram "—". Acima da tabela, um **resumo do recorte** soma as métricas de todas as rodadas que passam nos filtros (não só das carregadas) e dá a média por rodada, os itens por segundo do recorte e quantas rodadas pararam por cada motivo — filtre a fonte e o período para comparar antes × depois. O resumo vem da função `resumo_historico_importacoes`, com os mesmos filtros da listagem.

A **matriz de cobertura** usa o mesmo estado por janela da `/cobertura` ([cobertura estruturada](./importacao.md#cobertura)), lido pela função `cobertura_janelas`:

- célula vazia: o preenchimento é o estado;
- célula com registros: o fundo é o volume, e o contorno mostra o estado (tracejado em parcial, processando e indisponível; vermelho em erro);
- o tooltip traz o estado, o motivo da última conferência e a execução, para abrir o Histórico filtrado por `execucao`;
- nas fontes anuais com várias siglas (matérias, proposições), a célula do ano agrega as siglas: vale o pior estado que pede atenção, e concluídas junto com não consultadas dão parcial.

Exemplo: `/admin/dados?fonte=camara_vot&execucao=<uuid>` mostra todas as rodadas daquela janela. Valor desconhecido é ignorado; um link com filtros abre direto na aba Histórico. A lógica fica em `src/lib/admin-import/historico-filtros.ts`.

### `/admin/qualidade` — Curadoria de QA

Lista todos os `qa_findings`. Permite marcar como `falso_positivo`, `resolvido` ou anotar resposta do canal oficial. Detalhado em [`qualidade-dados.md`](./qualidade-dados.md).

### `/admin/sinais` — Anomalias

Gestão dos sinais investigativos detectados sobre dados corretos (ex: fracionamento, concentração de fornecedor). Diferente de QA — aqui o dado oficial está certo, mas o **padrão** é suspeito. Ver [`dominios/anomalias-e-sinais.md`](./dominios/anomalias-e-sinais.md).

### `/admin/artigos` — Editor editorial

Editor Markdown para criar/editar mapas, tutoriais e notas. Toca tabela `artigos`. Slug amigável é usado nas rotas públicas `/mapas/$slug`, `/tutoriais/$slug`, `/notas/$slug`.

**Fontes usadas** são uma lista controlada (`src/lib/artigos/fontes.ts`), marcada por caixas de seleção. São as fontes do acervo, com os rótulos da faceta Fonte da busca (CGU, PNCP, Transferegov, SICONFI, Câmara, Senado, TSE, IBGE), e as fontes oficiais externas que os artigos citam (SIOP, Receita Federal, SICAF, Painel de Preços, CEIS, CNEP, TCU, MGI). Leis e conceitos não são fonte: o artigo os cita no texto. O servidor recusa valor fora da lista. A normalização de 2026-09-26 (migration `0020`) guardou nas notas internas de cada artigo os valores que saíram da lista.

**Referências** (v0.16.0, tabela `artigo_referencias`). Ao editar um artigo salvo, a seção de referências lista os registros e as consultas que ele cita:

- **Sugestões:** saem dos links internos do texto salvo. Uma ficha é resolvida pelo índice de busca (o link casa com o `href_interno` da linha). Um link de `/buscar` vira consulta normalizada (parâmetros em ordem, sem página, quantidade, ordem nem corte). O admin confirma cada uma. Link ambíguo, como `/contratos/$id` com um contrato da CGU e outro do PNCP no mesmo id, pede para escolher o registro; link que não casa com nada aparece como não encontrado.
- **Cadastro manual:** registro por coleção e id de origem, ou consulta por link de `/buscar`.
- **Necessita revisão:** calculado na leitura. Acontece quando o registro citado sumiu do índice (despublicado, limpo ou removido), quando mudou depois da última verificação (`busca_indice.atualizado_em` maior que `verificado_em`) ou quando a consulta citada passou a dar zero resultados. A lista mostra o selo "necessita revisão (N)" e o filtro "Só os que precisam de revisão".
- **"Verificado":** atualiza `verificado_em` e o título citado. O texto do artigo nunca é reescrito.
- **Remoção:** remover uma referência não toca o registro citado.

O público lê as referências de artigo publicado; só admin escreve.

Nas fichas (licitação, contrato CGU e PNCP, emenda, convênio, fornecedor, candidatura, deputado, senador, órgão e município), o bloco **"Aprenda a investigar este registro"** lista os artigos publicados que citam o registro (`artigosQueCitam`, pela identidade do índice: coleção e id de origem). Sem artigo, o bloco não aparece.

### `/admin/prompts` — Prompts do Kit

CRUD dos prompts do Kit de investigação (`prompt_modelos`) e vínculo N:N com mapas (`mapa_prompts`). Um prompt só aparece no site quando está `ativo` **e** vinculado a um mapa público.

Cada variável do prompt (`{{var}}`) é editada aqui com **nome**, **dica** de preenchimento e **link interno** para onde colher o dado. Esse link deve apontar para a página que os passos daquele mapa indicam (ex.: `/emendas` no mapa das emendas, `/camara/deputados` na cota parlamentar) — não há catálogo hardcoded no código; tudo se ajusta por esta tela. Ver [`dominios/laboratorio-civico.md`](./dominios/laboratorio-civico.md).

### `/admin/marcacoes` — Moderação

Modera contribuições da comunidade (marcações em registros pelos usuários).

### `/admin/analises` — Análises

Espaço para análises editoriais cruzando dados de várias fontes.

### `/admin/roadmap` — Roadmap público

Gestão dos itens visíveis em `/roadmap`.

## Área do usuário (não-admin)

- `/minhas-marcacoes` — registros que o usuário marcou para acompanhar.

## Importante

- Toda escrita em caches/tabelas operacionais passa por server function admin — usuários comuns só leem (RLS).
- Logs de ingestão (`importacoes`) ficam públicos por princípio de transparência.
