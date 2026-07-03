CREATE OR REPLACE FUNCTION public.cobertura_camara_proposicoes()
 RETURNS TABLE(ano integer, mes integer, qtd bigint, ultimo timestamp with time zone)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT ano, 1 AS mes, COUNT(*)::bigint, MAX(updated_at)
  FROM public.camara_proposicoes_cache GROUP BY ano
$function$;
REVOKE EXECUTE ON FUNCTION public.cobertura_camara_proposicoes() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cobertura_camara_proposicoes() TO service_role;

CREATE OR REPLACE FUNCTION public.cobertura_senado_materias()
 RETURNS TABLE(ano integer, mes integer, qtd bigint, ultimo timestamp with time zone)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT ano, 1 AS mes, COUNT(*)::bigint, MAX(updated_at)
  FROM public.senado_materias_cache GROUP BY ano
$function$;
REVOKE EXECUTE ON FUNCTION public.cobertura_senado_materias() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cobertura_senado_materias() TO service_role;

CREATE TABLE public.camara_deputado_legislaturas (
  deputado_id BIGINT NOT NULL,
  id_legislatura INTEGER NOT NULL,
  sigla_partido TEXT,
  sigla_uf TEXT,
  situacao TEXT,
  condicao_eleitoral TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (deputado_id, id_legislatura)
);
GRANT SELECT ON public.camara_deputado_legislaturas TO anon, authenticated;
GRANT ALL ON public.camara_deputado_legislaturas TO service_role;
ALTER TABLE public.camara_deputado_legislaturas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "camara_dep_leg select all" ON public.camara_deputado_legislaturas FOR SELECT USING (true);
CREATE POLICY "camara_dep_leg admin write" ON public.camara_deputado_legislaturas FOR ALL
  USING (has_role(auth.uid(),'admin'::app_role)) WITH CHECK (has_role(auth.uid(),'admin'::app_role));
CREATE INDEX idx_camara_dep_leg_dep ON public.camara_deputado_legislaturas(deputado_id);
CREATE INDEX idx_camara_dep_leg_leg ON public.camara_deputado_legislaturas(id_legislatura);

CREATE TABLE public.senado_senador_legislaturas (
  codigo_parlamentar BIGINT NOT NULL,
  legislatura INTEGER NOT NULL,
  sigla_partido TEXT,
  sigla_uf TEXT,
  participacao TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (codigo_parlamentar, legislatura)
);
GRANT SELECT ON public.senado_senador_legislaturas TO anon, authenticated;
GRANT ALL ON public.senado_senador_legislaturas TO service_role;
ALTER TABLE public.senado_senador_legislaturas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "senado_sen_leg select all" ON public.senado_senador_legislaturas FOR SELECT USING (true);
CREATE POLICY "senado_sen_leg admin write" ON public.senado_senador_legislaturas FOR ALL
  USING (has_role(auth.uid(),'admin'::app_role)) WITH CHECK (has_role(auth.uid(),'admin'::app_role));
CREATE INDEX idx_senado_sen_leg_sen ON public.senado_senador_legislaturas(codigo_parlamentar);
CREATE INDEX idx_senado_sen_leg_leg ON public.senado_senador_legislaturas(legislatura);