import * as React from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { AnomaliaInvestigacao } from "@/components/AnomaliaInvestigacao";
import {
  findingPorChave,
  promoverParaFinding,
  marcarStatusFinding,
  salvarReporteFinding,
  salvarNotaFinding,
} from "@/lib/data/qa.functions";
import type { AnomaliaSeveridade } from "@/lib/anomalia";

export type CandidatoInvestigacao = {
  fonte: string;
  entidade_tipo: string;
  entidade_id: string;
  regra: string;
  origem: "sinal" | "marcacao_cidada";
  severidade?: AnomaliaSeveridade;
  valor_armazenado?: number | null;
  valor_esperado?: number | null;
  detalhes?: Record<string, unknown>;
};

/**
 * Card colapsado com botão "Abrir investigação". Quando o candidato já tem
 * um qa_finding correspondente (mesmo fonte+entidade+regra+origem), renderiza
 * o <AnomaliaInvestigacao /> completo com as ações de admin. Caso contrário,
 * promove ao clicar.
 */
export function InvestigacaoInline({
  candidato,
  children,
  statusFilter,
  curls,
}: {
  candidato: CandidatoInvestigacao;
  /** Cabeçalho do card — descrição do registro original (sem borda própria). */
  children: React.ReactNode;
  /** Se definido, oculta o card quando o status do finding não bate.
   * Quando o finding ainda não existe, é tratado como "aberto". */
  statusFilter?: string;
  curls?: Array<{ label: string; command: string; nota?: string }>;
}) {
  const qc = useQueryClient();
  const fetchFinding = useServerFn(findingPorChave);
  const mutPromover = useServerFn(promoverParaFinding);
  const mutStatus = useServerFn(marcarStatusFinding);
  const mutReporte = useServerFn(salvarReporteFinding);
  const mutNota = useServerFn(salvarNotaFinding);

  const chave = [
    "finding-chave",
    candidato.fonte,
    candidato.entidade_tipo,
    candidato.entidade_id,
    candidato.regra,
    candidato.origem,
  ];

  const { data: finding, isLoading } = useQuery({
    queryKey: chave,
    queryFn: () =>
      fetchFinding({
        data: {
          fonte: candidato.fonte,
          entidade_tipo: candidato.entidade_tipo,
          entidade_id: candidato.entidade_id,
          regra: candidato.regra,
          origem: candidato.origem,
        },
      }),
  });

  const [promovendo, setPromovendo] = React.useState(false);
  const invalidar = () => qc.refetchQueries({ queryKey: chave });

  // Auto-promove para finding na primeira renderização: a UX desejada é que
  // todo sinal/marcação já apareça em "modo investigação", sem ação manual.
  const autoTried = React.useRef(false);
  React.useEffect(() => {
    if (isLoading || finding || autoTried.current) return;
    autoTried.current = true;
    setPromovendo(true);
    mutPromover({
      data: {
        fonte: candidato.fonte,
        entidade_tipo: candidato.entidade_tipo,
        entidade_id: candidato.entidade_id,
        regra: candidato.regra,
        origem: candidato.origem,
        severidade: candidato.severidade ?? "aviso",
        valor_armazenado: candidato.valor_armazenado ?? null,
        valor_esperado: candidato.valor_esperado ?? null,
        detalhes: candidato.detalhes,
      },
    })
      .then(() => invalidar())
      .catch((e) => toast.error((e as Error).message))
      .finally(() => setPromovendo(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, finding]);

  // Filtro de status: tratamos pré-promoção como "aberto".
  const statusAtual = finding?.status ?? "aberto";
  if (statusFilter && statusAtual !== statusFilter) return null;

  return (
    <article className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="p-4">{children}</div>
      <div className="border-t border-border bg-muted/30">
        {isLoading || (!finding && promovendo) ? (
          <div className="p-3 text-xs text-muted-foreground inline-flex items-center gap-2">
            <Loader2 className="size-3.5 animate-spin" /> Abrindo investigação…
          </div>
        ) : !finding ? (
          <div className="p-3">
            <Button
              size="sm"
              variant="outline"
              disabled={promovendo}
              onClick={async () => {
                setPromovendo(true);
                try {
                  await mutPromover({
                    data: {
                      fonte: candidato.fonte,
                      entidade_tipo: candidato.entidade_tipo,
                      entidade_id: candidato.entidade_id,
                      regra: candidato.regra,
                      origem: candidato.origem,
                      severidade: candidato.severidade ?? "aviso",
                      valor_armazenado: candidato.valor_armazenado ?? null,
                      valor_esperado: candidato.valor_esperado ?? null,
                      detalhes: candidato.detalhes,
                    },
                  });
                  toast.success("Investigação aberta.");
                  invalidar();
                } catch (e) {
                  toast.error((e as Error).message);
                } finally {
                  setPromovendo(false);
                }
              }}
            >
              {promovendo ? (
                <Loader2 className="size-3.5 mr-1.5 animate-spin" />
              ) : (
                <Search className="size-3.5 mr-1.5" />
              )}
              Abrir investigação manualmente
            </Button>
          </div>
        ) : (
          <AnomaliaInvestigacao
            anomalia={finding}
            notaInicial={finding.notas_admin ?? null}
            flush
            curls={curls}
            actions={{
              onReportar: async (canal, protocolo) => {
                await mutReporte({
                  data: { id: finding.id, canal, protocolo: protocolo || undefined },
                });
                invalidar();
              },
              onConfirmar: async () => {
                await mutStatus({ data: { id: finding.id, status: "confirmado" } });
                invalidar();
              },
              onMarcarCorrigido: async () => {
                await mutStatus({ data: { id: finding.id, status: "corrigido_origem" } });
                invalidar();
              },
              onMarcarFalsoPositivo: async () => {
                await mutStatus({ data: { id: finding.id, status: "falso_positivo" } });
                invalidar();
              },
              onSalvarNota: async (nota) => {
                await mutNota({ data: { id: finding.id, nota } });
                invalidar();
              },
            }}
          />
        )}
      </div>
    </article>
  );
}