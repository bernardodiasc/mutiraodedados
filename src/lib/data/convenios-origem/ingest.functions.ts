import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { rodarComOrcamento } from "@/lib/data/runner";
import { checkpointImportacao } from "@/lib/data/checkpoint.server";
import { reacaoAoErroDeLista } from "@/lib/data/erro-origem";
import { registrarRodadaImportacao } from "@/lib/data/historico.server";
import { JANELA_ORCAMENTO_MS, JANELA_TETO_SUBREQUISICOES } from "@/lib/data/janela-varredura";
import { fetchComRetry } from "@/lib/data/http-retry";
import {
  mapearLinhaOrigem,
  resolverColunas,
  type ColunasOrigem,
  type RegistroOrigem,
} from "@/lib/data/convenios-origem/csv";

/**
 * Enriquecimento dos convênios pela ORIGEM — o CSV `siconv_convenio.zip` do
 * módulo Discricionárias e Legais do Transferegov (v0.10.0).
 *
 * O módulo não tem API (só download); o arquivo tem ~18 MB comprimidos,
 * ~287 mil convênios. A varredura é retomável POR LOTE de linhas: cada rodada
 * baixa o zip de novo (Range no payload deflate, inflar é rápido), pula até o
 * cursor e envia lotes ao banco via RPC — um lote = uma subrequisição, então
 * o teto de subrequisições limita a rodada como nas outras fontes.
 *
 * Regra: **a origem enriquece, não corrige.** Ela escreve apenas as colunas
 * que são dela (situacao_origem, valor_empenhado, valor_desembolsado) e
 * preenche data_assinatura só quando o espelho veio sem ela.
 */

const URL_ZIP =
  "https://api-publica.transferegov.gestao.gov.br/downloads/dadosgov/siconv_convenio.zip";
const UA = "MutiraoDeDados/1.0 (+https://mutiraodedados.com.br)";
const TAM_LOTE = 500;

/**
 * Abre o zip (um arquivo só, deflate, tamanhos no cabeçalho local — conferido
 * contra o arquivo real em 2026-08-20) e devolve as linhas do CSV.
 */
async function* linhasDoCsvZip(): AsyncGenerator<string> {
  // Cabeçalho local: 30 bytes fixos + nome + extra; tamanho comprimido no
  // offset 18. Dois GETs pequenos + um do payload exato mantêm o
  // DecompressionStream livre de lixo posterior (diretório central).
  const head = await fetchComRetry(URL_ZIP, {
    headers: { Range: "bytes=0-63", "User-Agent": UA },
  });
  if (!head.ok) throw new Error(`TRANSIENT: origem ${head.status} no cabeçalho do zip`);
  const hb = new DataView(await head.arrayBuffer());
  if (hb.getUint32(0, true) !== 0x04034b50) throw new Error("zip: assinatura inesperada");
  if (hb.getUint16(8, true) !== 8) throw new Error("zip: método não é deflate");
  const csize = hb.getUint32(18, true);
  const nlen = hb.getUint16(26, true);
  const elen = hb.getUint16(28, true);
  if (csize === 0) throw new Error("zip: tamanho ausente do cabeçalho (data descriptor)");
  const ini = 30 + nlen + elen;

  const res = await fetchComRetry(URL_ZIP, {
    headers: { Range: `bytes=${ini}-${ini + csize - 1}`, "User-Agent": UA },
  });
  if (!res.ok || !res.body) throw new Error(`TRANSIENT: origem ${res.status} no payload do zip`);

  const stream = res.body
    .pipeThrough(new DecompressionStream("deflate-raw"))
    .pipeThrough(new TextDecoderStream("utf-8"));
  const reader = stream.getReader();
  let resto = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    const partes = (resto + value).split("\n");
    resto = partes.pop() ?? "";
    for (const l of partes) yield l.replace(/\r$/, "");
  }
  if (resto.trim()) yield resto;
}

