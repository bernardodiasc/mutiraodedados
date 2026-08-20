import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { rodarComOrcamento } from "@/lib/data/runner";
import { checkpointImportacao } from "@/lib/data/checkpoint.server";
import { reacaoAoErroDeLista } from "@/lib/data/erro-origem";
import { registrarRodadaImportacao } from "@/lib/data/historico.server";
import { JANELA_ORCAMENTO_MS, JANELA_TETO_SUBREQUISICOES } from "@/lib/data/janela-varredura";

const BASE = "https://legis.senado.leg.br/dadosabertos";
const UA = "MutiraoDeDados/1.0 (+https://mutiraodedados.com.br)";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// GET com retry/backoff (500 → 1500 → 4500 ms) para 429/5xx e erros de rede
// transitórios; 4xx é erro definitivo.
async function senadoGet<T = unknown>(path: string, tentativas = 4): Promise<T> {
  let ultimoErro = "sem resposta";
  for (let tent = 0; tent < tentativas; tent++) {
    if (tent > 0) await sleep(500 * 3 ** (tent - 1));
    let res: Response;
    try {
      res = await fetch(`${BASE}${path}`, {
        headers: { accept: "application/json", "user-agent": UA },
      });
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
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw new Error("Falha ao verificar permissão.");
  if (data?.role !== "admin") throw new Error("Acesso restrito: somente administradores.");
}

/**
 * Item da lista de matérias em DUAS formas.
 *
 * A API mudou o formato sem trocar de URL: hoje ela devolve campos planos
 * (`Numero`, `Sigla`, `Ano`, `Ementa`, `Autor`, `Data`), e não mais o bloco
 * `IdentificacaoMateria`. Como o código só lia a forma antiga, `numero` saía
 * 0 e TODA matéria era descartada em silêncio — 902 itens percorridos, zero
 * importados, e o Histórico dizendo "consultado, sem dados".
 *
 * Os dois formatos ficam aceitos: o serviço está em descontinuação e não
 * queremos que uma reversão do lado deles nos quebre de novo.
 */
type MateriaListItem = {
  Codigo?: string | number;
  // Forma nova (plana).
  Sigla?: string;
  Numero?: string | number;
  Ano?: string | number;
  Ementa?: string;
  Autor?: string;
  Data?: string;
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
  SituacaoAtual?: {
    Autuacoes?: { Autuacao?: { Situacao?: { DescricaoSituacao?: string; DataSituacao?: string } } };
  };
};

/**
 * Aviso quando a rodada descarta itens. Silêncio aqui foi o que escondeu a
 * mudança de formato da API: 902 matérias percorridas, todas descartadas por
 * falta de número, e o Histórico registrando "consultado, sem dados".
 *
 * Descarte com importação também é sinalizado, em tom mais brando — pode ser
 * o item vazio que a API às vezes devolve, mas se virar rotina merece olhar.
 */
export function alertaDeDescarte(
  processados: number,
  descartados: { semCodigo: number; semNumero: number },
): string | null {
  const total = descartados.semCodigo + descartados.semNumero;
  if (total === 0) return null;
  const detalhe = [
    descartados.semCodigo > 0 ? `${descartados.semCodigo} sem código` : null,
    descartados.semNumero > 0 ? `${descartados.semNumero} sem número` : null,
  ]
    .filter(Boolean)
    .join(", ");
  if (processados === 0) {
    return `A origem devolveu ${total} matérias e nenhuma pôde ser lida (${detalhe}). Isso costuma indicar mudança no formato da resposta — não que o período esteja vazio.`;
  }
  return `info: ${total} matérias descartadas (${detalhe}).`;
}

/** ISO curto (YYYY-MM-DD) ou null — a API mistura formatos entre os campos. */
function apenasData(v: string | null | undefined): string | null {
  return v && /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : null;
}

/** Importa matérias do Senado por ano + sigla (PL, PEC, MPV, PLP...). */
export const importarMaterias = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        ano: z.number().int().min(1990).max(2100),
        sigla: z.string().min(2).max(10).default("PL"),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.userId);

    let totalAutores = 0;
    const erros: string[] = [];
    const inicioRodada = Date.now();

    // A lista do ano+sigla vem numa chamada só (a API não pagina), mas cada
    // matéria custa ~3 operações de banco — centenas delas estouram o limite
    // de subrequisições do Worker numa chamada única. O cursor é a matéria; a
    // lista é buscada uma vez por rodada e ordenada por código para a
    // retomada não pular nem repetir.
    let listaRodada: MateriaListItem[] | null = null;
    const carregarLista = async (): Promise<MateriaListItem[]> => {
      if (listaRodada) return listaRodada;
      const json = await senadoGet<{
        PesquisaBasicaMateria?: {
          Materias?: { Materia?: MateriaListItem | MateriaListItem[] };
        };
      }>(`/materia/pesquisa/lista?ano=${data.ano}&sigla=${encodeURIComponent(data.sigla)}`);
      listaRodada = asArray(json.PesquisaBasicaMateria?.Materias?.Materia).sort(
        (a, b) =>
          Number(a.IdentificacaoMateria?.CodigoMateria ?? a.Codigo ?? 0) -
          Number(b.IdentificacaoMateria?.CodigoMateria ?? b.Codigo ?? 0),
      );
      return listaRodada;
    };

    // Item que a API devolve mas não conseguimos ler. Contá-los é o que
    // separa "o ano não teve matérias" de "não entendemos a resposta" — a
    // segunda hipótese passou despercebida por não ter contador nenhum.
    const descartados = { semCodigo: 0, semNumero: 0 };

    const rodada = await rodarComOrcamento({
      chave: `senado_mat#${data.ano}#${data.sigla}`,
      checkpoint: checkpointImportacao,
      orcamentoMs: JANELA_ORCAMENTO_MS,
      orcamentoCusto: JANELA_TETO_SUBREQUISICOES,
      maxPassos: 5000,
      passo: async (cursor) => {
        let custo = 0;
        let arr: MateriaListItem[];
        try {
          const antes = listaRodada;
          arr = await carregarLista();
          if (!antes) custo++;
        } catch (e) {
          // Sem a lista não há item a processar: passageiro refaz, definitivo
          // encerra a rodada em vez de gastar centenas de tentativas inúteis.
          const r = reacaoAoErroDeLista(e);
          return {
            processados: 0,
            fim: r.fim,
            custo: 1,
            interromper: r.interromper,
            erros: [`lista: ${(e as Error).message}`],
          };
        }
        if (cursor > arr.length) return { processados: 0, fim: true, custo };
        const m = arr[cursor - 1];

        try {
          const idMat = Number(m.IdentificacaoMateria?.CodigoMateria ?? m.Codigo);
          if (!Number.isFinite(idMat) || idMat <= 0) {
            descartados.semCodigo++;
            return { processados: 0, fim: false, custo };
          }

          // Descartar itens vazios da API (sem número de matéria) — viravam "PL 0/ano".
          const numero = Number(m.IdentificacaoMateria?.NumeroMateria ?? m.Numero ?? 0);
          if (!Number.isFinite(numero) || numero <= 0) {
            descartados.semNumero++;
            return { processados: 0, fim: false, custo };
          }

          const autorPrincipal =
            asArray(m.AutoresPrincipais?.AutorPrincipal)[0]?.NomeAutor ??
            asArray(m.Autoria?.Autor)[0]?.NomeAutor ??
            m.Autor ??
            null;
          const sit = m.SituacaoAtual?.Autuacoes?.Autuacao?.Situacao;

          const row = {
            id: idMat,
            sigla_subtipo: String(
              m.IdentificacaoMateria?.SiglaSubtipoMateria ?? m.Sigla ?? data.sigla,
            ),
            numero,
            ano: Number(m.IdentificacaoMateria?.AnoMateria ?? m.Ano ?? data.ano),
            ementa: (m.EmentaMateria ?? m.Ementa ?? "").slice(0, 4000) || null,
            data_apresentacao: apenasData(m.DataApresentacao ?? m.Data),
            autor_principal: autorPrincipal,
            ultima_situacao: sit?.DescricaoSituacao ?? null,
            ultima_data: apenasData(sit?.DataSituacao),
            url_texto: `https://www25.senado.leg.br/web/atividade/materias/-/materia/${idMat}`,
            updated_at: new Date().toISOString(),
          };
          const { error: e1 } = await supabaseAdmin.from("senado_materias_cache").upsert(row);
          custo++;
          if (e1) throw new Error(e1.message);

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
            custo++;
            const { error: e2 } = await supabaseAdmin
              .from("senado_materias_autores_cache")
              .insert(autores);
            custo++;
            if (e2) throw new Error(`autores: ${e2.message}`);
            totalAutores += autores.length;
          }
          return { processados: 1, fim: false, custo };
        } catch (e) {
          // Uma matéria com problema não interrompe a varredura — segue para a
          // seguinte, com o erro registrado.
          return { processados: 0, fim: false, custo, erros: [`mat: ${(e as Error).message}`] };
        }
      },
    });

    erros.push(...rodada.erros);

    // Zero importados COM itens descartados não é ausência de dado: é resposta
    // que não soubemos ler. Vira erro (não "info:") de propósito, para o
    // Histórico classificar como falha nossa em vez de "consultado, vazio".
    const alerta = alertaDeDescarte(rodada.processados, descartados);
    if (alerta) erros.push(alerta);

    // Linha de rodada no Histórico — inclui consulta vazia e motivo de parada.
    const avisoHistorico = await registrarRodadaImportacao(
      {
        fonte: "senado_mat",
        ano: data.ano,
        mes: 1, // fonte anual — âncora da matriz de cobertura
        endpoint: `GET ${BASE}/materia/pesquisa/lista?ano=${data.ano}&sigla=${data.sigla} (+ autores por matéria)`,
        unidade: "matérias",
        userId: context.userId,
        duracaoMs: Date.now() - inicioRodada,
      },
      rodada,
    );
    if (avisoHistorico) erros.push(avisoHistorico);

    return {
      importados: rodada.processados,
      autores: totalAutores,
      erros,
      varredura: {
        haMais: !rodada.concluido,
        cursor: rodada.cursorFinal,
        totalAcumulado: rodada.totalAcumulado,
        orcamentoEsgotado: rodada.orcamentoEsgotado,
        custoEsgotado: rodada.custoEsgotado,
      },
    };
  });

export const listarMaterias = createServerFn({ method: "GET" })
  .inputValidator((input) =>
    z
      .object({
        ano: z.number().int().optional(),
        sigla: z.string().optional(),
        termo: z.string().max(120).optional(),
        limit: z.number().int().min(1).max(500).default(200),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data }) => {
    let q = supabaseAdmin
      .from("senado_materias_cache")
      .select(
        "id,sigla_subtipo,numero,ano,ementa,data_apresentacao,autor_principal,ultima_situacao",
      )
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
      .from("senado_materias_cache")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
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
    .from("senado_materias_cache")
    .select("id", { count: "exact", head: true });
  const { data: porTipo } = await supabaseAdmin
    .from("senado_materias_cache")
    .select("sigla_subtipo")
    .limit(10000);
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
