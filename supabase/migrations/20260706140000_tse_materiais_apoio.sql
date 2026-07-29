-- Materiais de apoio da fonte TSE (plano de integração, Fase 4.B):
--   1. Mapa investigativo 'siga-o-dinheiro-campanha-contrato' + 4 prompts do Kit
--   2. Tutorial 'como-ler-uma-prestacao-de-contas-de-campanha'
--   3. Nota de campo 'integracao-fonte-tse'
-- Idempotente: guardas por slug (artigos), título (prompts) e vínculo (mapa_prompts).

-- 1) Mapa investigativo -------------------------------------------------------
INSERT INTO public.artigos (slug, titulo, categoria, resumo, conteudo_md, publico, publicado_em, dificuldade, tempo_estimado_min, fontes_usadas, ordem)
SELECT
  'siga-o-dinheiro-campanha-contrato',
  'Siga o dinheiro: da doação de campanha ao contrato público',
  'mapa',
  'Como verificar, com dados oficiais do TSE e da CGU, se quem financiou a campanha de um político depois apareceu como fornecedor do poder público.',
  $md$
## O que este mapa investiga

Empresas podem doar serviços e pessoas físicas podem doar dinheiro a campanhas — é **legal**. Empresas também vendem ao governo — igualmente **legal**. O que merece atenção é o **padrão**: o mesmo CNPJ que financia a campanha de um parlamentar e, meses depois, fatura contratos de órgãos sob influência dele. Este mapa ensina a montar esse dossiê com dados oficiais, sem atalhos e sem acusação.

O ciclo que você vai percorrer: **Demanda** (a campanha precisa de dinheiro) → **Conexão** (a doação registrada no TSE) → **Resultado** (o contrato registrado na CGU). A ligação entre as pontas nunca é automática — é uma hipótese que você constrói e verifica.

## Passo 1 — Escolha o político e colha as contas de campanha

1. Abra a ficha do parlamentar em [Deputados](/camara/deputados) ou [Senadores](/senado/senadores) e desça até a seção **Eleições** — ela lista as últimas candidaturas, os bens declarados e os *top doadores* e *top fornecedores* da campanha mais recente (fonte: prestação de contas do TSE).
2. Se preferir partir do candidato, use a [busca de candidatos](/eleicoes/candidatos) e abra a ficha da candidatura.
3. Anote os doadores **pessoa jurídica** (CNPJ de 14 dígitos). Doadores pessoa física vêm com CPF mascarado pelo próprio TSE (`***.NNN.NNN-**`) e **não são cruzáveis** — essa é uma limitação da origem, não do site.
4. Chave de busca importante: o `SQ_CANDIDATO` (número sequencial da candidatura) aparece na URL da ficha — guarde-o para reproduzir a consulta na fonte oficial (DivulgaCandContas).

## Passo 2 — Verifique se o doador vende ao governo

1. Para cada CNPJ doador, abra a página do fornecedor (busque o CNPJ na [busca unificada](/buscar)). Se o CNPJ tem contratos federais importados, a ficha mostra órgãos contratantes, valores e a seção **Doações eleitorais** — que fecha o cruzamento no sentido inverso.
2. Compare as datas: doação foi **antes** do contrato? Quantos meses separam uma coisa da outra? Contrato assinado logo após a posse do político beneficiado pesa mais que um contrato antigo.
3. Compare os órgãos: o contrato é de um órgão sobre o qual o parlamentar tem influência real (comissões, emendas destinadas, base estadual)? Sem esse elo, o cruzamento perde força.

## Passo 3 — Confira os sinais automáticos e reproduza na fonte

1. A plataforma roda esse cruzamento automaticamente: o sinal `doador_virou_fornecedor` aparece em [Qualidade](/qualidade) e nas fichas envolvidas, com valor doado, valor do contrato e o intervalo em meses. Os critérios estão em [Metodologia](/metodologia).
2. **Reproduza na origem** antes de qualquer conclusão: a prestação de contas oficial fica no DivulgaCandContas do TSE (link "Ver na fonte oficial" na ficha do candidato) e o contrato, no Portal da Transparência (link no card do contrato).
3. Procure explicações legítimas: fornecedor tradicional daquele órgão desde antes da eleição? Doação pequena diante do faturamento? Setor com pouquíssimos fornecedores capazes?

