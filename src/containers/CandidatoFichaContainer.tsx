import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { compararBensTse, obterCandidatoTse } from "@/lib/data/tse/queries.functions";
import type { CandidaturaHistoricoRow } from "@/lib/data/tse/queries.functions";
import {
  candidaturaComparacaoPadrao,
  deriveEstado,
  type CandidaturaHistorico,
} from "@/lib/candidato-ficha/logic";
import { linkDivulgaCandidato } from "@/lib/links-oficiais";
import { CandidatoFichaView } from "@/components/CandidatoFichaView";
import { QualidadeBanner } from "@/components/QualidadeBanner";
import { ComparadorPatrimonioView } from "@/components/ComparadorPatrimonioView";
import { HistoricoCandidaturasView } from "@/components/HistoricoCandidaturasView";
import { VinculoParlamentarView } from "@/components/VinculoParlamentarView";

function paraHistorico(row: CandidaturaHistoricoRow, sqAtual: string): CandidaturaHistorico {
  return {
    sq: row.sq_candidato,
    ano: row.ano_eleicao,
    turno: row.nr_turno,
    cargo: row.cargo_nome,
    uf: row.uf,
    partido: row.partido_sigla,
    situacao: row.situacao_totalizacao,
    bensTotal: row.bens_total_declarado,
    atual: row.sq_candidato === sqAtual,
  };
}

export function CandidatoFichaContainer({ sq, ano }: { sq: string; ano?: number }) {
  const obterFn = useServerFn(obterCandidatoTse);
  const compararFn = useServerFn(compararBensTse);
  const [sqEscolhido, setSqEscolhido] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["tse", "candidato", sq, ano],
    queryFn: () => obterFn({ data: { sq, ano } }),
  });
  const estado = deriveEstado({ carregando: isLoading, temErro: !!error, encontrado: !!data });

  // Ano efetivo: o da candidatura carregada. A URL pode não trazer ano nenhum
  // (link curto/canônico), e tudo que depende dele — sinais, comparação, link
  // para a fonte oficial — precisa do ano real, não do que veio na query.
  const anoEfetivo = data?.candidato.ano_eleicao ?? ano;

  const historico = (data?.historico ?? []).map((h) => paraHistorico(h, sq));
  const opcoes = historico.filter((c) => c.sq !== sq);
  // O seletor só vira estado depois que o usuário mexe; até lá segue o padrão
  // derivado dos dados, para não precisar de useEffect de sincronização.
  const padrao = anoEfetivo != null ? candidaturaComparacaoPadrao(historico, anoEfetivo) : null;
  const alvo = opcoes.find((o) => o.sq === sqEscolhido) ?? padrao;

  const comparacao = useQuery({
    queryKey: ["tse", "comparar-bens", sq, anoEfetivo, alvo?.sq, alvo?.ano],
    queryFn: () =>
      compararFn({ data: { sqA: sq, anoA: anoEfetivo!, sqB: alvo!.sq, anoB: alvo!.ano } }),
    enabled: !!alvo && anoEfetivo != null,
    placeholderData: keepPreviousData,
  });

  const ue = data?.candidato.municipio_cod ?? data?.candidato.uf ?? null;
  return (
    <>
      {anoEfetivo != null && (
        <div className="grid gap-3 mb-6">
          {/* Sinais desta candidatura: alertas/lacunas (fonte tse) e cruzamentos
              investigativos (tse-cruzamento) — públicos, não só no admin. */}
          <QualidadeBanner
            fonte="tse"
            entidadeTipo="candidato"
            entidadeId={`${sq}-${anoEfetivo}`}
          />
          <QualidadeBanner
            fonte="tse-cruzamento"
            entidadeTipo="candidato"
            entidadeId={`${sq}-${anoEfetivo}`}
          />
        </div>
      )}
      <CandidatoFichaView
        estado={estado}
        detalhe={data ?? null}
        urlOficial={
          anoEfetivo != null
            ? linkDivulgaCandidato({
                ano: anoEfetivo,
                uf: data?.candidato.uf,
                ue,
                sqCandidato: sq,
              })
            : ""
        }
        vinculoParlamentar={data && <VinculoParlamentarView parlamentares={data.parlamentares} />}
        historico={
          data && (
            <HistoricoCandidaturasView
              candidaturas={historico}
              indisponivel={data.historicoIndisponivel}
            />
          )
        }
        comparador={
          data && (
            <ComparadorPatrimonioView
              opcoes={opcoes}
              sqSelecionado={alvo?.sq ?? null}
              onSelecionar={setSqEscolhido}
              carregando={comparacao.isFetching}
              erro={!!comparacao.error}
              comparacao={comparacao.data ?? null}
            />
          )
        }
      />
    </>
  );
}
CandidatoFichaContainer.displayName = "CandidatoFichaContainer";
