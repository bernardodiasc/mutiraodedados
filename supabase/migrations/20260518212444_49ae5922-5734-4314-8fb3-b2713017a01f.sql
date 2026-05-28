
-- 1) Validation trigger on contestacoes to bound free-text fields
CREATE OR REPLACE FUNCTION public.tg_validate_contestacao()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.url_pagina IS NULL OR length(NEW.url_pagina) > 500 THEN
    RAISE EXCEPTION 'url_pagina inválida';
  END IF;
  IF NEW.descricao IS NULL OR length(NEW.descricao) < 10 OR length(NEW.descricao) > 4000 THEN
    RAISE EXCEPTION 'descricao deve ter entre 10 e 4000 caracteres';
  END IF;
  IF NEW.fundamento IS NOT NULL AND length(NEW.fundamento) > 4000 THEN
    RAISE EXCEPTION 'fundamento excede 4000 caracteres';
  END IF;
  IF NEW.contato IS NOT NULL AND length(NEW.contato) > 255 THEN
    RAISE EXCEPTION 'contato excede 255 caracteres';
  END IF;
  IF NEW.tipo NOT IN ('correcao_factual','dado_desatualizado','pii_exposicao','classificacao_inadequada','outro') THEN
    RAISE EXCEPTION 'tipo inválido';
  END IF;
  IF NEW.solicitante_tipo NOT IN ('cidadao','empresa','orgao','representante','anonimo') THEN
    RAISE EXCEPTION 'solicitante_tipo inválido';
  END IF;
  -- Normalize empties
  IF NEW.contato IS NOT NULL AND btrim(NEW.contato) = '' THEN NEW.contato := NULL; END IF;
  IF NEW.fundamento IS NOT NULL AND btrim(NEW.fundamento) = '' THEN NEW.fundamento := NULL; END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_contestacao ON public.contestacoes;
CREATE TRIGGER trg_validate_contestacao
BEFORE INSERT OR UPDATE ON public.contestacoes
FOR EACH ROW EXECUTE FUNCTION public.tg_validate_contestacao();

-- 2) Defence-in-depth: restrictive policies on user_roles so any future
--    permissive policy still has to satisfy has_role(admin) for writes.
CREATE POLICY "roles restrict insert to admin"
  ON public.user_roles
  AS RESTRICTIVE
  FOR INSERT
  TO public
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "roles restrict update to admin"
  ON public.user_roles
  AS RESTRICTIVE
  FOR UPDATE
  TO public
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "roles restrict delete to admin"
  ON public.user_roles
  AS RESTRICTIVE
  FOR DELETE
  TO public
  USING (public.has_role(auth.uid(), 'admin'::app_role));
