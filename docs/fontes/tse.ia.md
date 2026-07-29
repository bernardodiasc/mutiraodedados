# TSE — referência técnica

Fatos travados por inspeção ao vivo dos zips e da API (2026-07-06). O que é regra geral de importação mora em [`importacao.md`](../importacao.md); o que é conceito de sinal mora em [`qualidade-dados.md`](../qualidade-dados.md).

## Módulos

```
src/lib/data/ckan/client.ts        # camada CKAN GENÉRICA: package_show, zip remoto via
                                   # HTTP Range (EOCD + central dir), DecompressionStream
                                   # deflate-raw, CSV streaming Latin-1/;/aspas. Reutilizável
                                   # por qualquer fonte CKAN; nada de TSE aqui.
src/lib/data/tse/client-ckan.ts    # mapeamento TSE: urlZipTse/nomeEntradaTse/montarChaveTse,
                                   # TSE_ANOS_ELEICAO, TSE_UFS (27+BR), combinacaoValida
src/lib/data/tse/client-api.ts     # DivulgaCandContas: divulgaGet (retry 500/1500/4500ms),
                                   # listarEleicoesOrdinarias (catálogo de ids), buscarCandidatoDivulga
src/lib/data/tse/parsers.ts        # header-driven: IndiceCabecalho + mapear{Candidato,Bem,
                                   # Resultado,Receita,Despesa}; sentinelas, vírgula decimal,
                                   # datas BR (inclusive "10/10/201400:00:00"), hashDedup FNV-1a
src/lib/data/tse/ingest.server.ts  # sincronizarArquivoTse: 1 invocação = 1 (tipo, ano, UF);
                                   # retomada por linhas em tse_varredura; resultados agregam
                                   # zonas em memória (retomada = recomeço, upsert idempotente)
src/lib/data/tse/ingest.functions.ts  # sincronizarTse{Candidatos,Bens,Resultados,Receitas,
                                      # Despesas}, listarProgressoTse
src/lib/data/tse/ponte.server.ts   # matcher parlamentar↔candidato (CPF Câmara / nome+UF Senado)
src/lib/data/tse/ponte.functions.ts   # sincronizarPonteParlamentarFn, revalidarCandidatoViaApi
src/lib/data/tse/revalidacao.server.ts # revalidarCandidatoTse (Divulga → reconcilia findings)
src/lib/data/tse/qualidade.ts      # 6 regras tipo='qualidade' (rodam no ingest)
src/lib/data/tse/lacunas.ts        # 4 regras tipo='lacuna' (puras)
src/lib/data/tse/investigativos.ts # 3 regras tipo='investigativo' fonte='tse-cruzamento' (puras)
src/lib/data/tse/sinais.server.ts  # runners (RPCs SQL) + confirmação na API p/ eleito_sem_contas
src/lib/data/tse/sinais.functions.ts  # rodarLacunasTse, rodarSinaisInvestigativosTse,
                                      # rodarDoadorVirouFornecedorFn (gatilho pós-import contratos)
src/lib/data/tse/queries.functions.ts # leituras públicas (hub, lista, ficha, parlamentar, fornecedor, partido)
```

Fixtures reais reduzidas (Latin-1) em `src/lib/data/tse/__fixtures__/`; testes em `parsers.test.ts` e `investigativos.test.ts` (inclui a guarda: cruzamento nunca sai `tipo='qualidade'`).

## URLs e nomes de arquivo (confirmados)

CDN base: `https://cdn.tse.jus.br/estatistica/sead/odsele`

| tipo | zip | entrada (por UF) |
|---|---|---|
| candidatos | `consulta_cand/consulta_cand_<ano>.zip` | `consulta_cand_<ano>_<UF>.csv` |
| bens | `bem_candidato/bem_candidato_<ano>.zip` | `bem_candidato_<ano>_<UF>.csv` |
| resultados | `votacao_candidato_munzona/votacao_candidato_munzona_<ano>.zip` | `votacao_candidato_munzona_<ano>_<UF>.csv` |
| receitas 2014 | `prestacao_contas/prestacao_final_2014.zip` | `receitas_candidatos_2014_<UF>.txt` |
| receitas 2016 | `prestacao_contas/prestacao_contas_final_2016.zip` | `receitas_candidatos_prestacao_contas_final_2016_<UF>.txt` |
| receitas 2018+ | `prestacao_contas/prestacao_de_contas_eleitorais_candidatos_<ano>.zip` | `receitas_candidatos_<ano>_<UF>.csv` |
| despesas 2014 | (mesmo zip de 2014) | `despesas_candidatos_2014_<UF>.txt` |
| despesas 2016 | (mesmo zip de 2016) | `despesas_candidatos_prestacao_contas_final_2016_<UF>.txt` |
| despesas 2018+ | (mesmo zip 2018+) | `despesas_contratadas_candidatos_<ano>_<UF>.csv` |

