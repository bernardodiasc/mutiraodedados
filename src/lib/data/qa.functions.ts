import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  regrasCgu,
  regrasPncp,
  regrasCamaraCeap,
  regrasSenadoCeaps,
  regrasTransferegov,
  regrasTransferegovEmendas,
  regrasSiconfi,
  flagQA,
  type QaFonte,
} from "./qa";
import type {
  AnomaliaInput,
  AnomaliaSeveridade,
  AnomaliaStatus,
} from "@/lib/anomalia";

// -------------------------------------------------------------
// Helpers
// -------------------------------------------------------------
async function ensureAdmin(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw new Error("Falha ao verificar permissão.");
  if (data?.role !== "admin")
    throw new Error("Acesso restrito: somente administradores.");
}

function urlInternaPara(
  fonte: string,
  tipo: string,
  id: string,
): string | undefined {
  if (fonte === "cgu" && tipo === "contrato") return `/contratos/${id}`;
  if (fonte === "cgu" && tipo === "orgao") return `/orgaos/${id}`;
  if (fonte === "cgu" && tipo === "fornecedor") return `/fornecedores/${id}`;
  if (fonte === "pncp" && tipo === "contrato") return `/pncp`;
  if (fonte === "transferegov" && tipo === "instrumento") return `/convenios/${id}`;
  if (fonte === "transferegov" && tipo === "emenda") return `/transferencias/especiais/${id}`;
  return undefined;
}

function urlOficialPara(
  fonte: string,
  tipo: string,
  id: string,
): string | undefined {
  if (fonte === "cgu" && tipo === "contrato")
    return `https://portaldatransparencia.gov.br/contratos/${encodeURIComponent(id)}`;
  if (fonte === "cgu" && tipo === "orgao")
    return `https://portaldatransparencia.gov.br/orgaos/${encodeURIComponent(id)}`;
  if (fonte === "cgu" && tipo === "fornecedor")
    return `https://portaldatransparencia.gov.br/busca?termo=${encodeURIComponent(id)}&tipoBusca=2`;
  if (fonte === "pncp" && tipo === "contrato")
    return `https://pncp.gov.br/app/contratos/${encodeURIComponent(id)}`;
  if (fonte === "transferegov" && tipo === "instrumento")
    // O Portal da Transparência não tem URL pública por id de convênio.
    // O link "de verdade" é a página do transferegov.sistema.gov.br
    // (`sequencialConvenio={codigo}`), montada em listarQualidade* a partir
    // do `codigo_siconv` (dimConvenio.codigo da CGU). Quando o cache não
    // tem o código, caímos numa busca pelo número do convênio.
    return `https://portaldatransparencia.gov.br/convenios/consulta`;
  if (fonte === "transferegov" && tipo === "emenda")
    return `https://portaldatransparencia.gov.br/emendas/consulta?codigoEmenda=${encodeURIComponent(id)}`;
  return undefined;
}

function origemParaAnomalia(origem: string): "qa" | "marcacao_cidada" | "sinal" {
  if (origem === "marcacao_cidada" || origem === "sinal") return origem;
  return "qa";
}

type FindingRow = {
  id: string;
  fonte: string;
  entidade_tipo: string;
  entidade_id: string;
  regra: string;
  severidade: string;
  origem: string;
  valor_armazenado: number | null;
  valor_esperado: number | null;
  status: string;
  reportado_em: string | null;
  reporte_canal: string | null;
  reporte_protocolo: string | null;
  detectado_em: string;
  revalidado_em: string | null;
  resolvido_em: string | null;
  detalhes?: Record<string, unknown> | null;
};

function numberFromDetalhes(detalhes: Record<string, unknown> | null | undefined, key: string): number | null {
  const v = detalhes?.[key];
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
}

