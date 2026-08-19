# Parlamentares (Câmara, Senado, Congresso)

## Propósito

Acompanhar 513 deputados e 81 senadores: gastos, votações, proposições e atividades.

## Páginas públicas — Câmara

- `/camara` — hub: resumo da legislatura, atalhos.
- `/camara/deputados` — lista com ranking de gastos CEAP.
- `/camara/deputados/$id` — perfil: dados pessoais, CEAP mensal, fornecedores recorrentes, votações.
- `/camara/proposicoes` — lista de PLs, PECs, MPs.
- `/camara/proposicoes/$id` — detalhe + autores + tramitação.
- `/camara/votacoes` — votações nominais por período.
- `/camara/votacoes/$id` — resultado + votos individuais.

## Páginas públicas — Senado

- `/senado` — hub.
- `/senado/senadores`, `/senado/senadores/$id` — equivalente à Câmara, com CEAPS.
- `/senado/materias`, `/senado/materias/$id` — matérias legislativas.
- `/senado/votacoes`, `/senado/votacoes/$id` — votações plenárias.

## Página pública — Congresso

- `/congresso` — visão unificada das duas casas e sessões conjuntas (ex: votação de vetos, LDO).

## Padrão de card

Card de parlamentar: foto, nome, partido/UF, total CEAP/CEAPS no período, link interno + link página oficial Câmara/Senado.

Card de votação: data, ementa curta, resultado (aprovado/rejeitado), placar, link interno + página oficial.

## Admin

- `/admin/dados` — disparar ingestão de cadastros, CEAP/CEAPS por mês, votações por período.
- `/admin/sinais` — sinais sobre gastos atípicos.

## Fontes

- [Câmara dos Deputados](../fontes/camara.md)
- [Senado Federal](../fontes/senado.md)

## Conceitos relacionados

- [CEAP e CEAPS](../conceitos/ceap-e-ceaps.md)
- [Votações nominais](../conceitos/votacoes-nominais.md)
