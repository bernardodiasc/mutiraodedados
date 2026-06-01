# Anomalias e sinais

## Propósito

Detectar **padrões suspeitos** em dados oficialmente corretos — diferentes de [QA findings](../qualidade-dados.md), que são erros nos próprios dados.

Exemplos de sinais:

- Crescimento abrupto de receita de um fornecedor.
- Fracionamento de despesa (vários contratos pequenos sob o mesmo limiar de dispensa).
- Concentração excessiva (um fornecedor ganha quase tudo de um órgão).
- Gastos CEAP fora do padrão estatístico.

## Página pública

- `/anomalias` — lista de sinais com explicação humana, evidências, severidade.
- Cada item linka para o registro afetado no site e para a fonte oficial.
- Componente `ChecklistInvestigacao` ajuda o cidadão a verificar passo-a-passo.

## Admin

- `/admin/sinais` — gestão e priorização de sinais. Permite marcar como `falso_positivo`, `confirmado`, `investigado`.

## Lógica

- `src/lib/anomalias.ts` — algoritmos de detecção.
- `src/lib/anomalia.ts` — contrato de dados único para qualquer "achado".
- Tabela: `anomalias`.

## Diferença em relação a QA

| Aspecto         | QA finding                          | Anomalia                            |
| --------------- | ----------------------------------- | ----------------------------------- |
| Origem          | Erro nos dados oficiais             | Padrão suspeito em dados corretos   |
| Ação esperada   | Denúncia ao canal oficial (Fala.BR) | Investigação jornalística/cidadã    |
| Página          | `/qualidade`                        | `/anomalias`                        |

## Conceitos relacionados

- [O que é contrato público](../conceitos/o-que-e-contrato-publico.md) — para entender fracionamento.
- [Transparência ativa vs passiva](../conceitos/transparencia-ativa-vs-passiva.md).