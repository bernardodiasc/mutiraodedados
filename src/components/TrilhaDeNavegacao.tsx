import { Fragment } from "react";
import { Link } from "@tanstack/react-router";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

export type ItemTrilha = {
  label: string;
  /** Rota interna (ex.: "/contratos"). O último item — a página atual — fica sem `to`. */
  to?: string;
  params?: Record<string, string>;
  search?: Record<string, unknown>;
};

/**
 * Trilha de navegação (breadcrumb) canônica da página — sempre a hierarquia
 * da rota, nunca "de onde o visitante veio". Substitui os "← Voltar" ad-hoc,
 * que apontavam para destinos arbitrários. Os rótulos devem ser os mesmos da
 * navegação principal (nav-groups).
 */
export function TrilhaDeNavegacao({
  itens,
  className,
}: {
  itens: ItemTrilha[];
  className?: string;
}) {
  if (itens.length === 0) return null;
  return (
    <Breadcrumb className={className}>
      <BreadcrumbList>
        {itens.map((item, i) => {
          const ultimo = i === itens.length - 1;
          return (
            <Fragment key={`${item.label}-${i}`}>
              <BreadcrumbItem>
                {ultimo || !item.to ? (
                  <BreadcrumbPage>{item.label}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild>
                    {/* Componente genérico orientado a dados: o cast abre mão da
                        checagem de rota do router — os chamadores passam rotas
                        existentes. */}
                    <Link
                      to={item.to as never}
                      params={item.params as never}
                      search={item.search as never}
                    >
                      {item.label}
                    </Link>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
              {!ultimo && <BreadcrumbSeparator />}
            </Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
TrilhaDeNavegacao.displayName = "TrilhaDeNavegacao";
