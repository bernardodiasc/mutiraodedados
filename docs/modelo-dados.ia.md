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
- **Adaptadores:** uma função `busca_projecao_<coleção>(ids)` por coleção transforma a linha de origem na linha do índice (tipo `busca_linha`). Nos contratos do PNCP, a coluna `modalidade` da origem guarda o tipo do contrato e vai para a faceta `tipo_contrato`; a faceta `modalidade` é só a modalidade da licitação (CGU). As coleções são contratos PNCP e CGU, licitações, emendas, convênios, fornecedores, candidaturas e artigos publicados.
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
