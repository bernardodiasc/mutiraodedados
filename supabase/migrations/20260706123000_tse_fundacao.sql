-- Fonte TSE — fundação (ver docs/fontes/tse.md e plano de integração).
-- 6 tabelas cache + view de cruzamento + estado de varredura retomável.
-- Padrão de cache: SELECT público (dados oficiais), escrita só service_role.

-- 1) Candidatos (uma linha por candidatura: sq_candidato é único por eleição)
CREATE TABLE public.tse_candidatos_cache (
  sq_candidato text NOT NULL,
  ano_eleicao integer NOT NULL,
  nr_turno integer NOT NULL DEFAULT 1,
  cargo_cod integer,
  cargo_nome text,
  uf text,
  municipio_cod text,          -- SG_UE nas municipais (código TSE da unidade eleitoral)
  nome_completo text,
  nome_urna text,
  cpf text,                    -- público por lei; pode vir mascarado/sentinela da origem
  titulo_eleitoral text,
  partido_sigla text,
  partido_numero integer,
  numero_candidato text,
  situacao_candidatura text,
  situacao_totalizacao text,   -- DS_SIT_TOT_TURNO (Eleito, Não eleito, Suplente…)
  ocupacao text,
  grau_instrucao text,
  genero text,
  cor_raca text,
  bens_total_declarado numeric,  -- agregado de tse_bens_candidato_cache (preenchido no sync de bens)
  url_prestacao_contas text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (sq_candidato, ano_eleicao)
);

CREATE INDEX tse_candidatos_cpf_idx ON public.tse_candidatos_cache(cpf);
CREATE INDEX tse_candidatos_ano_uf_cargo_idx ON public.tse_candidatos_cache(ano_eleicao, uf, cargo_cod);
CREATE INDEX tse_candidatos_nome_urna_idx ON public.tse_candidatos_cache(nome_urna);

-- 2) Bens declarados
CREATE TABLE public.tse_bens_candidato_cache (
  sq_candidato text NOT NULL,
  ano_eleicao integer NOT NULL,
  ordem_bem integer NOT NULL,
  tipo_bem text,
  descricao text,
  valor numeric,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (sq_candidato, ano_eleicao, ordem_bem)
);

CREATE INDEX tse_bens_ano_idx ON public.tse_bens_candidato_cache(ano_eleicao);

-- 3) Receitas de campanha. id: SQ_RECEITA (2018+) ou hash determinístico (2014/2016).
CREATE TABLE public.tse_receitas_campanha_cache (
  id text PRIMARY KEY,
  sq_candidato text NOT NULL,
  ano_eleicao integer NOT NULL,
  cpf_cnpj_doador text,
  nome_doador text,
  tipo_doador text,            -- pf | pj | partido | proprio | fundo | outro
  cnpj_doador_originario text,
  valor numeric,
  data date,
  tipo_receita text,
  forma_recebimento text,
  uf text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX tse_receitas_candidato_idx ON public.tse_receitas_campanha_cache(sq_candidato, ano_eleicao);
CREATE INDEX tse_receitas_doador_idx ON public.tse_receitas_campanha_cache(cpf_cnpj_doador);
CREATE INDEX tse_receitas_ano_uf_idx ON public.tse_receitas_campanha_cache(ano_eleicao, uf);

-- 4) Despesas de campanha (contratadas). id: SQ_DESPESA (2018+) ou hash (2014/2016).
CREATE TABLE public.tse_despesas_campanha_cache (
  id text PRIMARY KEY,
  sq_candidato text NOT NULL,
  ano_eleicao integer NOT NULL,
  cnpj_fornecedor text,
  nome_fornecedor text,
  valor numeric,
  data date,
  tipo_despesa text,
  descricao text,
  uf text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX tse_despesas_candidato_idx ON public.tse_despesas_campanha_cache(sq_candidato, ano_eleicao);
CREATE INDEX tse_despesas_fornecedor_idx ON public.tse_despesas_campanha_cache(cnpj_fornecedor);
CREATE INDEX tse_despesas_ano_uf_idx ON public.tse_despesas_campanha_cache(ano_eleicao, uf);

-- 5) Resultados agregados por município (somamos as zonas no ingest)
CREATE TABLE public.tse_resultados_cache (
  sq_candidato text NOT NULL,
  ano_eleicao integer NOT NULL,
  nr_turno integer NOT NULL DEFAULT 1,
  uf text NOT NULL,
  municipio_cod text NOT NULL,   -- código TSE do município (não IBGE)
  municipio_nome text,
  votos_nominais bigint NOT NULL DEFAULT 0,
  votos_nominais_validos bigint NOT NULL DEFAULT 0,
  situacao_totalizacao text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (sq_candidato, ano_eleicao, nr_turno, municipio_cod)
);

