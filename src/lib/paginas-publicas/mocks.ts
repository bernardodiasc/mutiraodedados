import type { ComponentProps } from "react";
import type { PaginasPublicasSyncView } from "@/components/PaginasPublicasSyncView";
import type { ViewVariants } from "@/lib/style-guide/registry";

const noop = () => {};

const base: ComponentProps<typeof PaginasPublicasSyncView> = {
  estado: "pronto",
  resumo: {
    novas: ["/trilhas#primeiro-contrato"],
    alteradas: ["/sobre", "/metodologia"],
    removidas: ["/pagina-antiga"],
    iguais: 58,
  },
  mensagemErro: null,
  onSincronizar: noop,
  sincronizando: false,
  resultado: null,
};

export const paginasPublicasSyncVariants: ViewVariants<
  ComponentProps<typeof PaginasPublicasSyncView>
> = [
  { label: "diferenças com o código", props: base },
  {
    label: "em dia",
    props: {
      ...base,
      resumo: { novas: [], alteradas: [], removidas: [], iguais: 62 },
      resultado: "Sincronizado: 1 novas, 2 alteradas, 1 retiradas.",
    },
  },
  { label: "sincronizando", props: { ...base, sincronizando: true } },
  { label: "carregando", props: { ...base, estado: "carregando", resumo: null } },
  {
    label: "tabela ainda não criada",
    props: {
      ...base,
      estado: "erro",
      resumo: null,
      mensagemErro:
        'Não foi possível ler as páginas públicas: relation "public.paginas_publicas" does not exist',
    },
  },
];
