
-- Tabela de lacunas (informação que falta)
CREATE TYPE public.lacuna_tipo AS ENUM ('transparencia','avaliacao','mensuracao','documental','institucional','metodologica');
CREATE TYPE public.lacuna_ciclo AS ENUM ('nasce','qualificada','evolui','conecta','encerra');

CREATE TABLE public.lacunas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo text NOT NULL,
  descricao text NOT NULL,
  tipo public.lacuna_tipo NOT NULL,
  ciclo public.lacuna_ciclo NOT NULL DEFAULT 'nasce',
  entidade_tipo text,
  entidade_id text,
  origem_qa_finding_id uuid REFERENCES public.qa_findings(id) ON DELETE SET NULL,
  tags text[] NOT NULL DEFAULT '{}',
  publicada boolean NOT NULL DEFAULT true,
  criada_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  resolvida_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.lacunas TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lacunas TO authenticated;
GRANT ALL ON public.lacunas TO service_role;

ALTER TABLE public.lacunas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lacunas publicadas são públicas"
  ON public.lacunas FOR SELECT
  USING (publicada = true);

CREATE POLICY "Admins podem ver todas as lacunas"
  ON public.lacunas FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins podem criar lacunas"
  ON public.lacunas FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins podem editar lacunas"
  ON public.lacunas FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins podem excluir lacunas"
  ON public.lacunas FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_lacunas_touch
  BEFORE UPDATE ON public.lacunas
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

CREATE INDEX idx_lacunas_tipo ON public.lacunas(tipo);
CREATE INDEX idx_lacunas_ciclo ON public.lacunas(ciclo);
CREATE INDEX idx_lacunas_entidade ON public.lacunas(entidade_tipo, entidade_id);
