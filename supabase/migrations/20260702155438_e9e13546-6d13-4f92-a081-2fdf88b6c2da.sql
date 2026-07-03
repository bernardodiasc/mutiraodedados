-- Kit de investigação: prompts curados para a IA do próprio usuário, vinculados
-- N:N aos mapas investigativos (artigos com categoria 'mapa').

CREATE TABLE public.prompt_modelos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo text NOT NULL CHECK (length(titulo) BETWEEN 5 AND 240),
  descricao text,
  prompt_template text NOT NULL CHECK (length(prompt_template) BETWEEN 10 AND 8000),
  variaveis text[] NOT NULL DEFAULT '{}',
  tags text[] NOT NULL DEFAULT '{}',
  ordem int NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.prompt_modelos TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.prompt_modelos TO authenticated;
GRANT ALL ON public.prompt_modelos TO service_role;
ALTER TABLE public.prompt_modelos ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.mapa_prompts (
  artigo_id uuid NOT NULL REFERENCES public.artigos(id) ON DELETE CASCADE,
  prompt_modelo_id uuid NOT NULL REFERENCES public.prompt_modelos(id) ON DELETE CASCADE,
  ordem int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (artigo_id, prompt_modelo_id)
);
CREATE INDEX mapa_prompts_artigo_idx ON public.mapa_prompts(artigo_id, ordem);

GRANT SELECT ON public.mapa_prompts TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.mapa_prompts TO authenticated;
GRANT ALL ON public.mapa_prompts TO service_role;
ALTER TABLE public.mapa_prompts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "prompts publicos de mapa publico" ON public.prompt_modelos
  FOR SELECT TO anon, authenticated USING (
    (ativo AND EXISTS (
      SELECT 1 FROM public.mapa_prompts mp
      JOIN public.artigos a ON a.id = mp.artigo_id
      WHERE mp.prompt_modelo_id = prompt_modelos.id AND a.publico
    ))
    OR public.has_role(auth.uid(), 'admin')
  );
CREATE POLICY "prompts admin escreve" ON public.prompt_modelos
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "vinculos de mapa publico" ON public.mapa_prompts
  FOR SELECT TO anon, authenticated USING (
    EXISTS (SELECT 1 FROM public.artigos a WHERE a.id = artigo_id AND a.publico)
    OR public.has_role(auth.uid(), 'admin')
  );
CREATE POLICY "vinculos admin escreve" ON public.mapa_prompts
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER tg_prompt_modelos_touch BEFORE UPDATE ON public.prompt_modelos
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

ALTER TYPE public.pergunta_item_tipo ADD VALUE IF NOT EXISTS 'prompt';

