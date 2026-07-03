-- Piloto 2 do Kit de investigação: prompts do mapa
-- 'emenda-parlamentar-do-anuncio-ao-pagamento'. Expõem honestamente a quebra
-- de ID emenda→execução e a anonimização das emendas de relator (RP9).
-- Idempotente: já aplicada no banco de produção (fora do tracker do Supabase).
-- Só insere prompts/vínculos que ainda não existam (guarda por título e vínculo).
WITH mapa AS (
  SELECT id FROM public.artigos WHERE slug = 'emenda-parlamentar-do-anuncio-ao-pagamento'
), novos(titulo, descricao, prompt_template, variaveis, tags, ordem) AS (
  VALUES
  (
    'Raio-x das emendas de um parlamentar',
    'Mapeia para onde o parlamentar direciona o orçamento: municípios, funções e tipos de emenda.',
    'Você vai analisar as emendas parlamentares de {{parlamentar}} no período {{periodo}}. Os dados abaixo vieram do CSV exportado da página de Emendas (fonte: Portal da Transparência/CGU); cada linha traz autor, tipo, localidade, função e os valores empenhado, liquidado e pago.

Tarefas:
1. Some o total empenhado e o total pago do período e calcule a taxa de execução (pago ÷ empenhado).
2. Agrupe por localidade do gasto: quais municípios/UFs concentram mais recursos? Liste os 10 maiores com valores e %.
3. Agrupe por função (Saúde, Educação, Urbanismo…): qual é o perfil temático das emendas?
4. Aponte padrões que merecem verificação: um município que recebe muito mais que os demais, mudança brusca de destino entre anos, concentração numa única função.
5. Para cada padrão apontado, diga que dado adicional eu deveria colher (ex.: convênios do município beneficiado, contratos do órgão executor).

Importante: direcionar emendas para a base eleitoral é legal e esperado no presidencialismo de coalizão — concentração é sinal para entender, não prova de irregularidade. Considere explicações legítimas (tamanho do município, calamidades, prioridades declaradas).

Dados (CSV):
{{cole_o_csv}}',
    ARRAY['parlamentar','periodo','cole_o_csv'],
    ARRAY['emendas','parlamentar'],
    10
  ),
  (
    'Funil da execução: empenhado → liquidado → pago',
    'Encontra emendas que travaram no meio do caminho e explica o que cada fase significa.',
    'Você vai analisar a execução de emendas parlamentares no recorte {{recorte}}. Os dados abaixo vieram do CSV da página de Emendas (Portal da Transparência/CGU) e trazem, por emenda, os valores empenhado, liquidado e pago, além de restos a pagar (inscritos, pagos e cancelados).

Antes de tudo, use as definições corretas: EMPENHADO é reserva orçamentária (promessa), LIQUIDADO é o reconhecimento de que o serviço/obra foi entregue, PAGO é o dinheiro saindo do caixa. Empenhado ≠ pago ≠ desviado.

Tarefas:
1. Calcule, para o conjunto, o funil total: % liquidado sobre empenhado e % pago sobre empenhado.
2. Liste as emendas com maior valor empenhado e pagamento zero ou muito baixo — o dinheiro pode estar em restos a pagar, cancelado ou simplesmente parado.
3. Analise os restos a pagar: quanto foi inscrito, quanto foi pago depois e quanto foi cancelado? Cancelamento alto merece atenção.
4. Sugira, para as 5 emendas mais travadas, o que verificar em seguida (convênio correspondente, situação da obra, notícia local).

Importante: execução orçamentária é plurianual — uma emenda de dezembro naturalmente paga pouco no mesmo ano. Baixa execução é convite para acompanhar, não denúncia. Diga explicitamente quando o padrão tem explicação técnica plausível.

Dados (CSV):
{{cole_o_csv}}',
    ARRAY['recorte','cole_o_csv'],
    ARRAY['emendas','execucao','restos-a-pagar'],
    20
  ),
  (
    'Da emenda ao convênio: casando as duas pontas',
    'Tenta ligar uma emenda aos convênios/contratos que a executaram — e explica por que essa ligação não é automática.',
    'Você vai tentar rastrear a execução de uma emenda parlamentar até o instrumento que gastou o dinheiro na ponta (convênio, contrato de repasse ou contratação). Abaixo estão (A) os dados da emenda e (B) o CSV de convênios/contratos do município ou órgão executor no período.

Contexto essencial: as APIs públicas federais NÃO trazem um identificador comum ligando a emenda ao convênio ou contrato — essa é uma quebra de rastreabilidade conhecida. O casamento que você vai fazer é por aproximação (beneficiário, município, valores, datas e objeto), e o resultado é uma hipótese a confirmar na fonte oficial, nunca uma certeza.

Tarefas:
1. Do lado (A), extraia: autor, ano, localidade, função, valores e — se houver — beneficiário do plano de ação (EC 105).
2. Do lado (B), filtre instrumentos compatíveis: mesmo município/beneficiário, período seguinte ao empenho, valor da mesma ordem de grandeza, objeto compatível com a função da emenda.
3. Ranqueie os candidatos por plausibilidade e explique o porquê de cada um.
4. Para o melhor candidato, liste como confirmar: número do convênio no Transferegov, plano de trabalho, contrato no PNCP pelo CNPJ do município.

Importante: deixe claro no resultado que a ligação é probabilística por limitação dos dados públicos — não afirme que "a emenda X virou o convênio Y" sem confirmação documental.

(A) Dados da emenda:
{{cole_dados_emenda}}

(B) Convênios/contratos do destino (CSV):
{{cole_csv_convenios}}',
    ARRAY['cole_dados_emenda','cole_csv_convenios'],
    ARRAY['emendas','convenios','rastreabilidade'],
    30
  ),
  (
    'O que dá (e o que não dá) para saber de uma emenda de relator (RP9)',
    'Guia realista para o "orçamento secreto": autor anônimo por desenho e o caminho indireto pela execução.',
    'Você vai analisar emendas de relator (RP9) do ano {{ano}}. Os dados abaixo vieram do CSV da página de Emendas (Portal da Transparência/CGU), filtrado pelo tipo "Emenda de Relator".

Contexto essencial: nas RP9 o autor aparece como "RELATOR GERAL" e a localidade como "Nacional" — a anonimização é uma característica do desenho do mecanismo, não uma falha dos dados. O STF declarou o esquema inconstitucional em novembro de 2022 (ADPF 854). Alguns registros de 2020 nem têm número de emenda. Não invente autores: quem indicou cada gasto NÃO está nos dados.

Tarefas:
1. Some os valores empenhados e pagos e compare a ordem de grandeza com os demais tipos de emenda do mesmo ano (se eu colar os dois recortes).
2. Agrupe por função e subfunção: para onde o dinheiro do relator foi tematicamente?
3. Explique o caminho indireto de investigação: como a emenda não identifica autor nem município, o rastro real está nos órgãos executores — convênios e contratos firmados no período com verba dessas funções.
4. Liste 3 perguntas que eu poderia responder na sequência com os dados de convênios/contratos do período, e o filtro exato a aplicar.

Importante: seja explícito sobre os limites — qualquer atribuição de autoria a um parlamentar específico exige fonte externa (reportagens, ofícios de indicação divulgados) e não sai destes dados.

Dados (CSV):
{{cole_o_csv}}',
    ARRAY['ano','cole_o_csv'],
    ARRAY['emendas','rp9','orcamento-secreto'],
    40
  )
), ins AS (
  INSERT INTO public.prompt_modelos (titulo, descricao, prompt_template, variaveis, tags, ordem)
  SELECT n.titulo, n.descricao, n.prompt_template, n.variaveis, n.tags, n.ordem
  FROM novos n
  WHERE NOT EXISTS (
    SELECT 1 FROM public.prompt_modelos pm WHERE pm.titulo = n.titulo
  )
  RETURNING id, ordem
)
INSERT INTO public.mapa_prompts (artigo_id, prompt_modelo_id, ordem)
SELECT mapa.id, ins.id, ins.ordem FROM mapa, ins
WHERE NOT EXISTS (
  SELECT 1 FROM public.mapa_prompts mp
  WHERE mp.artigo_id = mapa.id AND mp.prompt_modelo_id = ins.id
);