CREATE INDEX tse_resultados_ano_uf_idx ON public.tse_resultados_cache(ano_eleicao, uf);

-- 6) Ponte parlamentar ↔ candidato (preenchida pelo matcher da Fase 2)
CREATE TABLE public.tse_parlamentar_candidato (
  parlamentar_tipo text NOT NULL CHECK (parlamentar_tipo IN ('deputado', 'senador')),
  parlamentar_id text NOT NULL,
  sq_candidato text NOT NULL,
  ano_eleicao integer NOT NULL,
  cpf text,
  match_metodo text NOT NULL CHECK (match_metodo IN ('cpf', 'nome_uf_partido')),
  match_confianca numeric NOT NULL DEFAULT 1 CHECK (match_confianca >= 0 AND match_confianca <= 1),
  revisado boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (parlamentar_tipo, parlamentar_id, sq_candidato, ano_eleicao)
);

CREATE INDEX tse_ponte_candidato_idx ON public.tse_parlamentar_candidato(sq_candidato, ano_eleicao);
CREATE INDEX tse_ponte_cpf_idx ON public.tse_parlamentar_candidato(cpf);
CREATE INDEX tse_ponte_confianca_idx ON public.tse_parlamentar_candidato(match_confianca) WHERE NOT revisado;

-- 7) Estado de varredura retomável do TSE (análogo a cgu_varredura; chave
--    composta `<arquivo>#<ano>#<uf>`, progresso em linhas processadas).
CREATE TABLE public.tse_varredura (
  chave text PRIMARY KEY,
  linhas_processadas bigint NOT NULL DEFAULT 0,
  importados bigint NOT NULL DEFAULT 0,
  completa boolean NOT NULL DEFAULT false,
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

-- 8) View do cruzamento doador ↔ fornecedor (lookup por CNPJ normalizado).
--    Junta fornecedores de contratos (cadastro extraído dos contratos CGU) com
--    doadores PJ de campanha. CPFs de PF vêm mascarados da origem e não cruzam.
CREATE VIEW public.v_fornecedor_doador AS
SELECT
  r.cpf_cnpj_doador AS cnpj,
  r.nome_doador,
  r.sq_candidato,
  r.ano_eleicao,
  r.valor AS valor_doado,
  r.data AS data_doacao,
  f.nome AS nome_fornecedor_contratos,
  f.cnpj AS cnpj_fornecedor_formatado
FROM public.tse_receitas_campanha_cache r
JOIN public.fornecedores_cache f
  ON regexp_replace(f.cnpj, '\D', '', 'g') = regexp_replace(r.cpf_cnpj_doador, '\D', '', 'g')
WHERE length(regexp_replace(r.cpf_cnpj_doador, '\D', '', 'g')) = 14;

-- GRANTs + RLS (padrão cache: leitura pública, escrita service_role)
GRANT SELECT ON public.tse_candidatos_cache, public.tse_bens_candidato_cache,
  public.tse_receitas_campanha_cache, public.tse_despesas_campanha_cache,
  public.tse_resultados_cache, public.tse_parlamentar_candidato TO anon, authenticated;