function comparacaoPara(r: FindingRow): AnomaliaInput["comparacao"] {
  const inicial = numberFromDetalhes(r.detalhes, "valor_inicial");
  const final = numberFromDetalhes(r.detalhes, "valor_final") ?? r.valor_esperado;
  if (r.regra === "discrepancia_extrema_inicial_final") {
    return {
      armazenado: inicial ?? r.valor_armazenado,
      esperado: final,
      armazenadoLabel: "Valor inicial suspeito",
      esperadoLabel: "Valor final do contrato",
      observacao: "A regra avalia a escala do valor inicial: ele está milhares de vezes acima do valor final e merece investigação própria.",
    };
  }
  if (r.regra === "discrepancia_listagem_detalhe") {
    // Regra desativada: a diferença entre os endpoints /contratos
    // (grupos de 4 dígitos, ex. "975.0000") e /contratos/id (decimal,
    // ex. "9750000.0") é parte esperada do schema da API e hoje é
    // normalizada no parser. Registros antigos ficam no histórico como
    // trilha auditável.
    return {
      armazenado: r.valor_armazenado,
      esperado: r.valor_esperado,
      armazenadoLabel: "Valor final do contrato — endpoint /contratos/id",
      esperadoLabel: "Valor final do contrato — endpoint /contratos (listagem)",
      observacao:
        "Regra desativada. Diferenças de formato entre listagem e detalhe da CGU são esperadas (mesmo número, escalas diferentes) e hoje são normalizadas no parser — não geram mais alerta nem correção automática.",
    };
  }
  if (r.regra === "valor_truncado_suspeito" || r.regra === "valor_final_truncado_suspeito") {
    return {
      armazenado: r.valor_armazenado,
      esperado: null,
      armazenadoLabel: "Valor armazenado (suspeito)",
      esperadoLabel: "Valor oficial (a confirmar)",
      observacao:
        "Valor abaixo do limite plausível para esta fonte. Confira no detalhe oficial via cURL abaixo.",
    };
  }
  return r.valor_armazenado != null || r.valor_esperado != null
    ? { armazenado: r.valor_armazenado, esperado: r.valor_esperado }
    : undefined;
}

function rowToAnomalia(r: FindingRow): AnomaliaInput {
  const trilha: AnomaliaInput["trilha"] = [
    {
      em: r.detectado_em,
      tipo: "deteccao",
      descricao:
        r.origem === "revalidacao"
          ? `Detectado via revalidação (${r.regra})`
          : `Detectado por heurística (${r.regra})`,
    },
  ];
  if (r.revalidado_em)
    trilha.push({
      em: r.revalidado_em,
      tipo: "revalidacao",
      descricao:
        r.valor_esperado != null
          ? `Revalidado via endpoint de detalhe — divergência confirmada`
          : `Revalidado — valores conferem`,
    });
  if (r.reportado_em)
    trilha.push({
      em: r.reportado_em,
      tipo: "reporte",
      descricao: r.reporte_protocolo
        ? `Reportado ao órgão (${r.reporte_canal ?? "—"}, protocolo ${r.reporte_protocolo})`
        : `Reportado ao órgão (${r.reporte_canal ?? "—"})`,
    });
  if (r.resolvido_em)
    trilha.push({
      em: r.resolvido_em,
      tipo: "resolucao",
      descricao: `Resolvido (${r.status})`,
    });

  return {
    id: r.id,
    origem: origemParaAnomalia(r.origem),
    fonte: r.fonte,
    severidade: (r.severidade as AnomaliaSeveridade) ?? "aviso",
    status: (r.status as AnomaliaStatus) ?? "aberto",
    regra: r.regra,
    resumo: r.regra,
    entidade: {
      tipo: r.entidade_tipo,
      id: r.entidade_id,
    url_interno: urlInternaPara(r.fonte, r.entidade_tipo, r.entidade_id),
      url_oficial: urlOficialPara(r.fonte, r.entidade_tipo, r.entidade_id),
    },
    comparacao: comparacaoPara(r),
    trilha,
    reporte: r.reportado_em
      ? {
          canal: r.reporte_canal ?? undefined,
          protocolo: r.reporte_protocolo ?? undefined,
          reportado_em: r.reportado_em ?? undefined,
        }
      : undefined,
    detectado_em: r.detectado_em,
    revalidado_em: r.revalidado_em ?? null,
  };
}

// -------------------------------------------------------------
// Leitura pública (via RPC SECURITY DEFINER)
// -------------------------------------------------------------
// Sinais (origem='sinal') e marcações cidadãs (origem='marcacao_cidada')
// reusam a tabela qa_findings só pra ter o fluxo de investigação/denúncia,
// mas NÃO devem aparecer nas listas de "Qualidade", que são exclusivamente
// sobre defeitos de importação/cobertura de dados.
const ORIGENS_FORA_QUALIDADE = ["sinal", "marcacao_cidada"] as const;
function ehQualidade(origem: string | null | undefined) {
  return !ORIGENS_FORA_QUALIDADE.includes(
    (origem ?? "") as (typeof ORIGENS_FORA_QUALIDADE)[number],
  );
}

