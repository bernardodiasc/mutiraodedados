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
                                      # + compararBensTse (dois lados, agregados por categoria)
src/lib/data/tse/identidade.ts     # cpfUtilizavel / tituloUtilizavel / chavesIdentidade
                                   # (título é a chave primária: o TSE parou de publicar CPF em 2024)
src/lib/data/tse/categorias-bens.ts # tipo_bem_cod (dezena) → 6 categorias cidadãs;
                                    # fallback por palavra-chave p/ linhas sem código
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
- **Identificador da pessoa oscila por ano**: até 2022 `NR_CPF_CANDIDATO` vem preenchido; em **2024** ele é `-4`/`NÃO DIVULGÁVEL` em 100% das linhas e só `NR_TITULO_ELEITORAL_CANDIDATO` vem; em **2026 os dois voltam** (amostra AC: 136/136 em cada). Na base atual: 2022 tem 29.241 títulos e CPFs; 2024 tem 463.583 títulos e **zero** CPFs. Ligar candidaturas só por CPF perde a eleição de 2024 inteira — por isso a chave é título, com CPF de reforço, e não o contrário.
- **Bens**: `CD_TIPO_BEM_CANDIDATO` existe em todos os anos e vai para `tipo_bem_cod`. São **48 códigos** (lista completa extraída de `bem_candidato_2026.zip`, Brasil inteiro, travada em `categorias-bens.test.ts`). O mapa é **por código exato**, não por dezena: existem códigos de um dígito (`1` Prédio residencial, `2` Prédio comercial, `3` Galpão — todos imóveis, e por dezena o `2` viraria veículo), a dezena 2 é "bens móveis" e não transporte (`24` atividade autônoma, `25` jóia/arte, `26` linha telefônica), e a dezena 7 (fundos) não existia nos anos antigos. `DS_TIPO_BEM_CANDIDATO` traz enumeração depois de `:` — cortada antes de casar por palavra-chave no fallback.

## Cobertura por tipo de arquivo

O piso **não é o mesmo para todos**. Sondagem ano a ano no CDN em **2026-08-08**:

| tipo | primeiro ano no CDN | usamos a partir de |
|---|---|---|
| candidatos | 1994 | **1998** |
| resultados (votação) | 1994 | **1998** |
| bens | **2006** (1994–2004 dão 404) | 2006 |
| receitas / despesas | **2012** (`prestacao_final_2012.zip`) | 2012 |

`ANO_INICIO_POR_TIPO` + `origemDisponivel(tipo, ano)` em `client-ckan.ts` guardam isso, e `motivoIndisponivel` distingue as duas bordas na interface: "o TSE só publica X a partir de N" (esperar não resolve) × "ainda não foi publicada" (eleição em curso).

**O antigo piso de 2014 era conservador, não técnico.** Cabeçalhos de 1998, 2006 e 2012 baixados do CDN vêm no layout moderno, com as 20 colunas que `mapearCandidato` lê e com CPF e título preenchidos (1998/AC: 281/284 e 279/284) — o TSE republicou a série histórica inteira. Verificado de ponta a ponta contra a rede: `candidatos 1998/AC` parseia (DELEGADO DANZICURT, CPF 11 dígitos, título 12) e `bens 2006/AC` também (código 99, R$ 9.667,37). Peculiaridades já cobertas por alias: bens de 2006 usam `NR_ORDEM_CANDIDATO` (igual a 2016); contas de 2012 usam o mesmo layout legado de 2014 (`prestacao_final_<ano>.zip`, `receitas_candidatos_<ano>_<UF>.txt`, cabeçalhos humanos).

Ids do Divulga só existem de **2004** em diante — fichas de 1998–2002 caem na home do sistema deles, que é o melhor disponível.

Baixar para 1994 é mudar `ANO_INICIO_POR_TIPO` e acrescentar 1994/1996 a `TSE_ANOS_ELEICAO`; a regra `anoEleicaoMunicipal` (`ano % 4 === 0`) continua valendo para trás.

## Eleição em curso (2026)

Verificado no CDN em **2026-08-08** (registro de candidaturas aberto até 15/08):

| tipo | situação |
|---|---|
| `consulta_cand_2026.zip` | **no ar**, 1,65 MB, 29 CSVs (27 UFs + BR + ZZ) + `leiame.pdf`, atualizado diariamente. Compare: 2024 tem 63 MB — 2026 cresce até o fim do registro |
| `bem_candidato_2026.zip` | **no ar**, 2,16 MB, mesma estrutura |
| `votacao_candidato_munzona_2026.zip` | existe, mas cada CSV tem **894 bytes = só cabeçalho** (pleito em outubro) |
| `prestacao_de_contas_eleitorais_candidatos_2026.zip` | **404** |

`origemDisponivel(tipo, ano)` em `client-ckan.ts` codifica isso; `combinacaoValida` o consulta, e `motivoIndisponivel` (em `tse-import/logic.ts`) devolve o texto que o admin mostra ao desabilitar o botão. **Ao liberar contas/votação de 2026, é só relaxar `origemDisponivel`.** Reimporte candidatos e bens periodicamente enquanto o registro estiver aberto — o upsert é idempotente.

## Contratos das leituras da ficha

