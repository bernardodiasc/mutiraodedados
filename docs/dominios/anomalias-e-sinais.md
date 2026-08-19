# Anomalias e sinais

## Propósito

Descrever **onde cada tipo de sinal aparece** — nas páginas públicas e no admin. A definição dos três tipos (alerta de qualidade, lacuna, sinal investigativo) e a regra de classificação são normativas e moram em [`qualidade-dados.md`](../qualidade-dados.md) — este arquivo não as repete.

## Onde cada tipo aparece

| Tipo                | Páginas públicas                                                                                                                                                                                                                                                                                             | Admin                                                                                                                                                   |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Alerta de qualidade | `/qualidade` (lista), `/qualidade/$id` (detalhe), banner `QualidadeBanner` nas fichas afetadas                                                                                                                                                                                                               | `/admin/qualidade` (triagem, falso positivo, reporte oficial)                                                                                           |
| Lacuna              | `/lacunas` (lacunas curadas) e badge nas fichas quando a ausência afeta aquele registro                                                                                                                                                                                                                      | `/admin/qualidade` (findings `tipo='lacuna'`) → promoção via `converterFindingEmLacuna`                                                                 |
| Sinal investigativo | `/anomalias` (sinais derivados de contratos, em memória) e cards nas fichas de entidade (candidato, parlamentar, fornecedor) — sempre com `AvisoMetodologico`. Os investigativos **persistidos** (cruzamentos TSE, `licitacao_sem_desfecho`) aparecem em `/qualidade` com selo de tipo + `AvisoMetodologico` | `/admin/sinais` mostra APENAS os sinais em memória de contratos; os persistidos são triados em `/admin/qualidade` com o filtro por tipo `investigativo` |

Páginas públicas que expõem sinais por fonte: `/tse` (contagens dos três tipos + link de reprodução), fichas `/eleicoes/candidatos/$sq` (banners de qualidade e de cruzamentos da candidatura), seção "Eleições" das fichas de parlamentar e seção "Doações eleitorais" em `/fornecedores/$cnpj`. Os critérios de todas as regras ficam em `/metodologia` (hub por fonte).

Princípio: **sinal não é coisa de admin.** Todo sinal público mostra a evidência, o link para o registro afetado no site, o link para a fonte oficial e — quando investigativo — o aviso metodológico de que o padrão não é irregularidade por si só.

## Exemplos de sinais investigativos

- Crescimento abrupto de receita de um fornecedor.
- Fracionamento de despesa (vários contratos pequenos sob o mesmo limiar de dispensa).
- Concentração excessiva (um fornecedor ganha quase tudo de um órgão).
- Gastos CEAP fora do padrão estatístico.
- Doador de campanha que aparece como fornecedor de contrato/emenda do mesmo parlamentar (fonte TSE, ver [`fontes/tse.md`](../fontes/tse.md)).

## Persistência

- Sinais dos três tipos persistem em `qa_findings` com a coluna `tipo` (ver [`qualidade-dados.md`](../qualidade-dados.md)).
- Exceção histórica: os sinais de contratos listados em `/anomalias` são derivados **em memória** por `src/lib/anomalias.ts` sobre o dataset carregado (não persistem em tabela). Sinais novos (ex.: cruzamentos TSE) já nascem persistidos com `tipo='investigativo'`.

## Página pública

- `/anomalias` — lista de sinais com explicação humana, evidências, severidade.
- Cada item linka para o registro afetado no site e para a fonte oficial.
- Componente `ChecklistInvestigacao` ajuda o cidadão a verificar passo-a-passo.

## Admin

- `/admin/sinais` — gestão e priorização dos sinais **em memória** de contratos (`src/lib/anomalias.ts`). Permite marcar como `falso_positivo`, `confirmado`, `investigado`.
- `/admin/qualidade` — triagem dos findings **persistidos** dos três tipos (filtros por tipo, fonte, status e regra), incluindo os investigativos TSE e de licitações.

## Catálogo público das regras

O catálogo central `src/lib/sinais-catalogo.ts` é a fonte única das descrições públicas (label, o que detecta, limiares, severidade, onde roda) — alimenta os boxes "Como ler esta página" de `/qualidade`, `/lacunas` e `/anomalias`, os filtros dessas páginas e do admin. Toda regra nova precisa de uma entrada (o teste `sinais-catalogo.test.ts` cobra).

## Lógica

- `src/lib/anomalias.ts` — algoritmos de detecção em memória (contratos).
- `src/lib/anomalia.ts` — contrato de dados único para qualquer "achado".
- `src/lib/data/qa.ts` — pipeline persistente (`flagQA`) usado pelos três tipos.
- Fontes com catálogo completo de sinais separam por arquivo: `src/lib/data/<fonte>/qualidade.ts`, `lacunas.ts`, `investigativos.ts`.

## Conceitos relacionados

- [O que é contrato público](../conceitos/o-que-e-contrato-publico.md) — para entender fracionamento.
- [Transparência ativa vs passiva](../conceitos/transparencia-ativa-vs-passiva.md).
