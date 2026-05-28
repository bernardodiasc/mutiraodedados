import { FileText, ScrollText, Handshake, Wallet, Eye } from "lucide-react";

const ETAPAS = [
  { icon: ScrollText, titulo: "Edital", desc: "Órgão publica edital no PNCP com objeto, modalidade e estimativa." },
  { icon: FileText, titulo: "Proposta", desc: "Fornecedores enviam propostas; sessão pública registra lances." },
  { icon: Handshake, titulo: "Contrato", desc: "Empenho e assinatura geram número de controle PNCP rastreável." },
  { icon: Wallet, titulo: "Execução", desc: "Pagamentos aparecem no Portal da Transparência por empenho." },
  { icon: Eye, titulo: "Fiscalização", desc: "Cidadão cruza valor, fornecedor e histórico para detectar anomalias." },
];

export function FluxoContratoPNCP() {
  return (
    <ol className="grid grid-cols-1 sm:grid-cols-5 gap-3">
      {ETAPAS.map((e, i) => {
        const Icon = e.icon;
        return (
          <li
            key={e.titulo}
            className="relative rounded-lg border border-border bg-background p-3 flex flex-col gap-2"
          >
            <div className="flex items-center gap-2">
              <span className="size-6 rounded-full bg-accent/15 text-accent text-xs font-semibold flex items-center justify-center">
                {i + 1}
              </span>
              <Icon className="size-4 text-accent" />
            </div>
            <div className="font-medium text-sm">{e.titulo}</div>
            <div className="text-xs text-muted-foreground leading-relaxed">{e.desc}</div>
          </li>
        );
      })}
    </ol>
  );
}