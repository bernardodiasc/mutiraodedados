import { useCallback, useState } from "react";
import { toast } from "sonner";
import { BotaoSalvarBusca } from "@/components/BotaoSalvarBusca";
import { BotaoSalvarItem } from "@/components/BotaoSalvarItem";
import { useAuth } from "@/hooks/use-auth";
import { toCSV } from "@/lib/csv";
import { salvarItem } from "@/lib/itens-salvos.functions";
import {
  cabecalhoCsv,
  chaveDoItem,
  chaveDoRecorte,
  filtrosParaSalvar,
  linhasCsv,
  nomeDoArquivo,
  referenciasMarkdown,
  searchParaSalvar,
  tipoNoCaderno,
  type ContextoExportacao,
  type EscopoAcao,
} from "@/lib/buscar/acoes";
import { categoriaBusca } from "@/lib/busca/categorias";
import type { ItemBusca } from "@/lib/busca/consulta";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { BuscarView } from "@/components/BuscarView";
import type { CategoriaBuscaId } from "@/lib/busca/categorias";
import { ITENS_BUSCA_PADRAO } from "@/lib/busca/consulta";
import {
  chipsDaSearch,
  alternarValor,
  aplicarFiltros,
  atualizarResultados,
  deriveEstado,
  filtrosDaSearch,
  incompativeis,
  irParaCategoria,
  limparFiltros,
  mudarItens,
  mudarOrdem,
  novaConsulta,
  searchDaPagina,
  type BuscarSearch,
  type Incompativel,
} from "@/lib/buscar/logic";
import {
  exportarBusca,
  listaBusca,
  opcoesFacetaBusca,
  resumoBusca,
} from "@/lib/data/busca-indice.functions";

