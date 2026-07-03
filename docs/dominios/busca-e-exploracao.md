# Busca e exploração

## Propósito

Pontos de entrada quando o cidadão **não sabe exatamente o que procura**.

## Páginas públicas

- `/buscar` — busca global por termo (nome, CNPJ, número de contrato, palavras do objeto). Resultados de múltiplas bases: contratos PNCP, **licitações CGU**, **emendas CGU**, **convênios CGU** e transferências/convênios Transferegov. Por CNPJ casa órgão (CGU é por órgão, não por fornecedor) e convenente; por termo, objeto/autor/número. Ver `src/lib/data/busca.functions.ts`.
- `/explorar` — exploração por ente federativo (UF, município).
- `/cobertura` — matriz visual de cobertura: para cada fonte e cada mês, mostra se houve ingestão, se há dados, e se falta sincronizar. Componente: `CoberturaMatrix`.
- `/qualidade` — central de erros detectados nas bases oficiais (ver [`qualidade-dados.md`](../qualidade-dados.md)).

## Cobertura — como ler

- **Verde**: meses com dados ingeridos.
- **Amarelo**: meses sincronizados mas sem dados (confirmado vazio na fonte).
- **Cinza**: meses ainda não sincronizados.
- **Vermelho**: erro na última tentativa.

A regra usa `src/lib/data/cobertura.functions.ts` cruzando `importacoes` com os caches.

## Admin relacionado

- A página `/admin/dados` é a contraparte de escrita: gerar as ingestões que aparecem em `/cobertura`.

## Por que `/cobertura` é pública

Por princípio de transparência sobre nós mesmos: o cidadão precisa saber **o que não temos** para não tirar conclusões erradas dos agregados.