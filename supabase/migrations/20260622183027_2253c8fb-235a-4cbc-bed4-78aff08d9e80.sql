
-- Revoke column-level access to internal notes
REVOKE SELECT (notas_internas) ON public.artigos FROM anon, authenticated;
REVOKE SELECT (notas_admin) ON public.qa_findings FROM anon, authenticated;

-- Trigger to prevent non-admins from self-publishing perguntas
CREATE OR REPLACE FUNCTION public.tg_perguntas_guard_publicacao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    NEW.visibilidade_publica := OLD.visibilidade_publica;
    NEW.moderador_id := OLD.moderador_id;
    NEW.revisada_em := OLD.revisada_em;
    NEW.publicada_em := OLD.publicada_em;
    NEW.slug := OLD.slug;
    IF NEW.status = 'publicada' AND OLD.status <> 'publicada' THEN
      NEW.status := OLD.status;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS perguntas_guard_publicacao ON public.perguntas;
CREATE TRIGGER perguntas_guard_publicacao
  BEFORE UPDATE ON public.perguntas
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_perguntas_guard_publicacao();
