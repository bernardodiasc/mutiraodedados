import * as React from "react";
import { useServerFn } from "@tanstack/react-start";
import { useData } from "@/lib/data-store";
import { ORGAOS_BASE } from "@/lib/data/catalog";
import { registrarTentativa, type Fonte, FONTES_ANUAIS } from "@/lib/data/cobertura.functions";
import { importarCEAPMes } from "@/lib/data/camara/ingest.functions";
import { listarVotacoesPeriodo, importarVotacaoUnica } from "@/lib/data/camara/votacoes.functions";
import { importarCEAPSMes } from "@/lib/data/senado/ingest.functions";
import { importarVotacoesSenado } from "@/lib/data/senado/votacoes.functions";
import { importarContratosPNCP } from "@/lib/data/pncp/ingest.functions";
import { importarConveniosTransferegov } from "@/lib/data/transferegov/ingest.functions";
import {
  importarTransferenciasEspeciais,
  importarTransferenciasFinalidade,
} from "@/lib/data/transferegov/emendas-ingest.functions";
import { dentroDaJanela, type FonteJanela } from "@/lib/data/janelas";

const MESES_CURTO = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

function monthRange(year: number, month: number) {
  const last = new Date(year, month, 0).getDate();
  const mm = String(month).padStart(2, "0");
  return { ini: `${year}-${mm}-01`, fim: `${year}-${mm}-${String(last).padStart(2, "0")}` };
}

/**
 * Descreve o endpoint da API externa que o job vai consultar — usado
 * apenas para fins de auditoria/registro em `importacoes.endpoint`.
 */
function endpointFor(
  fonte: Fonte["fonte"],
  linhaId: string,
  y: number,
  m: number,
  ini: string,
  fim: string,
): string {
  const PORTAL = "https://api.portaldatransparencia.gov.br/api-de-dados";
  const iniBR = `${ini.slice(8, 10)}/${ini.slice(5, 7)}/${ini.slice(0, 4)}`;
  const fimBR = `${fim.slice(8, 10)}/${fim.slice(5, 7)}/${fim.slice(0, 4)}`;
  switch (fonte) {
    case "cgu":
      return `GET ${PORTAL}/contratos?codigoOrgao=${linhaId}&dataInicial=${iniBR}&dataFinal=${fimBR}`;
    case "camara_ceap":
      return `GET https://dadosabertos.camara.leg.br/api/v2/deputados/{id}/despesas?ano=${y}&mes=${m} (513 deputados)`;
    case "camara_vot":
      return `GET https://dadosabertos.camara.leg.br/api/v2/votacoes?dataInicio=${ini}&dataFim=${fim}`;
    case "senado_ceaps":
      return `GET https://www6g.senado.leg.br/transparencia/sen/{id}/CEAPS/${y} (81 senadores, filtro mês=${m})`;
    case "senado_vot":
      return `GET https://legis.senado.leg.br/dadosabertos/plenario/lista/votacao/${ini}/${fim}`;
    case "pncp":
      return `GET https://pncp.gov.br/api/consulta/v1/contratos?dataInicial=${ini.replace(/-/g, "")}&dataFinal=${fim.replace(/-/g, "")}`;
    case "transferegov":
      return `GET ${PORTAL}/convenios?dataInicial=${iniBR}&dataFinal=${fimBR}`;
    case "transferegov_especiais":
      return `GET ${PORTAL}/transferencias?ano=${y}&tipoEmenda=especial (ano inteiro)`;
    case "transferegov_finalidade":
      return `GET ${PORTAL}/transferencias?ano=${y}&tipoEmenda=finalidade-definida (ano inteiro)`;
    case "siconfi":
      return `GET https://apidatalake.tesouro.gov.br/ords/siconfi/tt/...`;
  }
  return "";
}

export type CoberturaJob = { label: string; run: () => Promise<number> };

export type BuildJobFn = (
  fonte: Fonte["fonte"],
  linhaId: string,
  ano: number,
  mes: number,
) => CoberturaJob | null;