export const listarQualidadePublico = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        fonte: z.string().optional(),
        status: z.string().optional(),
        limit: z.number().int().min(1).max(500).default(100),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data }) => {
    const { data: rows, error } = await supabaseAdmin.rpc(
      "qa_findings_publicos",
      {
        _fonte: data.fonte,
        _status: data.status,
        _limit: data.limit,
      },
    );
    if (error) throw new Error(error.message);
    const lista = (rows ?? [])
      .filter((r) => ehQualidade((r as FindingRow).origem))
      .map((r) => rowToAnomalia(r as FindingRow));

    // Sobrescreve url_oficial dos instrumentos transferegov com o número do
    // convênio (o Portal não tem página pública por id interno).
    const instrIds = lista
      .filter((a) => a.fonte === "transferegov" && a.entidade.tipo === "instrumento")
      .map((a) => a.entidade.id);
    if (instrIds.length > 0) {
      const { data: cs } = await supabaseAdmin
        .from("transferegov_instrumentos_cache")
        .select("id, numero, codigo_siconv")
        .in("id", instrIds);
      const byId = new Map(
        (cs ?? []).map(
          (c) => [c.id, { numero: c.numero, codigo_siconv: c.codigo_siconv ?? null }] as const,
        ),
      );
      for (const a of lista) {
        const meta = byId.get(a.entidade.id);
        if (meta && a.fonte === "transferegov" && a.entidade.tipo === "instrumento") {
          if (meta.codigo_siconv) {
            a.entidade.url_oficial = `https://discricionarias.transferegov.sistema.gov.br/voluntarias/ConsultarProposta/ResultadoDaConsultaDeConvenioSelecionarConvenio.do?sequencialConvenio=${encodeURIComponent(meta.codigo_siconv)}`;
          } else if (meta.numero) {
            a.entidade.url_oficial = `https://portaldatransparencia.gov.br/convenios/consulta?nrConvenio=${encodeURIComponent(meta.numero)}`;
          }
          a.entidade.rotulo = meta.codigo_siconv
            ? `Convênio nº ${meta.numero} · SICONV ${meta.codigo_siconv}`
            : `Convênio nº ${meta.numero}`;
        }
      }
    }
    return lista;
  });

export const detalheQualidadePublico = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z.object({ id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data }) => {
    const { data: rows, error } = await supabaseAdmin.rpc(
      "qa_finding_publico",
      { _id: data.id },
    );
    if (error) throw new Error(error.message);
    const r = (rows ?? [])[0] as FindingRow | undefined;
    if (!r) return null;
    return rowToAnomalia(r);
  });

export const agregadoQualidade = createServerFn({ method: "GET" }).handler(
  async () => {
    // Recalcula em JS pra poder excluir as origens não-qualidade.
    const { data, error } = await supabaseAdmin
      .from("qa_findings")
      .select("fonte, status, severidade, origem")
      .not(
        "origem",
        "in",
        `(${ORIGENS_FORA_QUALIDADE.map((o) => `"${o}"`).join(",")})`,
      );
    if (error) throw new Error(error.message);
    const agg = new Map<
      string,
      {
        fonte: string;
        total: number;
        abertos: number;
        confirmados: number;
        reportados: number;
        corrigidos: number;
        falsos_positivos: number;
        criticos: number;
      }
    >();
    for (const r of data ?? []) {
      const f = (r.fonte as string) || "—";
      const cur =
        agg.get(f) ??
        {
          fonte: f,
          total: 0,
          abertos: 0,
          confirmados: 0,
          reportados: 0,
          corrigidos: 0,
          falsos_positivos: 0,
          criticos: 0,
        };
      cur.total++;
      const s = (r.status as string) || "aberto";
      if (s === "aberto") cur.abertos++;
      else if (s === "confirmado") cur.confirmados++;
      else if (s === "reportado") cur.reportados++;
      else if (s === "corrigido_origem") cur.corrigidos++;
      else if (s === "corrigido_automaticamente") cur.corrigidos++;
      else if (s === "falso_positivo") cur.falsos_positivos++;
      if ((r.severidade as string) === "critico") cur.criticos++;
      agg.set(f, cur);
    }
    return Array.from(agg.values());
  },
);

// Findings públicos (sem notas_admin) por entidade — usado pelo banner em
// páginas de registro tipo /contratos/$id.
export const findingsPorEntidade = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        fonte: z.string().min(1).max(40),
        entidade_tipo: z.string().min(1).max(40),
        entidade_id: z.string().min(1).max(200),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { data: rows, error } = await supabaseAdmin
      .from("qa_findings")
      .select(
        "id,fonte,entidade_tipo,entidade_id,regra,severidade,origem,valor_armazenado,valor_esperado,status,reportado_em,reporte_canal,reporte_protocolo,detectado_em,revalidado_em,resolvido_em",
      )
      .eq("fonte", data.fonte)
      .eq("entidade_tipo", data.entidade_tipo)
      .eq("entidade_id", data.entidade_id)
      .in("status", ["aberto", "confirmado", "reportado"])
      .not(
        "origem",
        "in",
        `(${ORIGENS_FORA_QUALIDADE.map((o) => `"${o}"`).join(",")})`,
      )
      .order("severidade", { ascending: true });
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r) => rowToAnomalia(r as FindingRow));
  });