export const importarConveniosOrigem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({}).parse(input ?? {}))
  .handler(async ({ context }) => {
    const { data: role } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();
    if (role?.role !== "admin") throw new Error("Acesso restrito.");

    const erros: string[] = [];
    const inicioRodada = Date.now();
    let atualizados = 0;
    let semEspelho = 0;

    // O gerador é aberto UMA vez por rodada e avança em ordem; o runner pede
    // lotes sequenciais, então pular até o cursor acontece naturalmente.
    let gerador: AsyncGenerator<string> | null = null;
    let cols: ColunasOrigem | null = null;
    let linhasLidas = 0; // linhas de DADOS já entregues pelo gerador nesta rodada
    let custoDownload = 0;

    const proximoLote = async (aPartirDe: number): Promise<RegistroOrigem[] | null> => {
      if (!gerador) {
        gerador = linhasDoCsvZip();
        custoDownload = 2; // cabeçalho + payload
        const cab = await gerador.next();
        if (cab.done) return null;
        cols = resolverColunas(cab.value);
        if (!cols) throw new Error("origem: cabeçalho do CSV não tem NR_CONVENIO — formato mudou");
      }
      // Pula linhas anteriores ao cursor (rodada retomada).
      while (linhasLidas < aPartirDe) {
        const r = await gerador.next();
        if (r.done) return null;
        linhasLidas++;
      }
      const lote: RegistroOrigem[] = [];
      while (lote.length < TAM_LOTE) {
        const r = await gerador.next();
        if (r.done) break;
        linhasLidas++;
        const reg = mapearLinhaOrigem(r.value, cols!);
        if (reg) lote.push(reg);
      }
      return lote.length > 0 ? lote : null;
    };

    const rodada = await rodarComOrcamento({
      chave: "convenios_origem#csv",
      checkpoint: checkpointImportacao,
      orcamentoMs: JANELA_ORCAMENTO_MS,
      orcamentoCusto: JANELA_TETO_SUBREQUISICOES,
      maxPassos: 5000,
      passo: async (cursor) => {
        let custo = 0;
        let lote: RegistroOrigem[] | null;
        try {
          lote = await proximoLote((cursor - 1) * TAM_LOTE);
          if (custoDownload > 0) {
            custo += custoDownload;
            custoDownload = 0;
          }
        } catch (e) {
          const r = reacaoAoErroDeLista(e);
          return {
            processados: 0,
            fim: r.fim,
            custo: custo + 1,
            interromper: r.interromper,
            erros: [`csv: ${(e as Error).message}`],
          };
        }
        if (!lote) return { processados: 0, fim: true, custo };

        const { data: res, error } = await supabaseAdmin.rpc("enriquecer_convenios_origem", {
          _itens: lote as unknown as never,
        });
        custo++;
        if (error) {
          const r = reacaoAoErroDeLista(new Error(error.message));
          return {
            processados: 0,
            fim: r.fim,
            custo,
            interromper: r.interromper,
            erros: [`db lote ${cursor}: ${error.message}`],
          };
        }
        const linha = Array.isArray(res) ? res[0] : res;
        atualizados += linha?.atualizados ?? 0;
        semEspelho += linha?.sem_espelho ?? 0;
        return { processados: linha?.atualizados ?? 0, fim: false, custo };
      },
    });

    erros.push(...rodada.erros);
    if (semEspelho > 0) {
      erros.push(
        `info: ${semEspelho.toLocaleString("pt-BR")} convênios da origem ainda sem espelho no site nesta rodada — o acervo completo da origem depende do join com as propostas (horizonte).`,
      );
    }

    const avisoHistorico = await registrarRodadaImportacao(
      {
        fonte: "convenios_origem",
        escopo: "enriquecimento",
        endpoint: `GET ${URL_ZIP}`,
        unidade: "lotes",
        userId: context.userId,
        duracaoMs: Date.now() - inicioRodada,
      },
      rodada,
    );
    if (avisoHistorico) erros.push(avisoHistorico);

    return {
      importados: rodada.processados,
      atualizados,
      semEspelho,
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