GRANT ALL ON public.tse_candidatos_cache, public.tse_bens_candidato_cache,
  public.tse_receitas_campanha_cache, public.tse_despesas_campanha_cache,
  public.tse_resultados_cache, public.tse_parlamentar_candidato, public.tse_varredura TO service_role;
GRANT SELECT ON public.v_fornecedor_doador TO anon, authenticated, service_role;

ALTER TABLE public.tse_candidatos_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tse_bens_candidato_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tse_receitas_campanha_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tse_despesas_campanha_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tse_resultados_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tse_parlamentar_candidato ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tse_varredura ENABLE ROW LEVEL SECURITY;

CREATE POLICY "leitura pública" ON public.tse_candidatos_cache FOR SELECT USING (true);
CREATE POLICY "leitura pública" ON public.tse_bens_candidato_cache FOR SELECT USING (true);
CREATE POLICY "leitura pública" ON public.tse_receitas_campanha_cache FOR SELECT USING (true);
CREATE POLICY "leitura pública" ON public.tse_despesas_campanha_cache FOR SELECT USING (true);
CREATE POLICY "leitura pública" ON public.tse_resultados_cache FOR SELECT USING (true);
CREATE POLICY "leitura pública" ON public.tse_parlamentar_candidato FOR SELECT USING (true);
-- tse_varredura: interna (service_role bypassa RLS; sem policy de leitura pública)

