import { createFileRoute } from "@tanstack/react-router";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ExternalLink, Scale, BookOpen, Megaphone, Eye, FileSearch, ShieldCheck, Gavel } from "lucide-react";

export const Route = createFileRoute("/aprender")({
  component: AprenderPage,
  head: () => ({
    meta: [
      { title: "Primeiros passos — Mutirão de Dados" },
      { name: "description", content: "Guia prático: LAI, Lei da Transparência, Lei de Licitações, direitos de fiscalização e como denunciar irregularidades." },
      { property: "og:title", content: "Primeiros passos — Mutirão de Dados" },
      { property: "og:description", content: "Direitos cidadãos de fiscalização, leis-chave e como interpretar dados públicos brasileiros." },
      { property: "og:url", content: "https://mutiraodedados.com.br/aprender" },
    ],
    links: [{ rel: "canonical", href: "https://mutiraodedados.com.br/aprender" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: TOPICOS.map((t) => ({
            "@type": "Question",
            name: t.titulo,
            acceptedAnswer: { "@type": "Answer", text: t.resumo },
          })),
        }),
      },
    ],
  }),
});

type Topico = {
  id: string;
  icon: React.ReactNode;
  titulo: string;
  resumo: string;
  conteudo: React.ReactNode;
};

const TOPICOS: Topico[] = [
  {
    id: "vocabulario",
    icon: <Gavel className="size-5" />,
    titulo: "Anomalia, indício, irregularidade: o que cada palavra significa",
    resumo: "Distinções jurídicas e analíticas que separam um padrão estatístico de uma conclusão sobre conduta.",
    conteudo: (
      <>
        <p>
          O controle social maduro depende de vocabulário preciso. Confundir os termos abaixo
          é o caminho mais curto para a injustiça — tanto a falsa acusação quanto a omissão
          diante do óbvio.
        </p>
        <dl className="mt-4 space-y-3 text-sm">
          <div>
            <dt className="font-semibold text-foreground">Anomalia</dt>
            <dd className="text-muted-foreground">
              Desvio em relação a um padrão estatístico esperado. Descritiva, não atributiva.
              Pode ter explicação inteiramente legítima.
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-foreground">Sinal investigativo</dt>
            <dd className="text-muted-foreground">
              Conjunto de anomalias relacionadas que merece checagem. Vocabulário desta
              plataforma. Ainda não é juízo sobre conduta.
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-foreground">Indício</dt>
            <dd className="text-muted-foreground">
              Categoria jurídica (art. 239 do CPP). Fato conhecido que, por inferência, conduz
              à conclusão sobre outro fato. Requer apuração formal.
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-foreground">Irregularidade administrativa</dt>
            <dd className="text-muted-foreground">
              Conduta que infringe norma de gestão pública. Constatação cabe a órgãos de
              controle (CGU, TCU), não a plataformas analíticas.
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-foreground">Ilegalidade / crime</dt>
            <dd className="text-muted-foreground">
              Tipificação penal. Atribuível apenas mediante devido processo legal, com ampla
              defesa e contraditório.
            </dd>
          </div>
        </dl>
        <p className="mt-4 text-sm">
          Esta plataforma opera na primeira e na segunda categoria. As demais são competência
          de órgãos formais — e quem comunica em nome do controle social ganha credibilidade
          ao respeitar essa distinção.
        </p>
      </>
    ),
  },
  {
    id: "lai",
    icon: <BookOpen className="size-5" />,
    titulo: "Lei de Acesso à Informação (12.527/2011)",
    resumo: "Qualquer pessoa pode pedir informação pública — sem precisar justificar.",
    conteudo: (
      <>
        <p>
          A LAI é o instrumento mais direto do cidadão. Você pede, o órgão responde — em até{" "}
          <strong>20 dias úteis</strong>, prorrogáveis por mais 10. Não precisa explicar para quê.
        </p>
        <ul className="list-disc pl-5 mt-3 space-y-1 text-sm">
          <li>O que pedir: contratos, termos de referência, pareceres, atas, despesas, salários.</li>
          <li>Onde pedir: <strong>Fala.BR</strong> (federal), e-SIC dos estados e municípios.</li>
          <li>Negativa: cabe recurso em até 10 dias; no final, vai à CGU.</li>
          <li>Sigilo só por exceção (segurança nacional, dados pessoais) e com prazo definido.</li>
        </ul>
        <a href="https://falabr.cgu.gov.br/" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-accent mt-3 hover:underline">
          Abrir Fala.BR <ExternalLink className="size-3" />
        </a>
      </>
    ),
  },
  {
    id: "transparencia",
    icon: <Eye className="size-5" />,
    titulo: "Lei da Transparência (Lei Complementar 131/2009)",
    resumo: "Obriga União, estados e municípios a publicarem dados em tempo real.",
    conteudo: (
      <>
        <p>
          Conhecida como Lei Capiberibe, alterou a Lei de Responsabilidade Fiscal. Cada ente
          precisa de um <strong>Portal da Transparência</strong> próprio com receitas, despesas,
          contratos e licitações — em formato aberto e atualizado.
        </p>
        <ul className="list-disc pl-5 mt-3 space-y-1 text-sm">
          <li>Federal: <strong>portaltransparencia.gov.br</strong> (base deste projeto).</li>
          <li>Câmara e Senado têm portais próprios (cota parlamentar, diárias).</li>
          <li>Não publicar transparência ativa pode caracterizar improbidade.</li>
        </ul>
      </>
    ),
  },
  {
    id: "licitacoes",
    icon: <Scale className="size-5" />,
    titulo: "Lei de Licitações (14.133/2021)",
    resumo: "Como o governo compra. Regras, exceções e onde mora o risco.",
    conteudo: (
      <>
        <p>Substituiu a Lei 8.666/93. Modalidades principais:</p>
        <ul className="list-disc pl-5 mt-3 space-y-1 text-sm">
          <li><strong>Pregão</strong> — disputa pública para bens e serviços comuns.</li>
          <li><strong>Concorrência</strong> — obras e contratos maiores.</li>
          <li><strong>Dispensa</strong> — sem licitação, mas só em hipóteses legais (compras de pequeno valor até <strong>R$ 17.600</strong>, emergência, guerra, etc.).</li>
          <li><strong>Inexigibilidade</strong> — quando a competição é inviável (fornecedor exclusivo, notório saber).</li>
        </ul>
        <p className="mt-3 text-sm">
          <strong>Vermelhinho:</strong> sucessão de dispensas logo abaixo do teto, dispensa repetida com
          o mesmo fornecedor, inexigibilidade sem justificativa robusta. Tudo isso vira flag aqui.
        </p>
      </>
    ),
  },
  {
    id: "constituicao",
    icon: <ShieldCheck className="size-5" />,
    titulo: "Seus direitos constitucionais de fiscalização",
    resumo: "A Constituição põe o cidadão como agente legítimo de controle social.",
    conteudo: (
      <ul className="list-disc pl-5 space-y-2 text-sm">
        <li><strong>Art. 5º, XXXIII:</strong> direito de receber informação de órgãos públicos.</li>
        <li><strong>Art. 5º, LXXIII:</strong> ação popular para anular ato lesivo ao patrimônio público.</li>
        <li><strong>Art. 37, §3º, II:</strong> participação do usuário na administração pública.</li>
        <li><strong>Art. 74, §2º:</strong> qualquer cidadão é parte legítima para denunciar irregularidade ao <strong>TCU</strong>.</li>
      </ul>
    ),
  },
  {
    id: "denunciar",
    icon: <Megaphone className="size-5" />,
    titulo: "Como denunciar irregularidades",
    resumo: "Um caminho prático, do menos para o mais formal.",
    conteudo: (
      <ol className="list-decimal pl-5 space-y-2 text-sm">
        <li><strong>Ouvidoria do órgão</strong> — primeira instância, prazo legal de resposta.</li>
        <li><strong>Fala.BR (CGU)</strong> — denúncia federal centralizada, pode ser anônima.</li>
        <li><strong>TCU (Tribunal de Contas)</strong> — controle externo das contas públicas.</li>
        <li><strong>Ministério Público Federal</strong> — quando há indício de crime.</li>
        <li><strong>Polícia Federal</strong> — em casos de fraude, corrupção, peculato.</li>
      </ol>
    ),
  },
  {
    id: "interpretar",
    icon: <FileSearch className="size-5" />,
    titulo: "Como interpretar dados públicos",
    resumo: "Diferença entre anomalia e ilegalidade. Comparar antes de concluir.",
    conteudo: (
      <>
        <p>
          <strong>Anomalia ≠ ilegalidade.</strong> Esta plataforma marca padrões incomuns —
          eles podem ter explicação legítima (uma demanda nova, uma emergência real). Servem como
          convite à checagem.
        </p>
        <ul className="list-disc pl-5 mt-3 space-y-1 text-sm">
          <li>Compare valores em <strong>termos relativos</strong> (per capita, % do orçamento).</li>
          <li>Use <strong>série histórica</strong>: um número isolado raramente informa muito.</li>
          <li>Cheque a <strong>fonte primária</strong> — o link para o Portal está sempre presente.</li>
          <li>Evite atribuir intenção: descreva o padrão, deixe o leitor concluir.</li>
        </ul>
      </>
    ),
  },
];

