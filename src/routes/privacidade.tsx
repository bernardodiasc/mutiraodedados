import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/privacidade")({
  component: PrivacidadePage,
  head: () => ({
    meta: [
      { title: "Política de Privacidade — Mutirão de Dados" },
      { name: "description", content: "Como o Mutirão de Dados trata dados pessoais. Bases legais, direitos do titular e contato do encarregado." },
      { property: "og:title", content: "Política de Privacidade — Mutirão de Dados" },
      { property: "og:description", content: "Tratamento de dados pessoais conforme a LGPD." },
    ],
  }),
});

function PrivacidadePage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-12 prose-civic">
      <span className="inline-block text-xs font-semibold tracking-widest text-accent uppercase">Governança</span>
      <h1 className="font-display text-5xl leading-[0.95] mt-2">Política de Privacidade</h1>
      <p className="mt-4 text-sm text-muted-foreground">Última atualização: maio de 2026 — versão experimental, sujeita a revisão jurídica.</p>

      <p className="mt-6 text-lg text-muted-foreground">
        Esta política descreve como o Mutirão de Dados trata dados pessoais, em conformidade
        com a Lei Geral de Proteção de Dados Pessoais (Lei nº 13.709/2018 — LGPD).
      </p>

      <h2 className="font-display text-2xl mt-10">1. Quem somos</h2>
      <p className="mt-3 text-muted-foreground">
        Mutirão de Dados é uma iniciativa independente voltada à pesquisa em transparência
        pública e controle social. A plataforma reorganiza e contextualiza dados públicos
        administrativos.
      </p>

      <h2 className="font-display text-2xl mt-10">2. Dados que tratamos</h2>
      <p className="mt-3 text-muted-foreground"><strong className="text-foreground">Dados de cadastro:</strong> e-mail e nome de exibição informados voluntariamente no cadastro.</p>
      <p className="mt-2 text-muted-foreground"><strong className="text-foreground">Dados de uso:</strong> marcações cidadãs e comentários públicos associados ao perfil do usuário autenticado.</p>
      <p className="mt-2 text-muted-foreground"><strong className="text-foreground">Dados administrativos públicos:</strong> contratos, fornecedores e órgãos obtidos de fontes oficiais. Veja o tratamento específico em <Link to="/tratamento-de-dados" className="text-accent underline">Tratamento de Dados Públicos</Link>.</p>

      <h2 className="font-display text-2xl mt-10">3. Bases legais</h2>
      <ul className="mt-3 space-y-2 text-muted-foreground">
        <li><strong className="text-foreground">Consentimento</strong> (art. 7º, I) — cadastro e marcações cidadãs.</li>
        <li><strong className="text-foreground">Legítimo interesse</strong> (art. 7º, IX) — operação e segurança da plataforma.</li>
        <li><strong className="text-foreground">Estudos por órgão de pesquisa</strong> e <strong className="text-foreground">interesse público</strong> (art. 7º, IV e III) — reprocessamento de dados administrativos públicos para fins de transparência e controle social.</li>
      </ul>

      <h2 className="font-display text-2xl mt-10">4. Compartilhamento</h2>
      <p className="mt-3 text-muted-foreground">
        Não vendemos dados pessoais. Operamos sobre infraestrutura de terceiros (provedores de
        hospedagem e autenticação) sob contratos que vedam uso autônomo dos dados. Marcações
        cidadãs são públicas por desenho — quem comenta deve assumir essa visibilidade.
      </p>

      <h2 className="font-display text-2xl mt-10">5. Direitos do titular</h2>
      <p className="mt-3 text-muted-foreground">
        Você pode, a qualquer momento, solicitar acesso, correção, anonimização ou eliminação
        de seus dados pessoais (art. 18 da LGPD). Pedidos devem ser enviados ao encarregado,
        no canal indicado abaixo.
      </p>

      <h2 className="font-display text-2xl mt-10">6. Retenção</h2>
      <p className="mt-3 text-muted-foreground">
        Dados de cadastro são mantidos enquanto a conta estiver ativa. Marcações cidadãs
        permanecem associadas ao perfil; podem ser anonimizadas a pedido. Logs técnicos têm
        retenção limitada ao necessário para auditoria de segurança.
      </p>

      <h2 className="font-display text-2xl mt-10">7. Segurança</h2>
      <p className="mt-3 text-muted-foreground">
        Adotamos controles técnicos compatíveis com o estado da arte — autenticação, isolamento
        por linha (RLS), criptografia em trânsito. Incidentes serão comunicados conforme art. 48
        da LGPD.
      </p>

      <h2 className="font-display text-2xl mt-10">8. Encarregado (DPO)</h2>
      <div className="mt-3 border border-border rounded-xl bg-card p-5 not-prose">
        <div className="grid sm:grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Encarregado de Dados</div>
            <div className="font-semibold mt-1">A definir</div>
            <div className="text-xs text-muted-foreground mt-1">Indicação formal pendente de publicação na próxima revisão.</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Canal oficial</div>
            <Link className="font-semibold text-accent block mt-1" to="/contestar">Formulário de contestação</Link>
            <div className="text-xs text-muted-foreground mt-1">Prazo indicativo: 15 dias úteis. Para PII exposta: até 72h para retirada provisória.</div>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-4">
          Pedidos de exercício de direitos do titular (art. 18 da LGPD) podem ser formalizados
          também pelo formulário em <Link to="/contestar" className="text-accent underline">Contestar</Link>,
          que gera protocolo rastreável.
        </p>
      </div>

      <h2 className="font-display text-2xl mt-10">9. Cookies e telemetria</h2>
      <p className="mt-3 text-muted-foreground">
        Atualmente a plataforma usa apenas cookies estritamente necessários (sessão de
        autenticação). Não há rastreadores de terceiros, pixels publicitários ou
        ferramentas de analytics comportamental. Caso ferramentas de medição agregada
        sejam adotadas no futuro, esta seção será atualizada e um aviso de cookies será
        exibido antes do consentimento.
      </p>

      <h2 className="font-display text-2xl mt-10">10. Alterações</h2>
      <p className="mt-3 text-muted-foreground">
        Esta política pode ser revisada para refletir mudanças legais, operacionais ou
        metodológicas. Alterações relevantes serão sinalizadas na home da plataforma.
      </p>
    </article>
  );
}
