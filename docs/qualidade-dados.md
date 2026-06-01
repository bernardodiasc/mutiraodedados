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
  - `auto_correcao` — o próprio ingest corrigiu via consulta ao endpoint de detalhe.
  - `denuncia` — registrado por cidadão a partir do site.
- **Status**:
  - `aberto` — pendente de análise.
  - `corrigido_origem` — a fonte oficial corrigiu (ou o ingest auto-corrigiu).
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

## Auto-correção

Quando o Portal CGU retorna valor < R$ 100 numa listagem, o ingest consulta o endpoint de detalhe daquele registro. Se a diferença for maior que 5%, corrige o cache e cria um finding de auto-correção (severidade `aviso`, status `corrigido_origem`). Se o detalhe não responder, o registro é **pulado** — não entra no cache.

## Relacionado

- Regras de heurística por fonte: `src/lib/data/qa.ts`.
- Catálogo de canais oficiais: `src/lib/data/qa-canais.ts`.
- Detecção de anomalias (diferente de QA — são sinais investigativos sobre dados que estão corretos): [`dominios/anomalias-e-sinais.md`](./dominios/anomalias-e-sinais.md).