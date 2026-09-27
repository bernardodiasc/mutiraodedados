import { useState } from "react";
import { AprendaAInvestigar } from "@/containers/AprendaAInvestigarContainer";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { compararBensTse } from "@/lib/data/tse/queries.functions";
import type { CandidatoDetalhe, CandidaturaHistoricoRow } from "@/lib/data/tse/queries.functions";
import {
  candidaturaComparacaoPadrao,
  type CandidatoSearch,
  type CandidaturaHistorico,
} from "@/lib/candidato-ficha/logic";
import { linkDivulgaCandidato } from "@/lib/links-oficiais";
import { CandidatoFichaView } from "@/components/CandidatoFichaView";
import { QualidadeBanner } from "@/components/QualidadeBanner";
import { ComparadorPatrimonioView } from "@/components/ComparadorPatrimonioView";
import { HistoricoCandidaturasView } from "@/components/HistoricoCandidaturasView";
import { VinculoParlamentarView } from "@/components/VinculoParlamentarView";
import { ContasDeCampanhaContainer } from "@/containers/ContasDeCampanhaContainer";
import { LancamentosCampanhaContainer } from "@/containers/LancamentosCampanhaContainer";

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

export type CandidatoFichaContainerProps = {
  sq: string;
  /** Ficha vinda do loader da rota (já hidratada a partir do SSR). */
  data: CandidatoDetalhe;
  /** Linha indicada pelo link (destino da busca). */
  foco?: Pick<CandidatoSearch, "bem" | "receita" | "despesa">;
};

export function CandidatoFichaContainer({ sq, data, foco }: CandidatoFichaContainerProps) {
  const compararFn = useServerFn(compararBensTse);
  const [sqEscolhido, setSqEscolhido] = useState<string | null>(null);

  // Ano efetivo: o da candidatura carregada. A URL pode não trazer ano nenhum
  // (link curto/canônico), e tudo que depende dele — sinais, comparação, link
  // para a fonte oficial — precisa do ano real, não do que veio na query.
  const anoEfetivo = data.candidato.ano_eleicao;

  const historico = data.historico.map((h) => paraHistorico(h, sq));
  const opcoes = historico.filter((c) => c.sq !== sq);
  // O seletor só vira estado depois que o usuário mexe; até lá segue o padrão
  // derivado dos dados, para não precisar de useEffect de sincronização.
  const padrao = candidaturaComparacaoPadrao(historico, anoEfetivo);
  const alvo = opcoes.find((o) => o.sq === sqEscolhido) ?? padrao;

  const comparacao = useQuery({
    queryKey: ["tse", "comparar-bens", sq, anoEfetivo, alvo?.sq, alvo?.ano],
    queryFn: () =>
      compararFn({ data: { sqA: sq, anoA: anoEfetivo, sqB: alvo!.sq, anoB: alvo!.ano } }),
    enabled: !!alvo,
    placeholderData: keepPreviousData,
  });

  const ue = data.candidato.municipio_cod ?? data.candidato.uf ?? null;
  return (
    <>
      <div className="grid gap-3 mb-6">
        {/* Sinais desta candidatura: alertas/lacunas (fonte tse) e cruzamentos
            investigativos (tse-cruzamento) — públicos, não só no admin. */}
        <QualidadeBanner fonte="tse" entidadeTipo="candidato" entidadeId={`${sq}-${anoEfetivo}`} />
        <QualidadeBanner
          fonte="tse-cruzamento"
          entidadeTipo="candidato"
          entidadeId={`${sq}-${anoEfetivo}`}
        />
        <AprendaAInvestigar colecao="tse_candidatos_cache" idOrigem={`${sq}-${anoEfetivo}`} />
      </div>
      <CandidatoFichaView
        detalhe={data}
        urlOficial={linkDivulgaCandidato({
          ano: anoEfetivo,
          uf: data.candidato.uf,
          ue,
          sqCandidato: sq,
        })}
        vinculoParlamentar={<VinculoParlamentarView parlamentares={data.parlamentares} />}
        bemEmFoco={foco?.bem}
        contas={
          <>
            <ContasDeCampanhaContainer sq={sq} ano={anoEfetivo} />
            <LancamentosCampanhaContainer
              sq={sq}
              ano={anoEfetivo}
              tipo="receitas"
              foco={foco?.receita}
            />
            <LancamentosCampanhaContainer
              sq={sq}
              ano={anoEfetivo}
              tipo="despesas"
              foco={foco?.despesa}
            />
          </>
        }
        historico={
          <HistoricoCandidaturasView
            candidaturas={historico}
            indisponivel={data.historicoIndisponivel}
          />
        }
        comparador={
          <ComparadorPatrimonioView
            opcoes={opcoes}
            sqSelecionado={alvo?.sq ?? null}
            onSelecionar={setSqEscolhido}
            carregando={comparacao.isFetching}
            erro={!!comparacao.error}
            comparacao={comparacao.data ?? null}
          />
        }
      />
    </>
  );
}
CandidatoFichaContainer.displayName = "CandidatoFichaContainer";
