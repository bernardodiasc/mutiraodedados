import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetDescription } from "@/components/ui/sheet";
import { Search, ExternalLink, FileText, Building2, Send } from "lucide-react";
import type { Anomalia } from "@/lib/data/types";

export function ChecklistInvestigacao({ anomalia }: { anomalia: Anomalia }) {
  const cnpjQuery = anomalia.entidadeTipo === "fornecedor" ? anomalia.entidadeId : "";
  const cnpjLimpo = cnpjQuery.replace(/\D/g, "");

  const passos = [
    {
      icon: <FileText className="size-4" />,
      titulo: "Leia o objeto e a modalidade",
      texto: "Volte ao(s) contrato(s) envolvidos. Veja se a descrição é específica e se a modalidade (pregão, dispensa, inexigibilidade) faz sentido para o tipo de despesa.",
    },
    {
      icon: <Building2 className="size-4" />,
      titulo: "Cheque o quadro do fornecedor",
      texto: "Procure pelo CNPJ no Cadastro da Receita e em buscadores públicos. Veja capital social, sócios, data de abertura e atividade principal (CNAE).",
      link: cnpjLimpo ? `https://cnpj.biz/${cnpjLimpo}` : null,
      linkLabel: "Abrir CNPJ.biz",
    },
    {
      icon: <Search className="size-4" />,
      titulo: "Compare com pares",
      texto: "Outros fornecedores prestam serviço parecido? Compare valores médios entre órgãos da mesma função. Use /buscar para encontrar contratos análogos pelo CNPJ ou palavra-chave do objeto.",
    },
    {
      icon: <Send className="size-4" />,
      titulo: "Peça informação via LAI",
      texto: "Cidadãos podem solicitar pelo Fala.BR (CGU) o termo de referência, parecer jurídico e justificativa de dispensa. O órgão tem até 20 dias úteis para responder.",
      link: "https://falabr.cgu.gov.br/",
      linkLabel: "Abrir Fala.BR",
    },
    {
      icon: <Send className="size-4" />,
      titulo: "Se houver indício forte, denuncie",
      texto: "Denúncias ao TCU (controle externo) ou ao Ministério Público Federal são gratuitas. Anomalia estatística não basta — descreva o fato, junte evidências e indique o dispositivo legal aparentemente violado.",
      link: "https://contas.tcu.gov.br/ords/f?p=2300",
      linkLabel: "Ouvidoria do TCU",
    },
  ];

  return (
    <Sheet>
      <SheetTrigger className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-md border border-border bg-background hover:bg-muted">
        <Search className="size-3.5" /> Investigar este caso
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="font-display text-2xl leading-tight">Como investigar</SheetTitle>
          <SheetDescription className="text-xs">
            Esta é uma rota cidadã — não substitui controle profissional. Anomalia estatística não comprova ilegalidade.
          </SheetDescription>
        </SheetHeader>
        <ol className="mt-6 space-y-5">
          {passos.map((p, i) => (
            <li key={i} className="flex gap-3">
              <div className="size-7 rounded-full bg-accent/10 text-accent flex items-center justify-center shrink-0">{p.icon}</div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm">{i + 1}. {p.titulo}</div>
                <div className="text-xs text-muted-foreground mt-1 leading-relaxed">{p.texto}</div>
                {p.link && (
                  <a href={p.link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-accent mt-2 hover:underline">
                    {p.linkLabel} <ExternalLink className="size-3" />
                  </a>
                )}
              </div>
            </li>
          ))}
        </ol>
      </SheetContent>
    </Sheet>
  );
}