/** Hook que devolve um construtor único de jobs para a matriz de cobertura. */
export function useCoberturaJobBuilder(): BuildJobFn {
  const { loadRealOrgao } = useData();
  const logTentativa = useServerFn(registrarTentativa);
  const importarCEAP = useServerFn(importarCEAPMes);
  const listarVotsCam = useServerFn(listarVotacoesPeriodo);
  const importarVotCamUnica = useServerFn(importarVotacaoUnica);
  const importarCEAPS = useServerFn(importarCEAPSMes);
  const importarVotsSen = useServerFn(importarVotacoesSenado);
  const importarPNCP = useServerFn(importarContratosPNCP);
  const importarTransf = useServerFn(importarConveniosTransferegov);
  const importarTransfEsp = useServerFn(importarTransferenciasEspeciais);
  const importarTransfFin = useServerFn(importarTransferenciasFinalidade);

  return React.useCallback<BuildJobFn>(
    (fonte, linhaId, y, m) => {
      if (fonte !== "siconfi" && !dentroDaJanela(fonte as FonteJanela, y, m)) return null;
      const { ini, fim } = monthRange(y, m);
      const tag = `${MESES_CURTO[m - 1]}/${y}`;
      const escopo = fonte === "cgu" || fonte === "siconfi" ? linhaId : "";
      // Fontes anuais (Transferegov Especiais/Finalidade): UI mostra uma única
      // coluna por ano e a API é consultada por ano inteiro. Aqui registramos
      // exatamente UMA linha em `importacoes` (mes=1 como âncora do ano).
      const logar = async (registros: number, erro?: string) => {
        try {
          await logTentativa({
            data: {
              fonte,
              escopo,
              ano: y,
              mes: m,
              registros,
              endpoint: endpointFor(fonte, linhaId, y, m, ini, fim),
              ...(erro ? { erro } : {}),
            },
          });
        } catch (e) {
          console.error("[registrarTentativa] falhou", e);
        }
      };
      const wrap = (
        run: () => Promise<number | { importados: number; erro?: string | null }>,
      ): CoberturaJob["run"] => async () => {
        try {
          const res = await run();
          const n = typeof res === "number" ? res : (res.importados ?? 0);
          const erro = typeof res === "number" ? null : (res.erro ?? null);
          // CGU já grava seu próprio registro em `importacoes` dentro de
          // fetchPortalOrgao (com data_inicial/data_final/orgao_cod). Não
          // duplicar o log aqui.
          if (fonte !== "cgu") await logar(n, erro ?? undefined);
          return n;
        } catch (err) {
          const msg = (err as Error).message;
          const transient = msg.startsWith("TRANSIENT:") || msg.includes("timeout após");
          if (!transient && fonte !== "cgu") {
            await logar(0, msg.slice(0, 500));
          }
          throw err;
        }
      };
      switch (fonte) {
        case "cgu": {
          const o = ORGAOS_BASE.find((x) => x.cod === linhaId);
          const rotulo = o ? `${o.sigla} (${linhaId})` : linhaId;
          return {
            label: `${rotulo} · ${tag}`,
            run: wrap(async () => (await loadRealOrgao(linhaId, { dataInicial: ini, dataFinal: fim })).importados),
          };
        }
        case "camara_ceap":
          return {
            label: `Câmara CEAP · ${tag}`,
            run: wrap(async () => (await importarCEAP({ data: { ano: y, mes: m } })).importados),
          };
        case "camara_vot":
          return {
            label: `Câmara votações · ${tag}`,
            run: wrap(async () => {
              const { ids } = await listarVotsCam({ data: { dataInicio: ini, dataFim: fim, maxPaginas: 5 } });
              let total = 0;
              for (const id of ids) {
                try {
                  const r = await importarVotCamUnica({ data: { id } });
                  total += r.votos;
                } catch (e) {
                  console.error(`[camara_vot] votação ${id} falhou`, e);
                }
              }
              return total;
            }),
          };
        case "senado_ceaps":
          return {
            label: `Senado CEAPS · ${tag}`,
            run: wrap(async () => (await importarCEAPS({ data: { ano: y, mes: m } })).importados),
          };
        case "senado_vot":
          return {
            label: `Senado votações · ${tag}`,
            run: wrap(async () => (await importarVotsSen({ data: { dataInicio: ini, dataFim: fim } })).votos),
          };
        case "pncp":
          return {
            label: `PNCP · ${tag}`,
            run: wrap(async () => (await importarPNCP({ data: { dataInicial: ini, dataFinal: fim } })).importados),
          };
        case "transferegov":
          return {
            label: `Transferegov · ${tag}`,
            run: wrap(async () => (await importarTransf({ data: { dataInicial: ini, dataFinal: fim } })).importados ?? 0),
          };
        case "transferegov_especiais":
          // Fonte anual — emite um único job por ano (m=1 é a âncora).
          if (m !== 1) return null;
          return {
            label: `Transf. Especiais · ${y}`,
            run: wrap(async () => await importarTransfEsp({ data: { ano: y } })),
          };
        case "transferegov_finalidade":
          if (m !== 1) return null;
          return {
            label: `Transf. Finalidade · ${y}`,
            run: wrap(async () => await importarTransfFin({ data: { ano: y } })),
          };
        case "siconfi":
          return null;
      }
      return null;
    },
    [loadRealOrgao, logTentativa, importarCEAP, listarVotsCam, importarVotCamUnica, importarCEAPS, importarVotsSen, importarPNCP, importarTransf, importarTransfEsp, importarTransfFin],
  );
}

