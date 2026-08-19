-- Estado de varredura retomável, genérico por fonte.
--
-- A `cgu_varredura` e a `tse_varredura` resolvem o mesmo problema cada uma com
-- o seu formato. Esta tabela é o formato do runner genérico
-- (`src/lib/data/runner.ts`): qualquer fonte que precise de orçamento,
-- checkpoint e retomada grava aqui, sem tabela nova a cada vez.
--
-- A chave é composta e definida por quem usa — a CEAP da Câmara, por exemplo,
-- usa `camara_ceap#<ano>#<mes>` e guarda em `cursor` o índice do último
-- parlamentar processado naquele mês.
CREATE TABLE IF NOT EXISTS public.importacao_varredura (
  chave         text PRIMARY KEY,
  cursor        integer NOT NULL DEFAULT 0,
  total         integer NOT NULL DEFAULT 0,
  completa      boolean NOT NULL DEFAULT false,
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.importacao_varredura TO service_role;
ALTER TABLE public.importacao_varredura ENABLE ROW LEVEL SECURITY;

-- Mesma regra das demais tabelas de varredura: só admin lê. As escritas são
-- do servidor via service_role, que ignora RLS. Sem política de escrita para
-- anon/authenticated.
CREATE POLICY "importacao_varredura admin le" ON public.importacao_varredura
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
