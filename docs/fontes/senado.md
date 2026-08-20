# Senado Federal

- **URL base**: `https://legis.senado.leg.br/dadosabertos`
- **Chave**: não exige.
- **Janela**: CEAPS desde 2008, votações desde 2003.
- **Documentação oficial**: <https://www12.senado.leg.br/dados-abertos>

## ⚠ Matérias: endpoint em descontinuação

`materia/pesquisa/lista` **já passou da data de desativação anunciada pelo próprio serviço**. Os metadados da resposta, conferidos em 2026-08-20, dizem:

| Campo                     | Valor                                               |
| ------------------------- | --------------------------------------------------- |
| `DataDepreciacao`         | 2025-03-18                                          |
| `DataDesativacaoCompleta` | **2026-02-01**                                      |
| `UrlServicoSubstituto`    | `https://legis.senado.leg.br/dadosabertos/processo` |

Ele continua respondendo, mas **mudou o formato sem trocar de URL**: os itens vêm com campos planos (`Codigo`, `Sigla`, `Numero`, `Ano`, `Ementa`, `Autor`, `Data`) em vez do bloco `IdentificacaoMateria`. O ingest aceita as duas formas, mas isso é paliativo — a migração para `/processo` está no [ROADMAP.md](../../ROADMAP.md).

Ao mexer aqui, confira os metadados da resposta antes de confiar no formato:

```bash
curl -s 'https://legis.senado.leg.br/dadosabertos/materia/pesquisa/lista?ano=2025&sigla=PL' | head -c 600
```

## O que importamos

- **Senadores** em exercício.
- **Despesas CEAPS** (Cota para Exercício da Atividade Parlamentar dos Senadores).
  - Fonte: portal administrativo (`adm.senado.gov.br/adm-dadosabertos`), que entrega o ano inteiro numa chamada. A API antiga em `legis.senado.leg.br` saiu do ar (404) e fazia toda importação voltar vazia.
  - Importação **retomável**: cada rodada grava o mês em lotes, limitada por tempo e por subrequisições, e retoma de onde parou (`importacao_varredura`). O painel repete as rodadas até o mês fechar.
- **Votações** plenárias e votos individuais.
- **Matérias legislativas**.

## Peculiaridades

- Respostas costumam vir em formato derivado de XML convertido para JSON — campos podem ser objeto ou array do mesmo tipo dependendo do volume. O parser do ingest normaliza para array sempre.
- Números em pt-BR — `parseValorPortal` (compartilhado) cobre.

## Quem consome

- [Parlamentares](../dominios/parlamentares.md):
  - `/senado` — hub.
  - `/senado/senadores`, `/senado/senadores/$id`.
  - `/senado/votacoes`, `/senado/votacoes/$id`.
  - `/senado/materias`, `/senado/materias/$id`.

## Links externos esperados

Cada senador linka para `https://www25.senado.leg.br/web/senadores/senador/-/perfil/<codigo>`. Votações e matérias linkam para suas páginas oficiais.

## Conceitos relacionados

- [CEAPS](../conceitos/ceap-e-ceaps.md)
- [Votações nominais](../conceitos/votacoes-nominais.md)