// -------------------------------------------------------------
// Admin
// -------------------------------------------------------------
export const listarQualidadeAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        fonte: z.string().optional(),
        status: z.string().optional(),
        limit: z.number().int().min(1).max(500).default(200),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.userId);
    let q = supabaseAdmin
      .from("qa_findings")
      .select(
        "id,fonte,entidade_tipo,entidade_id,regra,severidade,origem,valor_armazenado,valor_esperado,status,reportado_em,reporte_canal,reporte_protocolo,detectado_em,revalidado_em,resolvido_em,notas_admin,detalhes",
      )
      .not(
        "origem",
        "in",
        `(${ORIGENS_FORA_QUALIDADE.map((o) => `"${o}"`).join(",")})`,
      )
      .order("severidade", { ascending: true })
      .order("detectado_em", { ascending: false })
      .limit(data.limit);
    if (data.fonte) q = q.eq("fonte", data.fonte);
    if (data.status) q = q.eq("status", data.status);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    const lista = rows ?? [];

    // Enriquecer findings CGU com data_assinatura do contrato (necessário pra
    // reconstruir o cURL do endpoint /contratos lista).
    const cguIds = lista
      .filter((r) => r.fonte === "cgu" && r.entidade_tipo === "contrato")
      .map((r) => r.entidade_id);
    const ctxCgu = new Map<string, { data_assinatura: string | null; orgao_cod: string | null }>();
    if (cguIds.length > 0) {
      const { data: cs } = await supabaseAdmin
        .from("contratos_cache")
        .select("id, data_assinatura, orgao_cod")
        .in("id", cguIds);
      for (const c of cs ?? []) {
        ctxCgu.set(c.id, {
          data_assinatura: c.data_assinatura ?? null,
          orgao_cod: c.orgao_cod ?? null,
        });
      }
    }

    // Enriquecer findings de instrumentos do Transferegov (endpoint /convenios
    // do Portal da Transparência) com número, beneficiário e datas, pra montar
    // o cURL de re-checagem e mostrar contexto no card.
    const instrIds = lista
      .filter((r) => r.fonte === "transferegov" && r.entidade_tipo === "instrumento")
      .map((r) => r.entidade_id);
    const ctxInstr = new Map<
      string,
      {
        numero: string | null;
        codigo_siconv: string | null;
        modalidade: string | null;
        beneficiario_nome: string | null;
        data_assinatura: string | null;
        valor_global: number | null;
        valor_repasse: number | null;
        valor_contrapartida: number | null;
        municipio_ibge: string | null;
        uf_beneficiario: string | null;
      }
    >();
    if (instrIds.length > 0) {
      const { data: cs } = await supabaseAdmin
        .from("transferegov_instrumentos_cache")
        .select(
          "id,numero,codigo_siconv,modalidade,beneficiario_nome,data_assinatura,valor_global,valor_repasse,valor_contrapartida,municipio_ibge,uf_beneficiario",
        )
        .in("id", instrIds);
      for (const c of cs ?? []) {
        ctxInstr.set(c.id, {
          numero: c.numero ?? null,
          codigo_siconv: c.codigo_siconv ?? null,
          modalidade: c.modalidade ?? null,
          beneficiario_nome: c.beneficiario_nome ?? null,
          data_assinatura: c.data_assinatura ?? null,
          valor_global: c.valor_global ?? null,
          valor_repasse: c.valor_repasse ?? null,
          valor_contrapartida: c.valor_contrapartida ?? null,
          municipio_ibge: c.municipio_ibge ?? null,
          uf_beneficiario: c.uf_beneficiario ?? null,
        });
      }
    }

    // Enriquecer findings de emendas (Transferegov SE) com número, autor e
    // valor pago — usado pra contexto e pra montar o cURL ao endpoint público.
    const emendaIds = lista
      .filter((r) => r.fonte === "transferegov" && r.entidade_tipo === "emenda")
      .map((r) => r.entidade_id);
    const ctxEmenda = new Map<
      string,
      {
        modalidade: string | null;
        numero_emenda: string | null;
        codigo_emenda: string | null;
        autor_emenda: string | null;
        ano: number | null;
        valor: number | null;
        valor_pago: number | null;
      }
    >();
    if (emendaIds.length > 0) {
      const { data: cs } = await supabaseAdmin
        .from("transferegov_emendas_cache")
        .select(
          "id,modalidade,numero_emenda,codigo_emenda,autor_emenda,ano,valor,valor_pago",
        )
        .in("id", emendaIds);
      for (const c of cs ?? []) {
        ctxEmenda.set(c.id, {
          modalidade: c.modalidade ?? null,
          numero_emenda: c.numero_emenda ?? null,
          codigo_emenda: c.codigo_emenda ?? null,
          autor_emenda: c.autor_emenda ?? null,
          ano: c.ano ?? null,
          valor: c.valor ?? null,
          valor_pago: c.valor_pago ?? null,
        });
      }
    }

    return lista.map((r) => {
      const base = rowToAnomalia(r as FindingRow);
      const extra = r as { notas_admin?: string | null; detalhes?: unknown };
      const ctx = ctxCgu.get(r.entidade_id);
      const ctxI = ctxInstr.get(r.entidade_id);
      const ctxE = ctxEmenda.get(r.entidade_id);
      // Sobrescreve url_oficial: se temos o código SICONV (dimConvenio.codigo
      // da CGU), montamos o link direto pra página do convênio no
      // transferegov.sistema.gov.br. Sem código, caímos numa busca pelo
      // número do convênio no Portal da Transparência.
      if (ctxI && base.fonte === "transferegov" && base.entidade.tipo === "instrumento") {
        if (ctxI.codigo_siconv) {
          base.entidade.url_oficial = `https://discricionarias.transferegov.sistema.gov.br/voluntarias/ConsultarProposta/ResultadoDaConsultaDeConvenioSelecionarConvenio.do?sequencialConvenio=${encodeURIComponent(ctxI.codigo_siconv)}`;
        } else if (ctxI.numero) {
          base.entidade.url_oficial = `https://portaldatransparencia.gov.br/convenios/consulta?nrConvenio=${encodeURIComponent(ctxI.numero)}`;
        }
        if (ctxI.numero) {
          base.entidade.rotulo = ctxI.codigo_siconv
            ? `Convênio nº ${ctxI.numero} · SICONV ${ctxI.codigo_siconv}`
            : `Convênio nº ${ctxI.numero}`;
        }
      }
      return {
        ...base,
        notas_admin: extra.notas_admin ?? null,
        detalhes_json: JSON.stringify(extra.detalhes ?? {}),
        contexto_origem: ctx
          ? {
              data_assinatura: ctx.data_assinatura,
              orgao_cod: ctx.orgao_cod,
            }
          : null,
        contexto_instrumento: ctxI ?? null,
        contexto_emenda: ctxE ?? null,
      };
    });
  });

