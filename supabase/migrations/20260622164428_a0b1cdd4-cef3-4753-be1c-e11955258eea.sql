
-- 1. Drop old perguntas table (only 2 test rows, no FKs)
DROP TABLE IF EXISTS public.perguntas CASCADE;
DROP TYPE IF EXISTS public.pergunta_estado;

-- 2. New enum for pergunta status
CREATE TYPE public.pergunta_status AS ENUM (
  'privada','em_revisao','publicada','arquivada','encerrada'
);

CREATE TYPE public.pergunta_item_tipo AS ENUM (
  'contrato','orgao','fornecedor','lacuna','finding','link','anotacao','convenio','parlamentar','votacao','anomalia'
);

-- 3. pergunta_modelos (curated by admin)
CREATE TABLE public.pergunta_modelos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo text NOT NULL CHECK (length(titulo) BETWEEN 5 AND 240),
  descricao text,
  contexto text,
  tags text[] NOT NULL DEFAULT '{}',
  ordem int NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.pergunta_modelos TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.pergunta_modelos TO authenticated;
GRANT ALL ON public.pergunta_modelos TO service_role;
ALTER TABLE public.pergunta_modelos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "modelos publicos ativos" ON public.pergunta_modelos
  FOR SELECT TO anon, authenticated USING (ativo OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "modelos admin escreve" ON public.pergunta_modelos
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER tg_pergunta_modelos_touch BEFORE UPDATE ON public.pergunta_modelos
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

-- 4. Seed modelos a partir das 4 ancoras hardcoded
INSERT INTO public.pergunta_modelos (titulo, descricao, contexto, ordem) VALUES
  ('Por que esta obra atrasou?', NULL,
   'Atrasos em obras públicas envolvem licitação, projeto, fiscalização e repasse. Raramente há uma causa única.', 10),
  ('Quem mede os resultados desta política?', NULL,
   'Muitas políticas têm meta declarada mas não têm indicador público que permita verificar se a meta foi alcançada.', 20),
  ('Por que os gastos aumentaram?', NULL,
   'Crescimento de despesa pode refletir nova política, reajuste de contratos, decisão judicial ou simples mudança contábil.', 30),
  ('Este programa está funcionando?', NULL,
   'Funcionar significa atingir o objetivo declarado. Sem avaliação pública, a resposta costuma ficar em aberto.', 40);

-- 5. perguntas: pasta de investigação do usuário
CREATE TABLE public.perguntas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  modelo_id uuid REFERENCES public.pergunta_modelos(id) ON DELETE SET NULL,
  titulo text NOT NULL CHECK (length(titulo) BETWEEN 5 AND 240),
  descricao text,
  contexto text,
  tags text[] NOT NULL DEFAULT '{}',
  status public.pergunta_status NOT NULL DEFAULT 'privada',
  visibilidade_publica boolean NOT NULL DEFAULT false,
  slug text UNIQUE,
  solicitada_publicacao_em timestamptz,
  publicada_em timestamptz,
  arquivada_em timestamptz,
  encerrada_em timestamptz,
  revisada_em timestamptz,
  moderador_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  motivo_rejeicao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX perguntas_user_status_idx ON public.perguntas(user_id, status);
CREATE INDEX perguntas_publica_idx ON public.perguntas(visibilidade_publica, publicada_em DESC) WHERE visibilidade_publica;

GRANT SELECT ON public.perguntas TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.perguntas TO authenticated;
GRANT ALL ON public.perguntas TO service_role;
ALTER TABLE public.perguntas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "perguntas autor le" ON public.perguntas
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin') OR visibilidade_publica);
CREATE POLICY "perguntas publicas anon" ON public.perguntas
  FOR SELECT TO anon USING (visibilidade_publica);
CREATE POLICY "perguntas autor escreve" ON public.perguntas
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "perguntas autor atualiza" ON public.perguntas
  FOR UPDATE TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "perguntas autor deleta" ON public.perguntas
  FOR DELETE TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

CREATE TRIGGER tg_perguntas_touch BEFORE UPDATE ON public.perguntas
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

-- 6. pergunta_itens
CREATE TABLE public.pergunta_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pergunta_id uuid NOT NULL REFERENCES public.perguntas(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tipo public.pergunta_item_tipo NOT NULL,
  ref_id text,
  titulo text NOT NULL,
  url text,
  nota text,
  ordem int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX pergunta_itens_pergunta_idx ON public.pergunta_itens(pergunta_id, ordem);
CREATE UNIQUE INDEX pergunta_itens_uniq ON public.pergunta_itens(pergunta_id, tipo, ref_id) WHERE ref_id IS NOT NULL;

GRANT SELECT ON public.pergunta_itens TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.pergunta_itens TO authenticated;
GRANT ALL ON public.pergunta_itens TO service_role;
ALTER TABLE public.pergunta_itens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "itens autor le" ON public.pergunta_itens
  FOR SELECT TO authenticated USING (
    user_id = auth.uid() OR public.has_role(auth.uid(),'admin')
    OR EXISTS (SELECT 1 FROM public.perguntas p WHERE p.id = pergunta_id AND p.visibilidade_publica)
  );
CREATE POLICY "itens publicos anon" ON public.pergunta_itens
  FOR SELECT TO anon USING (
    EXISTS (SELECT 1 FROM public.perguntas p WHERE p.id = pergunta_id AND p.visibilidade_publica)
  );
CREATE POLICY "itens autor escreve" ON public.pergunta_itens
  FOR ALL TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

-- 7. pergunta_seguidores
CREATE TABLE public.pergunta_seguidores (
  pergunta_id uuid NOT NULL REFERENCES public.perguntas(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (pergunta_id, user_id)
);
GRANT SELECT, INSERT, DELETE ON public.pergunta_seguidores TO authenticated;
GRANT ALL ON public.pergunta_seguidores TO service_role;
ALTER TABLE public.pergunta_seguidores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "seguidor le proprio" ON public.pergunta_seguidores
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "seguidor escreve proprio" ON public.pergunta_seguidores
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "seguidor remove proprio" ON public.pergunta_seguidores
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- 8. Optional pergunta_id em itens_salvos e anotacoes (anotacoes ja tem)
ALTER TABLE public.itens_salvos ADD COLUMN IF NOT EXISTS pergunta_id uuid REFERENCES public.perguntas(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS itens_salvos_pergunta_idx ON public.itens_salvos(pergunta_id) WHERE pergunta_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS anotacoes_pergunta_idx ON public.anotacoes(pergunta_id) WHERE pergunta_id IS NOT NULL;

-- 9. Trigger: lacuna automatica a partir de finding critico+confirmado
CREATE OR REPLACE FUNCTION public.tg_lacuna_de_finding()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.severidade = 'critico' AND NEW.status = 'confirmado' THEN
    IF NOT EXISTS (SELECT 1 FROM public.lacunas WHERE origem_qa_finding_id = NEW.id) THEN
      INSERT INTO public.lacunas (
        titulo, descricao, tipo, ciclo, entidade_tipo, entidade_id,
        origem_qa_finding_id, tags, publicada
      ) VALUES (
        'Lacuna detectada: ' || NEW.regra,
        'Achado crítico confirmado em ' || NEW.fonte || ': regra "' || NEW.regra || '". Detalhes em /qualidade/' || NEW.id::text || '.',
        'transparencia',
        'qualificada',
        NEW.entidade_tipo,
        NEW.entidade_id,
        NEW.id,
        ARRAY[NEW.fonte],
        true
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tg_qa_findings_lacuna ON public.qa_findings;
CREATE TRIGGER tg_qa_findings_lacuna
  AFTER INSERT OR UPDATE OF status, severidade ON public.qa_findings
  FOR EACH ROW EXECUTE FUNCTION public.tg_lacuna_de_finding();
