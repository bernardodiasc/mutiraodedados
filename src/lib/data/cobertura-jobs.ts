import * as React from "react";
import { useServerFn } from "@tanstack/react-start";
import { useData } from "@/lib/data-store";
import { ORGAOS_BASE } from "@/lib/data/catalog";
import { registrarTentativa, type Fonte, FONTES_ANUAIS } from "@/lib/data/cobertura.functions";
import { importarCEAPMes } from "@/lib/data/camara/ingest.functions";
import { listarVotacoesPeriodo, importarVotacaoUnica } from "@/lib/data/camara/votacoes.functions";
import { importarProposicoes } from "@/lib/data/camara/proposicoes.functions";
import { importarCEAPSMes } from "@/lib/data/senado/ingest.functions";
import { importarVotacoesSenado } from "@/lib/data/senado/votacoes.functions";
import { importarMaterias } from "@/lib/data/senado/materias.functions";
import { importarContratosPNCP } from "@/lib/data/pncp/ingest.functions";
import { importLicitacoes } from "@/lib/data/real/licitacoes.functions";
import { importEmendas } from "@/lib/data/real/emendas.functions";
import { importConvenios } from "@/lib/data/real/convenios.functions";
import { importarConveniosTransferegov } from "@/lib/data/transferegov/ingest.functions";
import { dentroDaJanela, type FonteJanela } from "@/lib/data/janelas";

const MESES_CURTO = [
  "Jan",
  "Fev",
  "Mar",
  "Abr",
  "Mai",
  "Jun",
  "Jul",
  "Ago",
  "Set",
  "Out",
  "Nov",
  "Dez",
];

// Fontes da CGU que gravam o PRÓPRIO registro de rodada em `importacoes`
// (via fetchPortalOrgao/varrerPaginado, com data_inicial/data_final/orgao_cod).
// Para essas, o wrapper de job NÃO deve duplicar o log via registrarTentativa.
const FONTES_CGU_AUTO_LOG = new Set<string>([
  "cgu",
  "cgu_licitacoes",
  "cgu_emendas",
  "cgu_convenios",
]);

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
    case "cgu_licitacoes":
      return `GET ${PORTAL}/licitacoes?codigoOrgao=${linhaId}&dataInicial=${iniBR}&dataFinal=${fimBR}`;
    case "cgu_emendas":
      return `GET ${PORTAL}/emendas?ano=${y} (ano inteiro)`;
    case "cgu_convenios":
      return `GET ${PORTAL}/convenios?dataInicial=${iniBR}&dataFinal=${fimBR}`;
    case "camara_ceap":
      return `GET https://dadosabertos.camara.leg.br/api/v2/deputados/{id}/despesas?ano=${y}&mes=${m} (513 deputados)`;
    case "camara_vot":
      return `GET https://dadosabertos.camara.leg.br/api/v2/votacoes?dataInicio=${ini}&dataFim=${fim}`;
    case "camara_props":
      return `GET https://dadosabertos.camara.leg.br/api/v2/proposicoes?ano=${y}&siglaTipo={PL,PEC,PLP,MPV,PDL,PRC} (ano inteiro)`;
    case "senado_ceaps":
      return `GET https://www6g.senado.leg.br/transparencia/sen/{id}/CEAPS/${y} (81 senadores, filtro mês=${m})`;
    case "senado_vot":
      return `GET https://legis.senado.leg.br/dadosabertos/plenario/lista/votacao/${ini}/${fim}`;
    case "senado_mat":
      return `GET https://legis.senado.leg.br/dadosabertos/materia/pesquisa/lista?ano=${y}&sigla={PL,PLS,PEC,PLP,PDL,PRC,MPV} (ano inteiro)`;
    case "pncp":
      return `GET https://pncp.gov.br/api/consulta/v1/contratos?dataInicial=${ini.replace(/-/g, "")}&dataFinal=${fim.replace(/-/g, "")}`;
    case "transferegov":
      return `GET ${PORTAL}/convenios?dataInicial=${iniBR}&dataFinal=${fimBR}`;
    case "siconfi":
      return `GET https://apidatalake.tesouro.gov.br/ords/siconfi/tt/...`;
  }
  return "";
}

export type CoberturaJob = {
  label: string;
  run: () => Promise<number>;
  // CGU: o job gerencia seu próprio timeout por rodada e roda várias rodadas
  // até a varredura do órgão completar — então o runner NÃO deve aplicar o
  // timeout único de 4min (que mataria o loop após a 1ª rodada).
  noTimeout?: boolean;
};