export const marcarStatusFinding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum([
          "aberto",
          "confirmado",
          "reportado",
          "corrigido_origem",
          "corrigido_automaticamente",
          "falso_positivo",
          "wontfix",
        ]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.userId);
    const resolvendo =
      data.status === "corrigido_origem" ||
      data.status === "corrigido_automaticamente" ||
      data.status === "falso_positivo" ||
      data.status === "wontfix";
    const patch: { status: string; resolvido_em?: string } = {
      status: data.status,
    };
    if (resolvendo) patch.resolvido_em = new Date().toISOString();
    const { error } = await supabaseAdmin
      .from("qa_findings")
      .update(patch)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const salvarReporteFinding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        id: z.string().uuid(),
        canal: z.string().min(1).max(64),
        protocolo: z.string().max(120).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.userId);
    const { error } = await supabaseAdmin
      .from("qa_findings")
      .update({
        status: "reportado",
        reporte_canal: data.canal,
        reporte_protocolo: data.protocolo ?? null,
        reportado_em: new Date().toISOString(),
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const salvarNotaFinding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        id: z.string().uuid(),
        nota: z.string().max(4000),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.userId);
    const { error } = await supabaseAdmin
      .from("qa_findings")
      .update({ notas_admin: data.nota || null })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// -------------------------------------------------------------
// Promover sinal/marcação cidadã em finding investigável
// -------------------------------------------------------------
// Retorna o finding existente (por chave fonte+entidade+regra+origem) ou
// cria um novo. Permite que /admin/sinais e /admin/marcacoes reusem o
// mesmo fluxo de investigação/denúncia de /admin/qualidade.
export const findingPorChave = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        fonte: z.string().min(1).max(40),
        entidade_tipo: z.string().min(1).max(40),
        entidade_id: z.string().min(1).max(200),
        regra: z.string().min(1).max(120),
        origem: z.string().min(1).max(40),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.userId);
    const { data: rows, error } = await supabaseAdmin
      .from("qa_findings")
      .select(
        "id,fonte,entidade_tipo,entidade_id,regra,severidade,origem,valor_armazenado,valor_esperado,status,reportado_em,reporte_canal,reporte_protocolo,detectado_em,revalidado_em,resolvido_em,notas_admin",
      )
      .eq("fonte", data.fonte)
      .eq("entidade_id", data.entidade_id)
      .eq("regra", data.regra)
      .order("detectado_em", { ascending: false })
      .limit(1);
    if (error) throw new Error(error.message);
    const r = (rows ?? [])[0];
    if (!r) return null;
    const base = rowToAnomalia(r as FindingRow);
    return { ...base, notas_admin: (r as { notas_admin?: string | null }).notas_admin ?? null };
  });

