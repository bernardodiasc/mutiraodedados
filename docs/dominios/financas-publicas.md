# Finanças públicas

## Propósito

Acompanhar a saúde fiscal dos entes federados (União, estados, municípios) via relatórios oficiais SICONFI.

## Página pública

- `/siconfi` — hub da fonte SICONFI (eixo "Por fonte"): descreve a fonte e suas conexões; linka para a listagem.
- `/relatorios-fiscais` — página-tipo (eixo "Por tipo"): consulta de RREO, RGF e DCA por ente, exercício e anexo.

## Padrão de card / linha

Cada relatório mostra: ente, tipo (RREO/RGF/DCA), exercício, período (bimestre/quadrimestre/ano), link interno + link consulta oficial SICONFI.

## Admin

- `/admin/dados` — disparar ingestão de relatório específico por ente e período.

## Fonte

- [SICONFI](../fontes/siconfi.md)

## Conceitos relacionados

- [SICONFI e relatórios fiscais](../conceitos/siconfi-e-relatorios-fiscais.md)

## Limitações

- Os relatórios são tabelados; o site mostra os principais indicadores mas o detalhe completo deve ser consultado no SICONFI oficial.
- Importação sob demanda — nem todo ente/ano está cacheado.
