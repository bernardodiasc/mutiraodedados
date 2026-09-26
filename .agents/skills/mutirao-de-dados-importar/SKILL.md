---
name: mutirao-de-dados-importar
description: Operador das importações oficiais do Mutirão de Dados pela ferramenta `bun run importar` — interpreta o pedido, roda a ferramenta, publica o relatório na issue indicada e abre as issues de reprovação. Carregar quando o mantenedor pedir para importar dados oficiais de uma fonte, levar uma fonte à cobertura completa ("toda janela aprovada") ou rodar as importações da rodada manual a partir de um roteiro numa issue.
---

# Importar dados oficiais — operador

Você é o **operador**: traduz o pedido em chamadas da ferramenta, roda, lê o resumo e relata. A ferramenta já decide o resto — fatia as janelas, repete as rodadas, confere cada janela e aplica a política de parada. Tudo sobre ela está em [`docs/automacao.md`](/docs/automacao.md#importação-sob-demanda-modo-nomeado); as checagens da conferência, em [`docs/importacao.md`](/docs/importacao.md#conferência). A ordem entre fontes é a tabela de dependências em `src/lib/data/automacao/dependencias.ts`; `bun run importar` sem argumentos lista as tarefas que já têm adaptador.

Guardrails:

- **O banco é um só, o de produção.** A ferramenta é o único caminho de escrita: importar janela histórica real é o próprio trabalho, e os upserts são idempotentes. Limpeza, SQL de escrita e reimportação em massa com `--reprocessar` ficam com o mantenedor.
- **Relate, sem diagnosticar.** O relatório e as issues dizem o que falhou (esperado × obtido) e onde ver. Investigar a causa e corrigir é trabalho de outra issue.
- O RELEASES.md é do fechamento de release; a skill escreve só nas issues.

## 1. Montar o plano

Cada pedido vira uma ou mais chamadas. Os três formatos:

| Pedido                                                             | Chamada                                                                                                                                                       |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Meta**: "votações da Câmara desde 2003 com toda janela aprovada" | `bun run importar camara_vot --pendentes` — as pendentes já vêm dentro da janela de disponibilidade; "desde 2015" vira `--pendentes 2015-01..<AAAA-MM atual>` |
| **Fonte + janela**: "Senado, votações de jan a jun de 2024"        | `bun run importar senado_vot 2024-01..2024-06`                                                                                                                |
| **Roteiro**: a lista numa issue indicada pelo mantenedor           | Ler com `gh issue view <n> --comments`; cada item vira uma chamada de meta ou de janela                                                                       |

- Várias fontes com o mesmo intervalo vão numa chamada só (`bun run importar camara_vot senado_vot --pendentes 2024`), ou `--todas --pendentes` para todas: a ferramenta as põe na ordem da tabela, pula com aviso a que ainda não tem adaptador e, quando uma fonte para, bloqueia só as que dependem dela.
- Parâmetro próprio da tarefa vai com `--param chave=valor`. Matérias e proposições vão por ano e sigla: sem `--param sigla=` (ou `siglaTipo=`), percorrem as siglas do painel; com ele, só a pedida. O SICONFI exige o ente e o relatório — `bun run importar siconfi_relatorio --pendentes --param codIbge=35 --param tipoRelatorio=RGF` —, e com `--todas` fica de fora sem eles; o SICONFI em lote vai por exercício e exige o ente (`siconfi_ano --param codIbge=35`) ou o conjunto (`siconfi_varredura --param conjunto=municipios --param uf=AC`). Cadastros (`camara_cadastro`, `camara_trajetoria`, `senado_cadastro`, `ibge`) não têm intervalo; matérias e proposições vão por ano. Formatos em [`docs/automacao.md`](/docs/automacao.md#a-ferramenta).
- Item que não casa com nenhuma tarefa da tabela (ex.: um check de tela) fica fora do plano e entra no relatório como "fora da ferramenta".
- A issue que recebe o relatório vem do mantenedor. Se o pedido não diz qual, pergunte antes de rodar.

Pronto quando cada item do pedido tem a sua chamada ou está anotado como fora da ferramenta.

## 2. Rodar

1. Confira que `.env.local` na raiz do repositório tem `CRON_SECRET` e `SITE_URL`. Sem eles, peça ao mantenedor: o segredo só ele tem.
2. Rode cada chamada **em segundo plano**, com a saída num arquivo de log fora do repositório (ex.: o diretório temporário da sessão), e espere o processo terminar. Uma chamada por vez: as janelas dividem o cursor com o painel.
3. Leia o código de saída e o bloco `resumo` no fim do log: uma linha por fonte (janelas por estado, importados, findings novos) e, abaixo dela, cada janela inconclusiva ou reprovada com a execução (`execucao_id`), as rodadas, o motivo e os erros sem `info:`.
4. Processo que morreu no meio (rede, máquina, interrupção): rode o mesmo comando com `--pendentes`. Sem estado local, ele continua de onde parou.
5. **Meta:** saiu com 0, a meta foi atingida. Saiu com 1 só por inconclusivas (sem reprovada, sem "a origem parece fora do ar"), rode `--pendentes` de novo; pare quando uma rodada não diminuir as pendentes e relate o que ficou.

A política de parada é da ferramenta: janela reprovada fica como está até a issue de correção ser resolvida.

Pronto quando cada chamada do plano terminou e o resumo dela foi lido.

## 3. Relatório

Um comentário na issue indicada (`gh issue comment <n> --body-file <arquivo>`), guardando a URL que o `gh` devolve — as issues de reprovação apontam para ela.

```markdown
## Importação — <data>

Pedido: <o pedido, em uma linha>. Comandos: `<comando 1>`, `<comando 2>`.

| Fonte      | Aprovadas | Inconclusivas | Reprovadas | Importados                 | Findings novos |
| ---------- | --------- | ------------- | ---------- | -------------------------- | -------------- |
| camara_vot | 11        | 0             | 1          | 812 votacoes, 402113 votos | não se aplica  |

- **Reprovadas:** `camara_vot` 2024-02 — execução `<execucao_id>` → <link da issue de reprovação>.
- **Inconclusivas (continuam pendentes):** <janela, execução e motivo>.
- **Paradas e puladas:** <fonte que parou e por quê; tarefa sem adaptador; tarefa bloqueada pela dependência>.
- **Fora da ferramenta:** <itens do roteiro que não são importação>.
```

"Sem conferência" no resumo é janela já aprovada antes, que nada rodou: conte com as aprovadas.

## 4. Issues de reprovação

**Uma issue por fonte + causa**, não por janela: todas as janelas reprovadas da mesma fonte pela mesma checagem vão na mesma issue. A checagem sai do motivo:

| Motivo começa com                                             | Checagem             |
| ------------------------------------------------------------- | -------------------- |
| "A janela não terminou" · "Nenhuma rodada desta execução"     | terminou             |
| "Falha nossa em"                                              | log limpo            |
| "Nenhum registro importado" · contagem × total da origem      | contagem             |
| "A cobertura não reflete"                                     | reflexo na cobertura |
| "Teto de"                                                     | teto de rodadas      |
| "A chamada à rota falhou" · "Não foi possível montar o plano" | chamada à rota       |

Título: `Importação reprovada: <tarefa> — <checagem>` (ex.: `Importação reprovada: camara_vot — contagem`).

**Origem ou nosso.** Sem diagnosticar, separe pelo que os erros dizem: problema do dado na origem (ela respondeu, mas o que publica está inconsistente — ex.: 404 no detalhe de um item que a própria listagem trouxe) ou erro nosso (parser, banco, endpoint que nós montamos). Registre a leitura na seção "Origem ou nosso" do corpo. Uma reprovação por problema do dado na origem não é bug de dado: indica que falta um sinal, e a correção é criar a regra que descarta o item com aviso e gera o sinal ([`docs/qualidade-dados.md`](/docs/qualidade-dados.md#problema-da-origem--erro-nosso)). Origem indisponível (5xx, 429, timeout) deixa a janela inconclusiva, não reprovada, e não abre issue.

1. Procure uma issue **aberta** com exatamente esse título: `gh issue list --state open --label bug --search "in:title Importação reprovada: <tarefa>" --json number,title` e compare o título inteiro.
2. **Existe:** comente nela a tabela das janelas novas e o link do relatório.
3. **Não existe:** abra sem pedir confirmação, com label `bug` e o milestone da release em andamento (a do "Estado atual" do WORKFLOW.md): `gh issue create --title "<título>" --label bug --milestone <vX.Y.Z> --body-file <arquivo>`, com este corpo:

````markdown
## O que falhou

Checagem **<checagem>** da conferência (`docs/importacao.md`, seção Conferência).

- **Esperado:** <o "Passa quando" da checagem, na tabela do doc>
- **Obtido:** <o motivo da conferência, como a ferramenta imprimiu>

## Janelas afetadas

| Janela  | `execucao_id` | Rodadas | Erros (sem `info:`) |
| ------- | ------------- | ------- | ------------------- |
| 2024-02 | `<uuid>`      | 3       | <erros, ou "—">     |

## Origem ou nosso

<"Parece problema do dado na origem: <evidência>. Falta um sinal." ou "Parece erro nosso: <evidência>." ou "Não dá para dizer pelo log.">

## Como ver

- Histórico filtrado: `<SITE_URL>/admin/dados?execucao=<uuid>` (uma linha por janela)
- SQL:

```sql
SELECT execucao_id, consultado_em, resultado, importados, erros, conferencia
FROM importacoes
WHERE execucao_id IN ('<uuid>')
ORDER BY execucao_id, consultado_em;
```

## Reproduzir uma janela

`bun run importar <tarefa> <AAAA-MM> --reprocessar`

## Relatório

<URL do comentário do relatório>
````

4. Com as issues abertas ou comentadas, ponha os links delas na linha **Reprovadas** do relatório: `gh issue comment <n> --edit-last --body-file <arquivo>`.

Pronto quando cada janela reprovada do resumo está numa issue (nova ou comentada) e o relatório aponta para cada uma.
