import { sanitizarTextoPublico } from "@/lib/sanitize";
import { parseValorPortal } from "@/lib/data/real/portal-client";
import { parseDatePortal } from "@/lib/data/real/sweep";
import { linkConsultaConvenioPortal } from "@/lib/links-oficiais";

/**
 * Mapeador ÚNICO do payload de /convenios (Portal CGU) para a linha de
 * `convenios_cache` (v0.9.0).
 *
 * Antes eram dois mapeadores — um por "eixo" — lendo o MESMO payload e cada
 * um escolhendo um subconjunto de campos com nomes próprios. Foi assim que os
 * dois lados divergiram sem ninguém notar. Este módulo mapeia o superconjunto
 * uma vez; os dois ingests (janela geral e janela por ente) o compartilham.
 */

export type PortalConvenioRaw = {
  id?: number | string;
  dataReferencia?: string;
  dimConvenio?: { numero?: string; objeto?: string; codigo?: string };
  situacao?: string;
  modalidade?: string;
  objeto?: string;
  convenente?: {
    nome?: string;
    cnpjFormatado?: string;
    cnpj?: string;
    codigoIBGE?: string | number;
    municipio?: { codigoIBGE?: string; nomeIBGE?: string; uf?: { sigla?: string; nome?: string } };
  };
  municipioConvenente?: {
    codigoIBGE?: string;
    nomeIBGE?: string;
    uf?: { sigla?: string; nome?: string };
  };
  orgao?: { nome?: string; codigoSIAFI?: string; cnpj?: string };
  unidadeGestora?: { nome?: string; orgaoVinculado?: { nome?: string; cnpj?: string } };
  tipoInstrumento?: { descricao?: string };
  valor?: unknown;
  valorLiberado?: unknown;
  valorContrapartida?: unknown;
  dataAssinatura?: string;
  dataInicioVigencia?: string;
  dataFinalVigencia?: string;
  dataFimVigencia?: string;
  dataPublicacao?: string;
  numero?: string;
  numeroOriginal?: string;
};

export type ConvenioCacheRow = {
  id: string;
  fonte: string;
  numero: string | null;
  codigo_siconv: string | null;
  objeto: string | null;
  situacao: string | null;
  tipo_instrumento: string | null;
  orgao_cod: string | null;
  orgao_nome: string | null;
  orgao_cnpj: string | null;
  convenente_nome: string | null;
  convenente_cnpj: string | null;
  esfera_convenente: string | null;
  uf: string | null;
  municipio_ibge: string | null;
  municipio_nome: string | null;
  valor: number;
  valor_liberado: number;
  valor_contrapartida: number;
  data_assinatura: string | null;
  data_inicio_vigencia: string | null;
  data_fim_vigencia: string | null;
  data_publicacao: string | null;
  ano: number;
  mes_referencia: number | null;
  url_oficial: string | null;
  updated_at: string;
};

/** Sigla da UF de 2 letras (a API troca sigla/nome — pega o que tem 2 letras). */
function ufDe(uf: { sigla?: string; nome?: string } | undefined): string | null {
  for (const cand of [uf?.nome, uf?.sigla]) {
    const s = (cand ?? "").trim();
    if (/^[A-Za-z]{2}$/.test(s)) return s.toUpperCase();
  }
  return null;
}

/** Esfera do convenente a partir do código IBGE: 2 dígitos UF, 7 município. */
function esferaDoIbge(ibge: string | null): string | null {
  if (!ibge) return null;
  if (/^\d{2}$/.test(ibge)) return "estadual";
  if (/^\d{7}$/.test(ibge)) return "municipal";
  return null;
}

/** `null` quando o item não tem nem id nem número — nada para ancorar. */
export function mapearConvenioCache(raw: PortalConvenioRaw): ConvenioCacheRow | null {
  const numero = raw.dimConvenio?.numero ?? raw.numero ?? raw.numeroOriginal ?? null;
  const id = raw.id != null ? String(raw.id) : numero ? `num-${numero}` : null;
  if (!id) return null;

  const ref = parseDatePortal(raw.dataReferencia) || parseDatePortal(raw.dataInicioVigencia);
  const muni = raw.municipioConvenente ?? raw.convenente?.municipio;
  const ibge = muni?.codigoIBGE
    ? String(muni.codigoIBGE)
    : raw.convenente?.codigoIBGE
      ? String(raw.convenente.codigoIBGE)
      : null;
  // CNPJ formatado ("00.378.257/0001-81") vira dígitos crus.
  const cnpj = (raw.convenente?.cnpj ?? raw.convenente?.cnpjFormatado ?? "").replace(/\D/g, "");
  return {
    id,
    fonte: "cgu",
    numero,
    codigo_siconv: raw.dimConvenio?.codigo || null,
    objeto:
      sanitizarTextoPublico((raw.objeto ?? raw.dimConvenio?.objeto ?? "").slice(0, 1000)) || null,
    situacao: raw.situacao || null,
    tipo_instrumento: raw.tipoInstrumento?.descricao ?? raw.modalidade ?? null,
    orgao_cod: raw.orgao?.codigoSIAFI || null,
    orgao_nome: raw.orgao?.nome ?? raw.unidadeGestora?.orgaoVinculado?.nome ?? null,
    orgao_cnpj: raw.orgao?.cnpj ?? raw.unidadeGestora?.orgaoVinculado?.cnpj ?? null,
    convenente_nome: sanitizarTextoPublico((raw.convenente?.nome ?? "").slice(0, 240)) || null,
    convenente_cnpj: cnpj || null,
    esfera_convenente: esferaDoIbge(ibge),
    uf: ufDe(muni?.uf),
    municipio_ibge: ibge,
    municipio_nome: muni?.nomeIBGE ?? null,
    valor: parseValorPortal(raw.valor),
    valor_liberado: parseValorPortal(raw.valorLiberado),
    valor_contrapartida: parseValorPortal(raw.valorContrapartida),
    data_assinatura: parseDatePortal(raw.dataAssinatura) || null,
    data_inicio_vigencia: parseDatePortal(raw.dataInicioVigencia) || null,
    data_fim_vigencia: parseDatePortal(raw.dataFinalVigencia ?? raw.dataFimVigencia) || null,
    data_publicacao: parseDatePortal(raw.dataPublicacao) || null,
    ano: ref ? Number(ref.slice(0, 4)) : new Date().getFullYear(),
    mes_referencia: ref ? Number(ref.slice(5, 7)) : null,
    url_oficial: linkConsultaConvenioPortal(numero),
    updated_at: new Date().toISOString(),
  };
}
