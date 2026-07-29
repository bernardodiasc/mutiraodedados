---
name: mutirao-de-dados-mapas-e-prompts
description: Fluxo para criar mapas investigativos e gerenciar os prompts do Kit de investigação no Mutirão de Dados. Carregar SEMPRE que a tarefa envolver criar um mapa novo, editar/adicionar/vincular prompts a um mapa, mexer no "Kit de investigação", nas variáveis dos prompts ou na tela /admin/prompts — mesmo que o usuário não cite "prompt" ou "Kit" explicitamente.
---

# Mapas + Prompts do Kit — Referência Rápida

Skill de **fluxo**. As regras completas ficam nos docs abaixo — leia o relevante antes de agir.

| Precisa de… | Doc de referência |
|---|---|
| Escrever o conteúdo do mapa (passos, chaves de busca) | [`/docs/padroes/conteudo-investigativo.md`](/docs/padroes/conteudo-investigativo.md) e a skill `mutirao-de-dados-conteudo-investigativo` |
| Onde mapas e prompts vivem no produto | [`/docs/dominios/artigos-e-aprendizado.md`](/docs/dominios/artigos-e-aprendizado.md) |
| Kit, variáveis, caderno, a **regra de coerência** | [`/docs/dominios/laboratorio-civico.md`](/docs/dominios/laboratorio-civico.md) |
| Telas de admin (`/admin/artigos`, `/admin/prompts`) | [`/docs/admin.md`](/docs/admin.md) |
| Tabelas `prompt_modelos` / `mapa_prompts` / `variaveis` jsonb | [`/docs/modelo-dados.ia.md`](/docs/modelo-dados.ia.md) |
| Criar schema novo (migração) | [`/docs/padroes/migrations.md`](/docs/padroes/migrations.md) |

## Modelo mental

- **Mapa** = artigo com `categoria='mapa'`, criado/editado em `/admin/artigos`. Os passos dizem *onde colher os dados*.
- **Prompt** (`prompt_modelos`) = objetivo com placeholders `{{var}}` que o cidadão copia para a própria IA. Vinculado N:N ao mapa via `mapa_prompts`. Gerido em `/admin/prompts`.
- **Kit de investigação** = painel lateral que aparece só em mapas, com o texto do mapa + os prompts vinculados.

## Regras que não podem ser quebradas

1. **Coerência mapa↔prompt.** Cada prompt e cada link de variável tem que fazer sentido com os passos *daquele* mapa. Ex.: no mapa das emendas, o CSV vem de `/emendas`; no de cota parlamentar, da página do parlamentar. A mesma variável pode ter link diferente em mapas diferentes.
2. **Zero hardcode.** Dica e link de cada variável são dados (`prompt_modelos.variaveis` jsonb: `{nome, dica?, href?, hrefLabel?}`), editados **só em `/admin/prompts`**. Nunca colocar catálogo de variáveis no código — `src/lib/kit-investigacao/logic.ts` apenas normaliza.
3. **Link interno.** `href` de variável é sempre rota interna (começa com `/`); links externos são descartados.
4. **Visibilidade.** Um prompt só aparece no site quando está `ativo` **e** vinculado a um mapa **público**.
5. **Serve para qualquer mapa.** O que valer aqui precisa funcionar para os mapas atuais e para mapas futuros — sem alteração de código a cada edição de conteúdo.

## Onde editar (sem tocar em código)

- **Conteúdo do mapa** e vínculo de prompts → `/admin/artigos` e `/admin/prompts`.
- Só recorra a código/migração se precisar de **campo/tabela novos** — aí siga [`/docs/padroes/migrations.md`](/docs/padroes/migrations.md) (regra Lovable: sempre arquivo de migração novo com timestamp posterior) e registre a entrega pela skill `mutirao-de-dados-features-roadmap`.