- `obterCandidatoTse({sq, ano}) → CandidatoDetalhe | null`. Além de `candidato`/`bens`/`votosTotais`/`topMunicipios`, devolve `bensTotalLinhas` (count exato; `bens` traz só as 100 maiores), `historico` (todas as candidaturas da mesma pessoa, **inclusive esta**, desc por ano) e `historicoIndisponivel` (sem título nem CPF aproveitável). `cpf` e `titulo_eleitoral` são lidos no servidor e **não** viajam no payload. Erro em qualquer das três queries paralelas é lançado — nunca degradar para lista vazia, que na tela vira "nenhum bem declarado".
- **A ponte tem os dois sentidos.** Ida: `eleicoesDoParlamentar` (ficha do parlamentar → candidaturas). Volta: `parlamentaresDasCandidaturas`, dentro de `obterCandidatoTse`, alimentando `CandidatoDetalhe.parlamentares` e a seção "Mandato no Mutirão de Dados". Detalhes que importam: a busca usa **todas** as candidaturas da pessoa (quem abre a de 2018 quer saber que ela é deputada hoje); ao deduplicar, prefere o vínculo da candidatura ABERTA, senão a ficha de 2022 diria "vínculo pela candidatura de 2026"; vínculo cujo parlamentar sumiu do roster é descartado, porque link morto é pior que seção ausente; e `match_metodo !== 'cpf'` rende aviso visível de que a ligação veio de nome/UF/partido e pode errar em homônimo.
- `compararBensTse({sqA, anoA, sqB, anoB}) → { a, b }`. Cada lado lê até 2000 bens, **agrega por categoria antes** de cortar em 100 para exibição (`truncado` avisa quando bateu o teto). Não verifica se os dois lados são da mesma pessoa — as tabelas são de leitura pública e a UI só oferece pares vindos do `historico`.

## tse_varredura (retomada)

Chave `\<tipo>#<ano>#<UF>` (ex.: `receitas#2022#SP`), com `linhas_processadas`, `importados`, `completa`. Bens/receitas/despesas retomam pulando linhas já processadas (re-stream do zip sem re-upsert); **resultados e candidatos recomeçam** e são processados por arquivo inteiro numa rodada (ambos limitados por UF), pois precisam agregar/deduplicar antes do upsert; upsert por PK substitui. Limpeza seletiva por entidade zera as chaves `\<tipo>#%` (ver `clearImportData`).

**Dedupe de candidatos por turno:** a PK de `tse_candidatos_cache` é `(sq_candidato, ano_eleicao)` — sem `nr_turno`. Em eleições com 2º turno o mesmo `sq_candidato` vem em duas linhas (turno 1 e 2); o ingest deduplica por candidato **mantendo o turno mais alto** (a linha do turno final carrega a `situacao_totalizacao` definitiva, ex.: "Eleito"). Sem isso as duas linhas caem no mesmo lote e o Postgres recusa (`ON CONFLICT DO UPDATE command cannot affect row a second time`).

## API DivulgaCandContas

- `GET /eleicao/ordinarias` → catálogo `{id, ano, nomeEleicao}` — ids: 2014=680, 2016=2, 2018=2022802018, 2020=2030402020 (+AP apartado em 2032002020), 2022=2040602022, 2024=2045202024, **2026=20322002026**. O cliente resolve dinamicamente e o `linkDivulgaCandidato` (links-oficiais) usa o mapa estático — ao entrar um ano novo, acrescente o id lá, senão o link "Ver na fonte oficial" cai na home.

### URL da ficha no Divulga (SPA)

Formato atual, conferido no navegador em **2026-08-08** contra o site real (versão 2.8.12):

```
https://divulgacandcontas.tse.jus.br/divulga/#/candidato/<REGIÃO>/<SG_UF>/<idEleicao>/<sq>/<ano>/<SG_UE>
```

- O formato anterior (`#/candidato/<ano>/<id>/<UE>/<sq>`) hoje devolve "ERRO AO CARREGAR A PÁGINA" em **todos** os anos — a troca não foi só para 2026.
- `SG_UF` e `SG_UE` são campos distintos: iguais nas gerais, diferentes nas municipais (UE = código do município). Por isso a função recebe objeto nomeado, não posicionais.
- `REGIÃO` é decorativa: `SUL/AC/...` abre a ficha de um candidato do Acre normalmente. Só alimenta a trilha de navegação do site deles, então UF fora do mapa degrada a migalha, não quebra o link. Grafias verificadas: `NORTE`, `NORDESTE`, `CENTRO-OESTE` (com hífen), `SUDESTE`, `SUL`, e `BRASIL` para cargos nacionais (`SG_UF = BR`).
- Casos cobertos por teste em `src/lib/links-oficiais.test.ts`, todos abertos no site antes de virarem asserção.
- `GET /candidatura/buscar/{ano}/{sgUe}/{idEleicao}/candidato/{sq}` → detalhe (`descricaoTotalizacao`, `gastoCampanha1T`, `cpf`). `sgUe` = UF nas gerais, código da UE nas municipais. Corpo vazio = não encontrado.
- Usos: `revalidarCandidatoTse` (divergência → finding `divergencia_api_csv`) e confirmação de `eleito_sem_prestacao_contas` antes de publicar.

## RPCs SQL (migration 20260706123000)

Público: `tse_resumo_eleicoes()`, `tse_resumo_partido(sigla)`. Service-role (sinais): `tse_eleitos_sem_contas(ano)`, `tse_candidatos_sem_bens(ano)`, `tse_contagem_ano_uf()`, `tse_evolucao_patrimonial(multiplo, minimo)`, `tse_fornecedor_concentrado(ano, min_cand, fracao)`, `tse_doacoes_de_fornecedores(minimo)`. View `v_fornecedor_doador` junta doadores PJ com `fornecedores_cache` por CNPJ normalizado.

## Limiares dos sinais investigativos

`LIMIARES_INVESTIGATIVOS` em `investigativos.ts`: doação mínima R$ 1.000; evolução ≥ 10× e final ≥ R$ 500 mil; concentração ≥ 10 candidatos e ≥ 40% do grupo. Mudanças de calibragem devem ser registradas em `/metodologia` (seção Versionamento).
