# Migrations + RLS + roles

## Onde vive cada migration

Desde 2026-09-25 o Lovable aplica migrations pelo **drizzle-kit**: `drizzle.config.ts` aponta para `drizzle/migrations/` e a conexão vem de `LOVABLE_DB_MIGRATION_URL`, variável do ambiente do Lovable (nunca no repositório).

| Pasta                  | Papel                                                                     |
| ---------------------- | ------------------------------------------------------------------------- |
| `drizzle/migrations/`  | **Fonte da verdade daqui para frente.** Toda migration nova nasce aqui.   |
| `supabase/migrations/` | Histórico congelado. Não recebe arquivos novos; nenhum arquivo é editado. |

Como o drizzle-kit decide o que aplicar: cada arquivo `NNNN_<slug>.sql` tem uma entrada em `drizzle/migrations/meta/_journal.json` (com o instante `when`), e o banco registra as já aplicadas na tabela `drizzle.__drizzle_migrations`. Na próxima rodada, só entram as entradas do journal mais novas que a última registrada. Arquivo `.sql` sem entrada no journal **não é aplicado**.

Se o Lovable ainda lê `supabase/migrations/`, o repositório não mostra — e não há documentação pública do Lovable sobre o modo drizzle. O que o histórico mostra: as migrations de 2026-08-20 a partir de `20260820150000` ficaram um mês ali sem serem aplicadas, e só entraram no banco quando o Lovable as copiou para `drizzle/`. Trate a pasta como não lida.

Regras que decorrem disso:

- **Migration nova nasce no PR**, junto com o código que a usa, pelo fluxo da seção seguinte. Não renumere nem edite as existentes.
- **Imutável também aqui**: editar um arquivo já aplicado não o reaplica (o registro no banco não muda) e deixa o repositório descrevendo um banco que não existe.
- **SQL idempotente é obrigatório** (`IF NOT EXISTS`, `CREATE OR REPLACE`, `DROP ... IF EXISTS` antes de `CREATE POLICY`/`CREATE TRIGGER`, bloco `DO` que confere o catálogo antes de `ADD CONSTRAINT`): uma migration aplicada à mão sem o registro, ou reaplicada pelo drizzle-kit, roda duas vezes. Na transição, `0000` já estava aplicada e rodou outra vez — só não quebrou porque usava `IF NOT EXISTS`.
- `drizzle/schema.ts` fica vazio de propósito: o esquema é descrito pelo SQL, não por modelos Drizzle. Os tipos ficam em `src/integrations/supabase/types.ts`: o PR os atualiza à mão (o Lovable os regenera a partir do banco quando mexe no projeto).

## Fluxo de uma migration

A migration nasce no PR e o mantenedor a aplica à mão, **registrando-a na mesma transação** em `drizzle.__drizzle_migrations` — exatamente o que o drizzle-kit faria. O Lovable não participa: pedir a ele a cada mudança seria um gargalo (os pedidos são poucos por dia) e as alterações dele passam por fora do fluxo de PR.

Por que o registro evita duplicação: o drizzle-kit lê só a **última** linha de `drizzle.__drizzle_migrations` (por `created_at`) e aplica toda entrada do journal com `when` maior; o `hash` é gravado mas não comparado. Sem o registro, uma migration aplicada à mão continua "pendente", e a ferramenta do Lovable a recria com outro número — foi assim que surgiu `0007`, cópia de `0006`.

1. **No PR (agente ou pessoa).** `bunx drizzle-kit generate --custom --name <slug>` cria o `.sql` vazio, a entrada do journal e o snapshot em `meta/`; escreva o SQL no `.sql`. Atualize à mão `src/integrations/supabase/types.ts` com o que a migration cria. No corpo do PR, uma seção **Migration** com o bloco pronto para colar e a consulta que confere o resultado:

   ```sql
   BEGIN;
   -- conteúdo integral de drizzle/migrations/NNNN_<slug>.sql
   INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
   VALUES ('<sha256 do arquivo>', <when da entrada no _journal.json>);
   COMMIT;
   ```

   O hash é `shasum -a 256 drizzle/migrations/NNNN_<slug>.sql` sobre o arquivo final, como está no commit (o drizzle-kit calcula sobre o conteúdo inteiro, com os `--> statement-breakpoint`); o `when` é o da entrada `NNNN_<slug>` em `meta/_journal.json`. Se o `.sql` mudar durante a revisão, o bloco é recalculado.

2. **Depois do merge, antes de publicar (mantenedor).** Colar o bloco no SQL editor do Lovable (More → Cloud → SQL editor) e rodar a consulta de conferência do PR. Código que depende da migration só funciona depois deste passo.
3. **Conferir o registro:**

   ```sql
   SELECT id, hash, created_at FROM drizzle.__drizzle_migrations ORDER BY created_at DESC LIMIT 5;
   ```

   O número de linhas da tabela deve igualar o número de entradas em `drizzle/migrations/meta/_journal.json`. Fechar uma release exige as duas iguais.

O SQL continua **idempotente** mesmo assim: se o registro ficar para trás, ou se alguém rodar o drizzle-kit, a migration roda de novo sem quebrar.

