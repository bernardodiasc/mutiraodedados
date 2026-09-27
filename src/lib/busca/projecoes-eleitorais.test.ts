import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { ANCORA_VOTACAO, ancoraBem, validarSearchCandidato } from "@/lib/candidato-ficha/logic";
import { ancoraLancamento } from "@/lib/contas-campanha/logic";

// ---------------------------------------------------------------------------
// Projeções de bens, receitas, despesas e resultados eleitorais no índice de
// busca: política de dados pessoais e destino na linha da ficha.
// ---------------------------------------------------------------------------

const PASTA = fileURLToPath(new URL("../../../drizzle/migrations/", import.meta.url));
const sql = readFileSync(
  PASTA + readdirSync(PASTA).find((f) => f.endsWith("_busca_eleitoral.sql"))!,
  "utf8",
);

/** Corpo SQL (entre `AS $$` e `$$;`) de cada função de projeção. */
function corpos(): Map<string, string> {
  const r = new Map<string, string>();
  for (const m of sql.matchAll(
    /FUNCTION public\.(busca_projecao_\w+)\(p_ids text\[\]\)[^]*?AS \$\$([^]*?)\$\$;/g,
  )) {
    r.set(m[1], m[2]);
  }
  return r;
}

const PROJECOES = corpos();
const corpo = (nome: string) => PROJECOES.get(nome)!;

/** O corpo sem as chamadas que já tratam documento (só CNPJ, ou CPF mascarado). */
function semDocumentoTratado(s: string): string {
  return s.replace(/public\.busca_(cnpj|documento_publico)\([^)]*\)/g, "");
}

describe("projeções eleitorais", () => {
  it("são as quatro, todas na categoria eleicoes com a candidatura como pai", () => {
    expect([...PROJECOES.keys()].sort()).toEqual([
      "busca_projecao_bens_candidato",
      "busca_projecao_despesas_campanha",
      "busca_projecao_receitas_campanha",
      "busca_projecao_resultados",
    ]);
    for (const [nome, s] of PROJECOES) {
      expect(s, nome).toMatch(/SELECT '[a-z_]+', [^\n]*, 'eleicoes', /);
      expect(s, nome).toContain("'pessoas', ");
      expect(s, nome).toMatch(/\.sq_candidato \|\| '-' \|\| \w\.ano_eleicao,\n/);
    }
  });

  it("nenhum CPF, título de eleitor ou dado sensível do candidato", () => {
    for (const [nome, s] of PROJECOES) {
      const livre = semDocumentoTratado(s);
      for (const proibido of [
        "cpf",
        "titulo_eleitoral",
        "cor_raca",
        "genero",
        "grau_instrucao",
        "ocupacao",
      ]) {
        expect(livre, `${nome}: ${proibido}`).not.toContain(proibido);
      }
    }
  });

  it("documento do doador e do fornecedor só mascarado ou como CNPJ", () => {
    const receitas = corpo("busca_projecao_receitas_campanha");
    expect(receitas).toContain("public.busca_documento_publico(r.cpf_cnpj_doador)");
    expect(receitas).toContain("public.busca_cnpj(r.cpf_cnpj_doador)");
    const despesas = corpo("busca_projecao_despesas_campanha");
    expect(despesas).toContain("public.busca_documento_publico(d.cnpj_fornecedor)");
    expect(despesas).toContain("public.busca_cnpj(d.cnpj_fornecedor)");
  });

  it("descrição do bem fica fora do índice", () => {
    expect(corpo("busca_projecao_bens_candidato")).not.toContain("descricao");
  });

  it("o destino chega à linha da ficha: parâmetros e âncoras que a ficha entende", () => {
    // Âncoras geradas pela ficha para a linha 3 e o lançamento 2022-9.
    expect(ancoraBem(3)).toBe("bem-3");
    expect(ancoraLancamento("receitas", "2022-9")).toBe("receita-2022-9");
    expect(ancoraLancamento("despesas", "2022-9")).toBe("despesa-2022-9");
    expect(corpo("busca_projecao_bens_candidato")).toContain(
      "'&bem=' || b.ordem_bem || '#bem-' || b.ordem_bem",
    );
    expect(corpo("busca_projecao_receitas_campanha")).toContain(
      "'&receita=' || public.busca_url_segmento(r.id) || '#receita-' || public.busca_url_segmento(r.id)",
    );
    expect(corpo("busca_projecao_despesas_campanha")).toContain(
      "'&despesa=' || public.busca_url_segmento(d.id) || '#despesa-' || public.busca_url_segmento(d.id)",
    );
    expect(corpo("busca_projecao_resultados")).toContain(`'#${ANCORA_VOTACAO}'`);
    // A ficha aceita os parâmetros no formato em que a busca os gera.
    expect(
      validarSearchCandidato({ ano: 2022, bem: 3, receita: "2022-123", despesa: "2014-0a1b" }),
    ).toEqual({ ano: 2022, bem: 3, receita: "2022-123", despesa: "2014-0a1b" });
  });

  it("chave registrada e id da projeção têm o mesmo formato", () => {
    expect(sql).toContain(
      "busca_registrar_colecao('tse_bens_candidato_cache',\n  $k$sq_candidato || '-' || ano_eleicao || '-' || ordem_bem$k$",
    );
    expect(corpo("busca_projecao_bens_candidato")).toContain(
      "b.sq_candidato || '-' || b.ano_eleicao || '-' || b.ordem_bem, 'eleicoes'",
    );
    expect(sql).toContain(
      "busca_registrar_colecao('tse_resultados_cache',\n  $k$sq_candidato || '-' || ano_eleicao || '-' || nr_turno$k$",
    );
    expect(corpo("busca_projecao_resultados")).toContain(
      "s.sq_candidato || '-' || s.ano_eleicao || '-' || s.nr_turno, 'eleicoes'",
    );
  });
});
