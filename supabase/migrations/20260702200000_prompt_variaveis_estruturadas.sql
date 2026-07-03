-- Variáveis dos prompts deixam de ser só nomes (text[]) e passam a carregar
-- METADADOS editáveis pelo admin: dica de preenchimento e link INTERNO para
-- onde colher o dado. Assim o Kit faz sentido com os passos de CADA mapa, e a
-- edição acontece toda em /admin/prompts — sem catálogo hardcoded no código.
--
-- Formato de cada item: { "nome": str, "dica"?: str, "href"?: "/rota", "hrefLabel"?: str }

-- 1. text[] -> jsonb (array de objetos {nome}), preservando os nomes existentes.
--    Idempotente e sem subquery no USING (o Postgres proíbe subquery na
--    expressão de transformação de tipo): converte para jsonb de strings e só
--    então remapeia para [{nome}]. O guard evita re-conversão (já é jsonb).
DO $$
BEGIN
  IF (
    SELECT udt_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'prompt_modelos' AND column_name = 'variaveis'
  ) = '_text' THEN
    ALTER TABLE public.prompt_modelos ALTER COLUMN variaveis DROP DEFAULT;
    ALTER TABLE public.prompt_modelos
      ALTER COLUMN variaveis TYPE jsonb USING to_jsonb(COALESCE(variaveis, ARRAY[]::text[]));
    ALTER TABLE public.prompt_modelos ALTER COLUMN variaveis SET DEFAULT '[]'::jsonb;
    UPDATE public.prompt_modelos SET variaveis = COALESCE(
      (SELECT jsonb_agg(jsonb_build_object('nome', e)) FROM jsonb_array_elements_text(variaveis) e),
      '[]'::jsonb
    );
  END IF;
END $$;

-- 2. Semear dica + link por prompt (initial data — dali em diante edita-se pelo admin).
--    Cota parlamentar (CEAP/CEAPS): o CSV e o nome vêm da página do parlamentar.
UPDATE public.prompt_modelos SET variaveis = '[
  {"nome":"parlamentar","dica":"Nome do deputado ou senador investigado.","href":"/camara/deputados","hrefLabel":"Deputados e senadores"},
  {"nome":"periodo","dica":"Intervalo que você quer analisar (ex.: 2023–2024)."},
  {"nome":"limite_pct","dica":"A partir de quanto você considera concentração (ex.: 30)."},
  {"nome":"cole_o_csv","dica":"Exporte o CSV na página do parlamentar (botão Exportar CSV).","href":"/camara/deputados","hrefLabel":"Achar o parlamentar"}
]'::jsonb WHERE titulo = 'Concentração de gastos num fornecedor';

UPDATE public.prompt_modelos SET variaveis = '[
  {"nome":"parlamentar","dica":"Nome do deputado ou senador investigado.","href":"/camara/deputados","hrefLabel":"Deputados e senadores"},
  {"nome":"ano","dica":"Ano de referência (ex.: 2024)."},
  {"nome":"teto_mensal","dica":"Valor do teto da cota no estado do parlamentar."},
  {"nome":"cole_o_csv","dica":"Exporte o CSV na página do parlamentar (botão Exportar CSV).","href":"/camara/deputados","hrefLabel":"Achar o parlamentar"}
]'::jsonb WHERE titulo = 'Gastos atípicos e teto mensal';

UPDATE public.prompt_modelos SET variaveis = '[
  {"nome":"parlamentar","dica":"Nome do deputado ou senador investigado.","href":"/camara/deputados","hrefLabel":"Deputados e senadores"},
  {"nome":"recorte","dica":"Partido ou estado com que comparar."},
  {"nome":"cole_csv_A","dica":"CSV de despesas do parlamentar principal.","href":"/camara/deputados","hrefLabel":"Achar o parlamentar"},
  {"nome":"cole_csv_B","dica":"CSV de despesas dos parlamentares de comparação.","href":"/camara/deputados","hrefLabel":"Achar os pares"}
]'::jsonb WHERE titulo = 'Comparação com os pares';

UPDATE public.prompt_modelos SET variaveis = '[
  {"nome":"cole_dados_fornecedor","dica":"Abra o fornecedor (CNPJ) e use Copiar dados.","href":"/buscar","hrefLabel":"Buscar fornecedor"}
]'::jsonb WHERE titulo = 'Raio-x de fornecedor suspeito';

--    Emendas: o CSV e o autor vêm da página de Emendas (não da lista de parlamentares).
UPDATE public.prompt_modelos SET variaveis = '[
  {"nome":"parlamentar","dica":"Autor da emenda.","href":"/emendas","hrefLabel":"Emendas (filtro por autor)"},
  {"nome":"periodo","dica":"Intervalo que você quer analisar (ex.: 2023–2024)."},
  {"nome":"cole_o_csv","dica":"Exporte o CSV em Emendas com os filtros aplicados.","href":"/emendas","hrefLabel":"Emendas"}
]'::jsonb WHERE titulo = 'Raio-x das emendas de um parlamentar';

UPDATE public.prompt_modelos SET variaveis = '[
  {"nome":"recorte","dica":"UF, função ou tipo de emenda para recortar."},
  {"nome":"cole_o_csv","dica":"Exporte o CSV em Emendas com os filtros aplicados.","href":"/emendas","hrefLabel":"Emendas"}
]'::jsonb WHERE titulo = 'Funil da execução: empenhado → liquidado → pago';

UPDATE public.prompt_modelos SET variaveis = '[
  {"nome":"cole_dados_emenda","dica":"Abra a emenda e use Copiar dados.","href":"/emendas","hrefLabel":"Emendas"},
  {"nome":"cole_csv_convenios","dica":"Exporte em Convênios com o filtro do município/órgão.","href":"/convenios","hrefLabel":"Convênios"}
]'::jsonb WHERE titulo = 'Da emenda ao convênio: casando as duas pontas';

UPDATE public.prompt_modelos SET variaveis = '[
  {"nome":"ano","dica":"Ano de referência (ex.: 2024)."},
  {"nome":"cole_o_csv","dica":"Exporte o CSV em Emendas filtrando por tipo Relator (RP9).","href":"/emendas","hrefLabel":"Emendas"}
]'::jsonb WHERE titulo = 'O que dá (e o que não dá) para saber de uma emenda de relator (RP9)';