WITH mapa AS (
  SELECT id FROM public.artigos WHERE slug = 'auditar-cota-parlamentar'
), ins AS (
  INSERT INTO public.prompt_modelos (titulo, descricao, prompt_template, variaveis, tags, ordem)
  VALUES
  (
    'Concentração de gastos num fornecedor',
    'Agrupa as despesas por CNPJ e mede quanto do total foi para poucos fornecedores.',
    E'Você vai analisar despesas de cota parlamentar (CEAP/CEAPS) de {{parlamentar}} no período {{periodo}}. Os dados abaixo vieram do CSV exportado da página do parlamentar (fonte: Câmara/Senado).\n\nTarefas:\n1. Agrupe as despesas por fornecedor (CNPJ) e calcule o total e o % de cada um sobre o total geral.\n2. Liste os 10 maiores fornecedores com nome, CNPJ, total e %.\n3. Destaque fornecedores que concentram mais de {{limite_pct}}% do total, com atenção especial a divulgação de atividade parlamentar, combustíveis e locação de veículos.\n4. Para cada destaque, diga que dado adicional eu deveria colher para entender melhor (ex.: dados cadastrais do CNPJ).\n\nImportante: reembolso aprovado NÃO é irregularidade. Concentração é um sinal para investigar, não uma acusação. Aponte também hipóteses alternativas legítimas.\n\nDados (CSV):\n{{cole_o_csv}}',
    ARRAY['parlamentar','periodo','limite_pct','cole_o_csv'],
    ARRAY['ceap','ceaps','fornecedor'],
    10
  ),
  (
    'Gastos atípicos e teto mensal',
    'Monta a série mensal e aponta picos acima da média ou perto do teto da cota.',
    E'Você vai analisar a série mensal de despesas de cota parlamentar de {{parlamentar}} em {{ano}}. O teto mensal da cota é {{teto_mensal}}.\n\nTarefas:\n1. Some as despesas por mês e monte a série de janeiro a dezembro.\n2. Calcule a média mensal e aponte meses com gasto 50% ou mais acima da média.\n3. Aponte meses em que o gasto chegou perto do teto (90% ou mais) e o que puxou o valor (tipo de despesa e fornecedor).\n4. Verifique saltos bruscos de um mês para o outro e liste os lançamentos que explicam cada salto.\n\nImportante: gastar até o teto é permitido; pico de gasto não é irregularidade — é um convite para ler os lançamentos daquele mês. Considere explicações plausíveis (recesso, período eleitoral, campanha de divulgação).\n\nDados (CSV):\n{{cole_o_csv}}',
    ARRAY['parlamentar','ano','teto_mensal','cole_o_csv'],
    ARRAY['ceap','ceaps','serie-mensal'],
    20
  ),
  (
    'Comparação com os pares',
    'Posiciona o parlamentar em relação à mediana do partido ou do estado.',
    E'Você vai comparar as despesas de cota parlamentar de {{parlamentar}} com as de outros parlamentares do mesmo {{recorte}} (partido ou estado).\n\nTarefas:\n1. Calcule o total e a composição por tipo de despesa de cada parlamentar nos dois conjuntos de dados abaixo.\n2. Posicione {{parlamentar}} em relação à mediana do grupo: total gasto, gasto por tipo e número de fornecedores distintos.\n3. Aponte em que categorias {{parlamentar}} destoa dos pares (para cima ou para baixo) e por quanto.\n4. Sugira que recortes adicionais valeria a pena comparar.\n\nImportante: estar acima da mediana não é irregularidade — mandatos têm perfis diferentes (representar um estado distante significa mais passagens aéreas, por exemplo). Considere essas explicações antes de apontar um desvio.\n\nDados do parlamentar (CSV A):\n{{cole_csv_A}}\n\nDados dos pares (CSV B):\n{{cole_csv_B}}',
    ARRAY['parlamentar','recorte','cole_csv_A','cole_csv_B'],
    ARRAY['ceap','ceaps','comparacao'],
    30
  ),
  (
    'Raio-x de fornecedor suspeito',
    'Cruza CNAE, endereço e data de abertura do CNPJ com o serviço prestado ao parlamentar.',
    E'Você vai fazer o raio-x de um fornecedor que apareceu com destaque nas despesas de cota parlamentar. Abaixo estão os dados cadastrais e de recebimentos que colhi na página do fornecedor (CNPJ) e em fontes oficiais.\n\nTarefas:\n1. Compare o CNAE (atividade declarada) com o serviço prestado ao parlamentar: são compatíveis?\n2. Analise a data de abertura da empresa: ela foi criada pouco antes de começar a receber da cota?\n3. Observe o endereço e o porte: há sinais de empresa de fachada (endereço residencial, capital social baixo para o volume recebido)?\n4. Liste as verificações que eu ainda posso fazer em fontes oficiais (quadro societário, outras receitas públicas do mesmo CNPJ).\n\nImportante: nenhum desses sinais, isolado ou em conjunto, prova irregularidade — empresas pequenas e recentes prestam serviços legítimos. O objetivo é priorizar o que verificar na fonte oficial.\n\nDados do fornecedor:\n{{cole_dados_fornecedor}}',
    ARRAY['cole_dados_fornecedor'],
    ARRAY['ceap','ceaps','fornecedor','cnpj'],
    40
  )
  RETURNING id, ordem
)
INSERT INTO public.mapa_prompts (artigo_id, prompt_modelo_id, ordem)
SELECT mapa.id, ins.id, ins.ordem FROM mapa, ins;