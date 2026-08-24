import {
  Building2,
  ChevronDown,
  ExternalLink,
  FileText,
  Loader2,
  Search,
  Send,
  Terminal,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { BotaoCopiar } from "@/components/BotaoCopiar";
import type { IconePassoInvestigacao, PassoInvestigacao } from "@/lib/painel-investigar/logic";
import type { PromptModelo } from "@/lib/prompt-modelos.functions";

const ICONES: Record<IconePassoInvestigacao, typeof Search> = {
  documento: FileText,
  empresa: Building2,
  busca: Search,
  envio: Send,
  terminal: Terminal,
};

export type PainelInvestigarViewProps = {
  titulo?: string;
  descricao?: string;
  passos: PassoInvestigacao[];
  /** Prompts do banco (mapa vinculado) — nunca hardcode. */
  prompts?: PromptModelo[];
  promptsLoading?: boolean;
  rotuloGatilho?: string;
};

/**
 * Painel "Investigar" — Sheet lateral padrão do site para instrução de
 * investigação: passo a passo cidadão e, quando a página tem mapa vinculado,
 * os prompts do banco. Fica fora do fluxo: a tela mostra os dados, o roteiro
 * abre por cima.
 */
export function PainelInvestigarView({
  titulo = "Como investigar",
  descricao = "Esta é uma rota cidadã — não substitui controle profissional. Anomalia estatística não comprova ilegalidade.",
  passos,
  prompts,
  promptsLoading = false,
  rotuloGatilho = "Investigar",
}: PainelInvestigarViewProps) {
  return (
    <Sheet>
      <SheetTrigger className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-md border border-border bg-background hover:bg-muted">
        <Search className="size-3.5" aria-hidden /> {rotuloGatilho}
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="font-display text-2xl leading-tight">{titulo}</SheetTitle>
          <SheetDescription className="text-xs">{descricao}</SheetDescription>
        </SheetHeader>

        <ol className="mt-6 space-y-5">
          {passos.map((p, i) => {
            const Icone = ICONES[p.icone ?? "busca"];
            return (
              <li key={i} className="flex gap-3">
                <div className="size-7 rounded-full bg-accent/10 text-accent flex items-center justify-center shrink-0">
                  <Icone className="size-4" aria-hidden />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm">
                    {i + 1}. {p.titulo}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    {p.texto}
                  </div>
                  {p.codigo && (
                    <div className="mt-2 space-y-1.5">
                      <pre className="text-[11px] leading-relaxed bg-muted rounded-md p-3 whitespace-pre-wrap overflow-auto">
                        {p.codigo}
                      </pre>
                      <BotaoCopiar
                        obterTexto={() => p.codigo!}
                        rotulo="Copiar comando"
                        mensagemToast="Comando copiado"
                      />
                    </div>
                  )}
                  {p.link && (
                    <a
                      href={p.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-accent mt-2 hover:underline"
                    >
                      {p.linkLabel} <ExternalLink className="size-3" aria-hidden />
                    </a>
                  )}
                </div>
              </li>
            );
          })}
        </ol>

        {(promptsLoading || (prompts && prompts.length > 0)) && (
          <section className="mt-8 space-y-3 border-t border-border pt-4">
            <h3 className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Prompts para sua IA
            </h3>
            {promptsLoading ? (
              <div className="text-xs text-muted-foreground flex items-center gap-2">
                <Loader2 className="size-3.5 animate-spin" aria-hidden /> Carregando prompts…
              </div>
            ) : (
              <ul className="space-y-2">
                {prompts!.map((p) => (
                  <li key={p.id} className="rounded-md border">
                    <Collapsible>
                      <CollapsibleTrigger className="group flex w-full items-center gap-2 p-3 text-left hover:bg-muted/40">
                        <ChevronDown
                          className="size-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180"
                          aria-hidden
                        />
                        <span className="text-sm font-medium leading-snug">{p.titulo}</span>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="px-3 pb-3 space-y-3">
                        {p.descricao && (
                          <p className="text-xs text-muted-foreground leading-relaxed">
                            {p.descricao}
                          </p>
                        )}
                        <pre className="text-[11px] leading-relaxed bg-muted rounded-md p-3 whitespace-pre-wrap max-h-64 overflow-auto">
                          {p.prompt_template}
                        </pre>
                        <BotaoCopiar
                          obterTexto={() => p.prompt_template}
                          rotulo="Copiar prompt"
                          mensagemToast="Prompt copiado — preencha as variáveis e cole na sua IA"
                        />
                      </CollapsibleContent>
                    </Collapsible>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </SheetContent>
    </Sheet>
  );
}
PainelInvestigarView.displayName = "PainelInvestigarView";
