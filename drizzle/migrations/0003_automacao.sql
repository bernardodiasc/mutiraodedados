-- lovable-cron-fallback-reviewed: tique de 5 min é o requisito da v0.11.0; o job é dormente (no-op) até automacao_config ter linha ativa com URL e segredo, então não gera trabalho real enquanto não configurado.
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE TABLE IF NOT EXISTS public.automacao_tarefas (
  id                text PRIMARY KEY,
  ativo             boolean NOT NULL DEFAULT true,
  prioridade        integer NOT NULL DEFAULT 100,
  params            jsonb NOT NULL DEFAULT '{}'::jsonb,
  executando_desde  timestamptz,
  ultima_execucao   timestamptz,
  ultimo_resultado  text
);

GRANT ALL ON public.automacao_tarefas TO service_role;
ALTER TABLE public.automacao_tarefas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "automacao_tarefas admin le" ON public.automacao_tarefas
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.automacao_tarefas (id, prioridade, params) VALUES
  ('pncp',             10, '{}'),
  ('convenios',        20, '{}'),
  ('camara_ceap',      30, '{}'),
  ('senado_ceaps',     40, '{}'),
  ('camara_vot',       50, '{}'),
  ('senado_vot',       60, '{}'),
  ('senado_mat',       70, '{"sigla": "PL"}'),
  ('camara_props',     80, '{"siglaTipo": "PL"}'),
  ('convenios_origem', 90, '{}'),
  ('ibge',            100, '{}')
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.automacao_config (
  id          boolean PRIMARY KEY DEFAULT true CHECK (id),
  url         text NOT NULL,
  segredo     text NOT NULL,
  ativo       boolean NOT NULL DEFAULT true,
  updated_at  timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.automacao_config TO service_role;
ALTER TABLE public.automacao_config ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.automacao_reivindicar_tarefa()
 RETURNS SETOF public.automacao_tarefas
 LANGUAGE sql SECURITY DEFINER SET search_path TO 'public'
AS $function$
  UPDATE public.automacao_tarefas t
  SET executando_desde = now()
  WHERE t.id = (
    SELECT id FROM public.automacao_tarefas
    WHERE ativo
      AND (executando_desde IS NULL OR executando_desde < now() - interval '15 minutes')
    ORDER BY ultima_execucao ASC NULLS FIRST, prioridade ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED
  )
  RETURNING t.*;
$function$;
REVOKE ALL ON FUNCTION public.automacao_reivindicar_tarefa() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.automacao_reivindicar_tarefa() TO service_role;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'mutirao-automacao') THEN
    PERFORM cron.unschedule('mutirao-automacao');
  END IF;
  PERFORM cron.schedule(
    'mutirao-automacao',
    '*/5 * * * *',
    $job$
      SELECT net.http_post(
        url     := c.url || '/api/cron-importar',
        headers := jsonb_build_object('x-cron-secret', c.segredo, 'Content-Type', 'application/json'),
        body    := '{}'::jsonb
      )
      FROM public.automacao_config c
      WHERE c.ativo
    $job$
  );
END
$$;