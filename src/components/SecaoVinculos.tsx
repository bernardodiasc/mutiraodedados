import { Link } from "@tanstack/react-router";
import { ArrowRight, ExternalLink, TriangleAlert, type LucideIcon } from "lucide-react";
import type { VinculoItem } from "@/lib/secao-vinculos/logic";

export type SecaoVinculosProps = {
  titulo: string;
  icone: LucideIcon;
  /** Uma frase dizendo o que liga estes registros a esta página. */
  descricao?: string;
  itens: VinculoItem[];
  /** Link de rodapé para a listagem filtrada (ex.: "Ver todos os contratos deste fornecedor"). */
  verTodos?: { label: string; to: string; search?: Record<string, unknown> };
  /** Sobrescreve o aviso exibido nos itens com match deduzido. */
  avisoInferido?: string;
};

const AVISO_INFERIDO_PADRAO =
  "Vínculo deduzido por nome — homônimos podem gerar ligação errada; confira na fonte antes de citar.";

/**
 * Seção padronizada de vínculos entre fontes — toda página que conecta seus
 * dados a registros de outra fonte (contrato→fornecedor, doador→fornecedor,
 * órgão→licitações…) renderiza esta seção, com o mesmo visual e o mesmo
 * aviso quando o match é deduzido. Some quando não há vínculo: seção vazia
 * seria ruído em toda ficha.
 */
export function SecaoVinculos({
  titulo,
  icone: Icone,
  descricao,
  itens,
  verTodos,
  avisoInferido = AVISO_INFERIDO_PADRAO,
}: SecaoVinculosProps) {
  if (itens.length === 0) return null;

  return (
    <section className="border border-border rounded-xl p-5 bg-card">
      <h2 className="font-display text-lg flex items-center gap-2">
        <Icone className="size-4 text-accent" aria-hidden /> {titulo}
      </h2>
      {descricao && <p className="text-sm text-muted-foreground mt-2">{descricao}</p>}

      <ul className="grid gap-2 mt-3">
        {itens.map((item) => (
          <li key={item.chave}>
            {item.to ? (
              // Componente genérico orientado a dados: o cast abre mão da
              // checagem de rota do router — os chamadores passam rotas
              // existentes (vinculoDeCnpj, rotaDaEntidade).
              <Link
                to={item.to as never}
                params={item.params as never}
                search={item.search as never}
                className="flex items-center justify-between gap-3 border border-border rounded-lg px-3 py-2 hover:border-accent hover:text-accent"
              >
                <ConteudoItem item={item} />
                <ArrowRight className="size-4 shrink-0" aria-hidden />
              </Link>
            ) : item.href ? (
              <a
                href={item.href}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between gap-3 border border-border rounded-lg px-3 py-2 hover:border-accent hover:text-accent"
              >
                <ConteudoItem item={item} />
                <ExternalLink className="size-4 shrink-0" aria-hidden />
              </a>
            ) : (
              <div className="flex items-center justify-between gap-3 border border-border rounded-lg px-3 py-2">
                <ConteudoItem item={item} />
              </div>
            )}
            {item.inferido && (
              <p className="text-xs text-muted-foreground mt-1 flex items-start gap-1.5">
                <TriangleAlert className="size-3.5 shrink-0 mt-0.5" aria-hidden />
                {avisoInferido}
              </p>
            )}
          </li>
        ))}
      </ul>

      {verTodos && (
        <Link
          to={verTodos.to as never}
          search={(verTodos.search ?? {}) as never}
          className="text-xs font-semibold text-accent mt-3 inline-block hover:underline underline-offset-4"
        >
          {verTodos.label} →
        </Link>
      )}
    </section>
  );
}
SecaoVinculos.displayName = "SecaoVinculos";

function ConteudoItem({ item }: { item: VinculoItem }) {
  return (
    <span className="min-w-0 flex-1 flex items-center justify-between gap-3">
      <span className="min-w-0">
        <span className="block font-medium truncate">{item.titulo}</span>
        {item.subtitulo && (
          <span className="block text-xs text-muted-foreground">{item.subtitulo}</span>
        )}
      </span>
      {item.valorFmt && (
        <span className="font-mono text-sm shrink-0 text-foreground">{item.valorFmt}</span>
      )}
    </span>
  );
}