export const promoverParaFinding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        fonte: z.string().min(1).max(40),
        entidade_tipo: z.string().min(1).max(40),
        entidade_id: z.string().min(1).max(200),
        regra: z.string().min(1).max(120),
        origem: z.enum(["sinal", "marcacao_cidada"]),
        severidade: z.enum(["info", "aviso", "critico"]).default("aviso"),
        valor_armazenado: z.number().nullable().optional(),
        valor_esperado: z.number().nullable().optional(),
        detalhes: z.record(z.string(), z.unknown()).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.userId);
    // Dedup por chave. O índice único é (fonte, entidade_id, regra) — NÃO
    // inclui origem nem entidade_tipo. Se filtrarmos por origem aqui,
    // perdemos findings já criados pela heurística (origem="heuristica")
    // com a mesma chave e o INSERT bate em qa_findings_unique_open.
    const { data: existentes } = await supabaseAdmin
      .from("qa_findings")
      .select("id")
      .eq("fonte", data.fonte)
      .eq("entidade_id", data.entidade_id)
      .eq("regra", data.regra)
      .limit(1);
    if ((existentes ?? []).length > 0) {
      return { id: existentes![0].id as string, criado: false };
    }
    const { data: ins, error } = await supabaseAdmin
      .from("qa_findings")
      .insert({
        fonte: data.fonte,
        entidade_tipo: data.entidade_tipo,
        entidade_id: data.entidade_id,
        regra: data.regra,
        origem: data.origem,
        severidade: data.severidade,
        status: "aberto",
        valor_armazenado: data.valor_armazenado ?? null,
        valor_esperado: data.valor_esperado ?? null,
        detalhes: (data.detalhes ?? {}) as never,
      })
      .select("id")
      .single();
    if (error) {
      // Corrida: alguém criou no meio do caminho. Relê e devolve o existente.
      if (error.code === "23505" || /unique/i.test(error.message)) {
        const { data: again } = await supabaseAdmin
          .from("qa_findings")
          .select("id")
          .eq("fonte", data.fonte)
          .eq("entidade_id", data.entidade_id)
          .eq("regra", data.regra)
          .limit(1);
        if ((again ?? []).length > 0) {
          return { id: again![0].id as string, criado: false };
        }
      }
      throw new Error(error.message);
    }
    return { id: ins!.id as string, criado: true };
  });

// -------------------------------------------------------------
// Backfill / job de aplicar heurísticas em todo cache
// -------------------------------------------------------------
export const aplicarHeuristicasFonte = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        fonte: z.enum([
          "cgu",
          "pncp",
          "camara_ceap",
          "senado_ceaps",
          "transferegov",
          "siconfi",
        ]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.userId);
    const fonte = data.fonte as QaFonte;
    let inseridos = 0;
    let totalAnalisado = 0;

    if (fonte === "cgu") {
      const { data: rows } = await supabaseAdmin
        .from("contratos_cache")
        .select("id, valor, valor_inicial, orgao_cod");
      totalAnalisado = rows?.length ?? 0;
      inseridos = await flagQA(regrasCgu(rows ?? []));
    } else if (fonte === "pncp") {
      const { data: rows } = await supabaseAdmin
        .from("pncp_contratos_cache")
        .select("id, valor_global, valor_inicial");
      totalAnalisado = rows?.length ?? 0;
      inseridos = await flagQA(regrasPncp(rows ?? []));
    } else if (fonte === "camara_ceap") {
      const { data: rows } = await supabaseAdmin
        .from("camara_despesas_cache")
        .select("id, valor_liquido, valor_documento, deputado_id");
      totalAnalisado = rows?.length ?? 0;
      inseridos = await flagQA(regrasCamaraCeap(rows ?? []));
    } else if (fonte === "senado_ceaps") {
      const { data: rows } = await supabaseAdmin
        .from("senado_despesas_cache")
        .select("id, valor_reembolsado, senador_id");
      totalAnalisado = rows?.length ?? 0;
      inseridos = await flagQA(regrasSenadoCeaps(rows ?? []));
    } else if (fonte === "transferegov") {
      const { data: rows } = await supabaseAdmin
        .from("transferegov_instrumentos_cache")
        .select("id, valor_repasse, valor_global");
      totalAnalisado = rows?.length ?? 0;
      inseridos = await flagQA(regrasTransferegov(rows ?? []));
      // Inclui também emendas (instrumentos + emendas compõem "transferegov").
      const { data: emRows } = await supabaseAdmin
        .from("transferegov_emendas_cache")
        .select("id, valor, valor_pago, modalidade");
      totalAnalisado += emRows?.length ?? 0;
      inseridos += await flagQA(regrasTransferegovEmendas(emRows ?? []));
    } else if (fonte === "siconfi") {
      const { data: rows } = await supabaseAdmin
        .from("siconfi_relatorios_cache")
        .select("id, valor, conta, tipo_relatorio");
      totalAnalisado = rows?.length ?? 0;
      inseridos = await flagQA(regrasSiconfi(rows ?? []));
    }
    return { fonte, totalAnalisado, novos: inseridos };
  });

