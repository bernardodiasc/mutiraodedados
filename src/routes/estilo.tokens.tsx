import { createFileRoute } from "@tanstack/react-router";
import { TokensSection } from "@/components/style-guide/TokensSection";

export const Route = createFileRoute("/estilo/tokens")({
  component: () => (
    <>
      <header>
        <h1 className="font-display text-3xl">Tokens visuais</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Tokens definidos em <code>src/styles.css</code>.
        </p>
      </header>
      <TokensSection />
    </>
  ),
});
