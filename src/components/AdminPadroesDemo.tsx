import * as React from "react";
import { Copy, Eye, EyeOff, Pencil, Trash2 } from "lucide-react";
import { IconeAcao } from "@/components/IconeAcao";
import { ListaOrdenavel } from "@/components/ListaOrdenavel";

/**
 * Demonstra o padrão canônico de botões de ação (só ícone) usado nas linhas das
 * listas do admin. Este é o padrão de referência — telas de curadoria devem usá-lo.
 */
export type IconeAcaoDemoViewProps = { ativo?: boolean };

export function IconeAcaoDemoView({ ativo = true }: IconeAcaoDemoViewProps) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 flex items-center justify-between gap-3">
      <div className="text-sm">
        <div className="font-medium">Item de exemplo</div>
        <div className="text-xs text-muted-foreground">
          Ações padronizadas: copiar, alternar, editar, excluir.
        </div>
      </div>
      <div className="flex items-center gap-0.5">
        <IconeAcao icon={Copy} label="Copiar" />
        <IconeAcao icon={ativo ? Eye : EyeOff} label={ativo ? "Desativar" : "Ativar"} />
        <IconeAcao icon={Pencil} label="Editar" />
        <IconeAcao icon={Trash2} label="Excluir" tone="destructive" />
      </div>
    </div>
  );
}

IconeAcaoDemoView.displayName = "IconeAcaoDemoView";

/**
 * Demonstra a lista reordenável por drag-and-drop. Mantém estado local só para o
 * style guide (não faz I/O) — arraste pela alça para reordenar.
 */
export type ListaOrdenavelDemoViewProps = { desabilitado?: boolean };

const ITENS_DEMO = [
  { id: "1", titulo: "Primeiro item" },
  { id: "2", titulo: "Segundo item" },
  { id: "3", titulo: "Terceiro item" },
];

export function ListaOrdenavelDemoView({ desabilitado = false }: ListaOrdenavelDemoViewProps) {
  const [itens, setItens] = React.useState(ITENS_DEMO);
  return (
    <ListaOrdenavel
      itens={itens}
      getId={(it) => it.id}
      desabilitado={desabilitado}
      dicaDesabilitado={desabilitado ? "Reordenação desligada (ex.: lista filtrada)." : undefined}
      onReordenar={(ids) =>
        setItens((atual) => ids.map((id) => atual.find((x) => x.id === id)!).filter(Boolean))
      }
      renderItem={(it) => (
        <div className="rounded-xl border border-border bg-card px-4 py-3 text-sm">{it.titulo}</div>
      )}
    />
  );
}

ListaOrdenavelDemoView.displayName = "ListaOrdenavelDemoView";
