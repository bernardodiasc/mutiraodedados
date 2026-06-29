# Container × View × logic.ts — anatomia completa

## Quando aplicar

Sempre que um componente tiver pelo menos um dos itens abaixo:
- `useState` / `useReducer` para estado de feature (não apenas estado transiente de UI primitiva)
- `useEffect`
- `useQuery` / `useMutation` / `useSuspenseQuery`
- `useServerFn`
- `useAuth` ou leitura direta de sessão
- Chamada a `supabase.*`
- `toast.*`
- Handlers que recebem dados de fora (props) e disparam efeitos

Componentes 100% apresentacionais (cards, banners, blocos estáticos) NÃO precisam virar Container/View. Exemplo: `BlocoLacuna`, `BlocoRastreabilidade`, `RodapeInvestigativo`.

## Template canônico

### logic.ts (puro)
```ts
export type Estado = "ocioso" | "carregando" | "pronto" | "erro";

export function deriveEstado(input: {
  carregando: boolean;
  temErro: boolean;
  temDados: boolean;
}): Estado {
  if (input.carregando) return "carregando";
  if (input.temErro) return "erro";
  if (input.temDados) return "pronto";
  return "ocioso";
}

export function formatarDataPt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("pt-BR");
}
```

### logic.test.ts (vitest)
```ts
import { describe, it, expect } from "vitest";
import { deriveEstado, formatarDataPt } from "./logic";

describe("deriveEstado", () => {
  it("carregando vence", () => {
    expect(deriveEstado({ carregando: true, temErro: true, temDados: true })).toBe("carregando");
  });
  it("ocioso é o default", () => {
    expect(deriveEstado({ carregando: false, temErro: false, temDados: false })).toBe("ocioso");
  });
});

describe("formatarDataPt", () => {
  it("formata", () => expect(formatarDataPt("2026-01-01T00:00:00Z")).toMatch(/2026/));
  it("devolve original em inválida", () => expect(formatarDataPt("xx")).toBe("xx"));
});
```

### View (stateless)
```tsx
import type { Estado } from "@/lib/minha-feature/logic";

export type MinhaFeatureViewProps = {
  estado: Estado;
  itens: Array<{ id: string; titulo: string }>;
  onSelecionar: (id: string) => void;
};

export function MinhaFeatureView({ estado, itens, onSelecionar }: MinhaFeatureViewProps) {
  if (estado === "carregando") return <div className="text-muted-foreground">Carregando…</div>;
  if (estado === "erro") return <div className="text-destructive">Não consegui carregar.</div>;
  return (
    <ul className="grid gap-3">
      {itens.map((i) => (
        <li key={i.id} className="border border-border rounded-xl p-5 bg-card">
          <button type="button" onClick={() => onSelecionar(i.id)}>{i.titulo}</button>
        </li>
      ))}
    </ul>
  );
}
MinhaFeatureView.displayName = "MinhaFeatureView";
```

### Container (estado/efeitos)
```tsx
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { listarItens } from "@/lib/minha-feature.functions";
import { deriveEstado } from "@/lib/minha-feature/logic";
import { MinhaFeatureView } from "@/components/MinhaFeatureView";

export function MinhaFeatureContainer() {
  const listar = useServerFn(listarItens);
  const { data, isLoading, error } = useQuery({ queryKey: ["minha-feature"], queryFn: () => listar() });
  const itens = data ?? [];
  const estado = deriveEstado({
    carregando: isLoading,
    temErro: !!error,
    temDados: itens.length > 0,
  });
  return <MinhaFeatureView estado={estado} itens={itens} onSelecionar={(id) => console.log(id)} />;
}
MinhaFeatureContainer.displayName = "MinhaFeatureContainer";
```

### mocks.ts (style guide)
```ts
import type { ViewVariants } from "@/lib/style-guide/registry";
import type { MinhaFeatureViewProps } from "@/components/MinhaFeatureView";

const base: MinhaFeatureViewProps = { estado: "pronto", itens: [{ id: "1", titulo: "Exemplo" }], onSelecionar: () => {} };

export const minhaFeatureVariants: ViewVariants<MinhaFeatureViewProps> = [
  { label: "carregando", props: { ...base, estado: "carregando", itens: [] } },
  { label: "erro", props: { ...base, estado: "erro", itens: [] } },
  { label: "vazio", props: { ...base, estado: "ocioso", itens: [] } },
  { label: "com itens", props: base },
];
```

### shim (compat com nome antigo)
```ts
// src/components/MinhaFeature.tsx
export { MinhaFeatureContainer as MinhaFeature } from "@/containers/MinhaFeatureContainer";
```

## Formulários controlados

Quando um form tem múltiplos campos, **lifte o draft inteiro para o Container** como um único objeto. O View expõe `onAlterarDraft(patch)` e `draft`. Veja `AnotacoesCadernoContainer` no repo.

```ts
export type Draft = { titulo: string; conteudo: string };
export const DRAFT_INICIAL: Draft = { titulo: "", conteudo: "" };
export function podeSalvar(d: Draft): boolean {
  return d.titulo.trim().length > 0 || d.conteudo.trim().length > 0;
}
```

## Anti-exemplos (recusar em code review)

### ❌ View que dispara mutação
```tsx
// ERRADO — View virou Container
export function BotaoView({ id }: { id: string }) {
  const fn = useServerFn(salvar);          // ← I/O em View
  const m = useMutation({ mutationFn: () => fn({ data: { id } }) });
  return <button onClick={() => m.mutate()}>Salvar</button>;
}
```
Faça: View recebe `onSave: () => void` + `estado: "salvar" | "salvando" | "salvo"`; Container monta o handler.

### ❌ Container com JSX rico
```tsx
// ERRADO — Container fazendo layout
export function Container() {
  const { data } = useQuery(...);
  return (
    <section className="grid gap-3">      {/* ← layout no Container */}
      <h2>Lista</h2>
      <ul>...</ul>
    </section>
  );
}
```
Faça: mova todo o JSX para `View`. Container retorna `<View …props />`.

### ❌ Lógica condicional em JSX
```tsx
// ERRADO — lógica espalhada no JSX
{user ? (loading ? <Loading/> : data?.length ? <List/> : <Empty/>) : <Login/>}
```
Faça: `deriveEstado(...)` em `logic.ts` (testável) e `switch` no View.

### ❌ View importando `toast`/`supabase`/`useAuth`
Toast pertence ao Container. View só renderiza o que recebe.

## Casos legítimos de View com `useState`

- Estado transiente de UI primitiva (tab selecionada de uma tablist, abrir/fechar collapse local sem persistência). Exemplo aceitável: `PainelModosLeitura` (tab local sem efeito de fora).
- Se o estado vira semântica do produto (escolha do usuário que dispara fetch, salva, navega), promova para Container.
