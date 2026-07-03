import type { ViewVariants } from "@/lib/style-guide/registry";
import type { KitInvestigacaoViewProps } from "@/components/KitInvestigacaoView";
import type { PromptModelo } from "@/lib/prompt-modelos.functions";

const prompt = (over: Partial<PromptModelo>): PromptModelo => ({
  id: "pm1",
  titulo: "Concentração de gastos num fornecedor",
  descricao: "Agrupa por CNPJ e mede quanto do total foi para poucos fornecedores.",
  prompt_template: "Você vai analisar…",
  variaveis: [
    {
      nome: "parlamentar",
      dica: "Nome do deputado ou senador investigado.",
      href: "/camara/deputados",
      hrefLabel: "Deputados e senadores",
    },
    { nome: "periodo", dica: "Intervalo que você quer analisar (ex.: 2023–2024)." },
    {
      nome: "cole_o_csv",
      dica: "Exporte o CSV na página do parlamentar.",
      href: "/camara/deputados",
      hrefLabel: "Achar o parlamentar",
    },
  ],
  tags: ["ceap"],
  ordem: 10,
  ativo: true,
  created_at: "2026-07-02",
  updated_at: "2026-07-02",
  ...over,
});

const base: KitInvestigacaoViewProps = {
  slug: "auditar-cota-parlamentar",
  titulo: "Auditando despesas com cota parlamentar",
  obterTextoMapa: () => "# Mapa\n\npassos do mapa…",
  prompts: [
    prompt({}),
    prompt({
      id: "pm2",
      titulo: "Gastos atípicos e teto mensal",
      variaveis: [
        { nome: "parlamentar", dica: "Nome do parlamentar." },
        { nome: "ano", dica: "Ano de referência (ex.: 2024)." },
        { nome: "teto_mensal", dica: "Teto da cota no estado." },
      ],
    }),
  ],
  promptsLoading: false,
  pastas: [],
};

export const kitInvestigacaoVariants: ViewVariants<KitInvestigacaoViewProps> = [
  { label: "com prompts", props: base },
  {
    label: "com pastas em uso",
    props: { ...base, pastas: [{ id: "f1", titulo: "Ciro Nogueira — emendas" }] },
  },
  { label: "carregando prompts", props: { ...base, prompts: [], promptsLoading: true } },
  { label: "sem prompts", props: { ...base, prompts: [] } },
];
