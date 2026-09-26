# Problemas Conhecidos e Lições Aprendidas

Este documento consolida particularidades e limitações técnicas descobertas no desenvolvimento do projeto Mutirão de Dados. Serve como memória técnica para evitar que os mesmos problemas sejam re-investigados.

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

**Resolvido (v0.1.0)**
O repositório tem um `vitest.config.ts` **definitivo** na raiz. Quando esse arquivo existe, o Vitest o usa com precedência e nem carrega o `vite.config.ts` — o conflito não ocorre. O `vite build` ignora o `vitest.config.ts`, então ele não interfere no build de produção (verificado).

Rode os testes com:

```bash
bun run test        # suíte completa (vitest run)
bun run test:watch  # modo watch
bunx vitest run src/lib/<área>  # recorte
```

Regra: **nunca importe o `vite.config.ts` dentro do `vitest.config.ts`** — é exatamente o que reintroduziria o conflito. Não é mais necessário criar/remover config temporário.

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

---

## 5. Server function criada por factory não é separada do bundle do cliente

**Sintoma**
Ao chamar uma server function, erro em runtime `Missing Supabase environment variable(s): SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY. Connect Supabase in Lovable Cloud.` — com **os dois** vars faltando ao mesmo tempo, mesmo com o env corretamente configurado (outras fontes funcionam). Vars configurados na Lovable/Worker não resolvem.

**Causa**
Os **dois** vars faltando = `process.env` **vazio** = o código do handler está rodando no **cliente** (o browser não tem `process.env`), não no servidor. O compilador do TanStack Start só separa o handler do bundle do cliente quando enxerga **estaticamente** cada `createServerFn().handler()` no topo do módulo. Quando a server function é produzida por uma **factory** (`function fazer(){ return createServerFn()... }` chamada para gerar vários exports), a extração falha, o handler vai para o cliente e o `await import("*.server")` / `supabaseAdmin` executa no browser.

```ts
// ❌ ERRADO — factory: o compilador não extrai o handler
function fazerSync(tipo) {
  return createServerFn({ method: "POST" }).handler(async () => {
    /* usa supabaseAdmin */
  });
}
export const sincronizarA = fazerSync("a");
export const sincronizarB = fazerSync("b");
```

**Regra**
Defina **cada** `createServerFn(...).handler(...)` inline, no topo do módulo (padrão de `camara/ingest.functions.ts`). Fatore só o corpo em um helper comum e chame-o de dentro de cada handler:

```ts
// ✅ CERTO — cada server fn é estática; o corpo compartilhado é um helper
async function executar(tipo, userId, data) {
  /* usa supabaseAdmin via await import */
}
export const sincronizarA = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => executar("a", context.userId, data));
```

**Como verificar**
Depois do `bun run build`, nenhum chunk em `.output/public` deve conter o handler server-only (ex.: `grep -rl "sincronizarArquivoTse" .output/public` = vazio). O corolário do problema §3 vale aqui: a extração do handler é o que mantém `client.server` fora do cliente.

## 6. Contagem em HEAD falha com mensagem vazia

**Sintoma**
Um erro nosso termina em `: ` sem texto, como `conferência: contagem em siconfi_relatorios_cache: `.

**Causa**
`select(..., { count: "exact", head: true })` faz o supabase-js mandar HEAD. Resposta de HEAD não tem corpo, e o PostgREST põe o erro no corpo: o supabase-js entrega `{ message: "" }`. O código só aparece no cabeçalho `proxy-status` (ex.: `PostgREST; error=57014`), que o supabase-js não lê. O caso mais comum é o tempo-limite de 8 s do PostgREST (`57014: canceling statement due to statement timeout`) numa contagem exata que não usa índice e lê a tabela inteira.

**Regra**
Contagem que alimenta uma mensagem de erro vai em GET com `.limit(0)`, que traz o mesmo `count` e o erro no corpo. Escreva o erro com `textoDoErroDoBanco(error, status)` (`src/lib/data/erros-banco.ts`), que junta código, mensagem, detalhe e dica e, sem nada disso, deixa o status HTTP. Se a contagem estoura o tempo, o filtro precisa casar com um índice: lista (`in`) ou faixa (`gte`/`lte`) sobre as colunas indexadas. `like` com `_` ou `%` só usa índice btree com `text_pattern_ops`.

**Como verificar**
Reproduza em GET (`Prefer: count=exact`, `limit=0`) com o mesmo filtro: o corpo traz `code` e `message`, e o tempo total mostra se passou dos 8 s.
