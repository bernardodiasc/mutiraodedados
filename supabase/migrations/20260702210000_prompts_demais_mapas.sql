-- Prompts do Kit de investigação para os 6 mapas que ainda não tinham nenhum:
-- contrato-federal-pncp, teia-de-relacionamentos, o-labirinto-dos-convenios,
-- cacando-sobrepreco, rastreando-o-dna-da-despesa, arquitetura-teorica.
-- Cada prompt é coerente com os PASSOS do seu mapa (regra de coerência do Kit) e
-- carrega variáveis jsonb {nome, dica?, href?, hrefLabel?} — href sempre rota interna.
--
-- Idempotente: só insere prompts/vínculos ainda inexistentes (guarda por título e
-- por vínculo). variaveis já é jsonb (ver 20260702200000). ativo default = true.
WITH dados(map_slug, titulo, descricao, prompt_template, variaveis, tags, ordem) AS (
  VALUES
  -- ===== contrato-federal-pncp =====
  (
    'contrato-federal-pncp',
    'Autópsia de um contrato do PNCP',
    'Lê os dados de um contrato e do fornecedor e aponta o que merece verificação.',
    'Você vai analisar um contrato público federal registrado no PNCP. Abaixo estão (A) os dados do contrato e (B) o histórico do fornecedor, ambos copiados da plataforma Mutirão de Dados.

Tarefas:
1. Resuma o contrato: órgão, objeto, modalidade, valor global e vigência.
2. Avalie a modalidade — dispensa e inexigibilidade compram sem concorrência e pedem atenção redobrada.
3. Olhe o fornecedor: com quantos órgãos contrata, se concentra receita em poucos e se o objeto combina com a atividade dele.
4. Liste até 5 pontos que merecem verificação e, para cada um, que dado eu deveria colher em seguida.

Importante: cada ponto é um sinal para checar, nunca prova de irregularidade — pode haver explicação legítima (fornecedor único, urgência real). Diga quando o padrão tiver explicação plausível.

(A) Contrato:
{{cole_dados_contrato}}

(B) Fornecedor:
{{cole_dados_fornecedor}}',
    '[
      {"nome":"cole_dados_contrato","dica":"Abra o contrato na Busca e use Copiar dados.","href":"/buscar","hrefLabel":"Buscar o contrato"},
      {"nome":"cole_dados_fornecedor","dica":"Abra o CNPJ do fornecedor e use Copiar dados.","href":"/buscar","hrefLabel":"Buscar o fornecedor"}
    ]'::jsonb,
    ARRAY['pncp','contrato','fornecedor'],
    10
  ),
  (
    'contrato-federal-pncp',
    'Compra sem licitação: a dispensa se sustenta?',
    'Foca em contratos por dispensa ou inexigibilidade e no risco de fracionamento.',
    'Você vai examinar um contrato firmado por dispensa ou inexigibilidade de licitação. Os dados abaixo vieram da plataforma Mutirão de Dados.

Tarefas:
1. Confirme a base legal alegada e o valor do contrato.
2. Compare o valor com o limite legal da modalidade ({{valor_limite}}): está logo abaixo do teto? Isso pode indicar fracionamento para evitar licitação.
3. Verifique se o mesmo órgão fez outras dispensas parecidas para o mesmo objeto/fornecedor no período (sinal de fracionamento).
4. Aponte o que confirmar na fonte oficial antes de qualquer conclusão.

Importante: dispensa é legal em muitas hipóteses (emergência, baixo valor, fornecedor exclusivo). Trate como sinal a investigar, não acusação.

Dados do contrato:
{{cole_dados_contrato}}',
    '[
      {"nome":"cole_dados_contrato","dica":"Abra o contrato na Busca e use Copiar dados.","href":"/buscar","hrefLabel":"Buscar o contrato"},
      {"nome":"valor_limite","dica":"Limite legal da modalidade para comparar (ex.: R$ 50 mil para dispensa)."}
    ]'::jsonb,
    ARRAY['pncp','dispensa','fracionamento'],
    20
  ),
  (
    'contrato-federal-pncp',
    'Contrato assinado x dinheiro que saiu',
    'Cruza o contrato com empenho, liquidação e pagamento para ver o que foi de fato executado.',
    'Você vai verificar se um contrato foi realmente executado. Um contrato assinado não garante que o dinheiro saiu. Abaixo estão os dados do contrato.

Antes: EMPENHADO é reserva, LIQUIDADO é reconhecimento da entrega, PAGO é o dinheiro saindo do caixa.

Tarefas:
1. Registre o valor contratado e o órgão contratante ({{orgao}}).
2. Explique que dados de despesa (empenho, liquidação, pagamento) eu preciso buscar no Portal da Transparência pelo CNPJ do fornecedor ou número do contrato.
3. Monte um checklist para comparar valor contratado x empenhado x liquidado x pago e identificar diferenças.
4. Diga que diferenças são normais (execução plurianual) e quais mereceriam explicação.

Dados do contrato:
{{cole_dados_contrato}}',
    '[
      {"nome":"cole_dados_contrato","dica":"Abra o contrato na Busca e use Copiar dados.","href":"/buscar","hrefLabel":"Buscar o contrato"},
      {"nome":"orgao","dica":"Órgão contratante, para achar as despesas.","href":"/orgaos","hrefLabel":"Órgãos"}
    ]'::jsonb,
    ARRAY['pncp','execucao','despesa'],
    30
  ),

  -- ===== teia-de-relacionamentos =====
  (
    'teia-de-relacionamentos-como-auditar-socios-e-empresas-contratadas',
    'Radiografia do QSA: capital social x tamanho do contrato',
    'Compara o porte declarado da empresa com o valor que ela ganhou.',
    'Você vai analisar o Quadro de Sócios e Administradores (QSA) de uma empresa que venceu um contrato público, para avaliar se ela tem capacidade compatível com o valor.

Tarefas:
1. Liste sócios, administradores, data de abertura e capital social.
2. Compare o capital social com o valor do contrato ({{valor_contrato}}): uma empresa de capital irrisório que ganha um contrato milionário é indício de possível empresa de fachada.
3. Verifique se a empresa foi aberta pouco antes do edital.
4. Liste o que confirmar em seguida (endereço real, outros contratos, atividade econômica).

Importante: capital baixo e empresa nova não provam fraude — muitas empresas legítimas são pequenas. É sinal para checar.

QSA e dados da empresa:
{{cole_qsa}}',
    '[
      {"nome":"cole_qsa","dica":"Cole o Quadro de Sócios e Administradores (consulta pública de CNPJ na Receita)."},
      {"nome":"valor_contrato","dica":"Valor do contrato que a empresa venceu.","href":"/buscar","hrefLabel":"Achar o contrato"}
    ]'::jsonb,
    ARRAY['cnpj','qsa','socios'],
    10
  ),
  (
    'teia-de-relacionamentos-como-auditar-socios-e-empresas-contratadas',
    'Concorrentes que parecem a mesma empresa',
    'Cruza endereço, telefone e sócios das empresas que disputaram a mesma licitação.',
    'Você vai procurar sinais de combinação de preços numa licitação. Abaixo estão (A) as empresas que enviaram proposta e (B) os endereços/sócios de cada CNPJ.

Tarefas:
1. Agrupe empresas que compartilham endereço, telefone, contador ou sócios.
2. Aponte parentesco entre sócios de concorrentes diferentes.
3. Marque casos em que a mesma pessoa aparece em duas ou mais concorrentes.
4. Para cada grupo suspeito, explique por que o vínculo importa e como confirmar (contrato social, comprovante de endereço).

Importante: empresas podem dividir endereço por coincidência (salas comerciais, contadores). Combinação de preços é hipótese a confirmar, não conclusão.

(A) Concorrentes:
{{cole_lista_concorrentes}}

(B) Endereços e sócios:
{{cole_enderecos}}',
    '[
      {"nome":"cole_lista_concorrentes","dica":"Cole as empresas que enviaram proposta na mesma licitação.","href":"/licitacoes","hrefLabel":"Licitações"},
      {"nome":"cole_enderecos","dica":"Cole endereço, telefone e sócios de cada CNPJ concorrente."}
    ]'::jsonb,
    ARRAY['licitacoes','conluio','cnpj'],
    20
  ),
  (
    'teia-de-relacionamentos-como-auditar-socios-e-empresas-contratadas',
    'Sócio com vínculo público ou de parentesco',
    'Cruza os nomes dos sócios com servidores do órgão contratante.',
    'Você vai checar se os sócios da empresa vencedora têm vínculo com o poder público. Abaixo estão os nomes dos sócios.

Tarefas:
1. Para cada sócio, monte a busca que eu devo fazer na lista de servidores do órgão contratante ({{orgao_contratante}}).
2. Explique o conflito de interesse: servidor não pode ser sócio-gerente de empresa que contrata com o órgão onde trabalha.
3. Sugira como checar parentesco entre sócios e agentes públicos do órgão.
4. Liste as fontes oficiais para confirmar cada vínculo.

Importante: homônimos são comuns — nome igual não é prova. Confirme por CPF/documento antes de afirmar vínculo.

Sócios da empresa vencedora:
{{nomes_socios}}',
    '[
      {"nome":"nomes_socios","dica":"Nomes dos sócios da empresa vencedora (do QSA)."},
      {"nome":"orgao_contratante","dica":"Órgão que contratou, onde buscar servidores.","href":"/orgaos","hrefLabel":"Órgãos"}
    ]'::jsonb,
    ARRAY['socios','servidores','conflito-de-interesse'],
    30
  ),

  -- ===== o-labirinto-dos-convenios =====
  (
    'o-labirinto-dos-convenios-rastreando-repasses-federais-para-municipios',
    'Raio-x de um convênio federal com município',
    'Lê objeto, plano de trabalho, situação e vigência de um convênio.',
    'Você vai analisar um convênio de repasse federal para um município. Os dados abaixo vieram da página de Convênios da Mutirão de Dados.

Tarefas:
1. Resuma: concedente, município beneficiário ({{municipio}}), objeto, valor e vigência.
2. Diga a situação atual: em execução, prestação de contas aprovada/rejeitada, inadimplente.
3. Aponte sinais: vigência encerrada com objeto inacabado, saldo não devolvido, valores atípicos para o porte do município.
4. Liste o que verificar em seguida (plano de trabalho, extrato da conta específica, licitação local).

Importante: repasse a município é o mecanismo normal de cooperação federativa. Sinais são convite a acompanhar, não denúncia.

Dados do convênio:
{{cole_dados_convenio}}',
    '[
      {"nome":"cole_dados_convenio","dica":"Abra o convênio e use Copiar dados.","href":"/convenios","hrefLabel":"Convênios"},
      {"nome":"municipio","dica":"Município beneficiário do repasse."}
    ]'::jsonb,
    ARRAY['convenios','transferegov','municipio'],
    10
  ),
  (
    'o-labirinto-dos-convenios-rastreando-repasses-federais-para-municipios',
    'A obra acabou ou o prazo venceu antes?',
    'Compara vigência, execução e prestação de contas de um conjunto de convênios.',
    'Você vai analisar a execução de convênios de um município. Abaixo está o CSV de convênios exportado da Mutirão de Dados.

Tarefas:
1. Para cada convênio, compare a vigência com a situação de execução e de prestação de contas.
2. Liste os que estão com vigência encerrada e objeto não concluído ou contas rejeitadas.
3. Some quanto foi repassado, quanto foi executado e quanto (se houver) deveria ter sido devolvido.
4. Ranqueie os 5 casos mais críticos e diga o que confirmar em cada um.

Importante: atrasos e pendências têm causas legítimas (chuvas, aditivos, troca de gestão). Trate como sinal a investigar.

Convênios (CSV):
{{cole_csv_convenios}}',
    '[
      {"nome":"cole_csv_convenios","dica":"Exporte o CSV em Convênios com o filtro do município.","href":"/convenios","hrefLabel":"Convênios"}
    ]'::jsonb,
    ARRAY['convenios','execucao','prestacao-de-contas'],
    20
  ),
  (
    'o-labirinto-dos-convenios-rastreando-repasses-federais-para-municipios',
    'Do convênio à empreiteira local',
    'Tenta ligar o repasse federal ao contrato que a prefeitura assinou na ponta.',
    'Você vai rastrear o dinheiro de um convênio federal até o contrato local que a prefeitura assinou. Abaixo estão (A) os dados do convênio e (B) o CSV de contratos do município/órgão executor.

Contexto: as bases públicas nem sempre trazem um identificador comum ligando convênio e contrato local. O casamento é por aproximação (município, valores, datas, objeto) e vira hipótese a confirmar.

Tarefas:
1. Extraia do convênio: objeto, valor, vigência e beneficiário.
2. Filtre no CSV os contratos compatíveis: mesmo período, valor da mesma ordem, objeto compatível.
3. Ranqueie os candidatos por plausibilidade e explique cada um.
4. Diga como confirmar o melhor candidato (número no Transferegov, plano de trabalho, contrato no PNCP pelo CNPJ do município).

Importante: deixe explícito que a ligação é probabilística por limite dos dados — não afirme que o convênio X virou o contrato Y sem confirmação documental.

(A) Convênio:
{{cole_dados_convenio}}

(B) Contratos do município (CSV):
{{cole_csv_contratos}}',
    '[
      {"nome":"cole_dados_convenio","dica":"Abra o convênio e use Copiar dados.","href":"/convenios","hrefLabel":"Convênios"},
      {"nome":"cole_csv_contratos","dica":"Exporte contratos do município/órgão em Contratos (fonte PNCP).","href":"/contratos","hrefLabel":"Contratos"}
    ]'::jsonb,
    ARRAY['convenios','contratos','rastreabilidade'],
    30
  ),

  -- ===== cacando-sobrepreco =====
  (
    'cacando-sobrepreco-como-comparar-o-valor-do-contrato-com-a-media-de-mercado',
    'Preço unitário x mediana de mercado',
    'Compara o preço unitário do contrato com uma amostra do Painel de Preços.',
    'Você vai avaliar se um item comprado por um órgão está com sobrepreço. Abaixo estão (A) o item e o preço unitário do contrato e (B) uma amostra de preços de referência do Painel de Preços do governo.

Tarefas:
1. Confirme o item ({{item}}) e o preço unitário pago ({{preco_unitario}}).
2. Calcule a diferença percentual entre o preço do contrato e a mediana da amostra de referência.
3. Classifique: dentro do mercado, acima (20 a 30%) ou muito acima (>30%).
4. Liste que condições especiais (frete a local remoto, prazo extremo, especificação diferente) poderiam justificar a diferença — e diga o que checar no edital.

Importante: preço acima da mediana pode ter justificativa técnica. Sobrepreço é indício a confirmar no edital, não superfaturamento comprovado.

(A) Item e preço do contrato:
{{item}} — {{preco_unitario}}

(B) Amostra do Painel de Preços:
{{cole_amostra_precos}}',
    '[
      {"nome":"item","dica":"Descrição exata do item comprado (especificação técnica)."},
      {"nome":"preco_unitario","dica":"Preço por unidade pago no contrato (não o valor global)."},
      {"nome":"cole_amostra_precos","dica":"Cole a amostra do Painel de Preços (preço médio/mediano do mesmo item e ano)."}
    ]'::jsonb,
    ARRAY['sobrepreco','preco-unitario','painel-de-precos'],
    10
  ),
  (
    'cacando-sobrepreco-como-comparar-o-valor-do-contrato-com-a-media-de-mercado',
    'O sobrepreço tem justificativa no edital?',
    'Checa se as condições do edital explicam um preço acima da média.',
    'Você já encontrou um preço acima da mediana (diferença de {{margem_pct}}%). Agora vai avaliar se o edital justifica isso. Abaixo estão os dados do contrato/edital.

Tarefas:
1. Liste as condições de entrega e execução previstas (prazo, local, garantia, especificação).
2. Avalie se alguma dessas condições justifica tecnicamente o preço mais alto.
3. Se não houver justificativa no edital, explique por que a suspeita de superfaturamento se fortalece.
4. Aponte o documento oficial que confirmaria (termo de referência, pesquisa de preços anexa).

Importante: a ausência de justificativa aparente não prova superfaturamento — o documento pode existir e não estar no que você colou. Peça a fonte antes de concluir.

Dados do contrato/edital:
{{cole_dados_contrato}}',
    '[
      {"nome":"margem_pct","dica":"Diferença percentual encontrada sobre a mediana (ex.: 30)."},
      {"nome":"cole_dados_contrato","dica":"Abra o contrato/edital e use Copiar dados.","href":"/contratos","hrefLabel":"Contratos"}
    ]'::jsonb,
    ARRAY['sobrepreco','edital','justificativa'],
    20
  ),
  (
    'cacando-sobrepreco-como-comparar-o-valor-do-contrato-com-a-media-de-mercado',
    'A pesquisa de preços do edital foi real?',
    'Verifica se a cotação prévia usou fornecedores reais e independentes.',
    'Você vai examinar a pesquisa de mercado que embasou uma licitação. Abaixo estão (A) os fornecedores usados na cotação e (B) o CNPJ da empresa vencedora.

Tarefas:
1. Liste os fornecedores da pesquisa de preços e diga se parecem reais e ativos.
2. Cruze com o CNPJ da vencedora ({{cnpj_vencedora}}): há vínculo societário, mesmo endereço ou parentesco entre os cotados e quem venceu?
3. Avalie se a cotação pode ter sido montada para validar um preço já escolhido.
4. Liste o que confirmar (QSA de cada cotado, situação cadastral).

Importante: coincidências acontecem — vínculo entre cotados e vencedora é sinal forte, mas exige confirmação documental.

(A) Fornecedores da pesquisa de preços:
{{cole_pesquisa_precos}}

(B) CNPJ vencedor: {{cnpj_vencedora}}',
    '[
      {"nome":"cole_pesquisa_precos","dica":"Cole os fornecedores usados na pesquisa de mercado do edital (anexos)."},
      {"nome":"cnpj_vencedora","dica":"CNPJ da empresa vencedora, para cruzar vínculo.","href":"/buscar","hrefLabel":"Buscar CNPJ"}
    ]'::jsonb,
    ARRAY['sobrepreco','pesquisa-de-precos','conluio'],
    30
  ),

  -- ===== rastreando-o-dna-da-despesa =====
  (
    'rastreando-o-dna-da-despesa-do-empenho-a-ordem-bancaria',
    'Empenho, liquidação e pagamento: o funil de uma despesa',
    'Organiza as três fases da despesa e mostra onde o dinheiro parou.',
    'Você vai analisar as fases de uma despesa pública. Abaixo estão as fases (empenho, liquidação, pagamento) de um CNPJ/contrato, copiadas do Portal da Transparência.

Antes: EMPENHO é a reserva do dinheiro (Nota de Empenho), LIQUIDAÇÃO é o atesto de que o serviço foi entregue, PAGAMENTO é a saída do dinheiro (Ordem Bancária).

Tarefas:
1. Some, para o CNPJ ({{cnpj}}), os totais empenhado, liquidado e pago.
2. Calcule quanto do empenhado virou pagamento e quanto ficou parado.
3. Aponte empenhos grandes com liquidação/pagamento baixos e explique as hipóteses (restos a pagar, cancelamento, obra parada).
4. Diga o que buscar em seguida para cada caso travado.

Importante: execução é plurianual; sobra empenhada no fim do ano é normal. Baixa execução é convite a acompanhar.

Fases da despesa:
{{cole_fases_despesa}}',
    '[
      {"nome":"cole_fases_despesa","dica":"Cole as fases (empenho, liquidação, pagamento) do Portal da Transparência.","href":"/buscar","hrefLabel":"Buscar por CNPJ/contrato"},
      {"nome":"cnpj","dica":"CNPJ da empresa contratada."}
    ]'::jsonb,
    ARRAY['despesa','empenho','pagamento'],
    10
  ),
  (
    'rastreando-o-dna-da-despesa-do-empenho-a-ordem-bancaria',
    'Nota fiscal emitida antes da entrega?',
    'Cruza datas de nota fiscal, liquidação e entrega do serviço.',
    'Você vai checar a coerência temporal de uma despesa. Abaixo estão as liquidações e notas fiscais de um contrato cujo objeto é {{objeto}}.

Tarefas:
1. Para cada liquidação, compare a data da nota fiscal com a data provável de entrega do serviço/obra.
2. Marque notas emitidas e liquidadas em prazo recorde ou em finais de semana/feriados.
3. Aponte pagamentos que possam ter ocorrido antes da liquidação (o que é irregular).
4. Liste o que confirmar (relatório de medição, atesto do fiscal, data real da entrega).

Importante: datas apertadas podem ter explicação (entrega parcelada, processo eletrônico rápido). É sinal a checar, não prova.

Liquidações e notas fiscais:
{{cole_liquidacoes}}',
    '[
      {"nome":"objeto","dica":"O que o contrato deveria entregar (bem ou serviço)."},
      {"nome":"cole_liquidacoes","dica":"Cole as notas fiscais/liquidações da despesa (Portal da Transparência).","href":"/buscar","hrefLabel":"Buscar a despesa"}
    ]'::jsonb,
    ARRAY['despesa','liquidacao','nota-fiscal'],
    20
  ),
  (
    'rastreando-o-dna-da-despesa-do-empenho-a-ordem-bancaria',
    'Liquidado é igual a pago? Achando o buraco',
    'Compara o total liquidado com o total pago e procura diferenças sem justificativa.',
    'Você vai comparar quanto foi liquidado e quanto foi pago numa despesa. Abaixo estão as fases da despesa.

Tarefas:
1. Some o total liquidado e o total pago.
2. Se forem diferentes, explique as hipóteses (pagamento pendente, glosa, retenção, restos a pagar).
3. Verifique se há pagamentos fracionados sem entregas parciais correspondentes.
4. Liste o que confirmar na fonte oficial para cada diferença.

Importante: diferença entre liquidado e pago é comum e muitas vezes legítima (calendário de pagamento). Trate como ponto a esclarecer.

Fases da despesa:
{{cole_fases_despesa}}',
    '[
      {"nome":"cole_fases_despesa","dica":"Cole as fases (empenho, liquidação, pagamento) do Portal da Transparência.","href":"/buscar","hrefLabel":"Buscar por CNPJ/contrato"}
    ]'::jsonb,
    ARRAY['despesa','liquidacao','pagamento'],
    30
  ),

  -- ===== arquitetura-teorica =====
  (
    'arquitetura-teorica-o-ecossistema-do-gasto-publico',
    'Mapeando o ciclo de um gasto do zero',
    'Organiza um caso em demanda, origem, conexão, destino e resultado.',
    'Você vai me ajudar a estruturar a investigação de um gasto público seguindo o ciclo demanda → origem → conexão → destino → resultado. Descrição do caso: {{caso}}. Abaixo, o que já encontrei.

Tarefas:
1. Enquadre o caso nas 5 fases do ciclo e diga o que já está preenchido e o que falta.
2. Para a ORIGEM, diga que classificações orçamentárias buscar (função, subfunção, ação; ou se é emenda parlamentar).
3. Para a CONEXÃO, identifique o instrumento provável (contrato, convênio, licitação) e as três fases da despesa (empenho, liquidação, pagamento).
4. Para o DESTINO e o RESULTADO, diga que identidade jurídica esperar (CNPJ/CPF ou conta específica) e como verificar a entrega física.
5. Entregue um roteiro numerado do que colher em seguida, com a página da plataforma para cada dado.

Importante: este é um roteiro de investigação — nenhuma etapa, sozinha, prova irregularidade.

O que já encontrei:
{{cole_dados}}',
    '[
      {"nome":"caso","dica":"Descreva o gasto que quer entender (ex.: creche no seu município)."},
      {"nome":"cole_dados","dica":"Cole o que já achou (contrato, convênio, emenda) via Copiar dados.","href":"/buscar","hrefLabel":"Busca unificada"}
    ]'::jsonb,
    ARRAY['metodo','ciclo-do-gasto','planejamento'],
    10
  ),
  (
    'arquitetura-teorica-o-ecossistema-do-gasto-publico',
    'Da demanda ao resultado: que dado falta?',
    'Checklist do que colher em cada fase do ciclo do gasto.',
    'Você vai me dizer o que ainda falta colher numa investigação. Estou na fase {{fase}} do ciclo do gasto (origem, conexão, destino ou resultado). Abaixo, o que já tenho.

Tarefas:
1. Liste os dados essenciais da fase {{fase}} e marque quais eu já tenho e quais faltam.
2. Para cada dado que falta, diga a fonte oficial e a página da plataforma para buscar.
3. Explique como esta fase se liga à anterior e à seguinte (o que precisa bater entre elas).
4. Aponte a incoerência mais comum nesta fase e como detectá-la.

Importante: o objetivo é organizar a coleta, não julgar — cada lacuna é um dado a buscar, não uma irregularidade.

O que já tenho:
{{cole_dados}}',
    '[
      {"nome":"fase","dica":"Em que fase você está: origem, conexão, destino ou resultado."},
      {"nome":"cole_dados","dica":"Cole o que já achou via Copiar dados.","href":"/buscar","hrefLabel":"Busca unificada"}
    ]'::jsonb,
    ARRAY['metodo','checklist','ciclo-do-gasto'],
    20
  ),
  (
    'arquitetura-teorica-o-ecossistema-do-gasto-publico',
    'Traduzindo empenho, liquidação e pagamento',
    'Explica as três fases da despesa em linguagem simples a partir de um caso real.',
    'Você vai me explicar, em linguagem simples, as três fases da despesa a partir de um caso real. Abaixo estão as fases de uma despesa que copiei do Portal da Transparência.

Tarefas:
1. Explique, com os números do caso, o que significa cada fase: empenho (reserva), liquidação (atesto da entrega) e pagamento (saída do dinheiro).
2. Mostre onde este dinheiro está agora no caso concreto.
3. Aponte, se houver, algo que não bate entre as fases e o que isso poderia significar.
4. Sugira a próxima pergunta que eu deveria fazer.

Importante: empenhado não é o mesmo que pago nem que desviado. Explique sem afirmar irregularidade.

Fases da despesa:
{{cole_fases_despesa}}',
    '[
      {"nome":"cole_fases_despesa","dica":"Cole as fases (empenho, liquidação, pagamento) do Portal da Transparência.","href":"/buscar","hrefLabel":"Busca unificada"}
    ]'::jsonb,
    ARRAY['metodo','despesa','didatico'],
    30
  )
), ins AS (
  INSERT INTO public.prompt_modelos (titulo, descricao, prompt_template, variaveis, tags, ordem)
  SELECT d.titulo, d.descricao, d.prompt_template, d.variaveis, d.tags, d.ordem
  FROM dados d
  WHERE NOT EXISTS (
    SELECT 1 FROM public.prompt_modelos pm WHERE pm.titulo = d.titulo
  )
  RETURNING id, titulo
)
INSERT INTO public.mapa_prompts (artigo_id, prompt_modelo_id, ordem)
SELECT a.id, ins.id, d.ordem
FROM ins
JOIN dados d ON d.titulo = ins.titulo
JOIN public.artigos a ON a.slug = d.map_slug
WHERE NOT EXISTS (
  SELECT 1 FROM public.mapa_prompts mp
  WHERE mp.artigo_id = a.id AND mp.prompt_modelo_id = ins.id
);