### A transição de 2026-09-25

As migrations de agosto que ainda não estavam aplicadas em produção foram copiadas para `drizzle/migrations/0000–0003`; `0004` e `0005` nasceram direto em `drizzle/`. Estas são as únicas migrations presentes nas duas pastas:

| `drizzle/migrations/`                | Original em `supabase/migrations/`         | Observação                                                                                                                      |
| ------------------------------------ | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| `0000_importacoes_resultado`         | `20260820020000_importacoes_resultado`     | Já estava aplicada (a coluna aparece nos tipos citados abaixo); por usar `IF NOT EXISTS`, a cópia não deve ter alterado nada.   |
| `0001_convenios_cache_unificada`     | `20260820150000_convenios_cache_unificada` | **Diverge**: em vez de `DROP TABLE`, marca as tabelas antigas de convênios como `DEPRECATED`; uma migration posterior as apaga. |
| `0002_convenios_origem`              | `20260820170000_convenios_origem`          | Igual (sem comentários).                                                                                                        |
| `0003_automacao`                     | `20260820190000_automacao`                 | Igual (sem comentários).                                                                                                        |
| `0004_tse_ocultar_cpf_publico`       | —                                          | Só em `drizzle/`.                                                                                                               |
| `0005_profiles_leitura_autenticados` | —                                          | Só em `drizzle/`.                                                                                                               |

`20260819120000_importacao_varredura` e `20260820120000_ibge_municipios_cache` já estavam aplicadas antes da transição (as tabelas aparecem nos tipos que o Lovable regenerou a partir do banco antes de rodar o drizzle) e por isso não foram copiadas. Os originais de `0000–0003` ficam em `supabase/migrations/` por serem histórico, e o comentário explicativo de cada um vale para a cópia — menos o trecho do original de `0001` sobre apagar as tabelas antigas.

### Banco novo (self-host)

As duas pastas não podem ser aplicadas em sequência cega: `0000–0003` repetem migrations que já estão em `supabase/migrations/`, e `0001` recria políticas que já existiriam. Para montar um banco do zero:

1. `supabase db push` — aplica todo `supabase/migrations/` (inclui os originais de `0000–0003`; aqui as tabelas antigas de convênios são apagadas, o que não afeta o app).
2. Aplique à mão, em ordem, os arquivos de `drizzle/migrations/` **a partir de `0004`** (ex.: `psql "$DATABASE_URL" -f drizzle/migrations/0004_tse_ocultar_cpf_publico.sql`).

## Template de tabela de usuário

```sql
CREATE TABLE public.minha_tabela (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  titulo text NOT NULL CHECK (length(titulo) BETWEEN 1 AND 300),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX minha_tabela_user_id_idx ON public.minha_tabela(user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.minha_tabela TO authenticated;
GRANT ALL ON public.minha_tabela TO service_role;
-- NÃO conceder TO anon — dados privados do usuário.

ALTER TABLE public.minha_tabela ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dono lê" ON public.minha_tabela
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "dono insere" ON public.minha_tabela
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "dono atualiza" ON public.minha_tabela
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "dono apaga" ON public.minha_tabela
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE TRIGGER minha_tabela_touch_updated_at
  BEFORE UPDATE ON public.minha_tabela
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();
```

## Tabela pública read-only

Para dados editorialmente curados (`afirmacoes`, `lacunas` publicadas, etc.):

```sql
GRANT SELECT ON public.tabela_publica TO anon;
GRANT SELECT ON public.tabela_publica TO authenticated;

CREATE POLICY "leitura pública" ON public.tabela_publica
  FOR SELECT TO anon, authenticated USING (publica = true);

-- Escrita apenas admin
CREATE POLICY "admin escreve" ON public.tabela_publica
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
```

## Roles — nunca em `profiles`

Sempre via `user_roles` + `has_role`:

```sql
SELECT public.has_role(auth.uid(), 'admin'::app_role);
```

`has_role` é `SECURITY DEFINER`, `STABLE`, `SET search_path = public` — não recrie. Apenas use.

## Funções SQL novas

Toda função SQL nova:

- declara `SET search_path = public`
- declara `STABLE` ou `IMMUTABLE` quando aplicável
- usa `SECURITY DEFINER` apenas quando precisa atravessar RLS de forma controlada (e nunca recebe o user_id como argumento confiável vindo do cliente — sempre `auth.uid()`).

## Anti-exemplos

- ❌ `CREATE TABLE` sem `GRANT` → app vê erro `permission denied for table`.
- ❌ `RLS enable` sem nenhuma policy → tabela "trancada" (nenhuma linha retornada).
- ❌ `user_id uuid` nullable → permite escrita sem dono, viola RLS na inserção.
- ❌ `role text` em `profiles` → privilege escalation. Use `user_roles` + `has_role`.
- ❌ `CREATE POLICY ... USING (true)` para tabela com dados de usuário → vaza tudo.
- ❌ Tocar em `auth.*`, `storage.*`, `realtime.*`, `vault.*`, `supabase_functions.*`.
- ❌ Trigger em tabelas do schema `auth`.
- ❌ Mexer em `supabase/config.toml` (auto-gerado).