function baixar(nome: string, conteudo: string, tipo: string) {
  const url = URL.createObjectURL(new Blob([conteudo], { type: tipo }));
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Chave de sessão dos grupos abertos: a mesma consulta volta como estava. */
function chaveGrupos(search: BuscarSearch): string {
  const { pagina: _p, ate: _a, ...resto } = search;
  return `buscar:grupos:${JSON.stringify(resto)}`;
}

function lerGrupos(search: BuscarSearch): CategoriaBuscaId[] | null {
  try {
    const v = sessionStorage.getItem(chaveGrupos(search));
    return v ? (JSON.parse(v) as CategoriaBuscaId[]) : null;
  } catch {
    return null;
  }
}

export function BuscarContainer({
  search,
  onSearchChange,
}: {
  search: BuscarSearch;
  onSearchChange: (next: BuscarSearch) => void;
}) {
  const resumoFn = useServerFn(resumoBusca);
  const listaFn = useServerFn(listaBusca);
  const opcoesFn = useServerFn(opcoesFacetaBusca);
  const exportarFn = useServerFn(exportarBusca);
  const salvarFn = useServerFn(salvarItem);
  const { user } = useAuth();

  const q = search.q ?? "";
  const temConsulta = q.length >= 2;
  const filtros = filtrosDaSearch(search);

  const resumo = useQuery({
    queryKey: ["buscar", "resumo", q, filtros, search.ate ?? null],
    enabled: temConsulta && !search.tipo,
    placeholderData: keepPreviousData,
    queryFn: () => resumoFn({ data: { q, filtros, ate: search.ate } }),
  });

  const lista = useQuery({
    queryKey: [
      "buscar",
      "lista",
      q,
      search.tipo,
      filtros,
      search.ate ?? null,
      search.ordem ?? "relevancia",
      search.pagina ?? 1,
      search.itens ?? ITENS_BUSCA_PADRAO,
    ],
    enabled: temConsulta && !!search.tipo,
    placeholderData: keepPreviousData,
    queryFn: () =>
      listaFn({
        data: {
          q,
          categoria: search.tipo!,
          filtros,
          ate: search.ate,
          ordem: search.ordem ?? "relevancia",
          pagina: search.pagina ?? 1,
          itens: search.itens ?? ITENS_BUSCA_PADRAO,
        },
      }),
  });

  const ativa = search.tipo ? lista : resumo;
  const dadosResumo = search.tipo ? null : (resumo.data ?? null);
  const dadosLista = search.tipo ? (lista.data ?? null) : null;
  const temResultados = search.tipo
    ? (dadosLista?.resultados.length ?? 0) > 0
    : (dadosResumo?.categorias.some((c) => c.previas.length > 0) ?? false) || !!dadosResumo?.exato;

  const estado = deriveEstado({
    temConsulta,
    carregando: ativa.isLoading,
    temErro: !!ativa.error && !ativa.data,
    temResultados,
  });

  const [trocaPendente, setTrocaPendente] = useState<{
    destino: CategoriaBuscaId | null;
    incompativeis: Incompativel[];
  } | null>(null);

  const [grupos, setGrupos] = useState<{ chave: string; abertos: CategoriaBuscaId[] | null }>(
    () => ({
      chave: chaveGrupos(search),
      abertos: typeof window === "undefined" ? null : lerGrupos(search),
    }),
  );
  const chaveAtual = chaveGrupos(search);
  const gruposAbertos =
    grupos.chave === chaveAtual
      ? grupos.abertos
      : typeof window === "undefined"
        ? null
        : lerGrupos(search);

  const pesquisarOpcoes = useCallback(
    (faceta: string, termo: string) =>
      opcoesFn({
        data: { q, categoria: search.tipo!, faceta, termo, filtros, ate: search.ate },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [opcoesFn, q, search.tipo, search.ate, JSON.stringify(filtros)],
  );

  // Seleção: amarrada ao recorte em que foi feita, para nunca misturar buscas.
  const recorteAtual = chaveDoRecorte(search);
  const [selecao, setSelecao] = useState<{
    ativa: boolean;
    recorte: string;
    itens: Map<string, ItemBusca>;
  }>({ ativa: false, recorte: recorteAtual, itens: new Map() });
  const selecaoDaqui = selecao.recorte === recorteAtual;
  const [acaoEmAndamento, setAcaoEmAndamento] = useState(false);

  const selecionar = (mudar: (itens: Map<string, ItemBusca>) => void) =>
    setSelecao((s) => {
      const itens = new Map(s.recorte === recorteAtual ? s.itens : []);
      mudar(itens);
      return { ...s, recorte: recorteAtual, itens };
    });

  const contexto = (
    escopo: EscopoAcao,
    total: number | null,
    truncado = false,
  ): ContextoExportacao => ({
    consulta: q,
    categoria: search.tipo ? categoriaBusca(search.tipo)!.rotulo : null,
    filtros: chipsDaSearch(search).map((c) => c.texto),
    escopo,
    corte: dadosLista?.corte ?? new Date().toISOString(),
    geradoEm: new Date().toISOString(),
    total,
    truncado,
    origem: window.location.origin,
  });

  /** Itens do escopo, com o contexto que acompanha a cópia ou o arquivo. */
  const itensDoEscopo = async (escopo: EscopoAcao) => {
    if (escopo === "pagina")
      return {
        itens: dadosLista?.resultados ?? [],
        ctx: contexto(escopo, dadosLista?.total ?? null),
      };
    if (escopo === "selecao")
      return {
        itens: [...selecao.itens.values()],
        ctx: contexto(escopo, dadosLista?.total ?? null),
      };
    const r = await exportarFn({
      data: {
        q,
        categoria: search.tipo!,
        filtros,
        ordem: search.ordem ?? "relevancia",
        ate: dadosLista?.corte ?? new Date().toISOString(),
      },
    });
    return { itens: r.itens, ctx: contexto(escopo, r.total, r.truncado) };
  };

  const executar = async (acao: () => Promise<void>) => {
    setAcaoEmAndamento(true);
    try {
      await acao();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível concluir a ação.");
    } finally {
      setAcaoEmAndamento(false);
    }
  };

  const ir = (next: BuscarSearch) => {
    setTrocaPendente(null);
    onSearchChange(next);
  };

  return (
    <BuscarView
      estado={estado}
      search={search}
      atualizando={ativa.isFetching && ativa.isPlaceholderData}
      resumo={dadosResumo}
      lista={dadosLista}
      mensagemErro={ativa.error instanceof Error ? ativa.error.message : null}
      trocaPendente={trocaPendente}
      gruposAbertos={gruposAbertos}
      montarSearchPagina={(p) =>
        searchDaPagina(search, p, (dadosLista ?? dadosResumo)?.corte ?? new Date().toISOString())
      }
      onBuscar={(texto) => ir(novaConsulta(search, texto))}
      onAlternarFiltro={(chave, valor) => ir(alternarValor(search, chave, valor))}
      onAplicarFiltros={(f) => ir(aplicarFiltros(search, f))}
      onLimparFiltros={() => ir(limparFiltros(search))}
      onIrCategoria={(destino) => {
        const lista = incompativeis(search, destino);
        if (lista.length) setTrocaPendente({ destino, incompativeis: lista });
        else ir(irParaCategoria(search, destino));
      }}
      onConfirmarTroca={() => trocaPendente && ir(irParaCategoria(search, trocaPendente.destino))}
      onCancelarTroca={() => setTrocaPendente(null)}
      onGruposAbertos={(abertos) => {
        setGrupos({ chave: chaveAtual, abertos });
        try {
          sessionStorage.setItem(chaveAtual, JSON.stringify(abertos));
        } catch {
          // Sem sessionStorage (aba privada): a preferência vale só nesta tela.
        }
      }}
      onOrdem={(ordem) => ir(mudarOrdem(search, ordem))}
      onItens={(itens) => ir(mudarItens(search, itens))}
      onAtualizar={() => ir(atualizarResultados(search))}
      onTentarDeNovo={() => void ativa.refetch()}
      onPesquisarOpcoes={pesquisarOpcoes}
      renderSalvarBusca={() => (
        <BotaoSalvarBusca
          path="/buscar"
          search={searchParaSalvar(search)}
          titulo="Busca"
          filtros={filtrosParaSalvar(search)}
        />
      )}
      renderAcoesItem={(item) => (
        <BotaoSalvarItem
          entidadeTipo={tipoNoCaderno(item)}
          entidadeId={item.id}
          titulo={item.titulo}
          url={item.href}
          contexto={[item.fonte, item.identificador].filter(Boolean).join(" · ")}
        />
      )}
      selecao={{
        ativa: selecao.ativa,
        chaves: selecaoDaqui ? [...selecao.itens.keys()] : [],
        deOutraBusca: selecaoDaqui ? 0 : selecao.itens.size,
        podeSalvar: !!user,
      }}
      acaoEmAndamento={acaoEmAndamento}
      onAlternarModoSelecao={() => setSelecao((s) => ({ ...s, ativa: !s.ativa }))}
      onAlternarItem={(item) =>
        selecionar((itens) => {
          const k = chaveDoItem(item);
          if (itens.has(k)) itens.delete(k);
          else itens.set(k, item);
        })
      }
      onSelecionarPagina={(itens) =>
        selecionar((sel) => {
          for (const i of itens) sel.set(chaveDoItem(i), i);
        })
      }
      onLimparSelecao={() => setSelecao((s) => ({ ...s, recorte: recorteAtual, itens: new Map() }))}
      onSalvarSelecao={() =>
        void executar(async () => {
          const itens = [...selecao.itens.values()];
          for (const i of itens) {
            await salvarFn({
              data: {
                entidade_tipo: tipoNoCaderno(i),
                entidade_id: i.id,
                titulo: i.titulo.slice(0, 300),
                url: i.href,
                contexto: [i.fonte, i.identificador].filter(Boolean).join(" · "),
              },
            });
          }
          toast.success(
            `${itens.length} ${itens.length === 1 ? "item salvo" : "itens salvos"} no caderno.`,
          );
          setSelecao((s) => ({ ...s, recorte: recorteAtual, itens: new Map() }));
        })
      }
      onCopiarReferencias={(escopo) =>
        void executar(async () => {
          const { itens, ctx } = await itensDoEscopo(escopo);
          await navigator.clipboard.writeText(referenciasMarkdown(itens, ctx));
          toast.success(
            `${itens.length} ${itens.length === 1 ? "referência copiada" : "referências copiadas"}.`,
          );
        })
      }
      onExportar={(escopo, formato) =>
        void executar(async () => {
          const { itens, ctx } = await itensDoEscopo(escopo);
          if (formato === "md") {
            baixar(
              nomeDoArquivo(q, ctx.geradoEm, "md"),
              referenciasMarkdown(itens, ctx),
              "text/markdown;charset=utf-8",
            );
          } else {
            const corpo = toCSV(linhasCsv(itens, ctx.origem)).replace(/^\uFEFF/, "");
            baixar(
              nomeDoArquivo(q, ctx.geradoEm, "csv"),
              `\uFEFF${cabecalhoCsv(ctx, itens.length)}\n${corpo}`,
              "text/csv;charset=utf-8",
            );
          }
        })
      }
    />
  );
}
BuscarContainer.displayName = "BuscarContainer";
