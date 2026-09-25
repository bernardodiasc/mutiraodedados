# SICONFI — Sistema de Informações Contábeis e Fiscais

- **URL base**: `https://apidatalake.tesouro.gov.br/ords/siconfi/tt`
- **Chave**: não exige.
- **Janela**: 2013.
- **Documentação oficial**: <https://apidatalake.tesouro.gov.br/docs/siconfi>
- **Mantenedor**: Secretaria do Tesouro Nacional (STN).

## Páginas (dois eixos)

- **`/siconfi`** — é o **hub da fonte** (eixo "Por fonte de dados"): descreve o SICONFI, dá o contador e a seção "Como o SICONFI se conecta" (vs Portal CGU, fratura Fundo a Fundo, granularidade). Linka adiante para a página-tipo.
- **`/relatorios-fiscais`** — é a **página-tipo** (eixo "Por tipo de dados"): a listagem dos dados (RREO/RGF/DCA) com filtros UF/exercício/tipo/busca e exportação CSV. É para onde aponta a `rota` da fonte em `cobertura-publica`.

## Relação com o Portal CGU (eixo "Por fonte")

O SICONFI **permanece fonte nativa** e só vive no eixo "Por fonte": RREO/RGF/DCA **não existem** no Portal CGU. Os dois medem coisas diferentes — SICONFI dá a visão contábil consolidada (empenhado/liquidado, todos os entes, mesma metodologia), o [Portal CGU](./portal-cgu.md) dá a execução de pagamentos contrato a contrato. Use SICONFI para **comparar entes** e o Portal para **rastrear contratos**. Ver [SICONFI e relatórios fiscais](../conceitos/siconfi-e-relatorios-fiscais.md).

## O que importamos

- **RREO** — Relatório Resumido da Execução Orçamentária (bimestral).
- **RGF** — Relatório de Gestão Fiscal (quadrimestral/semestral).
- **DCA** — Declaração de Contas Anuais.

## Peculiaridades

- Endpoints segmentados por tipo de relatório e por anexo (ex: Anexo 1 do RREO = Balanço Orçamentário).
- Identificação dos entes via código IBGE: 2 dígitos = estado, 7 dígitos = município.
- Volume grande quando se importa todos os anexos — preferimos importar sob demanda por ente/ano.
- **RGF exige `in_periodicidade` e `co_poder`.** Sem os dois, o `/rgf` responde 200 com **zero itens** — não com erro. O RGF é pedido poder a poder: estados `E, L, J, M, D`; DF `E, L, D` (Judiciário e MP do DF são da União); municípios `E, L`. O Tribunal de Contas (inclusive TCM) vem dentro do Legislativo (`L`). O poder entra na chave do cache — sem ele, o Legislativo sobrescreveria o Executivo.
- **Forma do relatório por porte.** Município com menos de 50 mil habitantes (LRF art. 63) pode optar pelo par _RGF Simplificado_ semestral (`S`, 2 períodos) + _RREO Simplificado_; os demais entes publicam RGF quadrimestral (`Q`, 3 períodos) + RREO. Numa amostra de 2023, a maioria dos municípios pequenos ainda usa a forma completa — por isso a completa é tentada primeiro e a simplificada só entra para município pequeno (população do cadastro `/entes` do próprio SICONFI). O `tipo_relatorio` gravado é o demonstrativo que respondeu ("RGF Simplificado", por exemplo).
- **Paginação.** A API corta em 5.000 itens por página (`hasMore`); o RREO de um estado grande chega perto disso. A importação segue `offset` até o fim.
- **Vazio só é "vazio" com o extrato de entregas.** Quando nenhuma forma responde, a importação consulta `/extrato_entregas` do ente/exercício: se o relatório não consta como entregue, grava o marcador "consultado, vazio"; se consta, é **erro** ("resposta vazia inesperada") e nenhum marcador é gravado. Lógica em `src/lib/data/siconfi/consulta.ts`.

## Reimportação necessária (correção de 2026-09-25)

Antes da correção, **todo RGF** e o RREO dos municípios que publicam a versão simplificada eram consultados com parâmetros incompletos e registrados como "sem dados". O que foi verificado no código:

- **Nenhum sinal foi gerado a partir desses vazios.** O SICONFI não tem regra de lacuna (só o alerta de qualidade `valor_negativo_em_conta_positiva`, que roda sobre linhas importadas) e nenhum finding foi criado por ausência.
- **Cobertura não os tratou como confirmados de forma que impeça reimportar.** Os marcadores ficam em `importacoes` (`importados = 0`, `erros` vazio) com `escopo` = código IBGE, mas a matriz de cobertura agrupa o SICONFI por tipo de relatório — as chaves não se cruzam e os marcadores não aparecem como "consultado, vazio". A varredura não lê marcadores (percorre pelo cursor), o resumo de cobertura ignora o SICONFI e "Sincronizar tudo" não gera jobs do SICONFI.
- **O efeito foi silencioso:** a linha de RGF simplesmente não existe na cobertura e no `/relatorios-fiscais`, e o contador "consultas sem dados" das rodadas antigas está inflado.

Para recuperar (nenhuma limpeza é necessária — o upsert grava por cima e nada é apagado):

1. Em `/admin/dados` → Entes → varredura do SICONFI, rodar de novo os mesmos conjuntos e intervalos de exercícios já varridos (UFs, capitais, municípios por UF). Varredura concluída recomeça do início ao ser pedida de novo.
2. Conferir no Histórico que o RGF passou a importar linhas e que "consultas sem dados" caiu; erros "resposta vazia inesperada" apontam casos a investigar.
3. **Não** usar a limpeza "Marcadores 'consultado, vazio'" para isso: ela apaga os marcadores de **todas** as fontes, não só do SICONFI. Os marcadores antigos do SICONFI não bloqueiam nada e podem ficar.

As rodadas ficam mais caras: o RGF de um estado são 5 consultas (uma por poder) e todo vazio gasta mais uma no extrato de entregas. O custo por passo agora é contado pelas requisições reais, então a varredura para antes do teto de subrequisições.

## Quem consome

- [Finanças públicas](../dominios/financas-publicas.md):
  - `/siconfi` — hub da fonte.
  - `/relatorios-fiscais` — consulta por ente, exercício e tipo de relatório.

## Links externos esperados

Cada relatório linka para a consulta oficial em `https://siconfi.tesouro.gov.br/siconfi/pages/public/consulta_finbra/finbra_list.jsf`.

## Conceitos relacionados

- [SICONFI e relatórios fiscais](../conceitos/siconfi-e-relatorios-fiscais.md)
