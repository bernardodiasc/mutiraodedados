# Problemas Conhecidos e Lições Aprendidas

Este documento consolida particularidades e limitações técnicas descobertas no desenvolvimento do projeto Auditoria Cidadã. Serve como memória técnica para evitar que os mesmos problemas sejam re-investigados.

**Consulte este arquivo antes de depurar erros de build, rotas, banco ou testes.**

---

## 1. Conflito do Zod 4 com Gerador de Rotas do TanStack Router (Vitest)

**Sintoma**
```
TypeError: z.function(...).returns is not a function
  at node_modules/@tanstack/router-generator/dist/esm/config.js:52:89
```

**Causa**
O projeto usa Zod v4 (`^4.4.3`), mas o `@lovable.dev/vite-tanstack-config` e o gerador de rotas interno do TanStack carregam o `vite.config.ts` esperando APIs do Zod v3. O Vitest tenta carregar o `vite.config.ts` e falha antes de rodar qualquer teste.

**Contorno**
Ao rodar testes unitários de funções puras (que não dependem de rotas ou React), crie um `vitest.config.ts` temporário com a configuração mínima:
```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  test: { environment: "node", globals: true },
});
```
Execute os testes e **remova o arquivo** em seguida para não interferir no build de produção.

---

## 2. Limitações de Execução no Cloudflare Workers

**Sintoma**
Timeouts ou estouro de recursos durante importações longas no servidor.

**Causa**
O deploy roda em Cloudflare Workers (`wrangler.jsonc`). Limites rígidos de CPU e tempo por requisição. Não são permitidos subprocessos nem binários nativos.

**Solução aplicada**
- Importações paginadas em lotes de até 200 registros no upsert.
- Varreduras longas (ex.: Portal CGU) são **retomáveis**: cada rodada roda até esgotar um orçamento de tempo (`orcamentoMs ≈ 3min`), salva o progresso na tabela `cgu_varredura`, e a próxima rodada retoma de onde parou. O `AdminImportContainer` gerencia o loop de auto-continuar no cliente.

---

## 3. Vazamento de Privilégios — Import Estático de `client.server`

**Sintoma**
Build com erro de bundle ou chave `SUPABASE_SERVICE_ROLE_KEY` vazando para o frontend.

**Causa**
`@/integrations/supabase/client.server` expõe `supabaseAdmin` (bypass de RLS, usa a `SUPABASE_SERVICE_ROLE_KEY`). O risco é esse módulo chegar ao **bundle do cliente**.

**Regra (atualizada — reflete o código real)**
O que importa é **quem** importa, não _como_. Arquivos de **server function** (`*.functions.ts`, e módulos `*.server.ts`) são server-only — o TanStack Start separa os handlers do bundle do cliente — então o **import estático no topo é o padrão** do projeto e é seguro:
```ts
// ✅ padrão em *.functions.ts / sweep.ts (server-only)
import { supabaseAdmin } from "@/integrations/supabase/client.server";
```
A regra de verdade: **nunca** importe `client.server` (nem `supabaseAdmin`) em **componentes/rotas `.tsx`** que renderizam no cliente. Se precisar de dados num componente, chame uma server function via `useServerFn`. Se um `.tsx` precisar pontualmente, use import dinâmico dentro de um handler server-side.

---

## 4. Rota TanStack com Underscore (`_`) vs Sem Underscore

**Sintoma**
Erro de TypeScript em link de rota: `Type '"/perguntas_/$slug"' is not assignable to type ...`

**Causa**
No TanStack Router file-based, arquivos com `_` no nome antes do `.` criam **layouts pathless** (ex: `_authenticated.tsx`). Arquivos como `perguntas_.$slug.tsx` criam a rota `/perguntas/$slug`, não `/perguntas_/$slug`. O `_` é parte da convenção de nome de arquivo, não da URL.

**Regra**
Ao linkar para rotas dinâmicas, use a URL real (sem o underscore de convenção). Verifique o `routeTree.gen.ts` para confirmar o caminho exato gerado.