`UF` ∈ 27 UFs + `BR` (cargos nacionais; só nas gerais). O dataset CKAN de contas de 2022 tem id fora do padrão: `dadosabertos-tse-jus-br-dataset-prestacao-de-contas-eleitorais-2022` — irrelevante para o ingest, que monta URLs do CDN diretamente.

## Layouts e aliases por ano

- **Candidatos/bens/votação**: layout moderno em TODOS os anos (o TSE republicou o histórico). Aliases: `DS_EMAIL`↔`NM_EMAIL` (2016); bens 2016 usa `NR_ORDEM_CANDIDATO` e `DT_ULTIMA_ATUALIZACAO` (demais: `NR_ORDEM_BEM_CANDIDATO`, `DT_ULT_ATUAL_BEM_CANDIDATO`).
- **Contas 2018+** (moderno): `SQ_RECEITA`/`SQ_DESPESA` são id natural → chave `\<ano>-<sq>`. Campos: `NR_CPF_CNPJ_DOADOR`, `NM_DOADOR`, `DS_ORIGEM_RECEITA`, `DS_ESPECIE_RECEITA`, `VR_RECEITA` ("1500,00"); despesas: `NR_CPF_CNPJ_FORNECEDOR`, `VR_DESPESA_CONTRATADA`, `DS_ORIGEM_DESPESA`.
- **Contas 2014/2016** (legado, cabeçalhos humanos, `.txt`): "Sequencial Candidato", "CPF/CNPJ do doador", "Valor receita", "Numero Recibo Eleitoral", "CPF/CNPJ do doador originário"; 2014 tem "Sigla  Partido" (dois espaços) e o typo real "Descriçao da despesa". Normalização de chave: maiúsculas, sem acento, `[^A-Z0-9]+`→`_`. Id = hash FNV-1a de `(sq, ano, data, documento, valor, recibo|documento)` prefixado pelo ano.
- Sentinelas: `#NULO#`, `#NULO`, `#NE`, `-1`, `-3`, `-4`, `NÃO DIVULGÁVEL` (CPF pode vir `-4`).
- Datas: `DD/MM/YYYY` e o formato colado de 2014 `DD/MM/YYYYHH:MM:SS`.

## tse_varredura (retomada)

Chave `\<tipo>#<ano>#<UF>` (ex.: `receitas#2022#SP`), com `linhas_processadas`, `importados`, `completa`. Bens/receitas/despesas retomam pulando linhas já processadas (re-stream do zip sem re-upsert); **resultados e candidatos recomeçam** e são processados por arquivo inteiro numa rodada (ambos limitados por UF), pois precisam agregar/deduplicar antes do upsert; upsert por PK substitui. Limpeza seletiva por entidade zera as chaves `\<tipo>#%` (ver `clearImportData`).

**Dedupe de candidatos por turno:** a PK de `tse_candidatos_cache` é `(sq_candidato, ano_eleicao)` — sem `nr_turno`. Em eleições com 2º turno o mesmo `sq_candidato` vem em duas linhas (turno 1 e 2); o ingest deduplica por candidato **mantendo o turno mais alto** (a linha do turno final carrega a `situacao_totalizacao` definitiva, ex.: "Eleito"). Sem isso as duas linhas caem no mesmo lote e o Postgres recusa (`ON CONFLICT DO UPDATE command cannot affect row a second time`).

## API DivulgaCandContas

- `GET /eleicao/ordinarias` → catálogo `{id, ano, nomeEleicao}` — ids: 2014=680, 2016=2, 2018=2022802018, 2020=2030402020 (+AP apartado), 2022=2040602022, 2024=2045202024. O cliente resolve dinamicamente e o `linkDivulgaCandidato` (links-oficiais) usa o mapa estático.
- `GET /candidatura/buscar/{ano}/{sgUe}/{idEleicao}/candidato/{sq}` → detalhe (`descricaoTotalizacao`, `gastoCampanha1T`, `cpf`). `sgUe` = UF nas gerais, código da UE nas municipais. Corpo vazio = não encontrado.
- Usos: `revalidarCandidatoTse` (divergência → finding `divergencia_api_csv`) e confirmação de `eleito_sem_prestacao_contas` antes de publicar.

## RPCs SQL (migration 20260706123000)

Público: `tse_resumo_eleicoes()`, `tse_resumo_partido(sigla)`. Service-role (sinais): `tse_eleitos_sem_contas(ano)`, `tse_candidatos_sem_bens(ano)`, `tse_contagem_ano_uf()`, `tse_evolucao_patrimonial(multiplo, minimo)`, `tse_fornecedor_concentrado(ano, min_cand, fracao)`, `tse_doacoes_de_fornecedores(minimo)`. View `v_fornecedor_doador` junta doadores PJ com `fornecedores_cache` por CNPJ normalizado.

## Limiares dos sinais investigativos

`LIMIARES_INVESTIGATIVOS` em `investigativos.ts`: doação mínima R$ 1.000; evolução ≥ 10× e final ≥ R$ 500 mil; concentração ≥ 10 candidatos e ≥ 40% do grupo. Mudanças de calibragem devem ser registradas em `/metodologia` (seção Versionamento).
