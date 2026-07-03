import * as React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { FluxoEmbed } from "@/components/fluxos";

// Captura shortcodes: :::fluxo{nome="contrato-pncp"}:::
const SHORTCODE_RE = /:::fluxo\{nome="([a-z0-9-]+)"\}:::/g;

type Segmento = { tipo: "md"; conteudo: string } | { tipo: "fluxo"; nome: string };

function dividir(md: string): Segmento[] {
  const partes: Segmento[] = [];
  let cursor = 0;
  for (const m of md.matchAll(SHORTCODE_RE)) {
    const idx = m.index ?? 0;
    if (idx > cursor) partes.push({ tipo: "md", conteudo: md.slice(cursor, idx) });
    partes.push({ tipo: "fluxo", nome: m[1] });
    cursor = idx + m[0].length;
  }
  if (cursor < md.length) partes.push({ tipo: "md", conteudo: md.slice(cursor) });
  return partes;
}

export function ArtigoRenderer({ conteudo }: { conteudo: string }) {
  const segmentos = React.useMemo(() => dividir(conteudo), [conteudo]);
  return (
    <div className="prose-artigo">
      {segmentos.map((s, i) =>
        s.tipo === "fluxo" ? (
          <FluxoEmbed key={i} nome={s.nome} />
        ) : (
          <ReactMarkdown
            key={i}
            remarkPlugins={[remarkGfm]}
            components={{
              h1: ({ node, ...p }) => <h1 className="font-display text-3xl mt-8 mb-3" {...p} />,
              h2: ({ node, ...p }) => <h2 className="font-display text-2xl mt-8 mb-2" {...p} />,
              h3: ({ node, ...p }) => <h3 className="font-display text-xl mt-6 mb-2" {...p} />,
              p: ({ node, ...p }) => (
                <p className="leading-relaxed text-foreground/90 my-3" {...p} />
              ),
              ul: ({ node, ...p }) => <ul className="list-disc pl-5 my-3 space-y-1" {...p} />,
              ol: ({ node, ...p }) => <ol className="list-decimal pl-5 my-3 space-y-1" {...p} />,
              li: ({ node, ...p }) => <li className="text-foreground/90" {...p} />,
              a: ({ node, ...p }) => (
                <a className="text-accent underline underline-offset-2 hover:opacity-80" {...p} />
              ),
              code: ({ node, ...p }) => (
                <code className="rounded bg-muted px-1 py-0.5 text-[0.85em]" {...p} />
              ),
              blockquote: ({ node, ...p }) => (
                <blockquote
                  className="border-l-2 border-accent/40 pl-4 italic text-muted-foreground my-4"
                  {...p}
                />
              ),
              hr: () => <hr className="my-6 border-border" />,
              table: ({ node, ...p }) => (
                <div className="my-4 overflow-x-auto">
                  <table className="w-full border-collapse text-sm" {...p} />
                </div>
              ),
              thead: ({ node, ...p }) => <thead className="border-b border-border" {...p} />,
              th: ({ node, ...p }) => (
                <th className="px-3 py-2 text-left font-semibold align-top" {...p} />
              ),
              td: ({ node, ...p }) => (
                <td
                  className="border-t border-border px-3 py-2 align-top text-foreground/90"
                  {...p}
                />
              ),
            }}
          >
            {s.conteudo}
          </ReactMarkdown>
        ),
      )}
    </div>
  );
}