// -------------------------------------------------------------
// Revalidação CGU — busca endpoint de detalhe para contratos suspeitos
// -------------------------------------------------------------
type PortalContratoDetalhe = {
  id?: number | string;
  valorInicialCompra?: number | string;
  valorFinalCompra?: number | string;
};

/**
 * Preserva os campos monetários da CGU como string antes do JSON.parse.
 * A API usa ponto decimal com 4 casas (ex.: 117560.3000), mas alguns
 * documentos/textos podem aparecer em pt-BR (ex.: 1.410.723,60).
 */
function preservarNumerosBR(jsonText: string): string {
  const campos = ["valorInicialCompra", "valorFinalCompra"];
  let out = jsonText;
  for (const c of campos) {
    const re = new RegExp(`"${c}"\\s*:\\s*(-?\\d+(?:\\.\\d+)?)`, "g");
    out = out.replace(re, `"${c}":"$1"`);
  }
  return out;
}

function parseValorPortal(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v !== "string") return 0;
  const s = v.trim().replace(/^R\$\s*/i, "").replace(/\s/g, "");
  if (!s) return 0;
  const normalizado = s.includes(",")
    ? s.replace(/\./g, "").replace(",", ".")
    : (s.match(/\./g)?.length ?? 0) > 1
      ? s.replace(/\./g, "")
      : s;
  const n = Number(normalizado);
  return Number.isFinite(n) ? n : 0;
}

function detalhesRevalidacao(
  detalhes: Record<string, unknown> | null | undefined,
  valorArmazenado: number,
  valorInicialDetalhe: number,
  valorFinalDetalhe: number,
) {
  return {
    ...((detalhes as Record<string, unknown>) ?? {}),
    fonte_detalhe: "portal_cgu_/contratos/id",
    valor_inicial: valorInicialDetalhe || null,
    valor_final: valorFinalDetalhe || null,
    revalidacao: {
      valor_lista: valorArmazenado,
      valor_inicial_detalhe: valorInicialDetalhe,
      valor_final_detalhe: valorFinalDetalhe,
    },
  } as never;
}

async function portalGetDetalhe(id: string): Promise<PortalContratoDetalhe> {
  const key = process.env.PORTAL_TRANSPARENCIA_API_KEY;
  if (!key) throw new Error("PORTAL_TRANSPARENCIA_API_KEY não configurada.");
  const url = `https://api.portaldatransparencia.gov.br/api-de-dados/contratos/id?id=${encodeURIComponent(id)}`;
  const res = await fetch(url, {
    headers: { "chave-api-dados": key, accept: "application/json" },
  });
  if (!res.ok) throw new Error(`Portal detalhe ${res.status}`);
  const text = await res.text();
  return JSON.parse(preservarNumerosBR(text)) as PortalContratoDetalhe;
}