/**
 * Cache de varredura da CGU, vivo durante UM lote de jobs.
 *
 * A API da CGU filtra contratos por VIGÊNCIA (não por assinatura), então
 * consultar mês a mês só repete o mesmo histórico. A ingestão roda em modo
 * varredura completa por órgão. Como a matriz/sincronização constroem um job
 * por (órgão, ano, mês), este cache garante que a primeira célula de um órgão
 * dispare UMA varredura e as demais virem no-ops — sem requisições redundantes
 * nem dupla contagem. `runJobs` chama `resetCguSweepCache()` no início de cada
 * lote para que um novo disparo realmente re-varra.
 */
const cguSweepCache = new Map<string, Promise<number>>();
// Sinal de cancelamento da varredura CGU (entre rodadas do auto-continuar).
let cguSweepAbort = false;
export function abortCguSweep() {
  cguSweepAbort = true;
}
export function resetCguSweepCache() {
  cguSweepCache.clear();
  cguSweepAbort = false;
}

export type BuildJobFn = (
  fonte: Fonte["fonte"],
  linhaId: string,
  ano: number,
  mes: number,
  // CGU: janela de vigência opcional (ISO YYYY-MM-DD). Quando presente, a
  // varredura filtra por início de vigência; ausente = varredura completa.
  opts?: { dataInicial?: string; dataFinal?: string },
) => CoberturaJob | null;