## O que este mapa NÃO prova

Doação legal + contrato legítimo **não é irregularidade por si só**. O padrão vira notícia ou denúncia só depois de: (a) confirmar as duas pontas na fonte oficial; (b) estabelecer o elo de influência entre o político e o órgão contratante; (c) ouvir os envolvidos. Use o Kit ao lado para transformar o que você colheu em análise.
$md$,
  true,
  now(),
  'intermediario',
  40,
  ARRAY['tse', 'cgu'],
  35
WHERE NOT EXISTS (SELECT 1 FROM public.artigos WHERE slug = 'siga-o-dinheiro-campanha-contrato');

-- 2) Prompts do Kit (4) + vínculos com o mapa --------------------------------
WITH dados(map_slug, titulo, descricao, prompt_template, variaveis, tags, ordem) AS (
  VALUES
  (
    'siga-o-dinheiro-campanha-contrato',
    'Raio-x das contas de uma campanha',
    'Organiza receitas e despesas de um candidato e aponta dependências e concentrações.',
    'Você vai analisar a prestação de contas de campanha de {{candidato}} na eleição de {{ano}}. Os dados abaixo vieram da ficha do candidato na plataforma Mutirão de Dados (fonte: dados abertos do TSE — receitas e despesas declaradas ao TSE pelos próprios candidatos).

Tarefas:
1. Some o total recebido e classifique as receitas por origem: fundo eleitoral/partidário, doações de pessoas físicas, recursos próprios, doações de outros candidatos ou comitês.
2. Calcule a dependência: qual % veio da maior origem? Campanhas quase 100% dependentes do fundo partidário têm dinâmica diferente de campanhas financiadas por muitas doações pequenas.
3. Liste os 10 maiores doadores e os 10 maiores fornecedores da campanha, com valores e %.
4. Aponte padrões que merecem verificação: doador PJ com valor muito acima dos demais, fornecedor que concentra quase todo o gasto, despesas genéricas ("serviços diversos") de valor alto.
5. Para cada padrão, diga que dado adicional colher (contratos públicos do CNPJ, outras campanhas atendidas pelo mesmo fornecedor).

Importante: doar e contratar são atos legais. Concentração é sinal para entender, não prova de irregularidade — considere explicações legítimas (campanha pequena tem poucos fornecedores; autofinanciamento é comum em candidaturas locais).

Receitas (da ficha do candidato):
{{cole_receitas}}

Despesas (da ficha do candidato):
{{cole_despesas}}',
    '[
      {"nome":"candidato","dica":"Nome de urna do candidato analisado.","href":"/eleicoes/candidatos","hrefLabel":"Buscar candidato"},
      {"nome":"ano","dica":"Ano da eleição (ex.: 2022)."},
      {"nome":"cole_receitas","dica":"Copie os top doadores e totais da seção Eleições/ficha do candidato.","href":"/eleicoes/candidatos","hrefLabel":"Ficha do candidato"},
      {"nome":"cole_despesas","dica":"Copie os top fornecedores e totais da mesma ficha.","href":"/eleicoes/candidatos","hrefLabel":"Ficha do candidato"}
    ]'::jsonb,
    ARRAY['tse', 'campanha', 'contas'],
    10
  ),
  (
    'siga-o-dinheiro-campanha-contrato',
    'Doador que virou fornecedor: monte o dossiê',
    'Cruza as doações de um CNPJ com os contratos públicos dele e monta a linha do tempo.',
    'Você vai investigar um CNPJ que doou para campanha eleitoral E aparece como fornecedor do poder público. Abaixo estão (A) as doações eleitorais do CNPJ e (B) os contratos públicos dele, ambos copiados da plataforma Mutirão de Dados (fontes: TSE e Portal da Transparência/CGU).

Tarefas:
1. Monte a linha do tempo: cada doação e cada contrato em ordem cronológica, com valores.
2. Calcule o intervalo (em meses) entre cada doação e o contrato mais próximo depois dela.
3. Compare grandezas: quanto a empresa doou no total × quanto faturou em contratos? Uma doação de R$ 10 mil seguida de contratos de R$ 10 milhões conta uma história; o inverso, outra.
4. Verifique o elo: os contratos são de órgãos sobre os quais o político beneficiado tem influência plausível (indique o que checar: comissões, emendas, cargo)?
5. Escreva o resumo do dossiê em 5 linhas, separando FATOS (datas, valores, registros oficiais) de HIPÓTESES (influência, retribuição), e liste o que ainda falta verificar na fonte oficial.

Importante: este cruzamento NUNCA é prova — doar é legal, vender ao governo é legal. O dossiê só aponta um padrão que merece apuração (jornalística ou institucional), e os envolvidos têm sempre o direito de explicar.

(A) Doações eleitorais do CNPJ:
{{cole_doacoes}}

(B) Contratos públicos do CNPJ:
{{cole_contratos}}',
    '[
      {"nome":"cole_doacoes","dica":"Na ficha do fornecedor, copie a seção Doações eleitorais.","href":"/buscar","hrefLabel":"Buscar o CNPJ"},
      {"nome":"cole_contratos","dica":"Na mesma ficha, copie a lista de contratos.","href":"/buscar","hrefLabel":"Buscar o CNPJ"}
    ]'::jsonb,
    ARRAY['tse', 'cruzamento', 'fornecedor'],
    20
  ),
  (
    'siga-o-dinheiro-campanha-contrato',
    'Interprete um sinal doador↔fornecedor',
    'Pega um sinal automático da plataforma e transforma em checklist de verificação.',
    'A plataforma Mutirão de Dados detectou automaticamente o padrão "doador virou fornecedor" descrito abaixo (regra `doador_virou_fornecedor`: CNPJ que doou ≥ R$ 1.000 para a campanha de um parlamentar e aparece como fornecedor em contrato público federal). Sua tarefa é interpretar o sinal com rigor.

Tarefas:
1. Extraia do sinal: CNPJ, valor doado, valor do contrato, intervalo em meses entre doação e contrato, e o parlamentar beneficiado.
2. Classifique a força do sinal (fraca/média/forte) usando: proporção doação×contrato, proximidade temporal, e se o contrato veio depois da eleição.
3. Liste 5 explicações LEGÍTIMAS possíveis para esse padrão (ex.: fornecedor histórico do órgão, único fabricante regional, doação irrelevante diante do porte).
4. Monte o checklist de verificação: o que abrir na fonte oficial (DivulgaCandContas para a doação; Portal da Transparência para o contrato), que documentos pedir via Lei de Acesso, e que pergunta fazer à assessoria dos envolvidos.
5. Diga explicitamente: com só estes dados, o que NÃO se pode afirmar?

Dados do sinal (copiados da página de Qualidade):
{{cole_dados_sinal}}',
    '[
      {"nome":"cole_dados_sinal","dica":"Abra o sinal em Qualidade e copie o card com a evidência.","href":"/qualidade","hrefLabel":"Sinais detectados"}
    ]'::jsonb,
    ARRAY['tse', 'sinal', 'metodo'],
    30
  ),
  (
    'siga-o-dinheiro-campanha-contrato',
    'Fornecedor de campanha concentrado: contrato coletivo ou dependência?',
    'Avalia se um fornecedor que atende muitos candidatos do mesmo partido é economia de escala ou risco.',
    'Você vai analisar um fornecedor de campanha que concentrou gastos de vários candidatos do partido {{partido}} na UF {{uf}} em {{ano}}. Os dados abaixo vieram da plataforma Mutirão de Dados (fonte: despesas de campanha declaradas ao TSE).

Contexto: partidos frequentemente contratam gráficas, produtoras e agências de forma coletiva — concentração pode ser economia de escala legítima. Mas um fornecedor que absorve fração alta do gasto de dezenas de candidatos também pode indicar direcionamento do fundo partidário ou triangulação.

Tarefas:
1. Resuma: quantos candidatos atendidos, total faturado, fração do gasto do grupo.
2. Verifique a especialização: o serviço prestado (descrição das despesas) combina com a atividade esperada da empresa?
3. Compare com a mediana: quanto os demais fornecedores do mesmo grupo faturaram? A distância é de 2× ou de 50×?
4. Liste os passos de verificação: idade do CNPJ, quadro societário (procurar sócios em comum com dirigentes partidários), endereço, contratos públicos do mesmo CNPJ.
5. Separe explicitamente o que é padrão esperado de campanha e o que merece apuração.

Dados (despesas do grupo partido×UF):
{{cole_despesas_grupo}}',
    '[
      {"nome":"partido","dica":"Sigla do partido (ex.: MDB)."},
      {"nome":"uf","dica":"UF do grupo analisado (ex.: AC)."},
      {"nome":"ano","dica":"Ano da eleição."},
      {"nome":"cole_despesas_grupo","dica":"Copie da página de Qualidade o card do sinal fornecedor_campanha_concentrado, ou monte a lista pelas fichas dos candidatos.","href":"/qualidade","hrefLabel":"Sinais detectados"}
    ]'::jsonb,
    ARRAY['tse', 'campanha', 'fornecedor'],
    40
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

