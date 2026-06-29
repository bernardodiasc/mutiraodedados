# Modelo de dados — referência técnica

Lista das tabelas principais. Esquema canônico vive em `supabase/migrations/` e tipos gerados em `src/integrations/supabase/types.ts` (não editar).

## Caches de fontes

| Tabela                                 | Fonte         | Conteúdo                                   |
| -------------------------------------- | ------------- | ------------------------------------------ |
| `contratos_cache`                      | Portal CGU    | Contratos do Executivo Federal             |
| `orgaos_cache`                         | Portal CGU    | Catálogo de órgãos SIAFI                   |
| `fornecedores_cache`                   | Portal CGU    | Empresas contratadas                       |
| `transferegov_instrumentos_cache`      | Portal CGU    | Convênios e contratos de repasse           |
| `transferegov_emendas_cache`           | Transferegov  | Emendas Pix (EC 105/2019)                  |
| `pncp_contratos_cache`                 | PNCP          | Contratos sob Lei 14.133                   |
| `camara_deputados_cache`               | Câmara        | Cadastro de deputados                      |
| `camara_despesas_cache`                | Câmara        | Despesas CEAP                              |
| `camara_votacoes_cache`, `_votos_cache`| Câmara        | Votações nominais e votos                  |
| `camara_proposicoes_cache`             | Câmara        | PLs e demais proposições                   |
| `senado_senadores_cache`               | Senado        | Cadastro de senadores                      |
| `senado_despesas_cache`                | Senado        | Despesas CEAPS                             |
| `senado_votacoes_cache`, `_votos_cache`| Senado        | Votações e votos                           |
| `senado_materias_cache`                | Senado        | Matérias legislativas                      |
| `siconfi_relatorios_cache`             | SICONFI       | RREO, RGF, DCA por ente                    |

## Tabelas transversais

| Tabela            | Função                                                            |
| ----------------- | ----------------------------------------------------------------- |
| `importacoes`     | Log de cada chamada feita às APIs oficiais (auditoria)            |
| `qa_findings`     | Inconsistências detectadas (ver `qualidade-dados.md`)             |
| `anomalias`       | Sinais investigativos sobre dados corretos                        |
| `marcacoes`       | Contribuições da comunidade marcando registros                    |
| `artigos`         | Conteúdo editorial (mapas, tutoriais, notas)                      |
| `roadmap_items`   | Itens do roadmap público                                          |
| `user_roles`      | Papéis (`admin`, `user`) por usuário                              |
| `profiles`        | Dados de perfil (sem PII sensível)                                |

## Laboratório cívico (perguntas, caderno, lacunas)

Tabelas que sustentam os modos **Perguntar** e **Investigar** (ver [`dominios/laboratorio-civico.md`](./dominios/laboratorio-civico.md)).

| Tabela         | Função                                                                                       |
| -------------- | -------------------------------------------------------------------------------------------- |
| `perguntas`    | Perguntas formuladas pelos cidadãos. Campos: `texto`, `contexto`, `estado`, `tags[]`, `origem_url`, `publicada`. Estados: `aberta`, `em_investigacao`, `respondida_parcialmente`, `respondida`, `sem_resposta_possivel`, `dormente`. |
| `itens_salvos` | Itens salvos no caderno do usuário (polimórficos). Chave: `(user_id, entidade_tipo, entidade_id)`. Tipos: `orgao`, `contrato`, `fornecedor`, `convenio`, `pergunta`, `anomalia`, `lacuna`. |
| `anotacoes`    | Notas em markdown privadas. Campos: `titulo?`, `conteudo_md`, `tags[]`. Âncoras opcionais: `pergunta_id`, `(entidade_tipo, entidade_id)`. |
| `lacunas`      | Informações que faltam. Campos: `titulo`, `descricao`, `tipo` (`transparencia`, `avaliacao`, `mensuracao`, `documental`, `institucional`, `metodologica`), `ciclo` (`nasce`→`qualificada`→`evolui`→`conecta`→`encerra`), `qa_finding_id?`, `entidade_tipo?`, `entidade_id?`. |

RLS:
- `perguntas`: leitura pública quando `publicada=true`; autor sempre lê/edita as suas.
- `itens_salvos` e `anotacoes`: estritamente privadas (`auth.uid() = user_id`).
- `lacunas`: leitura pública; escrita restrita a `admin`. Conversão a partir de `qa_findings` via server function `converterFindingEmLacuna`.

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