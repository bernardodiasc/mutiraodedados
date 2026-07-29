import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/tratamento-de-dados")({
  component: TratamentoPage,
  head: () => ({
    meta: [
      { title: "Tratamento de Dados Públicos — Mutirão de Dados" },
      { name: "description", content: "Como dados públicos são reprocessados pelo Mutirão de Dados, princípio da minimização e o que deliberadamente não republicamos." },
      { property: "og:title", content: "Tratamento de Dados Públicos — Mutirão de Dados" },
      { property: "og:description", content: "Minimização, sanitização e responsabilidade no tratamento de dados administrativos." },
    ],
  }),
});

function TratamentoPage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-12 prose-civic">
      <span className="inline-block text-xs font-semibold tracking-widest text-accent uppercase">Governança</span>
      <h1 className="font-display text-5xl leading-[0.95] mt-2">Tratamento de dados públicos</h1>
      <p className="mt-6 text-lg text-muted-foreground">
        Dado público não é dado livre de cuidado. O Mutirão de Dados reorganiza informações de
        portais governamentais para fins de transparência e controle social — e o faz sob os
        princípios da minimização, da proporcionalidade e do interesse público.
      </p>

      <h2 className="font-display text-2xl mt-10">A premissa</h2>
      <p className="mt-3 text-muted-foreground">
        O fato de uma informação constar em portal oficial <strong className="text-foreground">não autoriza
        automaticamente</strong> sua republicação sem critério. A LGPD (Lei nº 13.709/2018), mesmo no
        tratamento de dados de acesso público, exige finalidade legítima, adequação e
        proporcionalidade (art. 6º). O Marco Civil da Internet (Lei nº 12.965/2014) impõe
        responsabilidade civil pelo conteúdo agregado e contextualizado por intermediários.
      </p>
      <p className="mt-3 text-muted-foreground">
        Por isso aplicamos, antes da exibição, um conjunto de filtros e princípios.
      </p>

      <h2 className="font-display text-2xl mt-10">O que reprocessamos</h2>
      <ul className="mt-3 space-y-2 text-muted-foreground">
        <li><strong className="text-foreground">Dados estritamente administrativos</strong> — valor, modalidade, data, objeto, órgão contratante e fornecedor (pessoa jurídica).</li>
        <li><strong className="text-foreground">Identificadores empresariais</strong> — CNPJ, razão social. São dados públicos de natureza não pessoal.</li>
        <li><strong className="text-foreground">Indicadores derivados</strong> — séries históricas, agregações, sinais investigativos.</li>
      </ul>

      <h2 className="font-display text-2xl mt-10">O que não republicamos</h2>
      <p className="mt-3 text-muted-foreground">
        Ainda que apareçam em documentos públicos originais, são automaticamente mascarados
        antes da exibição:
      </p>
      <ul className="mt-3 space-y-2 text-muted-foreground">
        <li>CPF de servidores, sócios ou terceiros;</li>
        <li>Endereços residenciais;</li>
        <li>Telefones e e-mails pessoais identificáveis;</li>
        <li>RG, dados bancários, dados médicos;</li>
        <li>Assinaturas digitalizadas ou metadados sensíveis em anexos.</li>
      </ul>
      <p className="mt-3 text-muted-foreground">
        Quando o campo "objeto" de um contrato contém esses dados em texto livre, o sistema
        aplica máscara automatizada. Em casos de exposição residual, qualquer pessoa pode
        acionar o canal de <Link to="/contestar" className="text-accent underline">contestação</Link>.
      </p>

      <h2 className="font-display text-2xl mt-10">Pessoas físicas mencionadas</h2>
      <p className="mt-3 text-muted-foreground">
        A plataforma não constrói perfis nominais de servidores, parlamentares ou cidadãos.
        O foco analítico é institucional — órgãos, fornecedores empresariais e padrões
        agregados. Não publicamos rankings de pessoas físicas baseados em dados administrativos.
      </p>

      <h2 className="font-display text-2xl mt-10">Direito de retificação</h2>
      <p className="mt-3 text-muted-foreground">
        Órgãos públicos podem pedir correção quando entenderem que um dado oriundo do portal
        oficial esteja desatualizado ou incompleto em nossa base. Empresas podem pedir revisão
        de classificação automatizada que considerem inadequada. Cidadãos podem solicitar
        anonimização ou remoção de dados pessoais expostos involuntariamente.
      </p>
      <p className="mt-3 text-muted-foreground">
        Veja a página <Link to="/contestar" className="text-accent underline">Contestar</Link> para
        o procedimento detalhado.
      </p>

      <h2 className="font-display text-2xl mt-10">Fontes oficiais preservadas</h2>
      <p className="mt-3 text-muted-foreground">
        Toda análise mantém vínculo com o documento de origem. Quem desejar verificar o dado
        bruto é redirecionado ao portal oficial — a plataforma é uma camada interpretativa,
        não substitui a fonte primária.
      </p>
    </article>
  );
}
