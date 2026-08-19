# Modelo de dados — referência técnica

Lista das tabelas principais. Esquema canônico vive em `supabase/migrations/` e tipos gerados em `src/integrations/supabase/types.ts` (não editar).

## Caches de fontes

| Tabela                                  | Fonte          | Conteúdo                                   |
| --------------------------------------- | -------------- | ------------------------------------------ |
| `contratos_cache`                       | Portal CGU     | Contratos do Executivo Federal             |
| `orgaos_cache`                          | Portal CGU     | Catálogo de órgãos SIAFI                   |
| `fornecedores_cache`                    | Portal CGU     | Empresas contratadas                       |
| `transferegov_instrumentos_cache`       | Portal CGU     | Convênios e contratos de repasse           |
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
- `transferegov_instrumentos_cache.municipio_ibge` → catálogo IBGE local.
- `camara_despesas_cache.deputado_id` → `camara_deputados_cache.id`.
- `qa_findings.entidade_id` é polimórfico — interpretado por `entidade_tipo`.