export const revalidarFindingsCgu = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({ limit: z.number().int().min(1).max(50).default(25) })
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.userId);

    const { data: pendentes } = await supabaseAdmin
      .from("qa_findings")
        .select("id, entidade_id, regra, valor_armazenado, detalhes")
      .eq("fonte", "cgu")
      .eq("status", "aberto")
      .limit(data.limit);

    const lista = pendentes ?? [];
    let confirmados = 0;
    let falsos = 0;
    const erros: string[] = [];

    for (let i = 0; i < lista.length; i++) {
      const p = lista[i];
      if (i > 0) await new Promise((r) => setTimeout(r, 2000)); // rate limit
      try {
        const det = await portalGetDetalhe(p.entidade_id);
        const valorInicialDetalhe = parseValorPortal(det.valorInicialCompra);
        const valorFinalDetalhe = parseValorPortal(det.valorFinalCompra);
        const valorArmazenado = Number(p.valor_armazenado ?? 0);
        const ehInicialExtremo = p.regra === "discrepancia_extrema_inicial_final";
        const divergente = ehInicialExtremo
          ? valorInicialDetalhe > 0 && valorFinalDetalhe > 0 && valorInicialDetalhe >= valorFinalDetalhe * 1000
          : valorFinalDetalhe > 0 &&
            Math.abs(valorFinalDetalhe - valorArmazenado) >
              Math.max(valorFinalDetalhe, valorArmazenado) * 0.05;

        if (divergente) {
          confirmados++;
          await supabaseAdmin
            .from("contratos_cache")
            .update({
              valor: valorFinalDetalhe,
              valor_inicial: valorInicialDetalhe || null,
            })
            .eq("id", p.entidade_id);
          await supabaseAdmin
            .from("qa_findings")
            .update({
              status: ehInicialExtremo ? "confirmado" : "corrigido_automaticamente",
              severidade: "critico",
              valor_armazenado: valorArmazenado,
              valor_esperado: ehInicialExtremo ? valorFinalDetalhe : valorFinalDetalhe,
              revalidado_em: new Date().toISOString(),
              resolvido_em: ehInicialExtremo ? null : new Date().toISOString(),
              detalhes: detalhesRevalidacao(p.detalhes as Record<string, unknown> | null, valorArmazenado, valorInicialDetalhe, valorFinalDetalhe),
            })
            .eq("id", p.id);
        } else {
          falsos++;
          await supabaseAdmin
            .from("qa_findings")
            .update({
              status: "falso_positivo",
              revalidado_em: new Date().toISOString(),
              resolvido_em: new Date().toISOString(),
              valor_esperado: valorFinalDetalhe || null,
            })
            .eq("id", p.id);
        }
      } catch (e) {
        erros.push(`${p.entidade_id}: ${(e as Error).message}`);
      }
    }

    return {
      processados: lista.length,
      confirmados,
      falsos_positivos: falsos,
      erros,
    };
  });

// Revalida UM finding CGU específico (botão por item).
export const revalidarFindingCgu = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.userId);
    const { data: p, error: errFind } = await supabaseAdmin
      .from("qa_findings")
      .select("id, entidade_id, regra, valor_armazenado, detalhes, fonte")
      .eq("id", data.id)
      .maybeSingle();
    if (errFind) throw new Error(errFind.message);
    if (!p) throw new Error("Suspeita não encontrada.");
    if (p.fonte !== "cgu")
      throw new Error("Re-checagem automática só implementada para CGU.");

    const det = await portalGetDetalhe(p.entidade_id);
    const valorInicialDetalhe = parseValorPortal(det.valorInicialCompra);
    const valorFinalDetalhe = parseValorPortal(det.valorFinalCompra);
    const valorArmazenado = Number(p.valor_armazenado ?? 0);
    const ehInicialExtremo = p.regra === "discrepancia_extrema_inicial_final";
    const divergente = ehInicialExtremo
      ? valorInicialDetalhe > 0 && valorFinalDetalhe > 0 && valorInicialDetalhe >= valorFinalDetalhe * 1000
      : valorFinalDetalhe > 0 &&
        Math.abs(valorFinalDetalhe - valorArmazenado) >
          Math.max(valorFinalDetalhe, valorArmazenado) * 0.05;

    if (divergente) {
      await supabaseAdmin
        .from("contratos_cache")
        .update({
          valor: valorFinalDetalhe,
          valor_inicial: valorInicialDetalhe || null,
        })
        .eq("id", p.entidade_id);
      await supabaseAdmin
        .from("qa_findings")
        .update({
          status: ehInicialExtremo ? "confirmado" : "corrigido_automaticamente",
          severidade: "critico",
          valor_armazenado: valorArmazenado,
          valor_esperado: valorFinalDetalhe,
          revalidado_em: new Date().toISOString(),
          resolvido_em: ehInicialExtremo ? null : new Date().toISOString(),
          detalhes: detalhesRevalidacao(p.detalhes as Record<string, unknown> | null, valorArmazenado, valorInicialDetalhe, valorFinalDetalhe),
        })
        .eq("id", p.id);
      return {
        resultado: "confirmado" as const,
        valor_armazenado: ehInicialExtremo ? valorInicialDetalhe : valorArmazenado,
        valor_detalhe: valorFinalDetalhe,
      };
    } else {
      await supabaseAdmin
        .from("qa_findings")
        .update({
          status: "falso_positivo",
          revalidado_em: new Date().toISOString(),
          resolvido_em: new Date().toISOString(),
          valor_esperado: valorFinalDetalhe || null,
        })
        .eq("id", p.id);
      return {
        resultado: "falso_positivo" as const,
        valor_armazenado: valorArmazenado,
        valor_detalhe: valorFinalDetalhe,
      };
    }
  });