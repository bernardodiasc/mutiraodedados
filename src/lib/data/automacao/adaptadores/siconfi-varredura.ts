/**
 * Modo nomeado — varredura em massa do SICONFI: os 10 relatórios padrão
 * (RREO 1–6, RGF 1–3, DCA) de cada ente de um conjunto (as UFs, as capitais,
 * os municípios de uma UF ou um ente). Janela natural: UM exercício do
 * conjunto — intervalo maior é recusado, quem chama fatia. Retomável: o
 * cursor fica na varredura do servidor (a mesma do painel).
 *
 * Cada consulta grava a sua linha como o relatório avulso (tipo no `escopo`,
 * exercício e período em `ano`/`mes`, ente em `orgao_cod`), casando com a
 * matriz de cobertura. A rodada grava uma linha com o conjunto no `escopo`
 * (`varredura:<conjunto>[:<filtro>]`) e o exercício em `ano`, com `mes` 0: é a
 * linha da conferência da janela, e as pendentes são lidas por ela. A origem
 * só informa `hasMore`, então a contagem "não se aplica". A célula contada é
 * a do exercício, nos entes do conjunto.
 *
 * O ano todo de um ente (`siconfi-ano.ts`) é esta mesma varredura, com o
 * conjunto "ente": mesma chave, mesmo escopo, mesmas conferências.
 */
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  chaveDaVarreduraSiconfi,
  rodadaVarreduraSiconfi,
  varrerSiconfiSchema,
  type ParamsVarreduraSiconfi,
} from "@/lib/data/siconfi/ingest.functions";
import {
  CAPITAIS,
  ROTULO_CONJUNTO,
  escopoDaVarreduraSiconfi,
  filtroDoConjunto,
  type RecorteDaVarredura,
} from "@/lib/data/siconfi/varredura";
import { UF_LIST } from "@/lib/admin-entes/logic";
import { dentroDaJanelaAnual } from "@/lib/data/janelas";
import { ehPeriodoRecente } from "@/lib/data/historico-rodada";
import { janelasPendentesPorPeriodo } from "@/lib/data/automacao/conferencia";
import { lerConferencias } from "@/lib/data/automacao/conferencia.server";
import { textoDoErroDoBanco } from "@/lib/data/erros-banco";
import type { Adaptador, RecusaNomeada } from "@/lib/data/automacao/adaptador";
import type { JanelaPendente } from "@/lib/data/automacao/conferencia";

/** Código IBGE da UF pela sigla (ex.: AC → 12). */
const codigoDaUf = (sigla: string) => UF_LIST.find((u) => u.uf === sigla)?.codigo;

/** O filtro que o conjunto exige: a UF (sigla válida) nos municípios, o código no ente. */
function checarRecorte(p: RecorteDaVarredura, ctx: z.RefinementCtx) {
  if (p.conjunto === "municipios" && !(p.uf && codigoDaUf(p.uf))) {
    ctx.addIssue({ code: "custom", message: "municípios exige uf: a sigla de uma UF (ex.: SP)" });
  }
  if (p.conjunto === "ente" && !p.codIbge) {
    ctx.addIssue({ code: "custom", message: "ente exige codIbge" });
  }
}

/** Um exercício só, dentro da janela de disponibilidade da fonte. */
const schema = varrerSiconfiSchema.superRefine((p, ctx) => {
  if (p.exercicioInicial !== p.exercicioFinal) {
    ctx.addIssue({
      code: "custom",
      message: "janela maior que um exercício — fatie o intervalo em exercícios",
    });
  }
  if (!dentroDaJanelaAnual("siconfi", p.exercicioInicial)) {
    ctx.addIssue({
      code: "custom",
      message: "fora da janela de disponibilidade da fonte (siconfi)",
    });
  }
  checarRecorte(p, ctx);
}) as z.ZodType<ParamsVarreduraSiconfi>;

/**
 * Linhas do exercício no cache, nos entes do conjunto: as UFs pela lista dos
 * 27 códigos; os municípios de uma UF pela faixa de códigos dela (12xxxxx).
 * Lista e faixa, não `like`: só assim o índice (exercicio, cod_ibge) conta sem
 * ler a tabela. Com `like`, o banco lia todas as linhas do exercício e a
 * contagem estourava o tempo-limite do PostgREST (8 s) nas UFs e capitais.
 * Em GET com limit 0, não HEAD: o erro do banco vem no corpo.
 */
