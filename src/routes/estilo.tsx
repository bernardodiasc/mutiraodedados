import { createFileRoute, Outlet } from "@tanstack/react-router";
import { EstiloSidebar } from "@/components/style-guide/EstiloSidebar";

export const Route = createFileRoute("/estilo")({
  component: EstiloLayout,
  head: () => ({
    meta: [
      { title: "Estilo — Mutirão de Dados" },
      {
        name: "description",
        content:
          "Style guide do projeto: tokens visuais, tipografia, componentes UI e composições renderizadas com dados mockados.",
      },
    ],
  }),
});

function EstiloLayout() {
  return (
    <div className="flex min-h-[calc(100vh-3rem)] w-full">
      <EstiloSidebar />
      <main className="flex-1 min-w-0 px-6 py-8">
        <div className="mx-auto max-w-5xl space-y-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}