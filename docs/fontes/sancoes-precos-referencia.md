# Sanções, vínculos societários e preços de referência (roadmap doc-only)

Esta página documenta fontes federais **ainda não implementadas** — roadmap, sem código. Elas enriquecem a auditoria para além do ciclo orçamento → transferência → contrato (que já cobrimos via Portal CGU, PNCP, Transferegov e SICONFI), permitindo auditar **idoneidade da empresa, preço de referência e vínculos societários**.

## 1. Sanções: CEIS e CNEP — **endpoints nativos do Portal CGU**

- **O que auditar**: cruzar o CNPJ vencedor (do PNCP/contratos) com empresas inidôneas/suspensas (CEIS) e punidas (CNEP) para detectar contrato firmado com empresa impedida de licitar.
- **Acesso**: `GET /api-de-dados/ceis` e `GET /api-de-dados/cnep` — **na própria API do Portal da Transparência**.
- **Custo de adicionar**: baixo. Reaproveita o cliente `portalGet` e a mecânica de varredura existentes — não exige nova fonte/cliente. É o próximo passo de menor custo do barramento CGU.

## 2. TCU — sanções e jurisprudência

- **O que auditar**: Cadastro de Inabilitados e de Licitantes Inidôneos; acórdãos que embasem regras (ex.: edital que fere entendimento consolidado).
- **Acesso**: Portal de Dados Abertos do TCU + endpoints de busca processual. **Fonte externa ao Portal** — exige cliente próprio.

## 3. Receita Federal — CNPJ / Quadro Societário (QSA)

- **O que auditar**: QSA, capital social, data de abertura, CNAE. Detecta empresa de fachada (aberta dias antes de licitação milionária), colusão (sócios de concorrentes com mesmo endereço) e desvio de finalidade (CNAE incompatível com o objeto).
- **Acesso**: base pública integral de CNPJs (dados abertos mensais da Receita). Volumoso; exige ingestão própria.

## 4. Painel de Preços (MGI)

- **O que auditar**: sobrepreço/superfaturamento. Captura o código do item (CATMAT/CATSER) no PNCP e consulta média/mediana/menor preço do mercado público.
- **Acesso**: APIs/dados textuais do MGI (Compras.gov.br).

## 5. NF-e (Receita/ENCAT)

- **O que auditar**: liquidação na ponta — NF-e cancelada após o pagamento, ou descrevendo produto diferente do edital.
- **Acesso**: API de Distribuição de DF-e. Exige certificado digital (e-CNPJ) e autorização — viável só para órgãos de controle.

## 6. SICAF

- **O que auditar**: saúde financeira/regularidade fiscal das contratadas (certidões vencidas, situação falimentar).
- **Acesso**: integrado ao Compras.gov.br.

## 7. Despesas (`/despesas/*` do Portal CGU)

- **O que auditar**: execução orçamentária nas 3 fases — empenho (Nota de Empenho), liquidação (notas fiscais/atesto), pagamento (Ordem Bancária). A Nota de Empenho é o "DNA" da despesa e a chave para amarrar contratos/emendas aos micro-pagamentos.
- **Por que ainda não**: `/despesas` no Portal é uma **família de subendpoints** (por-orgao, documentos, documentos-por-favorecido…) com forma de "documento", não registro de entidade. É a entidade mais cara e merece de-risking próprio. As 3 fases já aparecem, em parte, nas **emendas** (`valorEmpenhado/Liquidado/Pago`).

## 8. Transferências (`/transferencias` do Portal CGU)

- **O que auditar**: repasses União → Estados/Municípios no nível de Ordem Bancária; campo `tipoTransferencia` distingue convênio de "Fundo a Fundo".
- **Por que ainda não**: o endpoint retornou **HTTP 403** com a chave atual (provável falta de permissão), e **sobrepõe** as transferências EC 105 (finalidade definida) já ingeridas em `transferegov_emendas_cache`. Doc-only até a chave ter acesso e a de-duplicação ser desenhada.

## A fratura "Fundo a Fundo"

Nas transferências Fundo a Fundo (SUS/SUAS), o recurso vai direto do Fundo Nacional ao Municipal, **sem convênio**. A rastreabilidade automática se quebra: o Portal mostra a Ordem Bancária; o Transferegov retorna nulo (não há convênio); e o PNCP registra o contrato municipal **sem campo estruturado** apontando a origem federal. Reatar a trilha exige cruzar SICONFI (saldos contábeis) + "Fonte de Recurso" na transparência municipal — fora do escopo federal atual. Registrado como lacuna metodológica em [`/lacunas`](../dominios/busca-e-exploracao.md).
