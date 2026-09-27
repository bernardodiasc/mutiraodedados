import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  ExternalLink,
  RefreshCw,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { ControlePaginacao } from "@/components/ControlePaginacao";
import { SeletorItensPorPagina } from "@/components/SeletorItensPorPagina";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LIMITE_EXPORTACAO, ROTULO_ESCOPO, chaveDoItem, type EscopoAcao } from "@/lib/buscar/acoes";
import { categoriaBusca, type CategoriaBuscaId } from "@/lib/busca/categorias";
import type { Desatualizadas } from "@/lib/busca/desatualizadas";
import {
  ITENS_BUSCA,
  ITENS_BUSCA_PADRAO,
  segmentosDoTrecho,
  type Facetas,
  type ItemBusca,
  type ListaBusca,
  type OpcaoFaceta,
  type OrdemBusca,
  type ResumoBusca,
} from "@/lib/busca/consulta";
import {
  chipsDaSearch,
  destinoInterno,
  formatarData,
  formatarTotal,
  formatarValor,
  gruposAbertosIniciais,
  gruposDoResumo,
  intervaloDaPagina,
  paramDaFaceta,
  rotuloData,
  rotuloFaceta,
  rotuloValor,
  temFiltros,
  textoDesatualizada,
  valoresDaFaceta,
  type BuscarSearch,
  type EstadoBuscar,
  type Incompativel,
} from "@/lib/buscar/logic";

export type BuscarViewProps = {
  estado: EstadoBuscar;
  search: BuscarSearch;
  /** Dados de uma consulta anterior mantidos enquanto a nova carrega. */
  atualizando: boolean;
  resumo: ResumoBusca | null;
  lista: ListaBusca | null;
  /** Categorias cuja coleção está com a importação atrasada. */
  desatualizadas: Desatualizadas;
  mensagemErro: string | null;
  /** Troca de categoria esperando confirmação (filtros que serão retirados). */
  trocaPendente: { destino: CategoriaBuscaId | null; incompativeis: Incompativel[] } | null;
  /** Grupos abertos da visão geral (null = abrir os dois primeiros com resultado). */
  gruposAbertos: CategoriaBuscaId[] | null;
  montarSearchPagina: (pagina: number) => BuscarSearch;
  onBuscar: (q: string) => void;
  onAlternarFiltro: (chave: string, valor: string) => void;
  onAplicarFiltros: (filtros: Record<string, string[]>) => void;
  onLimparFiltros: () => void;
  onIrCategoria: (destino: CategoriaBuscaId | null) => void;
  onConfirmarTroca: () => void;
  onCancelarTroca: () => void;
  onGruposAbertos: (abertos: CategoriaBuscaId[]) => void;
  onOrdem: (ordem: OrdemBusca) => void;
  onItens: (itens: number) => void;
  onAtualizar: () => void;
  onTentarDeNovo: () => void;
  onPesquisarOpcoes: (chave: string, termo: string) => Promise<OpcaoFaceta[]>;
  /** Botão de salvar a busca no caderno (container; fala com o servidor). */
  renderSalvarBusca?: () => ReactNode;
  /** Ações secundárias de cada item (ex.: salvar no caderno). */
  renderAcoesItem?: (item: ItemBusca) => ReactNode;
  selecao: EstadoSelecao;
  /** Uma ação (cópia, exportação, gravação) em andamento. */
  acaoEmAndamento: boolean;
  onAlternarModoSelecao: () => void;
  onAlternarItem: (item: ItemBusca) => void;
  onSelecionarPagina: (itens: ItemBusca[]) => void;
  onLimparSelecao: () => void;
  onSalvarSelecao: () => void;
  onCopiarReferencias: (escopo: EscopoAcao) => void;
  onExportar: (escopo: EscopoAcao, formato: "csv" | "md") => void;
};

export type EstadoSelecao = {
  /** Caixas de seleção visíveis. */
  ativa: boolean;
  /** Itens selecionados nesta busca (chave colecao:id). */
  chaves: string[];
  /** Itens selecionados em outra busca, esperando decisão (salvar ou limpar). */
  deOutraBusca: number;
  /** Quem está logado pode salvar a seleção no caderno. */
  podeSalvar: boolean;
};

const EXEMPLOS = ["merenda escolar", '"pregão eletrônico"', "12.345.678/0001-90"];

