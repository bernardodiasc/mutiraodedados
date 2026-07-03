import * as React from "react";
import { GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import { moverPara, ordemMudou } from "@/lib/lista-ordenavel/logic";

export type ListaOrdenavelProps<T> = {
  itens: T[];
  getId: (item: T) => string;
  renderItem: (item: T) => React.ReactNode;
  /** Chamado com os ids na nova ordem quando um arraste altera a sequência. */
  onReordenar: (idsNaNovaOrdem: string[]) => void;
  /** Desliga o arraste (ex.: lista filtrada, onde a ordem seria ambígua). */
  desabilitado?: boolean;
  /** Aviso mostrado no topo quando o arraste está desligado. */
  dicaDesabilitado?: React.ReactNode;
  className?: string;
};

/**
 * Lista vertical reordenável por drag-and-drop, sem dependências. O arraste só
 * dispara pela alça (GripVertical) — cliques em botões da linha continuam
 * funcionando. Quando `desabilitado`, some a alça e o aviso é exibido.
 */
export function ListaOrdenavel<T>({
  itens,
  getId,
  renderItem,
  onReordenar,
  desabilitado,
  dicaDesabilitado,
  className,
}: ListaOrdenavelProps<T>) {
  const [arrastandoId, setArrastandoId] = React.useState<string | null>(null);
  const [sobreId, setSobreId] = React.useState<string | null>(null);
  const pelaAlca = React.useRef(false);

  const limpar = () => {
    setArrastandoId(null);
    setSobreId(null);
    pelaAlca.current = false;
  };

  const soltar = (destinoId: string) => {
    if (!arrastandoId) return;
    const ids = itens.map(getId);
    const nova = moverPara(ids, arrastandoId, destinoId);
    if (ordemMudou(ids, nova)) onReordenar(nova);
    limpar();
  };

  return (
    <div className={className}>
      {desabilitado && dicaDesabilitado && (
        <p className="mb-2 text-[11px] text-muted-foreground">{dicaDesabilitado}</p>
      )}
      <ul className="space-y-2">
        {itens.map((item) => {
          const id = getId(item);
          const arrastando = arrastandoId === id;
          const alvo = !!arrastandoId && sobreId === id && arrastandoId !== id;
          return (
            <li
              key={id}
              draggable={!desabilitado}
              onDragStart={(e) => {
                if (desabilitado || !pelaAlca.current) {
                  e.preventDefault();
                  return;
                }
                setArrastandoId(id);
                e.dataTransfer.effectAllowed = "move";
                e.dataTransfer.setData("text/plain", id);
              }}
              onDragOver={(e) => {
                if (!arrastandoId) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                if (sobreId !== id) setSobreId(id);
              }}
              onDrop={(e) => {
                e.preventDefault();
                soltar(id);
              }}
              onDragEnd={limpar}
              className={cn(
                "flex items-stretch gap-1 rounded-xl transition-[opacity,box-shadow]",
                arrastando && "opacity-40",
                alvo && "ring-2 ring-accent ring-offset-2 ring-offset-background",
              )}
            >
              {!desabilitado && (
                <span
                  aria-hidden
                  onPointerDown={() => {
                    pelaAlca.current = true;
                  }}
                  onPointerUp={() => {
                    pelaAlca.current = false;
                  }}
                  title="Arraste para reordenar"
                  className="flex w-6 shrink-0 cursor-grab items-center justify-center rounded-md text-muted-foreground hover:text-foreground active:cursor-grabbing"
                >
                  <GripVertical className="size-4" />
                </span>
              )}
              <div className="min-w-0 flex-1">{renderItem(item)}</div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

ListaOrdenavel.displayName = "ListaOrdenavel";
