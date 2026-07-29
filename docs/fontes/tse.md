# TSE — Dados Abertos Eleitorais

Quem se candidatou, o que declarou de bens, quantos votos recebeu e de quem veio o dinheiro da campanha. Cobre eleições de **2014 em diante** (gerais e municipais).

- **Página da fonte no site**: `/tse` · hub de exploração em `/eleicoes`
- **Origem da carga em massa**: [dadosabertos.tse.jus.br](https://dadosabertos.tse.jus.br) (portal CKAN; CSVs zipados por eleição, no CDN `cdn.tse.jus.br`)
- **Revalidação pontual**: API do site DivulgaCandContas (`divulgacandcontas.tse.jus.br/divulga/rest/v1`) — **não documentada oficialmente**, pode mudar sem aviso; hoje sem chave (se passar a exigir, criar secret `TSE_API_KEY`)

## As duas origens e o papel de cada uma

**Regra de ouro da fonte:** dados só entram no cache pelo CKAN (carga em massa). A API DivulgaCandContas é fonte de verdade para revalidação pontual — confirmar a situação de um candidato, checar se um eleito realmente não tem contas antes de publicar a lacuna. É o mesmo padrão da conferência detalhe-por-contrato do Portal CGU.

## O que importamos

| Entidade | Tabela cache | Origem no CKAN | Página |
|---|---|---|---|
| Candidatos | `tse_candidatos_cache` | `consulta_cand_<ano>.zip` | `/eleicoes`, `/eleicoes/candidatos` |
| Bens declarados | `tse_bens_candidato_cache` | `bem_candidato_<ano>.zip` | ficha do candidato |
| Resultados (votos por município) | `tse_resultados_cache` | `votacao_candidato_munzona_<ano>.zip` | ficha do candidato |
| Receitas de campanha | `tse_receitas_campanha_cache` | prestação de contas por ano | fichas de candidato/parlamentar/fornecedor |
| Despesas de campanha (contratadas) | `tse_despesas_campanha_cache` | prestação de contas por ano | fichas de candidato/parlamentar |

Além disso, a **ponte** `tse_parlamentar_candidato` liga deputados/senadores em exercício às suas candidaturas (CPF na Câmara; nome+UF no Senado — vínculos por nome têm confiança menor e fila de revisão).

## Como a importação funciona

Cada rodada processa **um arquivo (ano × UF)**, em streaming direto do CDN — os zips (até 624 MB) nunca são baixados inteiros: lemos o índice do zip via HTTP Range e descomprimimos só a entrada da rodada. Arquivos grandes (receitas de 2022 têm milhões de linhas) são **retomáveis** por contagem de linhas (`tse_varredura`). Disparo pela aba **TSE** em `/admin/dados`, com auto-continuar.

## Sinais da fonte (por tipo)

Taxonomia em [qualidade-dados](../qualidade-dados.md); critérios completos na seção TSE de `/metodologia`.

- **Alertas de qualidade** (`src/lib/data/tse/qualidade.ts`, rodam na importação): `cpf_cnpj_invalido`, `valor_invalido`, `data_impossivel`, `sentinela_nao_tratada`, `duplicata_importacao`, `encoding_suspeito`.
- **Lacunas** (`lacunas.ts`, rodam pós-importação): `eleito_sem_prestacao_contas` (confirmada na API antes de publicar), `candidato_sem_bens` (atrás de flag até confirmar o comportamento do ano), `serie_historica_incompleta` (distingue falha nossa × ausência na origem), `parlamentar_sem_match`.
- **Sinais investigativos** (`investigativos.ts`, cruzamentos — fonte `tse-cruzamento`, sempre com `AvisoMetodologico`): `doador_virou_fornecedor` (doação ≥ R$ 1.000 + contratos do mesmo CNPJ; roda também ao fim de cada importação de contratos), `evolucao_patrimonial_atipica` (≥ 10× entre eleições e ≥ R$ 500 mil), `fornecedor_campanha_concentrado` (≥ 10 candidatos e ≥ 40% do gasto do grupo partido×UF).

## Peculiaridades

- **Latin-1, `;`, sentinelas** `#NULO#`/`#NULO`/`#NE`/`-1`/`-3`/`-4`/`NÃO DIVULGÁVEL`; valores com vírgula decimal.
- **O TSE republicou 2014–2024 no layout moderno** (colunas `SQ_`/`DS_`); só as contas de 2014/2016 seguem no layout legado. Os parsers são dirigidos pelo cabeçalho, nunca por posição.
- **CPF de doador PF vem mascarado da origem** (`***.NNN.NNN-**`) — cruzamentos com pessoa física são impossíveis por desenho; só CNPJs cruzam.
- **Votação agregada por município** (zonas somadas); seção/zona fora do escopo.
- **CPF de candidato é público** (Lei de Acesso), mas pode vir como sentinela em alguns registros.

## Materiais de apoio

- Mapa investigativo: `mapas/siga-o-dinheiro-campanha-contrato` (com 4 prompts no Kit).
- Tutorial: `tutoriais/como-ler-uma-prestacao-de-contas-de-campanha`.
- Nota de campo: `notas/integracao-fonte-tse` (decisões, surpresas e limitações da integração).

## Limites conhecidos

- Eleições de 2012 e anteriores fora do escopo (formatos muito diferentes).
- **Filiações partidárias ainda não são ingeridas** — o dataset é fragmentado por partido×UF, muda mensalmente e lista pessoas físicas nominalmente; a ingestão só entra quando houver produto agregado compatível com a LGPD (ver roadmap).
- Grafo de doadores compartilhados entre candidatos e cruzamento com a Receita Federal: fases futuras.
- Detalhes técnicos (layouts por ano, nomes de arquivo, chunking, contratos das server functions): [`tse.ia.md`](./tse.ia.md).
