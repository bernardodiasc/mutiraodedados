# Server functions — padrões e variantes

## 1. Função autenticada (caso default)

```ts
// src/lib/perguntas.functions.ts
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const criarSchema = z.object({
  texto: z.string().trim().min(5).max(500),
  contexto: z.string().trim().max(4000).optional().nullable(),
});

export const criarPergunta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => criarSchema.parse(data))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("perguntas")
      .insert({ autor_id: userId, texto: data.texto, contexto: data.contexto ?? null })
      .select("id, texto, contexto, created_at")
      .single();
    if (error) {
      console.error("[criarPergunta] erro", error);
      throw new Error(`Falha ao salvar pergunta: ${error.message}`);
    }
    return row;
  });
```

## 2. Função pública read-only (SSR-safe)

Usa cliente publishable, **não** o admin. Tabela exige policy `TO anon` enxuta.

```ts
import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export const listarLacunasPublicas = createServerFn({ method: "GET" }).handler(async () => {
  const supabase = createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false, storage: undefined } },
  );
  const { data, error } = await supabase
    .from("lacunas")
    .select("id, tipo, titulo, descricao, ciclo, resolvida_em")
    .eq("publica", true)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
});
```

## 3. Função admin (raro)

```ts
export const promover = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Apenas admin.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // ... operação privilegiada
  });
```

## 4. Webhook / endpoint público

Ainda não existe nenhum no projeto (não há `src/routes/api/`). Quando for necessário, o padrão é uma server route file-based em `src/routes/api/<nome>.ts` com verificação de assinatura/segredo no handler — nunca um endpoint aberto.

## Anti-exemplos

- ❌ `createServerFn` sem `requireSupabaseAuth` para uma operação que mexe em dados do usuário. É endpoint público no deploy.
- ❌ `import { supabaseAdmin } from "@/integrations/supabase/client.server"` no topo de `*.functions.ts` → vaza para o bundle do cliente. Use `await import(...)` dentro do handler.
- ❌ `process.env.X` no escopo do módulo. Leia dentro de `.handler()`.
- ❌ `loader` de rota pública chamando fn com `requireSupabaseAuth`. Build prerender 401. Mova para componente + `useQuery` ou ponha rota sob `_authenticated/`.
- ❌ Edge Function do Supabase para lógica interna. Use `createServerFn`.
- ❌ Mensagem de erro com `error.code` cru. Embrulhe em mensagem cidadã: `throw new Error("Falha ao salvar pergunta: ...")`.

## Convocação no cliente

```ts
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { criarPergunta } from "@/lib/perguntas.functions";

const criar = useServerFn(criarPergunta);
const m = useMutation({ mutationFn: (texto: string) => criar({ data: { texto } }) });
```

O token bearer é anexado automaticamente pelo `attachSupabaseAuth` (já registrado in `src/start.ts`). Nunca anexe header `Authorization` manualmente.
