# Páginas institucionais

Páginas estáticas (sem ingestão) que explicam o projeto, sua metodologia e suas obrigações legais.

## Páginas

- `/sobre` — quem somos, missão, equipe.
- `/metodologia` — como tratamos os dados (resumo executivo do que está documentado em `docs/`).
- `/referencias` — links para fontes oficiais, leis, portais de transparência.
- `/roadmap` — itens em planejamento (puxa de `roadmap_items`, editável em `/admin/roadmap`).
- `/transparencia-institucional` — avaliação de transparência ativa de órgãos (Índice de Transparência Institucional - ITI).
- `/privacidade` — política de privacidade (LGPD).
- `/termos` — termos de uso.
- `/tratamento-de-dados` — explicação do tratamento de dados pessoais e justificativa para republicação.
- `/contestar` — formulário para contestar sinais automáticos ou pedir correção.
- `/login` — autenticação (Supabase Auth + Google OAuth).

## Padrão

- Conteúdo estático em código (não vem do banco), salvo `/roadmap`.
- Todas têm `head()` com title/description próprios.
- Footer (`SiteFooter`) lista as institucionais.

## Relacionado

- [LGPD e dados públicos](../conceitos/lgpd-e-dados-publicos.md)
- [Transparência ativa vs passiva](../conceitos/transparencia-ativa-vs-passiva.md)