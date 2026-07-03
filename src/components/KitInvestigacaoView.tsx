import { Link } from "@tanstack/react-router";
import { ChevronDown, ExternalLink, FolderOpen, Loader2, NotebookPen, Sparkles } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { BotaoCopiar } from "@/components/BotaoCopiar";
import { BotaoSalvarItem } from "@/components/BotaoSalvarItem";
import { descreverVariaveis } from "@/lib/kit-investigacao/logic";
import type { PromptModelo } from "@/lib/prompt-modelos.functions";
import type { PastaResumo } from "@/lib/pergunta-itens.functions";

export type KitInvestigacaoViewProps = {
  slug: string;
  titulo: string;
  /** Texto do mapa pronto para colar numa IA (título, resumo, fontes, passos). */
  obterTextoMapa: () => string;
  prompts: PromptModelo[];
  promptsLoading: boolean;
  /** Pastas do caderno que já contêm prompts deste mapa (só quando logado). */
  pastas: PastaResumo[];
};

/**
 * Kit de investigação: painel lateral dos mapas. Copiar o procedimento,
 * ir ao caderno / pastas em uso, e os prompts do mapa (collapsible, com o
 * texto do prompt visível e as variáveis apontando onde colher cada dado).
 */
export function KitInvestigacaoView({
  slug,
  titulo,
  obterTextoMapa,
  prompts,
  promptsLoading,
  pastas,
}: KitInvestigacaoViewProps) {
  const urlMapa = `/mapas/${slug}`;
  return (
    <div className="rounded-lg border bg-card p-4 space-y-5">
      <div>
        <h2 className="font-display text-lg flex items-center gap-2">
          <Sparkles className="size-4 text-accent" /> Kit de investigação
        </h2>
        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
          Siga os passos do mapa para colher os dados e cole tudo na sua IA de
          confiança junto com um dos prompts abaixo.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <BotaoCopiar
          obterTexto={obterTextoMapa}
          rotulo="Copiar texto do mapa"
          mensagemToast="Mapa copiado — cole na sua IA ou nas suas anotações"
        />
        <BotaoSalvarItem entidadeTipo="mapa" entidadeId={slug} titulo={titulo} url={urlMapa} />
      </div>

      <nav className="space-y-2 border-t border-border pt-4">
        <Link
          to="/caderno"
          className="inline-flex items-center gap-1.5 text-sm font-medium hover:text-accent"
        >
          <NotebookPen className="size-4" /> Meu caderno
        </Link>
        {pastas.length > 0 && (
          <div className="space-y-1">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Pastas com prompts deste mapa
            </div>
            <ul className="flex flex-wrap gap-1.5">
              {pastas.map((p) => (
                <li key={p.id}>
                  <Link
                    to="/caderno/$id"
                    params={{ id: p.id }}
                    className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-accent/10 text-accent hover:bg-accent/20"
                  >
                    <FolderOpen className="size-3" /> {p.titulo}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </nav>

      <section className="space-y-3 border-t border-border pt-4">
        <h3 className="text-[10px] uppercase tracking-wider text-muted-foreground">
          Prompts para sua IA
        </h3>
        {promptsLoading ? (
          <div className="text-xs text-muted-foreground flex items-center gap-2">
            <Loader2 className="size-3.5 animate-spin" /> Carregando prompts…
          </div>
        ) : prompts.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Este mapa ainda não tem prompts cadastrados.
          </p>
        ) : (
          <ul className="space-y-2">
            {prompts.map((p) => (
              <li key={p.id} className="rounded-md border">
                <Collapsible>
                  <CollapsibleTrigger className="group flex w-full items-center gap-2 p-3 text-left hover:bg-muted/40">
                    <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
                    <span className="text-sm font-medium leading-snug">{p.titulo}</span>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="px-3 pb-3 space-y-3">
                    {p.descricao && (
                      <p className="text-xs text-muted-foreground leading-relaxed">{p.descricao}</p>
                    )}

                    {p.variaveis.length > 0 && (
                      <div className="space-y-1.5">
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                          O que preencher
                        </div>
                        <ul className="space-y-1.5">
                          {descreverVariaveis(p.variaveis).map((v) => (
                            <li key={v.nome} className="text-xs leading-relaxed">
                              <code className="px-1 py-0.5 rounded bg-muted text-muted-foreground">
                                {`{{${v.nome}}}`}
                              </code>{" "}
                              <span className="font-medium">{v.rotulo}</span> — {v.dica}
                              {v.href && (
                                <>
                                  {" "}
                                  <a
                                    href={v.href}
                                    className="inline-flex items-center gap-0.5 text-accent hover:underline"
                                  >
                                    {v.hrefLabel ?? "Abrir"} <ExternalLink className="size-3" />
                                  </a>
                                </>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <div className="space-y-1.5">
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        Prompt
                      </div>
                      <pre className="text-[11px] leading-relaxed bg-muted rounded-md p-3 whitespace-pre-wrap max-h-64 overflow-auto">
                        {p.prompt_template}
                      </pre>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <BotaoCopiar
                        obterTexto={() => p.prompt_template}
                        rotulo="Copiar prompt"
                        mensagemToast="Prompt copiado — preencha as variáveis e cole na sua IA"
                      />
                      <BotaoSalvarItem
                        entidadeTipo="prompt"
                        entidadeId={p.id}
                        titulo={p.titulo}
                        url={urlMapa}
                        contexto={p.descricao ?? undefined}
                      />
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </li>
            ))}
          </ul>
        )}
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          Sinal não é prova: gasto aprovado não é irregularidade. Os prompts pedem
          verificações na fonte oficial, nunca acusações.
        </p>
      </section>
    </div>
  );
}
KitInvestigacaoView.displayName = "KitInvestigacaoView";
