import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { filtroDeDespesasDaUrl } from "@/lib/cota-parlamentar/logic";

// ---------------------------------------------------------------------------
// Projeções das despesas da cota parlamentar (CEAP e CEAPS). Sem banco nos
// testes: as regras são conferidas no SQL da migration.
// ---------------------------------------------------------------------------

const PASTA = join(__dirname, "../../../drizzle/migrations");
const sql = readFileSync(
  join(PASTA, readdirSync(PASTA).find((f) => f.endsWith("_busca_despesas_cota.sql"))!),
  "utf8",
);

function projecao(nome: string): string {
  const ini = sql.indexOf(`FUNCTION public.${nome}(`);
  return sql.slice(ini, sql.indexOf("$$;", ini));
}

describe.each([
  ["busca_projecao_despesas_camara", "camara_despesas_cache", "/camara/deputados/", "deputado_id"],
  ["busca_projecao_despesas_senado", "senado_despesas_cache", "/senado/senadores/", "senador_id"],
])("%s", (nome, tabela, rota, parlamentar) => {
  const corpo = projecao(nome);

  it("grava a coleção na categoria Despesas e está registrada", () => {
    expect(corpo).toContain(`SELECT '${tabela}', e.id, 'despesas'`);
    expect(sql).toMatch(new RegExp(`busca_registrar_colecao\\('${tabela}', 'id', '${nome}'\\)`));
  });

  it("CPF do fornecedor nunca é pesquisável: o documento só passa pelas funções que o filtram", () => {
    const usos = [...corpo.matchAll(/[\w.(]*e\.fornecedor_cnpj/g)].map((m) => m[0]);
    expect(usos.length).toBeGreaterThan(0);
    for (const u of usos) {
      expect(u).toMatch(/^public\.busca_(cnpj|documento_publico)\(e\.fornecedor_cnpj$/);
    }
  });

  it("leva à linha da despesa na ficha do parlamentar, no mês da despesa", () => {
    expect(corpo).toContain(
      `'${rota}' || e.${parlamentar} || '?ano=' || e.ano || '&mes=' || e.mes\n      || '#despesa-' || public.busca_url_segmento(e.id)`,
    );
    expect(corpo).toContain(`'pessoas', e.${parlamentar}::text,`);
  });

  it("valor em reais e data com natureza válida", () => {
    expect(corpo).toMatch(/'BRL',/);
    expect(corpo).toContain("THEN 'fato' ELSE 'exercicio' END");
  });
});

describe("destino da despesa", () => {
  it("a ficha aceita o ano e o mês que a projeção grava na URL", () => {
    const url = new URL("https://x/camara/deputados/204554?ano=2024&mes=3#despesa-204554-7654321");
    expect(filtroDeDespesasDaUrl(Object.fromEntries(url.searchParams))).toEqual({
      ano: 2024,
      mes: 3,
    });
  });
});
