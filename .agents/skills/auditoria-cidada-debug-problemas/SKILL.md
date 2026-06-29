---
name: auditoria-cidada-debug-problemas
description: Histórico de lições aprendidas, debug e notas técnicas específicas sobre problemas conhecidos do ecossistema técnico do projeto (Zod, TanStack Start, Cloudflare Workers, Supabase). Carregar ao depurar erros de build, rotas, banco ou testes.
---

# Problemas Conhecidos — Referência Rápida

Consulte [`docs/padroes/debug-problemas.ia.md`](/docs/padroes/debug-problemas.ia.md) para o detalhamento completo de cada problema, incluindo sintomas, causa raiz e contorno.

## Resumo dos problemas documentados

| # | Problema | Palavras-chave |
|---|----------|---------------|
| 1 | Zod 4 quebra Vitest via `vite.config.ts` | `z.function(...).returns is not a function`, testes |
| 2 | Timeouts no Cloudflare Workers | importações longas, CPU limit, Workers |
| 3 | Vazamento de `client.server` para o bundle | `supabaseAdmin`, service role key, bundle |
| 4 | Rota com `_` no nome gera URL diferente | TanStack Router, file-based routing, `_authenticated` |

Ao identificar um problema parecido com qualquer um acima, leia o arquivo de referência antes de investigar.
