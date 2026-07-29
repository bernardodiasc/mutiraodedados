import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Section } from "./SectionPrimitives";

export function TipografiaSection() {
  return (
    <>
      <Section title="Famílias">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader>
              <CardDescription className="font-mono">--font-display</CardDescription>
              <CardTitle className="font-display text-3xl">Display</CardTitle>
            </CardHeader>
            <CardContent className="font-display text-base">
              ABCDEFGHIJKLMNOPQRSTUVWXYZ 0123456789
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardDescription className="font-mono">--font-sans</CardDescription>
              <CardTitle className="text-3xl">Sans</CardTitle>
            </CardHeader>
            <CardContent className="text-base">
              ABCDEFGHIJKLMNOPQRSTUVWXYZ 0123456789
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardDescription className="font-mono">--font-mono</CardDescription>
              <CardTitle className="font-mono text-3xl">Mono</CardTitle>
            </CardHeader>
            <CardContent className="font-mono text-base">
              ABCDEFGHIJKLMNOPQRSTUVWXYZ 0123456789
            </CardContent>
          </Card>
        </div>
      </Section>

      <Section title="Escala">
        <div className="space-y-3">
          <div className="font-display text-5xl">Heading 1 — display 5xl</div>
          <div className="font-display text-4xl">Heading 2 — display 4xl</div>
          <div className="font-display text-2xl">Heading 3 — display 2xl</div>
          <div className="text-xl">Heading 4 — sans xl</div>
          <p className="text-base">
            Corpo de texto padrão. Mutirão de Dados apresenta dados públicos com sinais
            investigativos, sem fazer acusações. Use parágrafos curtos e tom direto.
          </p>
          <p className="text-sm text-muted-foreground">
            Texto secundário (text-sm + muted-foreground) — descrições e legendas.
          </p>
          <p className="text-xs text-muted-foreground">Texto auxiliar (text-xs).</p>
        </div>
      </Section>
    </>
  );
}