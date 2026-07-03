import type { listarQualidadeAdmin } from "@/lib/data/qa.functions";

export const FONTES_QA = [
  "cgu",
  "pncp",
  "camara_ceap",
  "senado_ceaps",
  "transferegov",
  "siconfi",
] as const;

export type FonteQA = (typeof FONTES_QA)[number];

/**
 * Lista canônica de regras de QA (todas as fontes). Usada para pré-popular o
 * filtro "Todas as regras" com a lista completa — como os filtros de fonte e
 * status. As regras `valor_precisao_suspeita` e `valor_final_truncado_suspeito`
 * (CGU) foram removidas: a varredura passou a conferir o detalhe de cada
 * contrato e gravar o valor correto, então a divergência vira o alerta
 * `valor_corrigido_listagem` em vez de heurísticas sobre a listagem.
 */
export const REGRAS_QA = [
  "valor_corrigido_listagem",
  "fornecedor_ausente",
  "discrepancia_extrema_inicial_final",
  "valor_truncado_suspeito",
  "valor_muito_baixo",
  "valor_negativo",
  "valor_negativo_em_conta_positiva",
  "valor_global_zerado",
  "valor_global_menor_inicial",
  "repasse_maior_global",
  "pago_maior_empenhado",
  "liquido_maior_documento",
] as const;

export type FindingAdmin = Awaited<ReturnType<typeof listarQualidadeAdmin>>[number];

export type CurlEntry = { label: string; url: string; nota?: string };

const SWAGGER = "https://api.portaldatransparencia.gov.br/swagger-ui/index.html";

export function isoToBR(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export function buildCurlsQualidade(f: FindingAdmin): CurlEntry[] | undefined {
  if (f.fonte === "cgu" && f.entidade.tipo === "contrato") {
    const out: CurlEntry[] = [];
    const ctx = f.contexto_origem;
    const pagina = ctx?.pagina_varredura;
    if (ctx?.orgao_cod) {
      out.push({
        label: "Endpoint /contratos (origem do valor armazenado)",
        url: `${SWAGGER}#/Contratos%20do%20Poder%20Executivo%20Federal/contratos`,
        // A CGU filtra por vigência, não por assinatura — não dá pra localizar
        // por data. A ingestão grava a página onde o contrato apareceu na
        // varredura; use-a para encontrar o item.
        nota:
          pagina != null
            ? `No Swagger oficial, abra "Contratos > /contratos", preencha codigoOrgao=${ctx.orgao_cod} e pagina=${pagina} (sem dataInicial/dataFinal). Procure o item id=${f.entidade.id} e confira valorFinalCompra/valorInicialCompra.`
            : `No Swagger oficial, abra "Contratos > /contratos", preencha codigoOrgao=${ctx.orgao_cod} (sem dataInicial/dataFinal) e pagine até encontrar id=${f.entidade.id}.`,
      });
    }
    out.push({
      label: "Endpoint /contratos/id (re-checagem)",
      url: `${SWAGGER}#/Contratos%20do%20Poder%20Executivo%20Federal/contrato`,
      nota: `No Swagger oficial, abra "Contratos > /contratos/id" e informe id=${f.entidade.id}. Compare valorInicialCompra/valorFinalCompra com o card.`,
    });
    return out;
  }
  if (f.fonte === "transferegov" && f.entidade.tipo === "instrumento") {
    const out: CurlEntry[] = [];
    const ctx = f.contexto_instrumento;
    if (ctx?.data_assinatura) {
      const dia = isoToBR(ctx.data_assinatura);
      const extras: string[] = [];
      if (ctx.municipio_ibge) extras.push(`codigoIBGE=${ctx.municipio_ibge}`);
      else if (ctx.uf_beneficiario) extras.push(`codigoUFConvenente=${ctx.uf_beneficiario}`);
      out.push({
        label: "Endpoint /convenios (origem do valor armazenado)",
        url: `${SWAGGER}#/Convenios/convenioUsingGET`,
        nota: `No Swagger oficial, abra "Convenios > /convenios", preencha dataInicial=${dia}, dataFinal=${dia}, pagina=1${extras.length ? `, ${extras.join(", ")}` : ""}. Procure id=${f.entidade.id}.`,
      });
    }
    out.push({
      label: "Endpoint /convenios/id (re-checagem)",
      url: `${SWAGGER}#/Convenios/convenioUsingGET_1`,
      nota: `No Swagger oficial, abra "Convenios > /convenios/id" e informe id=${f.entidade.id}. Compare valor, valorLiberado e valorContrapartida.`,
    });
    return out;
  }
  return undefined;
}