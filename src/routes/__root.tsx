import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";

import appCss from "../styles.css?url";
import { DataProvider } from "@/lib/data-store";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { ConstrucaoBanner } from "@/components/ConstrucaoBanner";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/hooks/use-auth";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Auditoria Cidadã — Gastos federais sob escrutínio" },
      { name: "description", content: "Observatório cívico que organiza, compara e contextualiza gastos federais brasileiros para o controle social." },
      { name: "author", content: "Auditoria Cidadã" },
      { property: "og:title", content: "Auditoria Cidadã — Gastos federais sob escrutínio" },
      { property: "og:description", content: "Observatório cívico que organiza, compara e contextualiza gastos federais brasileiros para o controle social." },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: "Auditoria Cidadã" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Auditoria Cidadã — Gastos federais sob escrutínio" },
      { name: "twitter:description", content: "Observatório cívico que organiza, compara e contextualiza gastos federais brasileiros para o controle social." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/53f48119-18f7-4687-a3ee-49b32dcdc5a1/id-preview-99de29eb--00000000-0000-0000-0000-000000000000.lovable.app-1779070926485.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/53f48119-18f7-4687-a3ee-49b32dcdc5a1/id-preview-99de29eb--00000000-0000-0000-0000-000000000000.lovable.app-1779070926485.png" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "Organization",
              name: "Auditoria Cidadã",
              url: "https://auditoriacidada.ia.br",
              description: "Observatório cívico de gastos públicos federais brasileiros.",
            },
            {
              "@type": "WebSite",
              name: "Auditoria Cidadã",
              url: "https://auditoriacidada.ia.br",
              inLanguage: "pt-BR",
            },
          ],
        }),
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <DataProvider>
          <div className="min-h-screen flex flex-col">
            <SiteHeader />
            <ConstrucaoBanner />
            <main className="flex-1">
              <Outlet />
            </main>
            <SiteFooter />
          </div>
          <Toaster />
        </DataProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
