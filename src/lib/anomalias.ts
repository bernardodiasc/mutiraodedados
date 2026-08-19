import type { Anomalia, Contrato } from "./data/types";
import type { Dataset } from "./data/source";
import { calcularNotaTransparencia } from "./transparencia";

const fmtBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

const TERMOS_GENERICOS = [
  "serviços diversos",
  "servicos diversos",
  "aquisição de bens",
  "aquisicao de bens",
  "apoio operacional",
  "apoio administrativo",
  "prestação de serviços",
  "prestacao de servicos",
  "fornecimento de materiais",
  "serviços gerais",
  "servicos gerais",
  "outros serviços",
  "outros servicos",
];

function median(nums: number[]): number {
  if (nums.length === 0) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/**
 * Teto de dispensa de licitação para bens e serviços comuns, VIGENTE NA DATA do
 * contrato — um registro histórico deve ser avaliado pelo limite da sua época.
 * Valores da Lei 14.133 são atualizados por decreto anual: ao sair um novo
 * decreto, adicione uma entrada (não altere as anteriores). Enquanto a tabela
 * não é atualizada, vale o último teto conhecido — o efeito é conservador
 * (dispensas entre o teto antigo e o novo deixam de ser sinalizadas; nunca
 * geramos sinal com limite errado para a época).
 */
export type TetoDispensa = { vigenteDesde: string; teto: number; baseLegal: string };

export const TETOS_DISPENSA: TetoDispensa[] = [
  { vigenteDesde: "1900-01-01", teto: 8_000, baseLegal: "Lei 8.666/1993, art. 24, II" },
  { vigenteDesde: "2018-06-19", teto: 17_600, baseLegal: "Decreto 9.412/2018 (Lei 8.666)" },
  { vigenteDesde: "2021-04-01", teto: 50_000, baseLegal: "Lei 14.133/2021, art. 75, II" },
  { vigenteDesde: "2022-01-01", teto: 54_020.41, baseLegal: "Decreto 10.922/2021 (Lei 14.133)" },
];

export function tetoDispensaNaData(dataIso: string): TetoDispensa {
  let vigente = TETOS_DISPENSA[0];
  for (const t of TETOS_DISPENSA) {
    if (dataIso >= t.vigenteDesde) vigente = t;
  }
  return vigente;
}

export function detectarAnomalias(ds: Dataset): Anomalia[] {
  const out: Anomalia[] = [];

  // 1. Crescimento abrupto YoY por fornecedor (>3x e base >= R$ 500k).
  const porFornAno = new Map<string, Map<number, number>>();
  for (const c of ds.contratos) {
    if (!porFornAno.has(c.fornecedorCnpj)) porFornAno.set(c.fornecedorCnpj, new Map());
    const m = porFornAno.get(c.fornecedorCnpj)!;
    m.set(c.ano, (m.get(c.ano) ?? 0) + c.valor);
  }
  for (const [cnpj, m] of porFornAno) {
    const anos = [...m.keys()].sort();
    for (let i = 1; i < anos.length; i++) {
      // Só compara anos CONSECUTIVOS: com lacuna na série (ex.: 2019 → 2023),
      // "ano anterior" seria outro exercício e o salto não é comparável.
      if (anos[i] !== anos[i - 1] + 1) continue;
      const prev = m.get(anos[i-1])!;
      const atual = m.get(anos[i])!;
      if (prev >= 500_000 && atual / prev >= 3) {
        const f = ds.fornecedores.find(x => x.cnpj === cnpj);
        out.push({
          id: `cresc-${cnpj}-${anos[i]}`,
          entidadeTipo: "fornecedor",
          entidadeId: cnpj,
          entidadeNome: f?.nome ?? cnpj,
          regra: "crescimento_abrupto",
          severidade: atual / prev >= 6 ? "alta" : "media",
          titulo: `Receita pública multiplicada por ${(atual/prev).toFixed(1)}x em ${anos[i]}`,
          explicacao:
            `Este fornecedor recebeu ${fmtBRL(prev)} em ${anos[i-1]} e ${fmtBRL(atual)} em ${anos[i]} — um salto incomum. Crescimentos abruptos podem indicar uma demanda legítima nova, mas também podem sinalizar captura, contratos sem competição ou direcionamento. Verifique o objeto e a modalidade dos contratos recentes.`,
          evidencia: { ano_anterior: anos[i-1], total_anterior: prev, ano: anos[i], total: atual },
        });
      }
    }
  }

  // 2. Fracionamento: 5+ contratos de dispensa abaixo do teto legal VIGENTE NA
  //    DATA de cada contrato (Lei 8.666/Decreto 9.412 → Lei 14.133), mesmo
  //    fornecedor/órgão/ano.
  const fracMap = new Map<string, Contrato[]>();
  for (const c of ds.contratos) {
    if (c.modalidade !== "dispensa") continue;
    // Sem data de assinatura, usa o meio do ano do contrato como referência.
    const dataRef = c.dataAssinatura || `${c.ano}-07-01`;
    if (c.valor >= tetoDispensaNaData(dataRef).teto) continue;
    const k = `${c.orgaoCod}|${c.fornecedorCnpj}|${c.ano}`;
    if (!fracMap.has(k)) fracMap.set(k, []);
    fracMap.get(k)!.push(c);
  }
  for (const [k, lista] of fracMap) {
    if (lista.length >= 5) {
      const [orgaoCod, cnpj] = k.split("|");
      const f = ds.fornecedores.find(x => x.cnpj === cnpj);
      const o = ds.orgaos.find(x => x.cod === orgaoCod);
      const tetoRef = tetoDispensaNaData(lista[0].dataAssinatura || `${lista[0].ano}-07-01`);
      out.push({
        id: `frac-${k}`,
        entidadeTipo: "fornecedor",
        entidadeId: cnpj,
        entidadeNome: f?.nome ?? cnpj,
        regra: "fracionamento",
        severidade: "alta",
        titulo: `${lista.length} dispensas seguidas abaixo do limite legal`,
        explicacao:
          `${f?.nome ?? "Fornecedor"} recebeu ${lista.length} contratos por dispensa de licitação em ${lista[0].ano}, no órgão ${o?.sigla ?? orgaoCod}, todos logo abaixo de ${fmtBRL(tetoRef.teto)} — o teto que permitia contratar sem licitação na época (${tetoRef.baseLegal}). Esse padrão é compatível com fracionamento de despesa, vedado pela legislação de licitações.`,
        evidencia: {
          contratos: lista.length,
          soma: lista.reduce((s,c)=>s+c.valor,0),
          teto: tetoRef.teto,
          base_legal: tetoRef.baseLegal,
        },
      });
    }
  }

  // 3. Concentração: fornecedor concentra > 60% do gasto de um órgão num ano.
  const orgaoAnoTotal = new Map<string, number>();
  const orgaoAnoFornTotal = new Map<string, number>();
  for (const c of ds.contratos) {
    orgaoAnoTotal.set(`${c.orgaoCod}|${c.ano}`, (orgaoAnoTotal.get(`${c.orgaoCod}|${c.ano}`) ?? 0) + c.valor);
    const kf = `${c.orgaoCod}|${c.ano}|${c.fornecedorCnpj}`;
    orgaoAnoFornTotal.set(kf, (orgaoAnoFornTotal.get(kf) ?? 0) + c.valor);
  }
  for (const [kf, val] of orgaoAnoFornTotal) {
    const [orgaoCod, ano, cnpj] = kf.split("|");
    const tot = orgaoAnoTotal.get(`${orgaoCod}|${ano}`) ?? 0;
    if (tot > 2_000_000 && val / tot > 0.6) {
      const f = ds.fornecedores.find(x => x.cnpj === cnpj);
      const o = ds.orgaos.find(x => x.cod === orgaoCod);
      out.push({
        id: `conc-${kf}`,
        entidadeTipo: "orgao",
        entidadeId: orgaoCod,
        entidadeNome: o?.nome ?? orgaoCod,
        regra: "concentracao",
        severidade: val/tot > 0.8 ? "alta" : "media",
        titulo: `Um único fornecedor concentrou ${(val*100/tot).toFixed(0)}% dos contratos em ${ano}`,
        explicacao:
          `Em ${ano}, ${f?.nome ?? "um único fornecedor"} recebeu ${fmtBRL(val)} dos ${fmtBRL(tot)} contratados pelo órgão ${o?.sigla ?? orgaoCod} — concentração de ${(val*100/tot).toFixed(0)}%. Alta concentração reduz competição e pode indicar dependência ou favoritismo. Concorrência saudável tende a distribuir contratos.`,
        evidencia: { fornecedor: f?.nome ?? cnpj, percentual: Number((val*100/tot).toFixed(1)), total_orgao: tot },
      });
    }
  }

  // 4. Outlier por z-score em valor de contratos (>= z 3).
  const vals = ds.contratos.map(c => c.valor);
  if (vals.length > 5) {
    const mean = vals.reduce((a,b)=>a+b,0)/vals.length;
    const variance = vals.reduce((a,b)=>a+(b-mean)**2,0)/vals.length;
    const sd = Math.sqrt(variance) || 1;
    for (const c of ds.contratos) {
      const z = (c.valor - mean) / sd;
      if (z >= 3) {
        const f = ds.fornecedores.find(x => x.cnpj === c.fornecedorCnpj);
        out.push({
          id: `outlier-${c.id}`,
          entidadeTipo: "contrato",
          entidadeId: c.id,
          entidadeNome: c.objeto,
          regra: "outlier_valor",
          severidade: z >= 5 ? "alta" : "media",
          titulo: `Contrato com valor ${z.toFixed(1)}× acima da média`,
          explicacao:
            `Este contrato de ${fmtBRL(c.valor)} com ${f?.nome ?? "o fornecedor"} está ${z.toFixed(1)} desvios-padrão acima da média de todos os contratos comparáveis (${fmtBRL(mean)}). Valores muito atípicos merecem checagem do objeto, da modalidade e do parecer técnico.`,
          evidencia: { valor: c.valor, media: Math.round(mean), z: Number(z.toFixed(2)), modalidade: c.modalidade },
        });
      }
    }
  }

  // 5. Fornecedor recente com contrato alto.
  // Aparece pela primeira vez no dataset e em < 12 meses já recebe > R$ 1M.
  const firstSeen = new Map<string, string>(); // cnpj -> data ISO mínima
  for (const c of ds.contratos) {
    // Data vazia não pode entrar: "" é menor que qualquer ISO e viraria a
    // "primeira aparição", gerando NaN no cálculo de dias e silenciando a regra.
    if (!c.dataAssinatura) continue;
    const cur = firstSeen.get(c.fornecedorCnpj);
    if (!cur || c.dataAssinatura < cur) firstSeen.set(c.fornecedorCnpj, c.dataAssinatura);
  }
  const fornAlertados = new Set<string>();
  for (const c of ds.contratos) {
    if (c.valor < 1_000_000 || !c.dataAssinatura) continue;
    const first = firstSeen.get(c.fornecedorCnpj);
    if (!first) continue;
    const diasDesdePrim = (new Date(c.dataAssinatura).getTime() - new Date(first).getTime()) / 86_400_000;
    if (diasDesdePrim <= 365 && !fornAlertados.has(c.fornecedorCnpj)) {
      fornAlertados.add(c.fornecedorCnpj);
      const f = ds.fornecedores.find(x => x.cnpj === c.fornecedorCnpj);
      out.push({
        id: `novato-${c.fornecedorCnpj}`,
        entidadeTipo: "fornecedor",
        entidadeId: c.fornecedorCnpj,
        entidadeNome: f?.nome ?? c.fornecedorCnpj,
        regra: "fornecedor_recente_alto",
        severidade: c.valor >= 5_000_000 ? "alta" : "media",
        titulo: `Fornecedor recente com contrato de ${fmtBRL(c.valor)}`,
        explicacao:
          `Este fornecedor aparece nos contratos públicos a partir de ${new Date(first).toLocaleDateString("pt-BR")} e em menos de um ano já firmou um contrato de ${fmtBRL(c.valor)}. Empresas novas podem ter capacidade técnica legítima, mas a literatura de controle aponta para cautela extra com escala rápida — vale checar quadro societário, capital social e histórico no CNPJ.`,
        evidencia: { primeiro_contrato: first, contrato_alto: c.id, valor: c.valor },
      });
    }
  }

  // 6. Descrição genérica em contrato alto.
  for (const c of ds.contratos) {
    if (c.valor < 200_000) continue;
    const obj = (c.objeto || "").toLowerCase().trim();
    const curto = obj.length < 30;
    const generico = TERMOS_GENERICOS.some(t => obj.includes(t));
    if (!curto && !generico) continue;
    const f = ds.fornecedores.find(x => x.cnpj === c.fornecedorCnpj);
    out.push({
      id: `gen-${c.id}`,
      entidadeTipo: "contrato",
      entidadeId: c.id,
      entidadeNome: c.objeto || "Contrato sem descrição",
      regra: "descricao_generica",
      severidade: c.valor >= 1_000_000 ? "media" : "baixa",
      titulo: `Objeto contratual pouco específico para ${fmtBRL(c.valor)}`,
      explicacao:
        `O contrato com ${f?.nome ?? "o fornecedor"} descreve seu objeto como “${c.objeto}”. Descrições muito curtas ou genéricas dificultam fiscalização — a Lei nº 14.133/2021 exige objeto definido. Vale procurar o termo de referência completo no Portal e checar se há detalhamento.`,
      evidencia: { tamanho_descricao: obj.length, valor: c.valor },
    });
  }

  // 7. Dispensa recorrente: mesmo órgão+fornecedor com ≥3 dispensas/ano em 2+ anos seguidos.
  const dispMap = new Map<string, Map<number, number>>(); // orgao|cnpj -> ano -> count
  for (const c of ds.contratos) {
    if (c.modalidade !== "dispensa") continue;
    const k = `${c.orgaoCod}|${c.fornecedorCnpj}`;
    if (!dispMap.has(k)) dispMap.set(k, new Map());
    const m = dispMap.get(k)!;
    m.set(c.ano, (m.get(c.ano) ?? 0) + 1);
  }
  for (const [k, m] of dispMap) {
    const anos = [...m.entries()].filter(([, n]) => n >= 3).map(([a]) => a).sort();
    if (anos.length < 2) continue;
    // exige dois anos consecutivos
    let consecutivos = false;
    for (let i = 1; i < anos.length; i++) if (anos[i] === anos[i-1] + 1) consecutivos = true;
    if (!consecutivos) continue;
    const [orgaoCod, cnpj] = k.split("|");
    const f = ds.fornecedores.find(x => x.cnpj === cnpj);
    const o = ds.orgaos.find(x => x.cod === orgaoCod);
    const totalDisp = anos.reduce((s, a) => s + (m.get(a) ?? 0), 0);
    out.push({
      id: `disprec-${k}`,
      entidadeTipo: "fornecedor",
      entidadeId: cnpj,
      entidadeNome: f?.nome ?? cnpj,
      regra: "dispensa_recorrente",
      severidade: anos.length >= 3 ? "alta" : "media",
      titulo: `Dispensa de licitação repetida em ${anos.length} anos com o mesmo órgão`,
      explicacao:
        `${f?.nome ?? "Este fornecedor"} foi contratado por dispensa de licitação ${totalDisp} vezes pelo órgão ${o?.sigla ?? orgaoCod} ao longo dos anos ${anos.join(", ")}. A dispensa é exceção legal (Lei nº 14.133/2021); recorrência com mesmo fornecedor sugere checar se a hipótese de dispensa continua se justificando ou se uma licitação seria cabível.`,
      evidencia: { anos: anos.join(","), dispensas: totalDisp },
    });
  }

  // 8. Crescimento abrupto do gasto total do órgão (≥2× a mediana dos 3 anos
  //    anteriores COM DADOS — se a série tem lacunas, a mediana usa os três
  //    exercícios mais recentes disponíveis, não necessariamente consecutivos).
  const orgaoAno = new Map<string, Map<number, number>>();
  for (const c of ds.contratos) {
    if (!orgaoAno.has(c.orgaoCod)) orgaoAno.set(c.orgaoCod, new Map());
    const m = orgaoAno.get(c.orgaoCod)!;
    m.set(c.ano, (m.get(c.ano) ?? 0) + c.valor);
  }
  for (const [cod, m] of orgaoAno) {
    const anos = [...m.keys()].sort();
    for (let i = 3; i < anos.length; i++) {
      const ano = anos[i];
      const atual = m.get(ano)!;
      const baseline = median([m.get(anos[i-1])!, m.get(anos[i-2])!, m.get(anos[i-3])!]);
      if (baseline >= 1_000_000 && atual / baseline >= 2) {
        const o = ds.orgaos.find(x => x.cod === cod);
        out.push({
          id: `crescorg-${cod}-${ano}`,
          entidadeTipo: "orgao",
          entidadeId: cod,
          entidadeNome: o?.nome ?? cod,
          regra: "crescimento_orgao",
          severidade: atual / baseline >= 4 ? "alta" : "media",
          titulo: `Gasto do órgão ${(atual/baseline).toFixed(1)}× a mediana recente em ${ano}`,
          explicacao:
            `O órgão ${o?.sigla ?? cod} contratou ${fmtBRL(atual)} em ${ano}, frente a uma mediana de ${fmtBRL(baseline)} nos três anos anteriores com dados. Saltos dessa magnitude podem decorrer de uma política nova legítima, mas também merecem checagem da composição (quais fornecedores e modalidades responderam pelo crescimento).`,
          evidencia: { ano, atual: Math.round(atual), baseline: Math.round(baseline), salto: Number((atual/baseline).toFixed(2)) },
        });
      }
    }
  }

  // 9. Transparência institucional baixa em órgão com volume relevante.
  //    Nota ITI < 40 e total contratado >= R$ 5M na amostra carregada.
  const totalPorOrgao = new Map<string, number>();
  for (const c of ds.contratos) {
    totalPorOrgao.set(c.orgaoCod, (totalPorOrgao.get(c.orgaoCod) ?? 0) + c.valor);
  }
  for (const o of ds.orgaos) {
    const total = totalPorOrgao.get(o.cod) ?? 0;
    if (total < 5_000_000) continue;
    const n = calcularNotaTransparencia(ds, o.cod);
    if (n.faixa !== "baixa") continue;
    out.push({
      id: `iti-${o.cod}`,
      entidadeTipo: "orgao",
      entidadeId: o.cod,
      entidadeNome: o.nome,
      regra: "transparencia_baixa",
      severidade: n.nota < 25 ? "alta" : "media",
      titulo: `Publicação contratual opaca (ITI ${n.nota}/100) com volume de ${fmtBRL(total)}`,
      explicacao:
        `O órgão ${o.sigla} apresenta Índice de Transparência Institucional de ${n.nota}/100 sobre uma amostra de ${n.amostra} contratos somando ${fmtBRL(total)}. ITI baixo combinado com volume relevante indica dificuldade para a sociedade interpretar como o recurso público é alocado — objetos vagos, baixa competitividade, gasto concentrado em poucos fornecedores ou cobertura defasada. Não é juízo sobre legalidade; é sinal sobre clareza informacional. Consulte a página de transparência institucional para o detalhamento dos cinco eixos.`,
      evidencia: {
        nota: n.nota,
        amostra: n.amostra,
        total: Math.round(total),
      },
    });
  }

  return out;
}