-- Agregado do hub /eleicoes: contagens por (ano, cargo). SECURITY DEFINER
-- (mesmo padrão dos agregados de cobertura), leitura pública.
CREATE FUNCTION public.tse_resumo_eleicoes()
RETURNS TABLE (
  ano_eleicao integer,
  cargo_cod integer,
  cargo_nome text,
  total bigint,
  eleitos bigint,
  ufs bigint
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    ano_eleicao,
    cargo_cod,
    MIN(cargo_nome) AS cargo_nome,
    COUNT(*)::bigint AS total,
    COUNT(*) FILTER (WHERE situacao_totalizacao ILIKE 'eleito%')::bigint AS eleitos,
    COUNT(DISTINCT uf)::bigint AS ufs
  FROM public.tse_candidatos_cache
  GROUP BY ano_eleicao, cargo_cod
  ORDER BY ano_eleicao DESC, total DESC
$$;

GRANT EXECUTE ON FUNCTION public.tse_resumo_eleicoes() TO anon, authenticated, service_role;

-- Panorama público de um partido: contagens por (ano, cargo) + eleitos + bens.
CREATE FUNCTION public.tse_resumo_partido(_sigla text)
RETURNS TABLE (
  ano_eleicao integer,
  cargo_nome text,
  total bigint,
  eleitos bigint,
  bens_medio numeric
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    ano_eleicao,
    MIN(cargo_nome) AS cargo_nome,
    COUNT(*)::bigint AS total,
    COUNT(*) FILTER (WHERE situacao_totalizacao ILIKE 'eleito%')::bigint AS eleitos,
    AVG(bens_total_declarado) FILTER (WHERE bens_total_declarado > 0) AS bens_medio
  FROM public.tse_candidatos_cache
  WHERE upper(partido_sigla) = upper(_sigla)
  GROUP BY ano_eleicao, cargo_cod
  ORDER BY ano_eleicao DESC, total DESC
$$;

GRANT EXECUTE ON FUNCTION public.tse_resumo_partido(text) TO anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- RPCs de sinais (Fase 3) — agregações que não cabem no Worker. Server-only
-- (service_role): os resultados viram findings via flagQA, nunca são expostos
-- crus ao público.
-- ---------------------------------------------------------------------------

-- Lacuna `eleito_sem_prestacao_contas`: eleitos sem NENHUMA receita E NENHUMA
-- despesa no cache (a confirmação via API acontece no runner antes de gravar).
CREATE FUNCTION public.tse_eleitos_sem_contas(_ano integer)
RETURNS TABLE (sq_candidato text, uf text, municipio_cod text, nome_urna text, cargo_nome text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.sq_candidato, c.uf, c.municipio_cod, c.nome_urna, c.cargo_nome
  FROM public.tse_candidatos_cache c
  WHERE c.ano_eleicao = _ano
    AND c.situacao_totalizacao ILIKE 'eleito%'
    AND NOT EXISTS (
      SELECT 1 FROM public.tse_receitas_campanha_cache r
      WHERE r.sq_candidato = c.sq_candidato AND r.ano_eleicao = _ano
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.tse_despesas_campanha_cache d
      WHERE d.sq_candidato = c.sq_candidato AND d.ano_eleicao = _ano
    )
$$;

REVOKE EXECUTE ON FUNCTION public.tse_eleitos_sem_contas(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tse_eleitos_sem_contas(integer) TO service_role;

-- Lacuna `candidato_sem_bens`: aptos sem nenhuma linha de bens no ano.
CREATE FUNCTION public.tse_candidatos_sem_bens(_ano integer)
RETURNS TABLE (sq_candidato text, uf text, nome_urna text, cargo_nome text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.sq_candidato, c.uf, c.nome_urna, c.cargo_nome
  FROM public.tse_candidatos_cache c
  WHERE c.ano_eleicao = _ano
    AND c.situacao_candidatura ILIKE 'apto%'
    AND NOT EXISTS (
      SELECT 1 FROM public.tse_bens_candidato_cache b
      WHERE b.sq_candidato = c.sq_candidato AND b.ano_eleicao = _ano
    )
$$;

REVOKE EXECUTE ON FUNCTION public.tse_candidatos_sem_bens(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tse_candidatos_sem_bens(integer) TO service_role;

-- Cobertura por (ano, UF) para a lacuna `serie_historica_incompleta`.
CREATE FUNCTION public.tse_contagem_ano_uf()
RETURNS TABLE (ano_eleicao integer, uf text, candidatos bigint)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ano_eleicao, uf, COUNT(*)::bigint
  FROM public.tse_candidatos_cache
  GROUP BY ano_eleicao, uf
$$;

REVOKE EXECUTE ON FUNCTION public.tse_contagem_ano_uf() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tse_contagem_ano_uf() TO service_role;

-- Sinal investigativo `evolucao_patrimonial_atipica`: mesmo CPF em duas
-- eleições consecutivas com bens_total multiplicado além do limiar.
CREATE FUNCTION public.tse_evolucao_patrimonial(_multiplo numeric, _minimo_final numeric)
RETURNS TABLE (
  cpf text,
  sq_anterior text,
  ano_anterior integer,
  bens_anterior numeric,
  sq_recente text,
  ano_recente integer,
  bens_recente numeric,
  nome_urna text,
  uf text
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT a.cpf,
         a.sq_candidato, a.ano_eleicao, a.bens_total_declarado,
         b.sq_candidato, b.ano_eleicao, b.bens_total_declarado,
         b.nome_urna, b.uf
  FROM public.tse_candidatos_cache a
  JOIN public.tse_candidatos_cache b
    ON b.cpf = a.cpf
   AND b.ano_eleicao > a.ano_eleicao
   AND b.ano_eleicao <= a.ano_eleicao + 4
  WHERE a.cpf IS NOT NULL AND length(a.cpf) = 11
    AND a.bens_total_declarado > 0
    AND b.bens_total_declarado >= _minimo_final
    AND b.bens_total_declarado >= a.bens_total_declarado * _multiplo
$$;

REVOKE EXECUTE ON FUNCTION public.tse_evolucao_patrimonial(numeric, numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tse_evolucao_patrimonial(numeric, numeric) TO service_role;

-- Sinal investigativo `fornecedor_campanha_concentrado`: fornecedor que
-- atende muitos candidatos do mesmo (partido, UF, ano) concentrando fração
-- alta do total gasto por esse grupo.
CREATE FUNCTION public.tse_fornecedor_concentrado(
  _ano integer,
  _min_candidatos integer,
  _fracao_minima numeric
)
RETURNS TABLE (
  cnpj_fornecedor text,
  nome_fornecedor text,
  partido_sigla text,
  uf text,
  candidatos bigint,
  total_fornecedor numeric,
  total_grupo numeric,
  fracao numeric
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  WITH despesas AS (
    SELECT d.cnpj_fornecedor,
           MIN(d.nome_fornecedor) AS nome_fornecedor,
           c.partido_sigla,
           c.uf,
           COUNT(DISTINCT d.sq_candidato) AS candidatos,
           SUM(d.valor) AS total_fornecedor
    FROM public.tse_despesas_campanha_cache d
    JOIN public.tse_candidatos_cache c
      ON c.sq_candidato = d.sq_candidato AND c.ano_eleicao = d.ano_eleicao
    WHERE d.ano_eleicao = _ano
      AND d.cnpj_fornecedor IS NOT NULL AND length(d.cnpj_fornecedor) = 14
    GROUP BY d.cnpj_fornecedor, c.partido_sigla, c.uf
  ),
  grupos AS (
    SELECT c.partido_sigla, c.uf, SUM(d.valor) AS total_grupo
    FROM public.tse_despesas_campanha_cache d
    JOIN public.tse_candidatos_cache c
      ON c.sq_candidato = d.sq_candidato AND c.ano_eleicao = d.ano_eleicao
    WHERE d.ano_eleicao = _ano
    GROUP BY c.partido_sigla, c.uf
  )
  SELECT de.cnpj_fornecedor, de.nome_fornecedor, de.partido_sigla, de.uf,
         de.candidatos, de.total_fornecedor, g.total_grupo,
         de.total_fornecedor / NULLIF(g.total_grupo, 0) AS fracao
  FROM despesas de
  JOIN grupos g ON g.partido_sigla = de.partido_sigla AND g.uf = de.uf
  WHERE de.candidatos >= _min_candidatos
    AND g.total_grupo > 0
    AND de.total_fornecedor / g.total_grupo >= _fracao_minima
  ORDER BY fracao DESC
$$;

REVOKE EXECUTE ON FUNCTION public.tse_fornecedor_concentrado(integer, integer, numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tse_fornecedor_concentrado(integer, integer, numeric) TO service_role;

-- Doações (≥ _minimo) de CNPJs que também são fornecedores de contratos,
-- restritas a candidaturas VINCULADAS a parlamentares (ponte) — base do sinal
-- `doador_virou_fornecedor`.
CREATE FUNCTION public.tse_doacoes_de_fornecedores(_minimo numeric)
RETURNS TABLE (
  cnpj text,
  cnpj_formatado text,
  nome_doador text,
  nome_fornecedor text,
  sq_candidato text,
  ano_eleicao integer,
  valor_doado numeric,
  data_doacao date,
  parlamentar_tipo text,
  parlamentar_id text,
  match_confianca numeric
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT v.cnpj, v.cnpj_fornecedor_formatado, v.nome_doador,
         v.nome_fornecedor_contratos, v.sq_candidato, v.ano_eleicao,
         v.valor_doado, v.data_doacao,
         p.parlamentar_tipo, p.parlamentar_id, p.match_confianca
  FROM public.v_fornecedor_doador v
  JOIN public.tse_parlamentar_candidato p
    ON p.sq_candidato = v.sq_candidato AND p.ano_eleicao = v.ano_eleicao
  WHERE v.valor_doado >= _minimo
$$;

REVOKE EXECUTE ON FUNCTION public.tse_doacoes_de_fornecedores(numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tse_doacoes_de_fornecedores(numeric) TO service_role;