-- 3) Tutorial -----------------------------------------------------------------
INSERT INTO public.artigos (slug, titulo, categoria, resumo, conteudo_md, publico, publicado_em, dificuldade, tempo_estimado_min, fontes_usadas, ordem)
SELECT
  'como-ler-uma-prestacao-de-contas-de-campanha',
  'Como ler uma prestação de contas de campanha',
  'tutorial',
  'O vocabulário mínimo para entender receitas e despesas eleitorais: fundo eleitoral, doação de pessoa física, autofinanciamento, recursos estimáveis.',
  $md$
## Por que isso importa

Toda candidatura é obrigada a declarar ao TSE **de onde veio** e **para onde foi** o dinheiro da campanha. Essa prestação de contas é pública — e é uma das melhores janelas para entender a quem um político deve favores. Mas os termos confundem. Este tutorial resolve o vocabulário.

## Receita: de onde vem o dinheiro

- **Fundo Especial de Financiamento de Campanha (FEFC, "fundo eleitoral")** — dinheiro público distribuído aos partidos em ano de eleição. Desde 2018 é a maior fonte da maioria das campanhas.
- **Fundo partidário** — dinheiro público de manutenção dos partidos, que também pode ir para campanhas.
- **Doação de pessoa física** — qualquer cidadão pode doar até 10% dos rendimentos declarados no ano anterior. O CPF do doador aparece **mascarado** nos dados abertos (`***.NNN.NNN-**`) — proteção aplicada pelo próprio TSE.
- **Doação de empresas (PJ)** — **proibida para dinheiro desde 2015** (STF, ADI 4650). Se você vê CNPJ como doador, olhe o tipo: costuma ser doação **estimável** antiga (2014), partido/comitê (que têm CNPJ), ou cessão registrada de outra natureza.
- **Recursos próprios (autofinanciamento)** — o candidato banca a própria campanha, com limite legal.
- **Recursos estimáveis em dinheiro** — bens e serviços doados em espécie (cessão de carro, escritório, serviço voluntário especializado). Não passam pela conta bancária, mas contam.
- **Doador originário** — quando o dinheiro chega via partido/comitê, a lei manda declarar de quem ele veio ANTES. É o campo que impede a lavagem do doador atrás da sigla.

