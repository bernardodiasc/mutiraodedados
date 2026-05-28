import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/termos")({
  component: TermosPage,
  head: () => ({
    meta: [
      { title: "Termos de Uso — Auditoria Cidadã" },
      { name: "description", content: "Condições de uso da plataforma Auditoria Cidadã. Natureza experimental, responsabilidades do usuário e limites de interpretação dos dados." },
      { property: "og:title", content: "Termos de Uso — Auditoria Cidadã" },
      { property: "og:description", content: "Regras de uso, vedações e limites de responsabilidade." },
    ],
  }),
});

function TermosPage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-12 prose-civic">
      <span className="inline-block text-xs font-semibold tracking-widest text-accent uppercase">Governança</span>
      <h1 className="font-display text-5xl leading-[0.95] mt-2">Termos de Uso</h1>
      <p className="mt-4 text-sm text-muted-foreground">Última atualização: maio de 2026 — versão experimental, sujeita a revisão jurídica.</p>

      <h2 className="font-display text-2xl mt-10">1. Natureza da plataforma</h2>
      <p className="mt-3 text-muted-foreground">
        A Auditoria Cidadã é uma plataforma <strong className="text-foreground">experimental</strong> de
        pesquisa em transparência pública. Seu propósito é reorganizar, contextualizar e
        interpretar dados administrativos publicados por entes governamentais. Não substitui
        órgãos oficiais de controle (CGU, TCU, Ministério Público).
      </p>

      <h2 className="font-display text-2xl mt-10">2. Conteúdo analítico</h2>
      <p className="mt-3 text-muted-foreground">
        Sinais investigativos publicados aqui são resultado de regras estatísticas explicáveis
        (consulte a <Link to="/metodologia" className="text-accent underline">Metodologia</Link>).
        Anomalia estatística <strong className="text-foreground">não constitui</strong> indício jurídico,
        prova, parecer técnico ou conclusão sobre conduta. A plataforma não atribui responsabilidade
        a pessoas físicas ou jurídicas.
      </p>

      <h2 className="font-display text-2xl mt-10">3. Uso responsável</h2>
      <p className="mt-3 text-muted-foreground">
        Ao utilizar, citar ou compartilhar análises da plataforma, o usuário compromete-se a:
      </p>
      <ul className="mt-3 space-y-2 text-muted-foreground">
        <li>Não atribuir caráter conclusivo aos sinais aqui apresentados;</li>
        <li>Não usar a plataforma para difamação, calúnia, injúria ou perseguição;</li>
        <li>Indicar a Auditoria Cidadã como fonte secundária e o portal oficial como fonte primária;</li>
        <li>Respeitar os direitos de terceiros, em especial a presunção de inocência e a honra.</li>
      </ul>

      <h2 className="font-display text-2xl mt-10">4. Marcações cidadãs</h2>
      <p className="mt-3 text-muted-foreground">
        Comentários e marcações associadas ao perfil do usuário são <strong className="text-foreground">públicos</strong> e
        de responsabilidade exclusiva de quem os publica. A plataforma poderá remover conteúdo
        que viole estes termos ou a legislação vigente, sem prejuízo de cooperação com autoridades.
      </p>

      <h2 className="font-display text-2xl mt-10">5. Propriedade intelectual</h2>
      <p className="mt-3 text-muted-foreground">
        Os dados públicos reorganizados pertencem ao Estado brasileiro e são de livre acesso.
        A camada interpretativa, o código, o desenho e os textos editoriais da plataforma são
        de autoria do projeto e disponibilizados para uso não comercial com atribuição.
      </p>

      <h2 className="font-display text-2xl mt-10">6. Limitação de responsabilidade</h2>
      <p className="mt-3 text-muted-foreground">
        A plataforma é fornecida "no estado em que se encontra". Não nos responsabilizamos por
        decisões tomadas com base exclusiva em seus indicadores. Dados públicos podem conter
        erros de origem; análises podem refletir essas limitações.
      </p>

      <h2 className="font-display text-2xl mt-10">7. Contestação</h2>
      <p className="mt-3 text-muted-foreground">
        Órgãos, empresas e cidadãos podem solicitar correção ou retirada de análises específicas
        — veja <Link to="/contestar" className="text-accent underline">Contestar uma análise</Link>.
      </p>

      <h2 className="font-display text-2xl mt-10">8. Foro</h2>
      <p className="mt-3 text-muted-foreground">
        Eventuais controvérsias serão dirimidas pelo foro da Comarca de São Paulo/SP, salvo
        disposição legal em contrário.
      </p>
    </article>
  );
}
