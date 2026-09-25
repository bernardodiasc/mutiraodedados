# QA manual

Roteiros permanentes para conferir, com as mãos, que o Mutirão de Dados funciona. Estão organizados por **área**, não por release: cada release escolhe as seções que tocou e roda só elas. Os checks obrigatórios de cada tipo de release estão na seção 2 do [WORKFLOW](../../WORKFLOW.md#2-checks-proporcionais), e estes roteiros dizem **como** cumpri-los.

| Roteiro                                   | Quando rodar                                         |
| ----------------------------------------- | ---------------------------------------------------- |
| [Importação e automação](./importacao.md) | Release que toca importação de dados ou automação    |
| [Páginas públicas](./paginas-publicas.md) | Release que muda UI pública ou dado exibido          |
| [Painel admin](./admin.md)                | Release que muda telas do `/admin` (fora importação) |

## Antes de começar

1. **Migrations aplicadas.** Se algo falhar com "relation does not exist" ou "function does not exist", confira o pipeline de migrations antes de reportar bug ([padrão](../padroes/migrations.md)).
2. **Ambiente.** Rode no preview (UI) ou em staging (validação de release), nunca direto em produção quando o roteiro limpar dados.
3. **Log à mão.** Rodadas de importação são conferidas no Histórico do `/admin/dados` e no log `importacoes` — ver [pipeline de importação](../importacao.md).

## Como ler um roteiro

Cada seção é uma tabela com quatro colunas:

- **O quê**: a ação (rota, botão, entrada).
- **Esperado**: o que precisa acontecer. É critério, não número exato. Contagens dependem da janela importada, então o esperado é "maior que zero e coerente com a fonte oficial".
- **Cobertura**: `manual` quando só uma pessoa confere hoje; `coberto por <arquivo>.test.ts` quando um teste automatizado já garante o comportamento, e aí o item pode ser pulado se o `bun run test` passou.

A coluna **Cobertura** também é o inventário do que ainda falta automatizar.

## Divergências

Achou algo diferente do esperado? Registre como **issue**, com a rota, o passo do roteiro, o que apareceu e print quando for visual. Não anote resultado de rodada nestes arquivos: eles descrevem o comportamento esperado, não o histórico de execuções. O registro dos checks realmente executados vai para a entrada da release no [RELEASES.md](../../RELEASES.md).

## Manter os roteiros

- Feature nova ou fluxo alterado: a mesma mudança atualiza a seção correspondente aqui.
- Teste automatizado novo que cobre um item: troque `manual` pelo caminho do teste.
- Nada de valores datados (contagens, códigos específicos, "desde a correção de tal dia"). Descreva o comportamento esperado.
- Detalhes de uma fonte (janelas, endpoints, reimportações) ficam em [`fontes/`](../fontes/README.md), e os roteiros apontam para lá.
