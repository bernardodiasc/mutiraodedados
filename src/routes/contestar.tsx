import { createFileRoute, Link } from "@tanstack/react-router";
import { Send, CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export const Route = createFileRoute("/contestar")({
  component: ContestarPage,
  head: () => ({
    meta: [
      { title: "Contestar uma análise — Mutirão de Dados" },
      {
        name: "description",
        content:
          "Canal de contestação, correção ou remoção de análises publicadas. Procedimento aberto a órgãos, empresas e cidadãos.",
      },
      { property: "og:title", content: "Contestar uma análise — Mutirão de Dados" },
      {
        property: "og:description",
        content: "Procedimento de contestação e correção de análises.",
      },
    ],
  }),
});

const TIPOS = [
  { v: "correcao_factual", l: "Correção factual" },
  { v: "dado_desatualizado", l: "Dado desatualizado" },
  { v: "pii_exposicao", l: "Exposição de dado pessoal" },
  { v: "classificacao_inadequada", l: "Classificação automatizada inadequada" },
  { v: "outro", l: "Outro" },
] as const;

const SOLICITANTES = [
  { v: "cidadao", l: "Cidadão(ã)" },
  { v: "empresa", l: "Empresa / representante legal" },
  { v: "orgao", l: "Órgão público" },
  { v: "representante", l: "Jornalista / pesquisador(a)" },
  { v: "anonimo", l: "Prefiro não me identificar" },
] as const;

const schema = z.object({
  url_pagina: z.string().trim().min(1).max(500),
  tipo: z.enum([
    "correcao_factual",
    "dado_desatualizado",
    "pii_exposicao",
    "classificacao_inadequada",
    "outro",
  ]),
  solicitante_tipo: z.enum(["cidadao", "empresa", "orgao", "representante", "anonimo"]),
  descricao: z.string().trim().min(10, "Descreva com pelo menos 10 caracteres.").max(4000),
  fundamento: z.string().trim().max(4000).optional().or(z.literal("")),
  contato: z.string().trim().max(255).optional().or(z.literal("")),
});

function ContestarPage() {
  const { user } = useAuth();
  const [enviado, setEnviado] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const raw = {
      url_pagina: String(f.get("url_pagina") ?? ""),
      tipo: String(f.get("tipo") ?? "outro"),
      solicitante_tipo: String(f.get("solicitante_tipo") ?? "anonimo"),
      descricao: String(f.get("descricao") ?? ""),
      fundamento: String(f.get("fundamento") ?? ""),
      contato: String(f.get("contato") ?? ""),
    };
    const parsed = schema.safeParse(raw);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Preencha os campos obrigatórios.");
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from("contestacoes")
      .insert({
        url_pagina: parsed.data.url_pagina,
        tipo: parsed.data.tipo,
        solicitante_tipo: parsed.data.solicitante_tipo,
        descricao: parsed.data.descricao,
        fundamento: parsed.data.fundamento || null,
        contato: parsed.data.contato || null,
        user_id: user?.id ?? null,
      })
      .select("id")
      .single();
    setLoading(false);
    if (error) {
      toast.error("Não foi possível registrar a contestação. Tente novamente em instantes.");
      return;
    }
    setEnviado(data!.id);
    (e.target as HTMLFormElement).reset();
  }

  return (
    <article className="mx-auto max-w-3xl px-4 py-12 prose-civic">
      <span className="inline-block text-xs font-semibold tracking-widest text-accent uppercase">
        Governança
      </span>
      <h1 className="font-display text-5xl leading-[0.95] mt-2">Contestar uma análise</h1>
      <p className="mt-6 text-lg text-muted-foreground">
        Qualquer pessoa — cidadã, jurídica ou pública — pode solicitar a correção, a anonimização ou
        a retirada de uma análise específica publicada na plataforma. O procedimento é gratuito e
        aberto.
      </p>

      <h2 className="font-display text-2xl mt-10">Quando contestar</h2>
      <ul className="mt-3 space-y-2 text-muted-foreground">
        <li>
          <strong className="text-foreground">Dado desatualizado ou incompleto</strong> em relação
          ao portal oficial de origem.
        </li>
        <li>
          <strong className="text-foreground">Classificação automatizada inadequada</strong> —
          quando uma anomalia tem explicação documentada que a plataforma não capturou.
        </li>
        <li>
          <strong className="text-foreground">Exposição involuntária de dado pessoal</strong> (CPF,
          telefone, endereço) em campo livre não mascarado.
        </li>
        <li>
          <strong className="text-foreground">Erro factual</strong> na descrição editorial.
        </li>
      </ul>

      <h2 className="font-display text-2xl mt-10">Formulário</h2>
      <p className="mt-3 text-muted-foreground">
        Preencha o formulário abaixo. Sua contestação é registrada com identificador único e
        encaminhada ao encarregado de dados. Pedidos anônimos são aceitos — o contato é opcional,
        mas amplia a celeridade da resposta.
      </p>

      {enviado ? (
        <div className="mt-6 border border-emerald-500/30 bg-emerald-500/5 rounded-xl p-5">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="size-5 text-emerald-400 mt-0.5" />
            <div>
              <div className="font-semibold text-emerald-300">Contestação registrada</div>
              <p className="text-sm text-muted-foreground mt-1">
                Protocolo: <span className="font-mono text-foreground">{enviado.slice(0, 8)}</span>.
                Prazo indicativo de resposta: 15 dias úteis. Se você informou contato, retornaremos
                por lá.
              </p>
              <button
                onClick={() => setEnviado(null)}
                className="mt-3 text-sm text-accent hover:underline"
              >
                Registrar outra contestação
              </button>
            </div>
          </div>
        </div>
      ) : (
        <form
          onSubmit={onSubmit}
          className="mt-6 space-y-5 border border-border rounded-xl bg-card p-6"
        >
          <div className="grid gap-1.5">
            <Label htmlFor="url_pagina">URL da página em questão *</Label>
            <Input
              id="url_pagina"
              name="url_pagina"
              required
              placeholder="https://mutiraodedados.com.br/orgaos/..."
            />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="tipo">Tipo de contestação *</Label>
              <select
                id="tipo"
                name="tipo"
                required
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                {TIPOS.map((t) => (
                  <option key={t.v} value={t.v}>
                    {t.l}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="solicitante_tipo">Quem está contestando *</Label>
              <select
                id="solicitante_tipo"
                name="solicitante_tipo"
                required
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                {SOLICITANTES.map((s) => (
                  <option key={s.v} value={s.v}>
                    {s.l}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="descricao">O que precisa ser corrigido ou removido *</Label>
            <Textarea
              id="descricao"
              name="descricao"
              required
              rows={4}
              maxLength={4000}
              placeholder="Descreva objetivamente o ponto a ser revisto."
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="fundamento">Fundamento (opcional)</Label>
            <Textarea
              id="fundamento"
              name="fundamento"
              rows={3}
              maxLength={4000}
              placeholder="Documento de apoio, ofício, dispositivo legal, link para fonte oficial."
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="contato">Contato para resposta (opcional)</Label>
            <Input
              id="contato"
              name="contato"
              maxLength={255}
              placeholder="e-mail, telefone ou endereço institucional"
            />
          </div>
          <div className="flex items-center justify-between gap-3 pt-2">
            <p className="text-xs text-muted-foreground">
              {user
                ? "Registrado em sua conta para acompanhamento."
                : "Você não está logado — envio anônimo."}
            </p>
            <Button type="submit" disabled={loading}>
              <Send className="size-4 mr-2" /> {loading ? "Enviando…" : "Enviar contestação"}
            </Button>
          </div>
        </form>
      )}

      <h2 className="font-display text-2xl mt-10">Prazo</h2>
      <p className="mt-3 text-muted-foreground">
        Prazo indicativo de resposta: <strong className="text-foreground">15 dias úteis</strong>. Em
        casos de exposição de dado pessoal, a retirada provisória pode ocorrer em até 72 horas,
        enquanto a análise prossegue.
      </p>

      <h2 className="font-display text-2xl mt-10">O que não fazemos</h2>
      <p className="mt-3 text-muted-foreground">
        Não removemos análises legítimas por desconforto reputacional. A contestação é meio de
        correção factual e proteção de dados pessoais, não instrumento de supressão de
        transparência. Veja os{" "}
        <Link to="/termos" className="text-accent underline">
          Termos de Uso
        </Link>{" "}
        e a{" "}
        <Link to="/metodologia" className="text-accent underline">
          Metodologia
        </Link>
        .
      </p>
    </article>
  );
}
