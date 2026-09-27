import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { PaginasPublicasSyncView } from "@/components/PaginasPublicasSyncView";
import {
  conferirPaginasPublicas,
  sincronizarPaginasPublicas,
} from "@/lib/data/paginas-publicas.functions";

export function PaginasPublicasSyncContainer() {
  const conferirFn = useServerFn(conferirPaginasPublicas);
  const sincronizarFn = useServerFn(sincronizarPaginasPublicas);
  const conferencia = useQuery({
    queryKey: ["admin", "paginas-publicas"],
    queryFn: () => conferirFn(),
    staleTime: 60 * 1000,
  });
  const [sincronizando, setSincronizando] = React.useState(false);
  const [resultado, setResultado] = React.useState<string | null>(null);

  const sincronizar = async () => {
    setSincronizando(true);
    try {
      const r = await sincronizarFn();
      setResultado(
        `Sincronizado: ${r.novas.length} novas, ${r.alteradas.length} alteradas, ${r.removidas.length} retiradas.`,
      );
      await conferencia.refetch();
    } catch (e) {
      setResultado((e as Error).message);
    } finally {
      setSincronizando(false);
    }
  };

  return (
    <PaginasPublicasSyncView
      estado={conferencia.isPending ? "carregando" : conferencia.isError ? "erro" : "pronto"}
      resumo={conferencia.data ?? null}
      mensagemErro={conferencia.error instanceof Error ? conferencia.error.message : null}
      onSincronizar={() => void sincronizar()}
      sincronizando={sincronizando}
      resultado={resultado}
    />
  );
}