export function BuscarView(props: BuscarViewProps) {
  const { estado, search } = props;
  const facetas = (search.tipo ? props.lista?.facetas : props.resumo?.facetas) ?? null;
  return (
    <div className="space-y-5">
      <CampoBusca q={search.q ?? ""} onBuscar={props.onBuscar} />
      {estado === "inicial" ? (
        <Inicial onBuscar={props.onBuscar} />
      ) : (
        <>
          <Resumo {...props} />
          <Chips
            search={search}
            onAlternar={props.onAlternarFiltro}
            onLimpar={props.onLimparFiltros}
          />
          {props.trocaPendente && (
            <AvisoTroca
              pendente={props.trocaPendente}
              onConfirmar={props.onConfirmarTroca}
              onCancelar={props.onCancelarTroca}
            />
          )}
          {estado === "carregando" ? (
            <Carregando q={search.q ?? ""} />
          ) : estado === "erro" ? (
            <Erro mensagem={props.mensagemErro} onTentarDeNovo={props.onTentarDeNovo} />
          ) : estado === "vazio" ? (
            <Vazio search={search} onLimpar={props.onLimparFiltros} />
          ) : (
            <div
              className={`lg:grid lg:grid-cols-[240px_1fr] lg:gap-8 space-y-4 lg:space-y-0 ${
                props.atualizando ? "opacity-60 transition-opacity" : ""
              }`}
            >
              <aside aria-label="Refinar resultados">
                <div className="hidden lg:block">
                  <h2 className="text-sm font-semibold mb-3">Refinar resultados</h2>
                  {facetas ? (
                    <PainelFacetas
                      facetas={facetas}
                      search={search}
                      onAlternar={props.onAlternarFiltro}
                      onPesquisarOpcoes={props.onPesquisarOpcoes}
                    />
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Filtros indisponíveis: a contagem desta busca passou do tempo. Refine o termo.
                    </p>
                  )}
                </div>
                {facetas && (
                  <PainelMobile
                    facetas={facetas}
                    search={search}
                    onAplicar={props.onAplicarFiltros}
                    onPesquisarOpcoes={props.onPesquisarOpcoes}
                  />
                )}
              </aside>
              <div className="min-w-0">
                {search.tipo && props.lista ? (
                  <Categoria {...props} lista={props.lista} />
                ) : props.resumo ? (
                  <VisaoGeral {...props} resumo={props.resumo} />
                ) : null}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
BuscarView.displayName = "BuscarView";

// ---------------------------------------------------------------------------

function CampoBusca({ q, onBuscar }: { q: string; onBuscar: (q: string) => void }) {
  const [rascunho, setRascunho] = useState(String(q));
  useEffect(() => setRascunho(String(q)), [q]);
  const curto = rascunho.trim().length > 0 && rascunho.trim().length < 2;
  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        if (!curto) onBuscar(rascunho);
      }}
      className="space-y-1.5"
    >
      <label htmlFor="buscar-campo" className="text-sm font-medium">
        Buscar no acervo
      </label>
      <div className="flex gap-2">
        <input
          id="buscar-campo"
          value={rascunho}
          onChange={(e) => setRascunho(e.target.value)}
          aria-describedby="buscar-ajuda"
          aria-invalid={curto || undefined}
          className="flex-1 min-w-0 rounded-md border bg-background px-3 py-2 text-sm"
        />
        <button
          type="submit"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-accent text-accent-foreground text-sm font-semibold hover:opacity-90"
        >
          <Search className="size-4" aria-hidden /> Buscar
        </button>
      </div>
      <p id="buscar-ajuda" className="text-xs text-muted-foreground">
        {curto
          ? "Digite pelo menos 2 caracteres."
          : "Um assunto, nome, CNPJ ou número de processo. Use aspas para a expressão exata."}
      </p>
    </form>
  );
}

function Inicial({ onBuscar }: { onBuscar: (q: string) => void }) {
  return (
    <div className="rounded-xl border p-5 text-sm space-y-3">
      <p>
        A busca atravessa contratos, licitações, emendas, convênios, fornecedores, candidaturas e
        artigos já importados. Comece por um exemplo:
      </p>
      <div className="flex flex-wrap gap-2">
        {EXEMPLOS.map((ex) => (
          <button
            key={ex}
            type="button"
            onClick={() => onBuscar(ex)}
            className="rounded-full border px-3 py-1.5 text-xs hover:bg-muted"
          >
            {ex}
          </button>
        ))}
      </div>
      <Link
        to="/tutoriais/$slug"
        params={{ slug: "usar-busca-unificada" }}
        className="inline-block text-xs underline"
      >
        Como pesquisar um assunto em várias fontes
      </Link>
    </div>
  );
}

function Resumo(props: BuscarViewProps) {
  const { search } = props;
  const tipo = search.tipo ? categoriaBusca(search.tipo)!.rotulo : null;
  const total = search.tipo
    ? (props.lista?.total ?? null)
    : props.resumo?.contado
      ? props.resumo.categorias.reduce((s, c) => s + (c.total ?? 0), 0)
      : null;
  const contagemIndisponivel =
    (search.tipo
      ? props.lista && props.lista.total === null
      : props.resumo && !props.resumo.contado) ?? false;
  const novos = (search.tipo ? props.lista?.novos : props.resumo?.novos) ?? 0;
  const desatualizadaDaCategoria = search.tipo ? props.desatualizadas[search.tipo] : undefined;
  const avisoDesatualizada = desatualizadaDaCategoria
    ? textoDesatualizada(desatualizadaDaCategoria)
    : null;
  return (
    <div className="space-y-2">
      <p aria-live="polite" className="text-sm">
        Resultados para <strong>“{search.q}”</strong>
        {tipo && (
          <>
            {" "}
            em <strong>{tipo}</strong>
          </>
        )}
        {props.estado === "pronto" && total !== null && (
          <span className="text-muted-foreground">
            {" "}
            · {total.toLocaleString("pt-BR")} registros
          </span>
        )}
        <span className="text-muted-foreground"> · </span>
        <a href="/cobertura" className="underline text-muted-foreground">
          o que está carregado
        </a>
      </p>
      {props.renderSalvarBusca && <div>{props.renderSalvarBusca()}</div>}
      {contagemIndisponivel && (
        <p className="flex items-start gap-2 rounded-md border border-amber-500/50 bg-amber-500/10 p-2 text-xs">
          <AlertTriangle className="size-4 shrink-0 text-amber-600" aria-hidden />
          <span>
            Contagem indisponível: esta busca tem resultados demais para contar a tempo. Os
            resultados abaixo são navegáveis; refine o termo ou os filtros para ver totais e
            filtros.
          </span>
        </p>
      )}
      {avisoDesatualizada && (
        <p className="flex items-start gap-2 rounded-md border border-amber-500/50 bg-amber-500/10 p-2 text-xs">
          <Clock className="size-4 shrink-0 text-amber-600" aria-hidden />
          <span>
            {avisoDesatualizada}{" "}
            <a href="/cobertura" className="underline">
              Ver a cobertura
            </a>
          </span>
        </p>
      )}
      {novos > 0 && (
        <p className="flex flex-wrap items-center gap-2 rounded-md border p-2 text-xs">
          {novos.toLocaleString("pt-BR")} {novos === 1 ? "resultado novo" : "resultados novos"}{" "}
          desde que você abriu esta busca.
          <button
            type="button"
            onClick={props.onAtualizar}
            className="inline-flex items-center gap-1 underline"
          >
            <RefreshCw className="size-3" aria-hidden /> Atualizar
          </button>
        </p>
      )}
    </div>
  );
}

function Chips({
  search,
  onAlternar,
  onLimpar,
}: {
  search: BuscarSearch;
  onAlternar: (chave: string, valor: string) => void;
  onLimpar: () => void;
}) {
  const chips = chipsDaSearch(search);
  if (!chips.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <span className="text-muted-foreground">Filtros ativos:</span>
      {chips.map((c) => (
        <button
          key={c.chave + c.valor}
          type="button"
          onClick={() => onAlternar(c.chave, c.valor)}
          aria-label={`Remover filtro ${c.texto}`}
          className="inline-flex items-center gap-1 rounded-full border bg-muted px-2.5 py-1 min-h-8"
        >
          {c.texto}
          {c.aviso && <span className="text-muted-foreground">({c.aviso})</span>}
          <X className="size-3" aria-hidden />
        </button>
      ))}
      <button type="button" onClick={onLimpar} className="underline text-muted-foreground">
        Limpar filtros
      </button>
    </div>
  );
}

function AvisoTroca({
  pendente,
  onConfirmar,
  onCancelar,
}: {
  pendente: NonNullable<BuscarViewProps["trocaPendente"]>;
  onConfirmar: () => void;
  onCancelar: () => void;
}) {
  const destino = pendente.destino
    ? categoriaBusca(pendente.destino)!.rotulo
    : "Todas as categorias";
  return (
    <div
      role="alertdialog"
      aria-label="Filtros que deixam de valer"
      className="rounded-md border border-amber-500/50 bg-amber-500/10 p-3 text-sm space-y-2"
    >
      <p>
        Em <strong>{destino}</strong>, estes filtros não se aplicam e serão retirados:{" "}
        {pendente.incompativeis
          .map((x) => `${x.rotulo}: ${x.valores.map(rotuloValor).join(", ")}`)
          .join("; ")}
        .
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onConfirmar}
          className="rounded-md bg-accent text-accent-foreground px-3 py-1.5 text-xs font-semibold"
        >
          Continuar para {destino}
        </button>
        <button
          type="button"
          onClick={onCancelar}
          className="rounded-md border px-3 py-1.5 text-xs"
        >
          Ficar aqui
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Facetas

const ORDEM_UNIVERSAIS = ["fonte", "ano", "uf"];

function ordenarFacetas(facetas: Facetas): string[] {
  const chaves = Object.keys(facetas);
  return [
    ...ORDEM_UNIVERSAIS.filter((c) => chaves.includes(c)),
    ...chaves.filter((c) => !ORDEM_UNIVERSAIS.includes(c)),
  ];
}

function facetaLonga(search: BuscarSearch, chave: string): boolean {
  if (!search.tipo) return false;
  return categoriaBusca(search.tipo)!.facetas.find((f) => f.chave === chave)?.longa ?? false;
}

function PainelFacetas({
  facetas,
  search,
  onAlternar,
  onPesquisarOpcoes,
}: {
  facetas: Facetas;
  search: BuscarSearch;
  onAlternar: (chave: string, valor: string) => void;
  onPesquisarOpcoes: BuscarViewProps["onPesquisarOpcoes"];
}) {
  return (
    <div className="space-y-5">
      {ordenarFacetas(facetas).map((chave) => (
        <OpcoesFaceta
          key={chave}
          chave={chave}
          faceta={facetas[chave]}
          selecionados={valoresDaFaceta(search, chave)}
          longa={facetaLonga(search, chave)}
          onAlternar={(v) => onAlternar(chave, v)}
          onPesquisar={(termo) => onPesquisarOpcoes(chave, termo)}
        />
      ))}
      <p className="text-[11px] text-muted-foreground leading-snug">
        As contagens valem para toda a busca, não só para a página. Dentro de um filtro, as opções
        somam (qualquer uma); entre filtros, restringem (todas). Um registro pode contar em mais de
        uma opção.
      </p>
    </div>
  );
}

function OpcoesFaceta({
  chave,
  faceta,
  selecionados,
  longa,
  onAlternar,
  onPesquisar,
}: {
  chave: string;
  faceta: Facetas[string];
  selecionados: string[];
  longa: boolean;
  onAlternar: (valor: string) => void;
  onPesquisar: (termo: string) => Promise<OpcaoFaceta[]>;
}) {
  const [todas, setTodas] = useState(false);
  const [termo, setTermo] = useState("");
  const [pesquisadas, setPesquisadas] = useState<OpcaoFaceta[] | null>(null);
  const rotulo = rotuloFaceta(chave);

  // Pesquisa no servidor só quando há mais opções do que as carregadas.
  useEffect(() => {
    if (!longa || !faceta.mais || termo.trim().length < 2) {
      setPesquisadas(null);
      return;
    }
    let ativo = true;
    const t = setTimeout(() => {
      void onPesquisar(termo.trim()).then((r) => ativo && setPesquisadas(r));
    }, 300);
    return () => {
      ativo = false;
      clearTimeout(t);
    };
  }, [termo, longa, faceta.mais, onPesquisar]);

  const opcoes = useMemo(() => {
    const base = pesquisadas ?? faceta.opcoes;
    const t = termo.trim().toLowerCase();
    return t && !pesquisadas
      ? base.filter((o) => rotuloValor(o.valor).toLowerCase().includes(t))
      : base;
  }, [pesquisadas, faceta.opcoes, termo]);

  if (!faceta.opcoes.length) return null;
  if (faceta.opcoes.length === 1 && !selecionados.length) {
    return (
      <div className="text-xs">
        <div className="font-semibold uppercase tracking-wide text-muted-foreground mb-1">
          {rotulo}
        </div>
        {rotuloValor(faceta.opcoes[0].valor)} ({faceta.opcoes[0].n.toLocaleString("pt-BR")})
      </div>
    );
  }
  const visiveis =
    todas || termo ? opcoes : opcoes.filter((o, i) => i < 8 || selecionados.includes(o.valor));
  return (
    <fieldset className="space-y-1">
      <legend className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
        {rotulo}
      </legend>
      {longa && (faceta.opcoes.length > 8 || faceta.mais) && (
        <input
          value={termo}
          onChange={(e) => setTermo(e.target.value)}
          placeholder={`Pesquisar ${rotulo.toLowerCase()}`}
          aria-label={`Pesquisar opções de ${rotulo}`}
          className="w-full rounded border bg-background px-2 py-1 text-xs mb-1"
        />
      )}
      {visiveis.map((o) => (
        <label
          key={o.valor}
          className="flex items-center gap-2 text-sm cursor-pointer py-0.5 min-h-8"
        >
          <input
            type="checkbox"
            checked={selecionados.includes(o.valor)}
            onChange={() => onAlternar(o.valor)}
          />
          <span className="flex-1 truncate" title={rotuloValor(o.valor)}>
            {rotuloValor(o.valor)}
          </span>
          <span className="text-xs text-muted-foreground tabular-nums">
            {o.n.toLocaleString("pt-BR")}
          </span>
        </label>
      ))}
      {!termo && opcoes.length > 8 && (
        <button
          type="button"
          className="text-xs underline text-muted-foreground"
          onClick={() => setTodas(!todas)}
        >
          {todas ? "Ver menos" : `Ver mais (${opcoes.length - 8})`}
        </button>
      )}
    </fieldset>
  );
}

function PainelMobile({
  facetas,
  search,
  onAplicar,
  onPesquisarOpcoes,
}: {
  facetas: Facetas;
  search: BuscarSearch;
  onAplicar: (filtros: Record<string, string[]>) => void;
  onPesquisarOpcoes: BuscarViewProps["onPesquisarOpcoes"];
}) {
  const [aberto, setAberto] = useState(false);
  const [rascunho, setRascunho] = useState<Record<string, string[]>>({});
  const aplicados = chipsDaSearch(search).length;
  const doSearch = () =>
    Object.fromEntries(ordenarFacetas(facetas).map((c) => [c, valoresDaFaceta(search, c)]));
  // Filtros fora das facetas desta tela (ex.: próprios de outra categoria) seguem aplicados.
  const rascunhoCompleto = () => {
    const todos: Record<string, string[]> = {};
    for (const c of chipsDaSearch(search)) todos[c.chave] = [...(todos[c.chave] ?? []), c.valor];
    return { ...todos, ...rascunho };
  };
  return (
    <Sheet
      open={aberto}
      onOpenChange={(o) => {
        setAberto(o);
        if (o) setRascunho(doSearch());
      }}
    >
      <button
        type="button"
        onClick={() => {
          setRascunho(doSearch());
          setAberto(true);
        }}
        className="lg:hidden inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm min-h-11"
      >
        <SlidersHorizontal className="size-4" aria-hidden /> Filtrar ({aplicados})
      </button>
      <SheetContent side="left" className="flex flex-col">
        <SheetHeader>
          <SheetTitle>Filtrar resultados</SheetTitle>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-1">
          <p className="text-[11px] text-muted-foreground mb-3">
            As contagens são as da busca atual e mudam depois de aplicar.
          </p>
          <PainelFacetas
            facetas={facetas}
            search={{
              tipo: search.tipo,
              ...Object.fromEntries(
                Object.entries(rascunho).map(([c, v]) => [
                  paramDaFaceta(c),
                  v.join("|") || undefined,
                ]),
              ),
            }}
            onAlternar={(chave, valor) => {
              const atual = rascunho[chave] ?? [];
              setRascunho({
                ...rascunho,
                [chave]: atual.includes(valor)
                  ? atual.filter((x) => x !== valor)
                  : [...atual, valor],
              });
            }}
            onPesquisarOpcoes={onPesquisarOpcoes}
          />
        </div>
        <div className="flex gap-2 border-t pt-3">
          <button
            type="button"
            className="flex-1 rounded-md bg-accent text-accent-foreground py-2.5 text-sm font-semibold"
            onClick={() => {
              onAplicar(rascunhoCompleto());
              setAberto(false);
            }}
          >
            Aplicar filtros
          </button>
          <button
            type="button"
            className="flex-1 rounded-md border py-2.5 text-sm"
            onClick={() => setAberto(false)}
          >
            Cancelar
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// Resultados

function VisaoGeral(props: BuscarViewProps & { resumo: ResumoBusca }) {
  const grupos = gruposDoResumo(props.resumo);
  const abertos = props.gruposAbertos ?? gruposAbertosIniciais(grupos);
  return (
    <div className="space-y-4">
      {props.resumo.exato && (
        <section
          aria-label="Registro com o identificador buscado"
          className="rounded-xl border-2 border-accent/60 p-3"
        >
          <div className="text-xs font-semibold text-accent mb-1">
            Identificador exato · {categoriaBusca(props.resumo.exato.categoria)!.rotulo}
          </div>
          <ul>
            <Item item={props.resumo.exato} renderAcoes={props.renderAcoesItem} />
          </ul>
        </section>
      )}
      <div className="divide-y rounded-xl border">
        {grupos.map((g) => {
          const aberto = abertos.includes(g.categoria);
          const vazio = g.previas.length === 0;
          return (
            <section key={g.categoria} className="p-3" aria-labelledby={`grupo-${g.categoria}`}>
              <div className="flex items-center justify-between gap-2">
                <h2 id={`grupo-${g.categoria}`} className="text-base">
                  <button
                    type="button"
                    aria-expanded={aberto}
                    aria-controls={`previas-${g.categoria}`}
                    disabled={vazio}
                    onClick={() =>
                      props.onGruposAbertos(
                        aberto
                          ? abertos.filter((c) => c !== g.categoria)
                          : [...abertos, g.categoria],
                      )
                    }
                    className="flex items-center gap-2 text-left font-medium min-h-11 disabled:text-muted-foreground disabled:cursor-default"
                  >
                    {vazio ? (
                      <span className="size-4" aria-hidden />
                    ) : aberto ? (
                      <ChevronDown className="size-4" aria-hidden />
                    ) : (
                      <ChevronRight className="size-4" aria-hidden />
                    )}
                    {g.rotulo}
                    <span className="text-sm text-muted-foreground tabular-nums">
                      ({vazio && g.total === null ? "nenhum na amostra" : formatarTotal(g.total)})
                    </span>
                  </button>
                </h2>
                {props.desatualizadas[g.categoria] && (
                  <span
                    title={textoDesatualizada(props.desatualizadas[g.categoria]!)}
                    className="mr-auto text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-700 dark:text-amber-400"
                  >
                    desatualizada
                    <span className="sr-only">
                      : {textoDesatualizada(props.desatualizadas[g.categoria]!)}
                    </span>
                  </span>
                )}
                {!vazio && (
                  <button
                    type="button"
                    onClick={() => props.onIrCategoria(g.categoria)}
                    className="text-xs underline shrink-0"
                  >
                    {g.total === null
                      ? "Ver todos"
                      : `Ver todos os ${g.total.toLocaleString("pt-BR")}`}
                  </button>
                )}
              </div>
              {aberto && !vazio && (
                <ul id={`previas-${g.categoria}`} className="divide-y pl-6">
                  {g.previas.map((i) => (
                    <Item key={i.colecao + i.id} item={i} renderAcoes={props.renderAcoesItem} />
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}

function Categoria(props: BuscarViewProps & { lista: ListaBusca }) {
  const { lista, search } = props;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => props.onIrCategoria(null)}
          className="text-sm underline"
        >
          ← Todas as categorias
        </button>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <select
            value={search.ordem ?? "relevancia"}
            onChange={(e) => props.onOrdem(e.target.value as OrdemBusca)}
            aria-label="Ordenar por"
            className="rounded-md border bg-background px-2 py-1.5 text-sm"
          >
            <option value="relevancia">Relevância</option>
            <option value="data-desc">Mais recentes</option>
            <option value="data-asc">Mais antigos</option>
          </select>
          <SeletorItensPorPagina
            valor={search.itens ?? ITENS_BUSCA_PADRAO}
            aoMudar={props.onItens}
            opcoes={ITENS_BUSCA}
          />
        </div>
      </div>
      <BarraAcoes {...props} lista={lista} />
      <Paginacao {...props} lista={lista} />
      <ul className="divide-y rounded-xl border px-3">
        {lista.resultados.map((i) => (
          <Item
            key={i.colecao + i.id}
            item={i}
            renderAcoes={props.renderAcoesItem}
            selecao={
              props.selecao.ativa
                ? {
                    marcado: props.selecao.chaves.includes(chaveDoItem(i)),
                    bloqueado: props.selecao.deOutraBusca > 0,
                    onAlternar: () => props.onAlternarItem(i),
                  }
                : undefined
            }
          />
        ))}
      </ul>
      <Paginacao {...props} lista={lista} />
      {!lista.temMais && lista.total !== null && lista.total > 10_000 && (
        <p className="text-xs text-muted-foreground">
          A navegação por páginas vai até o resultado 10.000. Refine os filtros para chegar ao
          restante.
        </p>
      )}
    </div>
  );
}

function MenuEscopo({
  rotulo,
  props,
  aoEscolher,
}: {
  rotulo: string;
  props: BuscarViewProps;
  aoEscolher: (escopo: EscopoAcao) => void;
}) {
  const n = props.selecao.chaves.length;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={props.acaoEmAndamento}
        className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs min-h-8 disabled:opacity-50"
      >
        {rotulo} <ChevronDown className="size-3" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuItem onSelect={() => aoEscolher("pagina")}>
          {ROTULO_ESCOPO.pagina}
        </DropdownMenuItem>
        <DropdownMenuItem disabled={n === 0} onSelect={() => aoEscolher("selecao")}>
          {ROTULO_ESCOPO.selecao} ({n})
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => aoEscolher("conjunto")}>
          {ROTULO_ESCOPO.conjunto}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function BarraAcoes(props: BuscarViewProps & { lista: ListaBusca }) {
  const { selecao, lista } = props;
  const n = selecao.chaves.length;
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <button
          type="button"
          aria-pressed={selecao.ativa}
          onClick={props.onAlternarModoSelecao}
          className="rounded-md border px-2.5 py-1.5 min-h-8"
        >
          {selecao.ativa ? "Parar de selecionar" : "Selecionar resultados"}
        </button>
        <MenuEscopo
          rotulo="Copiar referências"
          props={props}
          aoEscolher={props.onCopiarReferencias}
        />
        <MenuEscopo
          rotulo="Exportar CSV"
          props={props}
          aoEscolher={(e) => props.onExportar(e, "csv")}
        />
        <MenuEscopo
          rotulo="Exportar Markdown"
          props={props}
          aoEscolher={(e) => props.onExportar(e, "md")}
        />
        {props.acaoEmAndamento && <span className="text-muted-foreground">Preparando…</span>}
      </div>
      {selecao.ativa && (
        <div className="flex flex-wrap items-center gap-3 text-xs" aria-live="polite">
          <button
            type="button"
            className="underline"
            disabled={selecao.deOutraBusca > 0}
            onClick={() => props.onSelecionarPagina(lista.resultados)}
          >
            Selecionar esta página ({lista.resultados.length})
          </button>
          <span className="text-muted-foreground">
            {n.toLocaleString("pt-BR")} {n === 1 ? "selecionado" : "selecionados"} nesta busca{" "}
            (selecionar a página não seleciona o resultado inteiro)
          </span>
          {n > 0 && (
            <button type="button" className="underline" onClick={props.onLimparSelecao}>
              Limpar seleção
            </button>
          )}
        </div>
      )}
      {selecao.deOutraBusca > 0 && (
        <div
          role="alertdialog"
          aria-label="Seleção de outra busca"
          className="rounded-md border border-amber-500/50 bg-amber-500/10 p-3 text-xs space-y-2"
        >
          <p>
            Você tem {selecao.deOutraBusca.toLocaleString("pt-BR")}{" "}
            {selecao.deOutraBusca === 1 ? "item selecionado" : "itens selecionados"} em outra busca.
            Para não misturar recortes, guarde ou descarte essa seleção antes de selecionar aqui.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={!selecao.podeSalvar || props.acaoEmAndamento}
              onClick={props.onSalvarSelecao}
              className="rounded-md bg-accent text-accent-foreground px-3 py-1.5 font-semibold disabled:opacity-50"
            >
              Salvar no caderno
            </button>
            <button
              type="button"
              onClick={props.onLimparSelecao}
              className="rounded-md border px-3 py-1.5"
            >
              Limpar seleção
            </button>
            {!selecao.podeSalvar && (
              <span className="self-center text-muted-foreground">
                Entre para salvar no caderno.
              </span>
            )}
          </div>
        </div>
      )}
      <p className="sr-only">
        A exportação do conjunto completo vai até {LIMITE_EXPORTACAO.toLocaleString("pt-BR")} itens.
      </p>
    </div>
  );
}

function Paginacao(props: BuscarViewProps & { lista: ListaBusca }) {
  const { lista } = props;
  if (lista.total !== null) {
    return (
      <ControlePaginacao
        pagina={lista.pagina}
        itens={lista.itens}
        total={Math.min(lista.total, 10_000)}
        to="/buscar"
        montarSearch={(p) => props.montarSearchPagina(p)}
      />
    );
  }
  // Sem total (contagem indisponível): anterior/próxima, sem inventar a última página.
  return (
    <nav aria-label="Paginação" className="flex items-center justify-between gap-2 text-sm">
      <span className="text-xs text-muted-foreground tabular-nums">
        {intervaloDaPagina(lista.pagina, lista.itens, lista.resultados.length, null)}
      </span>
      <div className="flex gap-1">
        {lista.pagina > 1 && (
          <Link
            to="/buscar"
            search={props.montarSearchPagina(lista.pagina - 1) as never}
            className="rounded border px-2 py-1"
            aria-label="Página anterior"
          >
            <ChevronLeft className="size-3.5" aria-hidden />
          </Link>
        )}
        {lista.temMais && (
          <Link
            to="/buscar"
            search={props.montarSearchPagina(lista.pagina + 1) as never}
            className="rounded border px-2 py-1"
            aria-label="Próxima página"
          >
            <ChevronRight className="size-3.5" aria-hidden />
          </Link>
        )}
      </div>
    </nav>
  );
}

const ROTULO_MOTIVO: Record<ItemBusca["motivo"], string> = {
  identificador: "identificador",
  titulo: "no título",
  nomes: "em nome ou documento relacionado",
  texto: "no texto",
};

function Item({
  item,
  renderAcoes,
  selecao,
}: {
  item: ItemBusca;
  renderAcoes?: (item: ItemBusca) => ReactNode;
  selecao?: { marcado: boolean; bloqueado: boolean; onAlternar: () => void };
}) {
  const [expandido, setExpandido] = useState(false);
  const texto = item.trecho ?? item.resumo;
  const longo = (texto?.length ?? 0) > 280;
  const destino = destinoInterno(item.href);
  return (
    <li className="py-3">
      <div className="flex items-start justify-between gap-3">
        {selecao && (
          <input
            type="checkbox"
            className="mt-1 size-4 shrink-0"
            checked={selecao.marcado}
            disabled={selecao.bloqueado}
            onChange={selecao.onAlternar}
            aria-label={`Selecionar ${item.titulo}`}
          />
        )}
        <div className="min-w-0 flex-1">
          <Link
            to={destino.to as never}
            search={destino.search as never}
            hash={destino.hash}
            className="font-medium text-sm hover:underline break-words"
          >
            {item.titulo}
          </Link>
          <div className="text-xs text-muted-foreground mt-0.5 flex flex-wrap gap-x-1.5">
            <span className="rounded border px-1">{item.fonte}</span>
            {item.identificador && <span className="break-all">{item.identificador}</span>}
            {item.data && (
              <span>
                · {rotuloData(item)}: {formatarData(item.data)}
              </span>
            )}
            {item.pai && <span>· em {item.pai.titulo}</span>}
          </div>
        </div>
        {item.valor && (
          <div className="text-right shrink-0 text-sm tabular-nums">
            {formatarValor(item.valor)}
            <div className="text-[11px] text-muted-foreground">{item.valor.natureza}</div>
          </div>
        )}
      </div>
      {texto && (
        <p className={`text-xs mt-1 leading-relaxed ${longo && !expandido ? "line-clamp-3" : ""}`}>
          {item.trecho
            ? segmentosDoTrecho(item.trecho).map((s, i) =>
                s.destaque ? (
                  <mark
                    key={i}
                    className="bg-yellow-200/70 dark:bg-yellow-500/30 rounded-sm px-0.5"
                  >
                    {s.texto}
                  </mark>
                ) : (
                  <span key={i}>{s.texto}</span>
                ),
              )
            : texto}{" "}
          <span className="text-muted-foreground">(encontrado {ROTULO_MOTIVO[item.motivo]})</span>
        </p>
      )}
      <div className="mt-1 flex flex-wrap gap-3 text-xs">
        {longo && (
          <button
            type="button"
            className="underline text-muted-foreground"
            onClick={() => setExpandido(!expandido)}
          >
            {expandido ? "Mostrar menos" : "Mostrar trecho inteiro"}
          </button>
        )}
        {item.urlOficial && (
          <a
            href={item.urlOficial}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-muted-foreground underline"
          >
            Ver na fonte oficial <ExternalLink className="size-3" aria-hidden />
          </a>
        )}
        {renderAcoes?.(item)}
      </div>
    </li>
  );
}

// ---------------------------------------------------------------------------
// Estados

function Carregando({ q }: { q: string }) {
  return (
    <div className="space-y-3" aria-busy="true">
      <p className="text-xs text-muted-foreground">Buscando “{q}”…</p>
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="h-14 rounded-md bg-muted animate-pulse" />
      ))}
    </div>
  );
}

function Erro({
  mensagem,
  onTentarDeNovo,
}: {
  mensagem: string | null;
  onTentarDeNovo: () => void;
}) {
  return (
    <div role="alert" className="rounded-xl border border-destructive/40 p-4 text-sm space-y-2">
      <p>{mensagem ?? "Não foi possível fazer a busca agora."}</p>
      <button type="button" onClick={onTentarDeNovo} className="underline text-xs">
        Tentar de novo
      </button>
    </div>
  );
}

function Vazio({ search, onLimpar }: { search: BuscarSearch; onLimpar: () => void }) {
  if (temFiltros(search)) {
    return (
      <div className="rounded-xl border p-4 text-sm space-y-2">
        <p>Nenhum registro com estes filtros.</p>
        <button type="button" onClick={onLimpar} className="underline text-xs">
          Limpar filtros e manter “{search.q}”
        </button>
      </div>
    );
  }
  return (
    <div className="rounded-xl border p-4 text-sm space-y-2">
      <p>
        Nada encontrado para “{search.q}” no acervo carregado. Isso não prova que o registro não
        exista: o site guarda só parte do que cada fonte publica.
      </p>
      <ul className="list-disc pl-5 text-xs text-muted-foreground space-y-1">
        <li>
          Confira o que está carregado em{" "}
          <a href="/cobertura" className="underline">
            cobertura
          </a>
          .
        </li>
        <li>Tente menos palavras, outra grafia ou o número do documento.</li>
        <li>
          Continue na fonte:{" "}
          <a
            className="underline"
            href="https://pncp.gov.br/app/contratos"
            target="_blank"
            rel="noreferrer"
          >
            PNCP
          </a>
          ,{" "}
          <a
            className="underline"
            href="https://portaldatransparencia.gov.br"
            target="_blank"
            rel="noreferrer"
          >
            Portal da Transparência
          </a>
          ,{" "}
          <a
            className="underline"
            href="https://divulgacandcontas.tse.jus.br"
            target="_blank"
            rel="noreferrer"
          >
            TSE
          </a>
          .
        </li>
      </ul>
    </div>
  );
}
