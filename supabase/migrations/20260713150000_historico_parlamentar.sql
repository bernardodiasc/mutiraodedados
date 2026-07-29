-- Histórico de trajetória parlamentar: entradas/saídas, afastamentos e suplência.
-- Alimentadas pelos ingests a partir de /deputados/{id}/historico (Câmara) e
-- /senador/{cod}/mandatos (Senado). Lidas só via service_role (server fns);
-- RLS habilitado sem policy pública (a role de serviço ignora RLS).
-- Datas guardadas como texto ISO (times de Brasília, sem timezone) para exibir
-- sem deslocamento e ordenar lexicograficamente.

-- ── Câmara: linha do tempo de status do deputado ─────────────────────────────
CREATE TABLE IF NOT EXISTS public.camara_deputado_eventos (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  deputado_id integer NOT NULL,
  id_legislatura integer,
  data_hora text,
  situacao text,
  condicao_eleitoral text,
  sigla_partido text,
  sigla_uf text,
  descricao text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS camara_deputado_eventos_dep_idx ON public.camara_deputado_eventos(deputado_id);
CREATE INDEX IF NOT EXISTS camara_deputado_eventos_leg_idx ON public.camara_deputado_eventos(id_legislatura);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.camara_deputado_eventos TO service_role;
ALTER TABLE public.camara_deputado_eventos ENABLE ROW LEVEL SECURITY;

-- ── Senado: períodos em exercício e afastamentos ─────────────────────────────
CREATE TABLE IF NOT EXISTS public.senado_exercicios (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  codigo_parlamentar integer NOT NULL,
  data_inicio text,
  data_fim text,
  sigla_causa text,
  descricao_causa text,
  participacao text,
  uf text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS senado_exercicios_cod_idx ON public.senado_exercicios(codigo_parlamentar);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.senado_exercicios TO service_role;
ALTER TABLE public.senado_exercicios ENABLE ROW LEVEL SECURITY;

-- ── Senado: cadeia de suplência (titular → 1º/2º suplente) ───────────────────
CREATE TABLE IF NOT EXISTS public.senado_suplencia (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  titular_codigo integer NOT NULL,
  legislatura integer,
  ordem text,
  suplente_codigo integer,
  suplente_nome text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS senado_suplencia_titular_idx ON public.senado_suplencia(titular_codigo);
CREATE INDEX IF NOT EXISTS senado_suplencia_suplente_idx ON public.senado_suplencia(suplente_codigo);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.senado_suplencia TO service_role;
ALTER TABLE public.senado_suplencia ENABLE ROW LEVEL SECURITY;
