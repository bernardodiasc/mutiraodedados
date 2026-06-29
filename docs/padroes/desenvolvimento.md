# Diretrizes Gerais de Desenvolvimento

Este documento descreve os padrões gerais do projeto para roteamento, estilização (UI/UX), vocabulário de domínio e boas práticas gerais.

## 1. Rotas (TanStack Start, file-based)

- **Páginas públicas**: Criadas top-level em `src/routes/`. O SSR fica ativado (comportamento padrão). Evite adicionar `beforeLoad` de controle de autenticação nestas páginas.
- **Páginas autenticadas**: Criadas sob a rota agrupada `src/routes/_authenticated/`. O layout gerencia a checagem da sessão e o redirecionamento.
- **Metadados (SEO)**: Toda rota deve implementar a exportação de `head()` contendo:
  - Title único descritivo
  - Description detalhada e amigável
  - `og:title` e `og:description`
  - `canonical`
  - `og:image` apenas em rotas folha (leaf).
- **Tratamento de Erros**: Toda rota com loader deve definir `errorComponent` e `notFoundComponent` para conter falhas graciosamente.
- **Abstração**: A rota deve apenas carregar o Container da feature e definir seus metadados de página. Não deve conter lógica de negócio inline.

## 2. Design Tokens e Interface do Usuário (UI)

- **Cores Semânticas**: Nunca declare classes Tailwind com valores de cores estáticas (`bg-white`, `text-black`, `bg-[#f3f3f3]`). Sempre utilize tokens semânticos baseados na folha de estilos do projeto (`src/styles.css`):
  - `bg-background`, `text-foreground`
  - `bg-card`, `text-muted-foreground`
  - `border-border`
  - `text-accent`, `bg-primary`
  - `text-destructive`
- **Tipografia**: Use as fontes semânticas:
  - `font-display` (Archivo Black) para títulos.
  - `font-sans` (IBM Plex Sans) para textos corridos.
  - `font-mono` para dados estruturados, códigos e identificadores.
- **Componentes Shadcn**: Os arquivos em `src/components/ui/` são primitivas do sistema de design e não entram na regra de Container/View — são blocos que as Views utilizam.
- **Cards de Registros**: Cards que representam itens como contratos e convênios devem exibir:
  - Identificador legível (ex: número do contrato)
  - Link interno (ex: `/contratos/$id`)
  - Link externo para o portal oficial com o rótulo "Ver na fonte oficial".
  - Badges de QA finding e severidade quando aplicável.
- **Empty States**: Use sempre o componente `EmptyState` em `src/components/EmptyState.tsx`, detalhando por que os dados estão vazios e como resolver.
- **Aviso Metodológico**: Insira `AvisoMetodologico` em páginas públicas que agrupam ou agregam dados para esclarecer limites metodológicos daquela fonte.

## 3. Vocabulário Cidadão (pt-BR)

Para manter a plataforma compreensível para o cidadão comum, evite jargões técnicos em labels visíveis:
- Use "Salvar no caderno" em vez de "Bookmark item"
- Use "Informação que falta" em vez de "Data gap"
- Use "O que comprova esta página" em vez de "Data lineage"
- Use "Modo aprender / perguntar / investigar" em vez de "Tabs"
- Sempre forneça mensagens de erro amigáveis em pt-BR e nunca exponha stack traces crus para o usuário final.
- Comentários de código: Use pt-BR quando detalhar regras de negócio governamentais/orçamentárias e use inglês quando descrever regras puramente técnicas.

## 4. Antipadrões Gerais

- Colocar `useState`, `useQuery` ou `useServerFn` direto nas Views ou em componentes de UI que não seguem o split de Container/View.
- Realizar import de `@/integrations/supabase/client.server` de forma estática no escopo top-level de arquivos de funções para evitar vazamento de privilégios.
- Chamar server functions autenticadas no loader de rotas públicas.
- Utilizar `console.log` para mensagens normais do servidor (use `console.error` com prefixo descritivo).

## 5. Checklist de Entrega de Feature

Antes de marcar uma tarefa como pronta:
1. `Container.tsx`, `View.tsx`, `logic.ts`, `logic.test.ts` e `mocks.ts` devem estar criados.
2. Registrar a feature em `src/lib/style-guide/registry.ts` (ordem alfabética).
3. Testes unitários devem estar passando (`bunx vitest run src/lib/<feature>`).
4. Server functions autenticadas devem possuir `.middleware([requireSupabaseAuth])` e validação Zod.
5. Banco de dados com RLS habilitada, `GRANT` correto e políticas configuradas.
6. Roteamento com tags `head()` de SEO completas.
7. Textos da interface em pt-BR cidadão.
8. Atualizar a documentação correspondente em `docs/dominios/` ou `docs/modelo-dados.ia.md`.
