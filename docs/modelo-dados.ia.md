# Modelo de dados — referência técnica

Lista das tabelas principais. Migrations novas vivem em `drizzle/migrations/`; `supabase/migrations/` é histórico congelado (ver [migrations](./padroes/migrations.md#onde-vive-cada-migration)). Tipos gerados ficam em `src/integrations/supabase/types.ts` (não editar).

## Caches de fontes

| Tabela                                  | Fonte          | Conteúdo                                   |
| --------------------------------------- | -------------- | ------------------------------------------ |
| `contratos_cache`                       | Portal CGU     | Contratos do Executivo Federal             |
| `orgaos_cache`                          | Portal CGU     | Catálogo de órgãos SIAFI                   |
| `fornecedores_cache`                    | Portal CGU     | Empresas contratadas                       |
| `convenios_cache`                       | Portal CGU     | Convênios e contratos de repasse           |
| `transferegov_emendas_cache`            | Transferegov   | Emendas Pix (EC 105/2019)                  |
| `pncp_contratos_cache`                  | PNCP           | Contratos sob Lei 14.133                   |
| `camara_deputados_cache`                | Câmara         | Cadastro de deputados                      |
| `camara_despesas_cache`                 | Câmara         | Despesas CEAP                              |
| `camara_votacoes_cache`, `_votos_cache` | Câmara         | Votações nominais e votos                  |
| `camara_proposicoes_cache`              | Câmara         | PLs e demais proposições                   |
| `senado_senadores_cache`                | Senado         | Cadastro de senadores                      |
| `senado_despesas_cache`                 | Senado         | Despesas CEAPS                             |
| `senado_votacoes_cache`, `_votos_cache` | Senado         | Votações e votos                           |
| `senado_materias_cache`                 | Senado         | Matérias legislativas                      |
| `siconfi_relatorios_cache`              | SICONFI        | RREO, RGF, DCA por ente                    |
| `tse_candidatos_cache`                  | TSE            | Candidaturas (PK sq_candidato+ano)         |
| `tse_bens_candidato_cache`              | TSE            | Bens declarados por candidatura            |
| `tse_receitas_campanha_cache`           | TSE            | Doações de campanha (id: SQ_RECEITA/hash)  |
| `tse_despesas_campanha_cache`           | TSE            | Despesas contratadas de campanha           |
| `tse_resultados_cache`                  | TSE            | Votos por município (zonas agregadas)      |
| `tse_parlamentar_candidato`             | TSE (derivada) | Ponte parlamentar↔candidato (CPF/nome)     |
| `tse_varredura`                         | TSE (interna)  | Retomada de importação por (tipo, ano, UF) |

## Tabelas transversais

| Tabela          | Função                                                                                             |
| --------------- | -------------------------------------------------------------------------------------------------- |
| `importacoes`   | Log de cada chamada feita às APIs oficiais (auditoria)                                             |
| `qa_findings`   | Sinais detectados — coluna `tipo`: `qualidade`/`lacuna`/`investigativo` (ver `qualidade-dados.md`) |
| `marcacoes`     | Contribuições da comunidade marcando registros                                                     |
| `artigos`       | Conteúdo editorial (mapas, tutoriais, notas)                                                       |
| `roadmap_items` | Itens do roadmap público                                                                           |
| `user_roles`    | Papéis (`admin`, `user`) por usuário                                                               |
| `profiles`      | Dados de perfil (sem PII sensível)                                                                 |

## Índice de busca

`busca_indice` guarda uma linha por registro pesquisável de qualquer coleção, para a `/buscar`. A chave é `(colecao, id_origem)`, onde `colecao` é o nome da tabela de origem. As listagens não usam o índice: continuam lendo as próprias tabelas.

- **Colunas do item:**
  - `categoria` (as 20 de `src/lib/busca/categorias.ts`, ordem fixa), `subtipo`, `fonte`;
  - `titulo`, `identificador` (rotulado) e `identificador_norm` (forma comparável, para o registro exato; nunca CPF), `nomes` (nomes e CNPJs públicos relacionados), `resumo` e `texto`;
  - `data_principal` com `data_natureza` (assinatura, apresentação, publicação, fato, exercício, eleição) e `data_precisao` (dia, mês, ano), e `ano` gerado a partir dela;
  - `uf`, `valor` com `valor_natureza` e `valor_unidade`;
  - `href_interno` (ficha, com âncora quando for sub-registro), `url_oficial` e registro-pai (`pai_*`);
  - `facetas` (JSON com as facetas próprias do tipo).
- **Texto:** `tsv_pt` e `tsv_padrao` são gerados com pesos (A título; B identificador e nomes; C resumo e texto).
  - `tsv_pt` usa a configuração `busca_pt` sobre `busca_texto_pt(...)` (sem acento, "-ões" vira "-ão"). A consulta aplica `busca_texto_pt` ao termo antes de `websearch_to_tsquery('public.busca_pt', …)`.
  - `tsv_padrao` usa a `portuguese`. As duas são consultadas com OU.
- **Corte (`ate`):** `indexado_em` guarda quando a linha entrou no índice e nunca muda depois; `atualizado_em` guarda a última regravação.
- **Adaptadores:** uma função `busca_projecao_<coleção>(ids)` por coleção transforma a linha de origem na linha do índice (tipo `busca_linha`). Desde a v0.16.0 (migration `0021`), a tabela `busca_colecoes` registra coleção → função, e `busca_projetar` despacha por ela. Coleção nova: a função de projeção e uma chamada `busca_registrar_colecao(tabela, expressão da chave, função)`, que grava o registro e cria os gatilhos; nenhuma migration precisa mais redefinir `busca_projetar`. Nos contratos do PNCP, a coluna `modalidade` da origem guarda o tipo do contrato e vai para a faceta `tipo_contrato`; a faceta `modalidade` é só a modalidade da licitação (CGU). As coleções são contratos PNCP e CGU, licitações, emendas, convênios, fornecedores, candidaturas, artigos publicados e, desde a v0.16.0, deputados e senadores (categoria Pessoas, uma linha por parlamentar, com o mandato atual na faceta `mandato`; e-mail e foto não entram; o id da Casa é pesquisável, mas não é identificador exato), órgãos do catálogo SIAFI e municípios do IBGE (categoria Organizações, com o código como identificador exato). A faceta `tipo_organizacao` separa órgão federal, município e fornecedor. Legislativo: proposições da Câmara e matérias do Senado (Propostas, com a sigla e o número normalizados como identificador exato: buscar "PL 1234/2024" destaca a proposição), votações das duas Casas (com a proposição ou matéria como registro-pai) e votos (Votos, uma linha por voto, com a votação como registro-pai e destino na linha do parlamentar, `/…/votacoes/<id>#voto-<parlamentar>`). A projeção do voto é enxuta: nome, voto, partido/UF e o assunto da votação. Despesas da cota parlamentar (CEAP da Câmara e CEAPS do Senado, categoria Despesas, migration `0024`): uma linha por despesa, com o parlamentar como registro-pai e destino na linha da despesa na ficha dele, aberta no mês da despesa (`/…/<id>?ano=<ano>&mes=<mes>#despesa-<id>`; a ficha aceita `ano` e `mes` na URL e, com eles, carrega as despesas desse mês mesmo quando a lista completa trunca). A projeção leva categoria, fornecedor, parlamentar, documento, competência e valor; o fornecedor pessoa física entra pelo nome, e o CPF não é pesquisável (só aparece mascarado). Facetas: parlamentar e categoria da despesa, além de Casa (fonte) e ano. Relatórios fiscais do SICONFI (categoria Finanças públicas, migration `0026`) entram por relatório, nunca por conta: a tabela `siconfi_relatorios` (ente × tipo × exercício × período) é o catálogo dos relatórios, mantido por gatilhos por comando em `siconfi_relatorios_cache` (acrescenta as chaves novas; tira o relatório que ficou sem nenhuma conta), e é ela a coleção registrada. O destino é `/relatorios-fiscais` filtrada no ente, exercício, tipo e período (a página aceita `codIbge` e `periodo` na URL). A carga dos relatórios já importados é por exercício, com `CALL busca_carregar_siconfi(de, ate)`. O índice trigram do título não cobre Votos nem Despesas. A carga dos votos já importados é por mês, com `CALL busca_carregar_votos(de, ate)`; os novos entram pelos gatilhos. Dados eleitorais (categoria Eleições e campanhas, migration `0025`): bens declarados, receitas e despesas de campanha e resultados, todos sub-registros com a candidatura como registro-pai (`pai_id` = `<sq>-<ano>`) e destino na linha da ficha — `/eleicoes/candidatos/<sq>?ano=<ano>&bem=<ordem>#bem-<ordem>`, `&receita=<id>#receita-<id>`, `&despesa=<id>#despesa-<id>` e `#votacao` para o resultado. A ficha acrescenta o bem indicado quando ele está fora dos 100 maiores e abre receitas e despesas na página que contém o lançamento. O bem entra pelo tipo, candidato, eleição e valor, sem a descrição; doador e fornecedor entram pelo nome, com só o CNPJ pesquisável e o documento de exibição mascarado (`busca_documento_publico`). O resultado é uma linha por candidatura e turno, com a soma dos votos nominais dos municípios. As projeções casam os ids pela chave primária da origem (junção com `unnest(p_ids)`), sem varrer a tabela a cada lote do gatilho. A carga dos bens já importados é por eleição, com `CALL busca_carregar_eleitoral(ano_de, ano_ate)`, que também cobre contas e resultados. Destinos com busca ou âncora no `href_interno` passam pelo `destinoInterno` (`src/lib/buscar/logic.ts`) antes do `Link`, que só aceita o caminho no `to`. Conteúdo editorial também entra (`COLECOES_EDITORIAIS`, sem fonte no catálogo de cobertura): investigações publicadas (`perguntas`, com visibilidade pública e slug; autoria, moderação e itens do caderno ficam fora), modelos de pergunta ativos, itens públicos do roadmap (sem as notas internas), lacunas publicadas (sem quem as criou) e os prompts do Kit de investigação. No Kit, a coleção é o vínculo `mapa_prompts` (categoria Artigos, subtipo `prompt`, id de origem `<prompt>:<mapa>`, o mapa como registro-pai e destino `/mapas/<slug>#prompt-<id>`): só entra prompt ativo vinculado a mapa público, e gatilhos próprios em `prompt_modelos` e `artigos` (`busca_kit_upd`) reindexam os vínculos quando o prompt ou o mapa muda. No caderno, o item salvo da busca usa o id do prompt, o mesmo que o Kit usa. As páginas estáticas públicas (ajuda, método, trilhas, referências, páginas de fonte e listas; categoria Páginas e ajuda, com a página na faceta `pagina_site`) só existem no código: a lista delas fica em `src/lib/paginas-publicas/lista.ts` e é copiada para a tabela `paginas_publicas` (migration `0023`, leitura pública, escrita só pelo servidor) pelo botão "Sincronizar páginas" da aba Busca do `/admin/dados`, que grava as entradas novas ou alteradas e apaga as que saíram; os gatilhos da coleção levam a mudança ao índice. Uma linha por página e uma por seção com âncora (`/trilhas#primeiro-contrato`, que aparece "em Trilhas"). Mudou o texto de uma página: atualize a entrada da lista e sincronize depois do deploy. O teste-guarda da lista acusa rota pública estática sem entrada (ou sem motivo em `ROTAS_FORA_DA_BUSCA`), entrada para rota ou âncora que não existe e resumo que não aparece mais no código da rota (o resumo é a `description` do `head`). Os destinos com âncora (`/perguntas#modelo-<id>`, `/roadmap#item-<id>`, `/lacunas#lacuna-<id>`, `/mapas/<slug>#prompt-<id>`) rolam até o item também quando a lista carrega no cliente (`useRolarAteAncora`). Os alertas de qualidade e lacunas detectados nas importações (`qa_findings`, categoria Qualidade e sinais, migration `0027`) entram com o mesmo filtro da leitura pública (sinais e marcações cidadãs ficam fora; `detalhes` e `notas_admin` não entram), destino `/qualidade/<id>`. O gatilho de UPDATE dessa coleção é por linha, com `WHEN` sobre as colunas publicadas: o `flagQA` regrava os findings abertos a cada reimportação, e um gatilho comum reindexaria um por comando. Ficam fora do índice, por decisão: as anomalias (calculadas no cliente, sem registro) e a transparência institucional (calculada por requisição; a nota aparece na ficha do órgão). Os guardas de teste leem as migrations (`src/lib/busca/migracoes-indice.test-util.ts`): toda coleção com gatilho precisa de fonte no catálogo de cobertura e da categoria em `CATEGORIA_DA_COLECAO`.
- **Manutenção:**
  - `busca_indexar(colecao, ids)` grava o que a projeção devolve e apaga do índice o que ela não devolve mais.
  - Gatilhos por comando (`busca_indice_ins/upd/del/trunc`) nas tabelas de origem chamam essa função na mesma transação.
  - `busca_reconstruir(colecao)` refaz a coleção inteira, preservando `indexado_em`: use na carga inicial e depois de mudar a configuração de texto.
- **Dados pessoais:** a projeção nunca leva CPF nem título de eleitor. CPF de pessoa física só aparece mascarado (`busca_documento_publico`). Fornecedor cuja chave é CPF completo fica fora. Cor/raça, gênero, grau de instrução e ocupação de candidatos não entram. Artigo não público não entra.
- **Acesso:** só `service_role` (RLS ligada, sem política; `anon` e `authenticated` sem `GRANT`).
- **Consulta:** três funções devolvem JSON e são chamadas pelas server functions de `src/lib/data/busca-indice.functions.ts`.
  - `busca_resumo(q, filtros, ate, contar)`: total por categoria, 3 prévias, facetas universais e o registro de identificador exato.
  - `busca_lista(q, categoria, filtros, ate, ordem, pagina, itens, facetas, contar)`: uma categoria paginada (20/50/100, até o resultado 10.000) com as facetas universais e as da categoria.
  - `busca_opcoes_faceta(...)`: opções de uma faceta longa filtradas por termo.
  - **Filtros:** `{fonte, uf, ano, por_categoria: {categoria: {chave: [...]}}}`, com OU dentro do filtro e E entre filtros; `__vazio__` seleciona "Sem informação". `busca_falhas` calcula uma vez por linha os filtros que ela não passa, e a contagem de cada opção ignora a própria faceta. A lógica que monta os filtros a partir do registro de categorias fica em `src/lib/busca/consulta.ts`.
  - **Corte:** `ate` limita a `indexado_em <= ate`; a resposta devolve o corte usado e, com corte, `novos`.
  - **Orçamento:** a contagem completa tem 3 s no servidor. Se estourar, a chamada é repetida com `contar = false`: prévias ou página sobre uma amostra, sem totais nem facetas.

## Laboratório cívico (perguntas, caderno, lacunas)

Tabelas que sustentam os modos **Perguntar** e **Investigar** (ver [`dominios/laboratorio-civico.md`](./dominios/laboratorio-civico.md)).

| Tabela           | Função                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `perguntas`      | Perguntas formuladas pelos cidadãos. Campos: `texto`, `contexto`, `estado`, `tags[]`, `origem_url`, `publicada`. Estados: `aberta`, `em_investigacao`, `respondida_parcialmente`, `respondida`, `sem_resposta_possivel`, `dormente`.                                                                                                                                                                                                                                            |
| `itens_salvos`   | Itens salvos no caderno do usuário (polimórficos). Chave: `(user_id, entidade_tipo, entidade_id)`. Tipos: `orgao`, `contrato`, `fornecedor`, `convenio`, `emenda`, `licitacao`, `pergunta`, `anomalia`, `lacuna`, `artigo`, `mapa`, `tutorial`, `prompt`, `busca`. Colunas de **snapshot de prova** (valor no momento em que o item foi salvo): `conteudo_snapshot` (JSON canônico), `snapshot_em`, `snapshot_hash` (sha256), `snapshot_verificado_em`, `snapshot_divergiu_em`. |
| `anotacoes`      | Notas em markdown privadas. Campos: `titulo?`, `conteudo_md`, `tags[]`. Âncoras opcionais: `pergunta_id`, `(entidade_tipo, entidade_id)`.                                                                                                                                                                                                                                                                                                                                       |
| `lacunas`        | Informações que faltam. Campos: `titulo`, `descricao`, `tipo` (`transparencia`, `avaliacao`, `mensuracao`, `documental`, `institucional`, `metodologica`), `ciclo` (`nasce`→`qualificada`→`evolui`→`conecta`→`encerra`), `qa_finding_id?`, `entidade_tipo?`, `entidade_id?`.                                                                                                                                                                                                    |
| `prompt_modelos` | Prompts curados do Kit de investigação (o cidadão copia para a IA dele). Campos: `titulo`, `descricao?`, `prompt_template` (com placeholders `{{var}}`), `variaveis` (**jsonb**: array de `{ nome, dica?, href?, hrefLabel? }` — `href` é rota interna, editável em `/admin/prompts`), `tags[]`, `ordem`, `ativo`.                                                                                                                                                              |
| `mapa_prompts`   | Associação N:N entre mapas (`artigos.categoria='mapa'`) e `prompt_modelos`. PK `(artigo_id, prompt_modelo_id)` + `ordem`. Um prompt genérico serve a vários mapas.                                                                                                                                                                                                                                                                                                              |

RLS:

- `perguntas`: leitura pública quando `publicada=true`; autor sempre lê/edita as suas.
- `itens_salvos` e `anotacoes`: estritamente privadas (`auth.uid() = user_id`).
- `lacunas`: leitura pública; escrita restrita a `admin`. Conversão a partir de `qa_findings` via server function `converterFindingEmLacuna`.
- `prompt_modelos`: leitura pública apenas de prompts `ativo=true` **vinculados a um mapa público**; CRUD restrito a `admin` (GRANT ao `anon` mantido — ver [`padroes/migrations.md`](./padroes/migrations.md)).
- `mapa_prompts`: leitura pública quando o `artigo` alvo é público; escrita restrita a `admin`.

## Convenções

- Toda tabela `*_cache` tem `id` como chave primária (natural ou composta `<entidade>-<numero>`).
- Toda tabela `*_cache` tem `updated_at` atualizado no upsert.
- RLS: `SELECT` público em caches; mutações apenas via `service_role`.
- `user_roles` é a única fonte de verdade de papéis (jamais em `profiles`).

## Relações relevantes

- `contratos_cache.orgao_cod` → `orgaos_cache.cod`.
- `contratos_cache.fornecedor_cnpj` → `fornecedores_cache.cnpj`.
- `convenios_cache.municipio_ibge` → catálogo IBGE local.
- `camara_despesas_cache.deputado_id` → `camara_deputados_cache.id`.
- `qa_findings.entidade_id` é polimórfico — interpretado por `entidade_tipo`.
