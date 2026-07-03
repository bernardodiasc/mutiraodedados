import type { ReactNode } from "react";
import { ExternalLink, ShieldAlert, AlertTriangle, Building2, FileText, UserCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { EmptyState } from "@/components/EmptyState";
import { ConstrucaoBanner } from "@/components/ConstrucaoBanner";
import { AvisoMetodologico } from "@/components/AvisoMetodologico";
import { MetodologiaPopover } from "@/components/MetodologiaPopover";
import { BotaoCopiar } from "@/components/BotaoCopiar";
import { BotaoBaixarCsv } from "@/components/BotaoBaixarCsv";
import { BotaoFonteOficial } from "@/components/BotaoFonteOficial";
import { SEVERIDADE_BADGE } from "@/lib/style-guide/tokens";
import { qaFindingMocks, contratoMocks, convenioMocks, deputadoMocks } from "@/lib/style-guide/mocks";

export type UIVariant = { label: string; render: () => ReactNode };
export type UIEntry = {
  slug: string;
  name: string;
  group: "Primitivos" | "Formulário" | "Feedback" | "Estrutura" | "Domínio";
  description?: string;
  variants: UIVariant[];
};

export const uiRegistry: UIEntry[] = [
  {
    slug: "button",
    name: "Button",
    group: "Primitivos",
    description: "Variantes de @/components/ui/button.",
    variants: [
      { label: "default", render: () => <Button>default</Button> },
      { label: "secondary", render: () => <Button variant="secondary">secondary</Button> },
      { label: "outline", render: () => <Button variant="outline">outline</Button> },
      { label: "ghost", render: () => <Button variant="ghost">ghost</Button> },
      { label: "link", render: () => <Button variant="link">link</Button> },
      { label: "destructive", render: () => <Button variant="destructive">destructive</Button> },
      { label: "size sm", render: () => <Button size="sm">sm</Button> },
      { label: "size default", render: () => <Button>default</Button> },
      { label: "size lg", render: () => <Button size="lg">lg</Button> },
      { label: "size icon", render: () => <Button size="icon"><ExternalLink /></Button> },
      { label: "disabled", render: () => <Button disabled>disabled</Button> },
    ],
  },
  {
    slug: "badge",
    name: "Badge",
    group: "Primitivos",
    variants: [
      { label: "default", render: () => <Badge>default</Badge> },
      { label: "secondary", render: () => <Badge variant="secondary">secondary</Badge> },
      { label: "outline", render: () => <Badge variant="outline">outline</Badge> },
      { label: "destructive", render: () => <Badge variant="destructive">destructive</Badge> },
      { label: "projeto · crítico", render: () => <Badge variant="destructive">crítico</Badge> },
      { label: "projeto · aviso", render: () => <Badge className="bg-accent text-accent-foreground border-transparent">aviso</Badge> },
      { label: "projeto · info", render: () => <Badge variant="secondary">info</Badge> },
      { label: "projeto · PII", render: () => <Badge variant="outline">PII detectada</Badge> },
      { label: "projeto · anomalia", render: () => <Badge className="bg-accent/20 text-accent border border-accent/40">anomalia</Badge> },
      ...(Object.keys(SEVERIDADE_BADGE) as Array<keyof typeof SEVERIDADE_BADGE>).map((k) => ({
        label: `severidade · ${k}`,
        render: () => {
          const s = SEVERIDADE_BADGE[k];
          return <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold ${s.cls}`}>{s.label}</span>;
        },
      })),
    ],
  },
  {
    slug: "alert",
    name: "Alert",
    group: "Feedback",
    variants: [
      {
        label: "default",
        render: () => (
          <Alert>
            <ShieldAlert />
            <AlertTitle>Aviso padrão</AlertTitle>
            <AlertDescription>Alerta neutro para informações gerais.</AlertDescription>
          </Alert>
        ),
      },
      {
        label: "destructive",
        render: () => (
          <Alert variant="destructive">
            <AlertTriangle />
            <AlertTitle>Erro</AlertTitle>
            <AlertDescription>Algo deu errado ao buscar os dados.</AlertDescription>
          </Alert>
        ),
      },
    ],
  },
  {
    slug: "card",
    name: "Card",
    group: "Estrutura",
    variants: [
      {
        label: "padrão",
        render: () => (
          <Card>
            <CardHeader>
              <CardTitle>Card padrão</CardTitle>
              <CardDescription>Descrição breve.</CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Conteúdo do card. Cards no projeto representam registros individuais.
            </CardContent>
          </Card>
        ),
      },
      {
        label: "clicável (anchor)",
        render: () => (
          <a href="#" className="block">
            <Card>
              <CardHeader>
                <CardTitle>Card clicável</CardTitle>
                <CardDescription>Envolvido em &lt;a&gt; — ganha sombra e lift.</CardDescription>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">Hover para ver elevação.</CardContent>
            </Card>
          </a>
        ),
      },
    ],
  },
  {
    slug: "form-controls",
    name: "Form controls",
    group: "Formulário",
    variants: [
      {
        label: "Input",
        render: () => (
          <div className="space-y-2 max-w-sm">
            <Label htmlFor="sg-input">Input</Label>
            <Input id="sg-input" placeholder="Digite algo" />
          </div>
        ),
      },
      {
        label: "Input disabled",
        render: () => (
          <div className="space-y-2 max-w-sm">
            <Label htmlFor="sg-input-d">Disabled</Label>
            <Input id="sg-input-d" disabled placeholder="Bloqueado" />
          </div>
        ),
      },
      {
        label: "Textarea",
        render: () => (
          <div className="space-y-2 max-w-sm">
            <Label htmlFor="sg-ta">Textarea</Label>
            <Textarea id="sg-ta" placeholder="Texto longo" rows={3} />
          </div>
        ),
      },
      {
        label: "Switch",
        render: () => (
          <div className="flex items-center gap-2">
            <Switch id="sg-switch" />
            <Label htmlFor="sg-switch">Switch</Label>
          </div>
        ),
      },
      {
        label: "Checkbox",
        render: () => (
          <div className="flex items-center gap-2">
            <Checkbox id="sg-check" />
            <Label htmlFor="sg-check">Checkbox</Label>
          </div>
        ),
      },
      {
        label: "RadioGroup",
        render: () => (
          <RadioGroup defaultValue="a" className="space-y-2">
            <div className="flex items-center gap-2"><RadioGroupItem value="a" id="r-a" /><Label htmlFor="r-a">Opção A</Label></div>
            <div className="flex items-center gap-2"><RadioGroupItem value="b" id="r-b" /><Label htmlFor="r-b">Opção B</Label></div>
          </RadioGroup>
        ),
      },
      {
        label: "Select",
        render: () => (
          <Select>
            <SelectTrigger className="w-56"><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="1">Opção 1</SelectItem>
              <SelectItem value="2">Opção 2</SelectItem>
              <SelectItem value="3">Opção 3</SelectItem>
            </SelectContent>
          </Select>
        ),
      },
    ],
  },
  {
    slug: "tabs",
    name: "Tabs",
    group: "Estrutura",
    variants: [
      {
        label: "default",
        render: () => (
          <Tabs defaultValue="t1" className="w-full max-w-md">
            <TabsList>
              <TabsTrigger value="t1">Tab 1</TabsTrigger>
              <TabsTrigger value="t2">Tab 2</TabsTrigger>
              <TabsTrigger value="t3">Tab 3</TabsTrigger>
            </TabsList>
            <TabsContent value="t1" className="pt-3 text-sm">Conteúdo da tab 1.</TabsContent>
            <TabsContent value="t2" className="pt-3 text-sm">Conteúdo da tab 2.</TabsContent>
            <TabsContent value="t3" className="pt-3 text-sm">Conteúdo da tab 3.</TabsContent>
          </Tabs>
        ),
      },
    ],
  },
  {
    slug: "skeleton",
    name: "Skeleton",
    group: "Feedback",
    variants: [
      {
        label: "linhas",
        render: () => (
          <div className="space-y-2 max-w-sm">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        ),
      },
      { label: "bloco", render: () => <Skeleton className="h-24 w-full max-w-sm" /> },
    ],
  },
  {
    slug: "progress",
    name: "Progress",
    group: "Feedback",
    variants: [
      { label: "30%", render: () => <Progress value={30} className="max-w-sm" /> },
      { label: "70%", render: () => <Progress value={70} className="max-w-sm" /> },
      { label: "100%", render: () => <Progress value={100} className="max-w-sm" /> },
    ],
  },
  {
    slug: "avatar",
    name: "Avatar",
    group: "Primitivos",
    variants: [
      { label: "fallback iniciais", render: () => <Avatar><AvatarFallback>AC</AvatarFallback></Avatar> },
    ],
  },
  {
    slug: "botoes-acao",
    name: "Botões de ação (Kit)",
    group: "Primitivos",
    description:
      "Primitivos contextuais do Kit de investigação: Copiar (texto/dados), Baixar CSV (dados tabulares) e Fonte oficial (registro de origem).",
    variants: [
      {
        label: "BotaoCopiar (rótulo)",
        render: () => <BotaoCopiar obterTexto={() => "conteúdo copiado"} rotulo="Copiar texto" />,
      },
      {
        label: "BotaoCopiar (só ícone)",
        render: () => <BotaoCopiar obterTexto={() => "x"} titulo="Copiar" />,
      },
      {
        label: "BotaoBaixarCsv",
        render: () => (
          <BotaoBaixarCsv
            filename="exemplo"
            obterLinhas={() => [{ a: 1, b: 2 }]}
            rotulo="Exportar CSV (1)"
          />
        ),
      },
      {
        label: "BotaoBaixarCsv (desabilitado)",
        render: () => (
          <BotaoBaixarCsv filename="vazio" obterLinhas={() => []} disabled rotulo="Baixar CSV" />
        ),
      },
      {
        label: "BotaoFonteOficial",
        render: () => <BotaoFonteOficial href="https://portaldatransparencia.gov.br" />,
      },
    ],
  },
  {
    slug: "separator",
    name: "Separator",
    group: "Estrutura",
    variants: [
      {
        label: "horizontal",
        render: () => (
          <div className="max-w-sm space-y-2">
            <p className="text-sm">Acima</p>
            <Separator />
            <p className="text-sm">Abaixo</p>
          </div>
        ),
      },
    ],
  },
  {
    slug: "empty-state",
    name: "EmptyState",
    group: "Feedback",
    variants: [
      { label: "default", render: () => <EmptyState title="Nenhum contrato encontrado" /> },
      {
        label: "com hint",
        render: () => (
          <EmptyState
            title="Sem importações neste mês"
            hint="Veja a página /cobertura para entender por que esta janela está vazia."
          />
        ),
      },
    ],
  },
  {
    slug: "banners",
    name: "Banners globais",
    group: "Feedback",
    variants: [
      { label: "ConstrucaoBanner", render: () => <div className="relative"><ConstrucaoBanner /></div> },
      { label: "AvisoMetodologico (completo)", render: () => <AvisoMetodologico /> },
      { label: "AvisoMetodologico (compacto)", render: () => <AvisoMetodologico compacto /> },
    ],
  },
  {
    slug: "metodologia-popover",
    name: "MetodologiaPopover",
    group: "Feedback",
    variants: [
      {
        label: "default (clique para abrir)",
        render: () => (
          <MetodologiaPopover titulo="Como o radar é calculado?">
            O radar combina 4 indicadores normalizados de 0 a 1: concentração de fornecedor,
            fracionamento, valor unitário e recorrência. A média ponderada gera o índice final.
          </MetodologiaPopover>
        ),
      },
    ],
  },
  {
    slug: "qa-finding",
    name: "QA Finding (público vs admin)",
    group: "Domínio",
    description: "Mesma informação, ações diferentes.",
    variants: qaFindingMocks.flatMap((f) => [
      {
        label: `público · ${f.severidade}`,
        render: () => {
          const sev = SEVERIDADE_BADGE[f.severidade];
          return (
            <article className="rounded-xl border border-border bg-card p-4 space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold ${sev.cls}`}>{sev.label}</span>
                {f.pii_detectada && <Badge variant="outline">PII mascarada</Badge>}
                <span className="text-xs text-muted-foreground font-mono ml-auto">{f.fonte}</span>
              </div>
              <h3 className="font-medium text-sm">{f.descricao}</h3>
              <div className="text-xs text-muted-foreground">Regra <code>{f.regra}</code> · detectado em {f.detectado_em}</div>
            </article>
          );
        },
      },
      {
        label: `admin · ${f.severidade}`,
        render: () => {
          const sev = SEVERIDADE_BADGE[f.severidade];
          return (
            <article className="rounded-xl border border-border bg-card p-4 space-y-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold ${sev.cls}`}>{sev.label}</span>
                <Badge variant="outline">status: {f.status}</Badge>
                {f.pii_detectada && <Badge variant="outline">PII</Badge>}
                <span className="text-xs text-muted-foreground font-mono ml-auto">#{f.id}</span>
              </div>
              <h3 className="font-medium text-sm">{f.descricao}</h3>
              <div className="text-xs text-muted-foreground">
                <code>{f.regra}</code> · {f.entidade_tipo}/{f.entidade_id} · {f.fonte}
              </div>
              <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
                <Button size="sm" variant="outline">Reportar ao órgão</Button>
                <Button size="sm" variant="ghost">Marcar resolvido</Button>
                <Button size="sm" variant="ghost">Falso positivo</Button>
              </div>
            </article>
          );
        },
      },
    ]),
  },
  {
    slug: "cards-dominio",
    name: "Cards de domínio",
    group: "Domínio",
    description: "Padrão: identificador + link interno + link à fonte oficial.",
    variants: [
      ...contratoMocks.map((c) => ({
        label: `Contrato ${c.numero}`,
        render: () => (
          <article className="rounded-xl border border-border bg-card p-4 space-y-2 max-w-md">
            <div className="flex items-center gap-2">
              <FileText className="size-4 text-accent" />
              <span className="font-mono text-sm">{c.numero}</span>
              <Badge variant="outline" className="ml-auto text-[10px]">{c.fonte}</Badge>
            </div>
            <h3 className="font-medium leading-tight">{c.fornecedor}</h3>
            <div className="text-xs text-muted-foreground space-y-0.5">
              <div>{c.orgao}</div>
              <div>CNPJ {c.cnpj}</div>
              <div>Vigência {c.vigencia_inicio} → {c.vigencia_fim}</div>
            </div>
            <div className="font-display text-xl">{c.valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</div>
          </article>
        ),
      })),
      ...convenioMocks.map((c) => ({
        label: `Convênio ${c.numero}`,
        render: () => (
          <article className="rounded-xl border border-border bg-card p-4 space-y-2 max-w-md">
            <div className="flex items-center gap-2">
              <Building2 className="size-4 text-accent" />
              <span className="font-mono text-sm">{c.numero}</span>
              <Badge variant="outline" className="ml-auto text-[10px]">{c.uf}</Badge>
            </div>
            <h3 className="font-medium leading-tight">{c.proponente}</h3>
            <div className="text-xs text-muted-foreground">{c.concedente}</div>
            <Badge variant="secondary" className="text-[10px]">{c.situacao}</Badge>
            <div className="font-display text-xl">{c.valor_global.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</div>
          </article>
        ),
      })),
      ...deputadoMocks.map((d) => ({
        label: `Deputado ${d.nome}`,
        render: () => (
          <article className="rounded-xl border border-border bg-card p-4 flex items-start gap-3 max-w-md">
            <div className="size-12 rounded-full bg-muted flex items-center justify-center shrink-0">
              <UserCircle2 className="size-8 text-muted-foreground" />
            </div>
            <div className="space-y-1 min-w-0">
              <h3 className="font-medium leading-tight">{d.nome}</h3>
              <div className="text-xs text-muted-foreground">{d.partido}/{d.uf} · {d.legislatura}ª legislatura</div>
            </div>
          </article>
        ),
      })),
    ],
  },
];