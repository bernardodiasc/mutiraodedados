# Qualidade de dados

Nem todo dado oficial é confiável. O sistema detecta inconsistências e as expõe na página [`/qualidade`](https://auditoriacidada.ia.br/qualidade).

## Tipos de achado

Toda inconsistência vira um **QA finding** na tabela `qa_findings`, com:

- **Severidade**:
  - `critico` — divergência confirmada ou erro grave (ex: valor mil vezes maior que outras fontes).
  - `aviso` — suspeita que precisa de verificação humana (ex: valor abaixo de R$ 100 num contrato).
  - `info` — nota informativa, sem indicar erro.
- **Origem**:
  - `heuristica` — gerado por regra automática durante a ingestão.
  - `denuncia` — registrado por cidadão a partir do site.
- **Status**:
  - `aberto` — pendente de análise.
  - `corrigido_origem` — a fonte oficial corrigiu.
  - `falso_positivo` — análise humana descartou.
  - `resolvido` — encaminhado ao canal oficial e respondido.

## Página pública `/qualidade`

Lista todos os achados visíveis ao público. Cada item mostra:

- O que foi detectado (regra + evidência).
- Link para o registro afetado no próprio site (ex: `/contratos/123`).
- Link para o registro na fonte oficial (Portal da Transparência, PNCP, etc.).
- Botão para abrir um chamado no canal oficial correspondente (Fala.BR, SIC, suporte SICONFI).

O catálogo de canais por fonte está em `src/lib/data/qa-canais.ts`. O texto-base do chamado é gerado por `qa-template.ts` com a evidência já preenchida.

## Página `/qualidade/$id`

Detalhe de um achado individual. Mostra histórico, anexos e permite ao cidadão registrar que abriu protocolo no canal oficial.

## Painel admin

Em [`/admin/qualidade`](./admin.md) o admin pode:

- Marcar findings como `falso_positivo` ou `resolvido`.
- Anotar respostas recebidas dos canais oficiais.
- Filtrar por fonte, severidade e regra.

## Valores suspeitos do Portal CGU

O ingest **não corrige** valores — grava o que a API devolve e sinaliza o que é anômalo. Quando a listagem traz valor < R$ 100 ou um valor inicial ≥ 1000× o final (indício de erro de escala/ponto-fixo no JSON da origem), gera um finding `possivel_ponto_fixo` (severidade `critico`) para revisão humana, reconciliado por `sincronizarQaCgu` contra o cache pós-upsert.

## Relacionado

- Regras de heurística por fonte: `src/lib/data/qa.ts`.
- Catálogo de canais oficiais: `src/lib/data/qa-canais.ts`.
- Detecção de anomalias (diferente de QA — são sinais investigativos sobre dados que estão corretos): [`dominios/anomalias-e-sinais.md`](./dominios/anomalias-e-sinais.md).