/** Hook que devolve um construtor único de jobs para a matriz de cobertura. */
export function useCoberturaJobBuilder(): BuildJobFn {
  const { loadRealOrgao } = useData();
  const logTentativa = useServerFn(registrarTentativa);
  const importarCEAP = useServerFn(importarCEAPMes);
  const listarVotsCam = useServerFn(listarVotacoesPeriodo);
  const importarVotCamUnica = useServerFn(importarVotacaoUnica);
  const importarProps = useServerFn(importarProposicoes);
  const importarCEAPS = useServerFn(importarCEAPSMes);
  const importarVotsSen = useServerFn(importarVotacoesSenado);
  const importarMat = useServerFn(importarMaterias);
  const importarPNCP = useServerFn(importarContratosPNCP);
  const importLic = useServerFn(importLicitacoes);
  const importEme = useServerFn(importEmendas);
  const importConv = useServerFn(importConvenios);
  const importarTransf = useServerFn(importarConveniosTransferegov);

  return React.useCallback<BuildJobFn>(
    (fonte, linhaId, y, m, opts) => {
      if (fonte !== "siconfi" && !dentroDaJanela(fonte as FonteJanela, y, m)) return null;
      const { ini, fim } = monthRange(y, m);
      const tag = `${MESES_CURTO[m - 1]}/${y}`;
      const escopo =
        fonte === "cgu" || fonte === "cgu_licitacoes" || fonte === "siconfi" ? linhaId : "";
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
      const wrap =
        (
          run: () => Promise<number | { importados: number; erro?: string | null }>,
        ): CoberturaJob["run"] =>
        async () => {
          try {
            const res = await run();
            const n = typeof res === "number" ? res : (res.importados ?? 0);
            const erro = typeof res === "number" ? null : (res.erro ?? null);
            // CGU (contratos e licitações) já grava seu próprio registro em
            // `importacoes` dentro do ingest/varredura (com data_inicial/
            // data_final/orgao_cod). Não duplicar o log aqui.
            if (!FONTES_CGU_AUTO_LOG.has(fonte)) await logar(n, erro ?? undefined);
            return n;
          } catch (err) {
            const msg = (err as Error).message;
            const transient = msg.startsWith("TRANSIENT:") || msg.includes("timeout após");
            if (!transient && !FONTES_CGU_AUTO_LOG.has(fonte)) {
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
            // O loop de rodadas gerencia seu próprio timeout por rodada.
            noTimeout: true,
            run: wrap(async () => {
              // Dedup por janela (ver cguSweepCache): a 1ª chamada de uma mesma
              // janela varre e as demais (mesma janela no lote) viram no-op.
              // Janela de vigência: o Sincronizar tudo passa o range de anos via
              // `opts`; na matriz (sem opts) a célula clicada importa só o MÊS
              // referente (janela = início..fim do mês), alocado por início de
              // vigência. A chave do cache inclui a janela para não colidir.
              const janela =
                opts?.dataInicial && opts?.dataFinal
                  ? { dataInicial: opts.dataInicial, dataFinal: opts.dataFinal }
                  : { dataInicial: ini, dataFinal: fim };
              const cacheKey = `${linhaId}|${janela.dataInicial}|${janela.dataFinal}`;
              const emCurso = cguSweepCache.get(cacheKey);
              if (emCurso) {
                try {
                  await emCurso;
                } catch {
                  /* erro já reportado na primeira célula do órgão */
                }
                return 0;
              }
              // AUTO-CONTINUAR: roda rodadas até a varredura do órgão completar
              // (haMais=false). Cada rodada é limitada por TEMPO no servidor
              // (~3min) e por um timeout de segurança aqui (4min). Teto de
              // rodadas como guarda contra loop infinito.
              const RODADA_TIMEOUT_MS = 4 * 60 * 1000;
              const MAX_RODADAS = 300;
              const p = (async () => {
                let total = 0;
                for (let r = 0; r < MAX_RODADAS; r++) {
                  if (cguSweepAbort) break;
                  const meta = await Promise.race([
                    loadRealOrgao(linhaId, janela),
                    new Promise<never>((_, reject) =>
                      setTimeout(
                        () =>
                          reject(
                            new Error(`timeout após ${Math.round(RODADA_TIMEOUT_MS / 1000)}s`),
                          ),
                        RODADA_TIMEOUT_MS,
                      ),
                    ),
                  ]);
                  total += meta.importados;
                  if (!meta.varredura?.haMais) break;
                }
                return total;
              })();
              cguSweepCache.set(cacheKey, p);
              return p;
            }),
          };
        }
        case "cgu_licitacoes": {
          const o = ORGAOS_BASE.find((x) => x.cod === linhaId);
          const rotulo = o ? `${o.sigla} (${linhaId})` : linhaId;
          return {
            label: `${rotulo} licitações · ${tag}`,
            // Varredura retomável por janela do mês — roda rodadas até completar.
            noTimeout: true,
            run: wrap(async () => {
              const RODADA_TIMEOUT_MS = 4 * 60 * 1000;
              const MAX_RODADAS = 100;
              let total = 0;
              for (let r = 0; r < MAX_RODADAS; r++) {
                if (cguSweepAbort) break;
                const res = await Promise.race([
                  importLic({ data: { codigoOrgao: linhaId, dataInicial: ini, dataFinal: fim } }),
                  new Promise<never>((_, reject) =>
                    setTimeout(
                      () =>
                        reject(new Error(`timeout após ${Math.round(RODADA_TIMEOUT_MS / 1000)}s`)),
                      RODADA_TIMEOUT_MS,
                    ),
                  ),
                ]);
                total += res.meta.importados;
                if (!res.meta.varredura.haMais) break;
              }
              return total;
            }),
          };
        }
        case "cgu_emendas":
          // Fonte anual — um job por ano (m=1 é a âncora). Varredura retomável.
          if (m !== 1) return null;
          return {
            label: `Emendas CGU · ${y}`,
            noTimeout: true,
            run: wrap(async () => {
              const RODADA_TIMEOUT_MS = 4 * 60 * 1000;
              const MAX_RODADAS = 100;
              let total = 0;
              for (let r = 0; r < MAX_RODADAS; r++) {
                if (cguSweepAbort) break;
                const res = await Promise.race([
                  importEme({ data: { ano: y } }),
                  new Promise<never>((_, reject) =>
                    setTimeout(
                      () =>
                        reject(new Error(`timeout após ${Math.round(RODADA_TIMEOUT_MS / 1000)}s`)),
                      RODADA_TIMEOUT_MS,
                    ),
                  ),
                ]);
                total += res.meta.importados;
                if (!res.meta.varredura.haMais) break;
              }
              return total;
            }),
          };
        case "cgu_convenios":
          return {
            label: `Convênios CGU · ${tag}`,
            noTimeout: true,
            run: wrap(async () => {
              const RODADA_TIMEOUT_MS = 4 * 60 * 1000;
              const MAX_RODADAS = 100;
              let total = 0;
              for (let r = 0; r < MAX_RODADAS; r++) {
                if (cguSweepAbort) break;
                const res = await Promise.race([
                  importConv({ data: { dataInicial: ini, dataFinal: fim } }),
                  new Promise<never>((_, reject) =>
                    setTimeout(
                      () =>
                        reject(new Error(`timeout após ${Math.round(RODADA_TIMEOUT_MS / 1000)}s`)),
                      RODADA_TIMEOUT_MS,
                    ),
                  ),
                ]);
                total += res.meta.importados;
                if (!res.meta.varredura.haMais) break;
              }
              return total;
            }),
          };
        case "camara_ceap":
          return {
            label: `Câmara CEAP · ${tag}`,
            noTimeout: true,
            // Varredura retomável por parlamentar — roda rodadas até completar.
            run: wrap(async () => {
              const RODADA_TIMEOUT_MS = 4 * 60 * 1000;
              const MAX_RODADAS = 120;
              let total = 0;
              for (let r = 0; r < MAX_RODADAS; r++) {
                if (cguSweepAbort) break;
                const res = await Promise.race([
                  importarCEAP({ data: { ano: y, mes: m } }),
                  new Promise<never>((_, reject) =>
                    setTimeout(
                      () =>
                        reject(new Error(`timeout após ${Math.round(RODADA_TIMEOUT_MS / 1000)}s`)),
                      RODADA_TIMEOUT_MS,
                    ),
                  ),
                ]);
                total += res.importados;
                if (!res.varredura.haMais) break;
              }
              return total;
            }),
          };
        case "camara_vot":
          return {
            label: `Câmara votações · ${tag}`,
            run: wrap(async () => {
              const { ids } = await listarVotsCam({
                data: { dataInicio: ini, dataFim: fim, maxPaginas: 5 },
              });
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
        case "camara_props":
          // Fonte anual — um job por ano (m=1 âncora). Itera os tipos padrão.
          if (m !== 1) return null;
          return {
            label: `Câmara proposições · ${y}`,
            run: wrap(async () => {
              const tipos = ["PL", "PEC", "PLP", "MPV", "PDL", "PRC"];
              let total = 0;
              for (const siglaTipo of tipos) {
                try {
                  const r = await importarProps({ data: { ano: y, siglaTipo } });
                  total += r.importados;
                } catch (e) {
                  console.error(`[camara_props] ${siglaTipo}/${y} falhou`, e);
                }
              }
              return total;
            }),
          };
        case "senado_ceaps":
          return {
            label: `Senado CEAPS · ${tag}`,
            noTimeout: true,
            // Varredura retomável por parlamentar — roda rodadas até completar.
            run: wrap(async () => {
              const RODADA_TIMEOUT_MS = 4 * 60 * 1000;
              const MAX_RODADAS = 40;
              let total = 0;
              for (let r = 0; r < MAX_RODADAS; r++) {
                if (cguSweepAbort) break;
                const res = await Promise.race([
                  importarCEAPS({ data: { ano: y, mes: m } }),
                  new Promise<never>((_, reject) =>
                    setTimeout(
                      () =>
                        reject(new Error(`timeout após ${Math.round(RODADA_TIMEOUT_MS / 1000)}s`)),
                      RODADA_TIMEOUT_MS,
                    ),
                  ),
                ]);
                total += res.importados;
                if (!res.varredura.haMais) break;
              }
              return total;
            }),
          };
        case "senado_vot":
          return {
            label: `Senado votações · ${tag}`,
            run: wrap(
              async () =>
                (await importarVotsSen({ data: { dataInicio: ini, dataFim: fim } })).votos,
            ),
          };
        case "senado_mat":
          // Fonte anual — um job por ano (m=1 âncora). Itera os subtipos padrão.
          if (m !== 1) return null;
          return {
            label: `Senado matérias · ${y}`,
            run: wrap(async () => {
              const siglas = ["PL", "PLS", "PEC", "PLP", "PDL", "PRC", "MPV"];
              let total = 0;
              for (const sigla of siglas) {
                try {
                  const r = await importarMat({ data: { ano: y, sigla } });
                  total += r.importados;
                } catch (e) {
                  console.error(`[senado_mat] ${sigla}/${y} falhou`, e);
                }
              }
              return total;
            }),
          };
        case "pncp":
          return {
            label: `PNCP · ${tag}`,
            run: wrap(
              async () =>
                (await importarPNCP({ data: { dataInicial: ini, dataFinal: fim } })).importados,
            ),
          };
        case "transferegov":
          return {
            label: `Transferegov · ${tag}`,
            run: wrap(
              async () =>
                (await importarTransf({ data: { dataInicial: ini, dataFinal: fim } })).importados ??
                0,
            ),
          };
        case "siconfi":
          return null;
      }
      return null;
    },
    [
      loadRealOrgao,
      logTentativa,
      importarCEAP,
      listarVotsCam,
      importarVotCamUnica,
      importarProps,
      importarCEAPS,
      importarVotsSen,
      importarMat,
      importarPNCP,
      importLic,
      importEme,
      importConv,
      importarTransf,
    ],
  );
}

/** Agrupamento visual das fontes no painel "Sincronizar tudo". */
export const GRUPOS_FONTES: Array<{ id: string; label: string; fontes: Fonte["fonte"][] }> = [
  {
    id: "cgu",
    label: "Portal CGU",
    fontes: ["cgu", "cgu_licitacoes", "cgu_emendas", "cgu_convenios"],
  },
  { id: "camara", label: "Câmara", fontes: ["camara_ceap", "camara_vot", "camara_props"] },
  { id: "senado", label: "Senado", fontes: ["senado_ceaps", "senado_vot", "senado_mat"] },
  {
    id: "entes",
    label: "Estados / Municípios",
    fontes: ["pncp", "transferegov"],
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
      // Linhas = órgãos/entidades que já aparecem na cobertura da fonte ("órgãos
      // com dados"). CGU não é mais forçado ao catálogo ORGAOS_BASE: a lista vem
      // do próprio dado e cresce conforme se importa.
      const linhasIds = f.linhas.length > 0 ? f.linhas.map((l) => l.id) : [f.fonte];
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