/** Agrupamento visual das fontes no painel "Sincronizar tudo". */
export const GRUPOS_FONTES: Array<{ id: string; label: string; fontes: Fonte["fonte"][] }> = [
  { id: "cgu", label: "Portal CGU", fontes: ["cgu"] },
  { id: "camara", label: "Câmara", fontes: ["camara_ceap", "camara_vot"] },
  { id: "senado", label: "Senado", fontes: ["senado_ceaps", "senado_vot"] },
  {
    id: "entes",
    label: "Estados / Municípios",
    fontes: ["pncp", "transferegov", "transferegov_especiais", "transferegov_finalidade"],
  },
];

/** Resumo de cobertura para a página de overview do admin. */
export type CoberturaResumo = {
  geral: { preenchidas: number; total: number; pct: number };
  porGrupo: Array<{ id: string; label: string; preenchidas: number; total: number; pct: number }>;
};

export function calcularCoberturaResumo(
  fontes: Fonte[],
  anoIni: number,
  anoFim: number,
): CoberturaResumo {
  const hoje = new Date();
  const anoAtual = hoje.getFullYear();
  const mesAtual = hoje.getMonth() + 1;

  const contar = (fonteIds: Fonte["fonte"][]) => {
    let preenchidas = 0;
    let total = 0;
    for (const f of fontes) {
      if (!fonteIds.includes(f.fonte)) continue;
      if (f.fonte === "siconfi") continue;
      const anual = FONTES_ANUAIS.has(f.fonte);
      // linhas: para CGU usar todos órgãos cobertos
      const linhasIds =
        f.fonte === "cgu"
          ? ORGAOS_BASE.filter((o) => o.disponivelPortal).map((o) => o.cod)
          : f.linhas.length > 0
            ? f.linhas.map((l) => l.id)
            : [f.fonte];
      // celulas indexadas
      const cells = new Map<string, number>();
      for (const l of f.linhas) {
        for (const c of l.celulas) {
          if (c.mes === 0) continue;
          cells.set(`${l.id}|${c.ano}|${c.mes}`, c.qtd);
        }
      }
      for (const lid of linhasIds) {
        for (let y = anoIni; y <= anoFim; y++) {
          const meses = anual ? [1] : Array.from({ length: 12 }, (_, i) => i + 1);
          for (const m of meses) {
            if (!dentroDaJanela(f.fonte as FonteJanela, y, m)) continue;
            if (y === anoAtual && m > mesAtual) continue;
            total += 1;
            if ((cells.get(`${lid}|${y}|${m}`) ?? 0) > 0) preenchidas += 1;
          }
        }
      }
    }
    const pct = total === 0 ? 0 : Math.round((preenchidas / total) * 100);
    return { preenchidas, total, pct };
  };

  const porGrupo = GRUPOS_FONTES.map((g) => ({
    id: g.id,
    label: g.label,
    ...contar(g.fontes),
  }));
  const all = GRUPOS_FONTES.flatMap((g) => g.fontes);
  const geral = contar(all);
  return { geral, porGrupo };
}