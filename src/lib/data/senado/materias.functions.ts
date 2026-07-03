import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const BASE = "https://legis.senado.leg.br/dadosabertos";
const UA = "AuditoriaCidada/1.0 (+https://auditoria-cidada.lovable.app)";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// GET com retry/backoff (500 → 1500 → 4500 ms) para 429/5xx e erros de rede
// transitórios; 4xx é erro definitivo.
async function senadoGet<T = unknown>(path: string, tentativas = 4): Promise<T> {
  let ultimoErro = "sem resposta";
  for (let tent = 0; tent < tentativas; tent++) {
    if (tent > 0) await sleep(500 * 3 ** (tent - 1));
    let res: Response;
    try {
      res = await fetch(`${BASE}${path}`, { headers: { accept: "application/json", "user-agent": UA } });
    } catch (e) {
      ultimoErro = (e as Error).message;
      continue;
    }
    if (res.ok) return (await res.json()) as T;
    if (res.status === 429 || res.status >= 500) {
      ultimoErro = `${res.status}`;
      continue;
    }
    const body = await res.text().catch(() => "");
    throw new Error(`Senado API ${res.status}: ${body.slice(0, 200)}`);
  }
  throw new Error(`Senado API indisponível após ${tentativas} tentativas (último: ${ultimoErro}).`);
}

function asArray<T>(v: T | T[] | null | undefined): T[] {
  if (v == null) return [];
  return Array.isArray(v) ? v : [v];
}

async function ensureAdmin(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("user_roles").select("role")
    .eq("user_id", userId).eq("role", "admin").maybeSingle();
  if (error) throw new Error("Falha ao verificar permissão.");
  if (data?.role !== "admin") throw new Error("Acesso restrito: somente administradores.");
}

type MateriaListItem = {
  Codigo?: string | number;
  IdentificacaoMateria?: {
    CodigoMateria?: string | number;
    SiglaSubtipoMateria?: string;
    NumeroMateria?: string | number;
    AnoMateria?: string | number;
  };
  EmentaMateria?: string;
  DataApresentacao?: string;
  Autoria?: { Autor?: { NomeAutor?: string } | Array<{ NomeAutor?: string }> };
  AutoresPrincipais?: { AutorPrincipal?: { NomeAutor?: string } | Array<{ NomeAutor?: string }> };
  SituacaoAtual?: { Autuacoes?: { Autuacao?: { Situacao?: { DescricaoSituacao?: string; DataSituacao?: string } } } };
};

/** Importa matérias do Senado por ano + sigla (PL, PEC, MPV, PLP...). */
export const importarMaterias = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      ano: z.number().int().min(1990).max(2100),
      sigla: z.string().min(2).max(10).default("PL"),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.userId);

    const json = await senadoGet<{
      PesquisaBasicaMateria?: {
        Materias?: { Materia?: MateriaListItem | MateriaListItem[] };
      };
    }>(`/materia/pesquisa/lista?ano=${data.ano}&sigla=${encodeURIComponent(data.sigla)}`);

    const arr = asArray(json.PesquisaBasicaMateria?.Materias?.Materia);
    if (arr.length === 0) return { importados: 0, autores: 0 };

    let importados = 0;
    let totalAutores = 0;
    const erros: string[] = [];

    for (const m of arr) {
      try {
        const idMat =
          Number(m.IdentificacaoMateria?.CodigoMateria ?? m.Codigo);
        if (!Number.isFinite(idMat) || idMat <= 0) continue;

        // Descartar itens vazios da API (sem número de matéria) — viravam "PL 0/ano".
        const numero = Number(m.IdentificacaoMateria?.NumeroMateria ?? 0);
        if (!Number.isFinite(numero) || numero <= 0) continue;

        const autorPrincipal =
          asArray(m.AutoresPrincipais?.AutorPrincipal)[0]?.NomeAutor ??
          asArray(m.Autoria?.Autor)[0]?.NomeAutor ??
          null;
        const sit = m.SituacaoAtual?.Autuacoes?.Autuacao?.Situacao;

        const row = {
          id: idMat,
          sigla_subtipo: String(m.IdentificacaoMateria?.SiglaSubtipoMateria ?? data.sigla),
          numero,
          ano: Number(m.IdentificacaoMateria?.AnoMateria ?? data.ano),
          ementa: (m.EmentaMateria ?? "").slice(0, 4000) || null,
          data_apresentacao:
            m.DataApresentacao && /^\d{4}-\d{2}-\d{2}/.test(m.DataApresentacao)
              ? m.DataApresentacao.slice(0, 10)
              : null,
          autor_principal: autorPrincipal,
          ultima_situacao: sit?.DescricaoSituacao ?? null,
          ultima_data:
            sit?.DataSituacao && /^\d{4}-\d{2}-\d{2}/.test(sit.DataSituacao)
              ? sit.DataSituacao.slice(0, 10)
              : null,
          url_texto: `https://www25.senado.leg.br/web/atividade/materias/-/materia/${idMat}`,
          updated_at: new Date().toISOString(),
        };
        const { error: e1 } = await supabaseAdmin.from("senado_materias_cache").upsert(row);
        if (e1) throw new Error(e1.message);
        importados++;

        // Autores (lista combinada de principais + demais)
        const autores = [
          ...asArray(m.AutoresPrincipais?.AutorPrincipal).map((a, i) => ({
            materia_id: idMat,
            senador_id: null as number | null,
            nome: (a.NomeAutor ?? "(sem nome)").slice(0, 240),
            tipo: "Principal",
            proponente: true,
            ordem: i + 1,
            updated_at: new Date().toISOString(),
          })),
          ...asArray(m.Autoria?.Autor).map((a, i) => ({
            materia_id: idMat,
            senador_id: null as number | null,
            nome: (a.NomeAutor ?? "(sem nome)").slice(0, 240),
            tipo: "Coautor",
            proponente: false,
            ordem: 100 + i,
            updated_at: new Date().toISOString(),
          })),
        ];
        if (autores.length > 0) {
          // Limpa autores antigos desta matéria para upsert idempotente
          await supabaseAdmin
            .from("senado_materias_autores_cache")
            .delete()
            .eq("materia_id", idMat);
          const { error: e2 } = await supabaseAdmin
            .from("senado_materias_autores_cache")
            .insert(autores);
          if (e2) throw new Error(`autores: ${e2.message}`);
          totalAutores += autores.length;
        }
      } catch (e) {
        erros.push(`mat: ${(e as Error).message}`);
      }
    }

    return { importados, autores: totalAutores, erros };
  });