## Despesa: para onde vai

- **Despesa contratada** — o compromisso assumido (o que usamos como "despesas de campanha").
- **Despesa paga** — a saída efetiva do caixa. Contratado ≠ pago: sobras e dívidas de campanha existem.
- Categorias que concentram gasto: publicidade (gráfica, rádio/TV, impulsionamento), pessoal de rua, transporte, advogados e contadores.

## O ciclo completo

**Demanda** (campanha precisa de recursos) → **Conexão** (doações e fundo entram na conta oficial; recibos eleitorais registram cada entrada) → **Resultado** (despesas contratadas e pagas; prestação FINAL julgada pela Justiça Eleitoral). Candidato **eleito** que não presta contas finais fica impedido de diplomação — por isso a ausência total de contas de um eleito é uma **lacuna** que sinalizamos.

## Onde os dados moram

- **Aqui**: ficha de cada candidato em [Eleições](/eleicoes) (receitas, despesas, bens, votos).
- **Na origem**: CSVs anuais em dadosabertos.tse.jus.br (carga em massa) e o site DivulgaCandContas (consulta individual fresca). Cada ficha tem o link "Ver na fonte oficial".

## Pontos cegos para ficar de olho

- CPF de doador mascarado impede cruzar pessoas físicas — só CNPJs são cruzáveis.
- Recursos estimáveis dependem de autodeclaração de valor — R$ 3.000 por "cessão de veículo" é estimativa, não nota fiscal.
- Contas de 2014/2016 vêm em formato antigo na origem; números baixos demais nesses anos podem ser limitação do dado, não da campanha.
$md$,
  true,
  now(),
  'iniciante',
  20,
  ARRAY['tse'],
  40