export async function contarNaCelulaDaVarredura(p: ParamsVarreduraSiconfi): Promise<number> {
  let q = supabaseAdmin
    .from("siconfi_relatorios_cache")
    .select("id", { count: "exact" })
    .eq("exercicio", p.exercicioInicial);
  if (p.conjunto === "ufs")
    q = q.in(
      "cod_ibge",
      UF_LIST.map((u) => u.codigo),
    );
  if (p.conjunto === "capitais")
    q = q.in(
      "cod_ibge",
      CAPITAIS.map((c) => c.codigo),
    );
  if (p.conjunto === "municipios") {
    const uf = codigoDaUf(p.uf ?? "");
    q = q.gte("cod_ibge", `${uf}00000`).lte("cod_ibge", `${uf}99999`);
  }
  if (p.conjunto === "ente") q = q.eq("cod_ibge", p.codIbge ?? "");
  const { count, error, status } = await q.limit(0);
  if (error)
    throw new Error(
      `conferência: contagem em siconfi_relatorios_cache: ${textoDoErroDoBanco(error, status)}`,
    );
  return count ?? 0;
}

/** Exercícios encerrados do conjunto cuja última conferência não é aprovada. */
async function pendentesDoConjunto(recorte: RecorteDaVarredura): Promise<JanelaPendente[]> {
  const conferencias = await lerConferencias("siconfi", escopoDaVarreduraSiconfi(recorte));
  return janelasPendentesPorPeriodo("siconfi", 0, conferencias);
}

/**
 * O adaptador de uma tarefa que é uma varredura do SICONFI: `paraVarredura`
 * traduz os parâmetros da tarefa nos da varredura (um exercício só).
 */
export function adaptadorDeVarreduraSiconfi<P>(opts: {
  schema: z.ZodType<P>;
  paraVarredura: (p: P) => ParamsVarreduraSiconfi;
  /** O recorte da consulta de pendentes, a partir dos `params` dela. */
  recorteDasPendentes: (params: unknown) => RecorteDaVarredura | RecusaNomeada;
}): Adaptador<P> {
  const { paraVarredura } = opts;
  return {
    schema: opts.schema,
    fonte: "siconfi",
    chave: (p) => chaveDaVarreduraSiconfi(paraVarredura(p)),
    escopo: (p) => escopoDaVarreduraSiconfi(paraVarredura(p)),
    janela: (p) => ({ ano: paraVarredura(p).exercicioInicial, mes: 0 }),
    recente: (p) => ehPeriodoRecente(paraVarredura(p).exercicioInicial, 12),
    contarNaCelula: (p) => contarNaCelulaDaVarredura(paraVarredura(p)),
    descricao: (p) => {
      const v = paraVarredura(p);
      const filtro = filtroDoConjunto(v);
      return `SICONFI: relatórios de ${v.exercicioInicial} — ${ROTULO_CONJUNTO[v.conjunto]}${filtro ? ` (${filtro})` : ""}`;
    },
    unidades: ["linhas"],
    rodada: (p, origem) =>
      rodadaVarreduraSiconfi(paraVarredura(p), null, origem).then((r) => ({
        importados: { linhas: r.importados },
        erros: r.erros,
        varredura: r.varredura,
        origem: null,
      })),
    pendentes: async (params) => {
      const recorte = opts.recorteDasPendentes(params);
      if ("recusa" in recorte) return recorte;
      return pendentesDoConjunto(recorte);
    },
  };
}

/** O que a consulta de pendentes da varredura precisa: o conjunto e o filtro dele. */
const recorteSchema = z
  .object({
    conjunto: varrerSiconfiSchema.shape.conjunto,
    uf: z.string().optional(),
    codIbge: z
      .string()
      .regex(/^\d{2}$|^\d{7}$/)
      .optional(),
  })
  .superRefine(checarRecorte);

export const adaptadorSiconfiVarredura = adaptadorDeVarreduraSiconfi<ParamsVarreduraSiconfi>({
  schema,
  paraVarredura: (p) => p,
  recorteDasPendentes: (params) => {
    const r = recorteSchema.safeParse(params ?? {});
    return r.success ? r.data : { recusa: `siconfi_varredura: ${z.prettifyError(r.error)}` };
  },
});