export const listarMaterias = createServerFn({ method: "GET" })
  .inputValidator((input) =>
    z.object({
      ano: z.number().int().optional(),
      sigla: z.string().optional(),
      termo: z.string().max(120).optional(),
      limit: z.number().int().min(1).max(500).default(200),
    }).parse(input ?? {}),
  )
  .handler(async ({ data }) => {
    let q = supabaseAdmin
      .from("senado_materias_cache")
      .select("id,sigla_subtipo,numero,ano,ementa,data_apresentacao,autor_principal,ultima_situacao")
      .order("data_apresentacao", { ascending: false, nullsFirst: false })
      .limit(data.limit);
    if (data.ano) q = q.eq("ano", data.ano);
    if (data.sigla) q = q.eq("sigla_subtipo", data.sigla);
    if (data.termo) q = q.ilike("ementa", `%${data.termo}%`);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r) => ({
      id: r.id as number,
      siglaSubtipo: r.sigla_subtipo as string,
      numero: r.numero as number,
      ano: r.ano as number,
      ementa: r.ementa as string | null,
      dataApresentacao: r.data_apresentacao as string | null,
      autorPrincipal: r.autor_principal as string | null,
      ultimaSituacao: r.ultima_situacao as string | null,
    }));
  });

export const getMateriaDetalhe = createServerFn({ method: "GET" })
  .inputValidator((input) => z.object({ id: z.number().int().positive() }).parse(input))
  .handler(async ({ data }) => {
    const { data: m, error } = await supabaseAdmin
      .from("senado_materias_cache").select("*").eq("id", data.id).maybeSingle();
    if (error) throw new Error(error.message);
    if (!m) return null;
    const { data: aut } = await supabaseAdmin
      .from("senado_materias_autores_cache")
      .select("senador_id,nome,tipo,proponente,ordem")
      .eq("materia_id", data.id)
      .order("ordem", { ascending: true });
    return {
      materia: {
        id: m.id as number,
        siglaSubtipo: m.sigla_subtipo as string,
        numero: m.numero as number,
        ano: m.ano as number,
        ementa: m.ementa as string | null,
        dataApresentacao: m.data_apresentacao as string | null,
        autorPrincipal: m.autor_principal as string | null,
        ultimaSituacao: m.ultima_situacao as string | null,
        ultimaData: m.ultima_data as string | null,
        urlTexto: m.url_texto as string | null,
      },
      autores: (aut ?? []).map((a) => ({
        senadorId: a.senador_id as number | null,
        nome: a.nome as string,
        tipo: a.tipo as string | null,
        proponente: Boolean(a.proponente),
      })),
    };
  });

export const senadoMateriasOverview = createServerFn({ method: "GET" }).handler(async () => {
  const { count } = await supabaseAdmin
    .from("senado_materias_cache").select("id", { count: "exact", head: true });
  const { data: porTipo } = await supabaseAdmin
    .from("senado_materias_cache").select("sigla_subtipo").limit(10000);
  const tipos = new Map<string, number>();
  for (const r of porTipo ?? []) {
    const k = (r.sigla_subtipo as string) ?? "?";
    tipos.set(k, (tipos.get(k) ?? 0) + 1);
  }
  return {
    total: count ?? 0,
    porTipo: [...tipos.entries()].map(([tipo, n]) => ({ tipo, n })).sort((a, b) => b.n - a.n),
  };
});