WHERE NOT EXISTS (SELECT 1 FROM public.artigos WHERE slug = 'como-ler-uma-prestacao-de-contas-de-campanha');

-- 4) Nota de campo -------------------------------------------------------------
INSERT INTO public.artigos (slug, titulo, categoria, resumo, conteudo_md, publico, publicado_em, fontes_usadas, ordem)
SELECT
  'integracao-fonte-tse',
  'Nota de campo: integrando os dados eleitorais do TSE',
  'nota',
  'Decisões, surpresas e limitações práticas encontradas ao integrar candidatos, bens, votação e contas de campanha (2014–2024) à plataforma.',
  $md$
## O desenho

Duas origens com papéis distintos: os **CSVs do CKAN** (dadosabertos.tse.jus.br) fazem a carga em massa — candidatos, bens, votação por município e prestação de contas, de 2014 a 2024 — e a **API do DivulgaCandContas** (não documentada oficialmente) serve só para revalidação pontual. É o mesmo padrão que já usávamos com o Portal da Transparência: cache em massa + conferência por detalhe.

Como rodamos em Cloudflare Workers (sem disco, com limite de tempo), os zips do TSE — que chegam a 624 MB — **nunca são baixados inteiros**: lemos o diretório central do zip via HTTP Range e descomprimimos em streaming só o arquivo (ano × UF) da rodada. Cada rodada importa um arquivo e salva o progresso; arquivos grandes retomam de onde pararam.

## Surpresas encontradas nos dados

- **O TSE republicou o histórico no layout moderno.** Esperávamos seis layouts diferentes (2014–2024); encontramos cabeçalhos padronizados (`SQ_CANDIDATO`, `SG_UF`…) em todos os anos de candidatos, bens e votação. A exceção são as **contas de 2014/2016**, que seguem no formato legado com cabeçalhos "humanos" ("CPF/CNPJ do doador", "Sigla  Partido" — com dois espaços mesmo).
- **Datas coladas em 2014**: "10/10/201400:00:00", sem espaço antes da hora.
- **Sentinelas variadas**: `#NULO#`, `#NULO`, `#NE`, `-1`, `-3`, `-4` e "NÃO DIVULGÁVEL" — inclusive um CPF de candidato que veio como `-4`.
- **`SQ_RECEITA`/`SQ_DESPESA` existem desde 2018** e são identificadores naturais perfeitos para deduplicação; para 2014/2016 geramos um hash determinístico.
- **O dataset de contas de 2022 tem nome fora do padrão** no CKAN (`dadosabertos-tse-jus-br-dataset-prestacao-de-contas-eleitorais-2022`).

## Decisões que merecem registro

- **Parser dirigido por cabeçalho**, nunca por posição — as pequenas variações entre anos (2016 tem colunas extras) deixam de quebrar a importação.
- **Votação agregada por município** (somamos as zonas) — resultados por seção ficaram fora do escopo.
- **Três tipos de sinal desde o nascimento**: alertas de qualidade rodam durante a importação; lacunas (ex.: eleito sem prestação de contas, confirmada na API antes de publicar) rodam depois; cruzamentos (doador↔fornecedor) são sinais investigativos e nunca se misturam com defeitos de dado.
- **Ponte parlamentar↔candidato**: por CPF na Câmara (a API expõe no detalhe); por nome+UF no Senado (não expõe) — vínculos por nome carregam aviso visível e fila de revisão.

## Limitações que ficaram

- **CPF de doador PF vem mascarado da origem** — cruzamentos pessoa-física são impossíveis por desenho (e é bom que seja assim).
- **Filiações partidárias ficaram para depois**: o dataset é fragmentado por partido×UF, muda mensalmente e lista pessoas físicas nominalmente — decidimos não ingerir até termos um produto agregado que respeite a LGPD.
- A API do DivulgaCandContas pode mudar sem aviso; se passar a exigir chave, a revalidação para até configurarmos `TSE_API_KEY` — a carga em massa não depende dela.
$md$,
  true,
  now(),
  ARRAY['tse'],
  50
WHERE NOT EXISTS (SELECT 1 FROM public.artigos WHERE slug = 'integracao-fonte-tse');
