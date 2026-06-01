# Artigos e aprendizado

## Propósito

Educar o cidadão sobre controle social, explicar metodologias e narrar investigações.

## Páginas públicas

- `/aprender` — central de conhecimento. Hub editorial.
- `/notas` — notas curtas (achados rápidos, comentários).
- `/notas/$slug` — leitura de uma nota.
- `/tutoriais` — passo-a-passo para fazer controle social (ex: "como ler um RREO").
- `/tutoriais/$slug` — leitura.
- `/mapas` — análises visuais (mapas geográficos, ranqueamentos).
- `/mapas/$slug` — leitura.

## Padrão de página

- `head()` próprio com `og:image` quando a peça tem capa.
- Renderização via `ArtigoRenderer` a partir de Markdown salvo no banco.
- Links para os registros que embasam a peça (contratos, convênios, deputados).

## Admin

- `/admin/artigos` — editor Markdown. Cria/edita slug, capa, conteúdo, status (rascunho/publicado).
- Tabela: `artigos` (campo `tipo` distingue mapa/tutorial/nota).

## Princípios editoriais

- Toda afirmação numérica linka para a fonte oficial.
- Sanitização de PII vale também aqui — não publicar CPFs em textos editoriais.
- Preferir explicar metodologia (como achamos) a apenas mostrar conclusão.