function AprenderPage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-12">
      <span className="inline-block text-xs font-semibold tracking-widest text-accent uppercase">
        Guia cidadão
      </span>
      <h1 className="font-display text-5xl leading-[0.95] mt-2">Aprender a interpretar</h1>
      <p className="mt-6 text-lg text-muted-foreground">
        Fiscalizar o poder público é um direito constitucional — mas exige vocabulário
        próprio, conhecimento do funcionamento administrativo e prudência ao tirar
        conclusões. Esta seção reúne, em linguagem analítica, o repertório mínimo para uma
        leitura informada do Estado.
      </p>
      <p className="mt-3 text-sm text-muted-foreground">
        Começamos pelas distinções conceituais — porque a palavra que se escolhe define o que
        se acusa — e seguimos para os instrumentos legais, modalidades de contratação e
        canais formais de pedido de informação e denúncia.
      </p>

      <div className="mt-10 space-y-3">
        {TOPICOS.map(t => (
          <Accordion key={t.id} type="single" collapsible>
            <AccordionItem value={t.id} className="border border-border rounded-xl bg-card px-5">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-start gap-3 text-left">
                  <div className="size-9 rounded-md bg-accent/10 text-accent flex items-center justify-center shrink-0">
                    {t.icon}
                  </div>
                  <div>
                    <div className="font-display text-lg leading-tight">{t.titulo}</div>
                    <div className="text-sm text-muted-foreground mt-0.5">{t.resumo}</div>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground leading-relaxed pt-2">
                {t.conteudo}
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        ))}
      </div>

      <div className="mt-12 border-l-2 border-accent pl-4 text-sm text-muted-foreground">
        Esta seção é educacional e <strong>não substitui orientação jurídica</strong>. Para casos
        concretos, procure a Defensoria Pública, a OAB ou um advogado de sua confiança.
      </div>
    </article>
  );
}