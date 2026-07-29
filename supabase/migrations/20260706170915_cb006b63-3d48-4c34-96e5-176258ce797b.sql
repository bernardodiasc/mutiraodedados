
-- 1) Security invoker on view
ALTER VIEW public.v_fornecedor_doador SET (security_invoker = on);

-- 2) Revoke EXECUTE on all SECURITY DEFINER functions from anon/authenticated
--    (all are called via service_role in server functions)
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig, p.proname
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef = true
      AND p.proname <> 'has_role'
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', r.sig);
  END LOOP;
END $$;

-- 3) Column-level revokes for internal notes
REVOKE SELECT (notas_internas) ON public.artigos FROM anon, authenticated;
REVOKE SELECT (notas_admin) ON public.qa_findings FROM anon, authenticated;

-- 4) Strengthen perguntas guard: lock status entirely for non-admins
CREATE OR REPLACE FUNCTION public.tg_perguntas_guard_publicacao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    NEW.visibilidade_publica := OLD.visibilidade_publica;
    NEW.moderador_id := OLD.moderador_id;
    NEW.revisada_em := OLD.revisada_em;
    NEW.publicada_em := OLD.publicada_em;
    NEW.slug := OLD.slug;
    -- Status só pode ser alterado por admins
    NEW.status := OLD.status;
  END IF;
  RETURN NEW;
END;
$fn$;
