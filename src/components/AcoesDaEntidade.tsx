import { BotaoCopiar } from "@/components/BotaoCopiar";
import { BotaoFonteOficial } from "@/components/BotaoFonteOficial";
import { BotaoSalvarItem } from "@/components/BotaoSalvarItem";
import { textoCopiavelDeEntidade } from "@/lib/itens-salvos/logic";
import { cn } from "@/lib/utils";
import type { EntidadeTipo } from "@/lib/itens-salvos.functions";

export type AcoesDaEntidadeProps = {
  entidadeTipo: EntidadeTipo;
  entidadeId: string;
  titulo: string;
  /** Rota interna do registro (usada no item salvo). */
  url?: string;
  /** Linha de contexto curta exibida no caderno. */
  contexto?: string;
  /** Dados da entidade no momento — viram snapshot de prova ao salvar. */
  snapshotDe?: unknown;
  /** URL do registro na fonte oficial. Omita quando não há URL única. */
  fonteOficialHref?: string;
  fonteOficialLabel?: string;
  /** Sobrescreve o texto de "Copiar dados". Por padrão usa
   * textoCopiavelDeEntidade(titulo, fonteOficialHref, snapshotDe). */
  obterTextoCopiavel?: () => string;
  rotuloCopiar?: string;
  mensagemCopiar?: string;
  className?: string;
};

/**
 * Kit do auditor: agrupa Copiar dados + Salvar no caderno (com pastas) +
 * Fonte oficial num único cluster reutilizável. Cada página de dado público
 * renderiza este componente em vez de repetir os três primitivos à mão.
 *
 * É um container (BotaoSalvarItem fala com server-fns), por isso NÃO entra no
 * composicoesRegistry — que importa apenas Views puras.
 */
export function AcoesDaEntidade({
  entidadeTipo,
  entidadeId,
  titulo,
  url,
  contexto,
  snapshotDe,
  fonteOficialHref,
  fonteOficialLabel,
  obterTextoCopiavel,
  rotuloCopiar = "Copiar dados",
  mensagemCopiar = "Dados copiados — cole na sua IA",
  className,
}: AcoesDaEntidadeProps) {
  const obterTexto =
    obterTextoCopiavel ??
    (() => textoCopiavelDeEntidade(titulo, fonteOficialHref ?? null, snapshotDe));

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <BotaoCopiar obterTexto={obterTexto} rotulo={rotuloCopiar} mensagemToast={mensagemCopiar} />
      <BotaoSalvarItem
        entidadeTipo={entidadeTipo}
        entidadeId={entidadeId}
        titulo={titulo}
        url={url}
        contexto={contexto}
        snapshotDe={snapshotDe}
      />
      {fonteOficialHref && <BotaoFonteOficial href={fonteOficialHref} rotulo={fonteOficialLabel} />}
    </div>
  );
}
AcoesDaEntidade.displayName = "AcoesDaEntidade";
