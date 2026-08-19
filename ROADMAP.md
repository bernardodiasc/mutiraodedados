# ROADMAP — engenharia

Só futuro. Trabalho entregue mora no [RELEASES.md](./RELEASES.md); processo e convenções no [WORKFLOW.md](./WORKFLOW.md). Este roadmap é de engenharia — o roadmap público cidadão vive em [/roadmap](https://mutiraodedados.com.br/roadmap) (tabela `roadmap_itens`).

## Visão

Estabilizar as funcionalidades existentes para **importar todos os dados históricos possíveis** nas fontes que a plataforma já suporta, com qualidade garantida por sinais e testes. Automação periódica das importações é o horizonte final — cada release de estabilização deve manter os runners de importação chamáveis sem browser, idempotentes e com estado no banco, para que a automação seja apenas um novo gatilho sobre o mesmo código.

## Release em andamento — v0.4.0: CEAP/CEAPS retomáveis

Fragilidade nº 1 do diagnóstico: `importarCEAPMes` e `importarCEAPSMes` percorrem **todos** os parlamentares em cache dentro de uma única server function, cada um com até 30 páginas — sem orçamento de tempo, sem retomada e sem limite de subrequisições. Com o histórico de várias legislaturas importado, é o candidato mais provável a estourar os limites do Worker.

**Escopo**

- Migrar `importarCEAPMes` (`src/lib/data/camara/ingest.functions.ts`) e `importarCEAPSMes` (`src/lib/data/senado/ingest.functions.ts`) para o runner genérico: checkpoint por parlamentar dentro do mês, orçamento de tempo, retomada pelo auto-continuar do admin.
- Migration da tabela de varredura correspondente (GRANT + RLS).

**Critérios de aceite**

- Teste unitário da lógica de particionamento por parlamentar.
- 1 mês histórico completo de CEAP e CEAPS importado via retomada múltipla, sem timeout, com contagem conferida contra a fonte.
- Migration aplicada com RLS conferida.

## Backlog sequenciado

Ordem por dependência técnica rumo à carga histórica. Cada release fecha conforme o [WORKFLOW.md](./WORKFLOW.md).

### v0.5.0 — PNCP, Transferegov e proposições em modo carga

- PNCP e Transferegov ganham orçamento + varredura/retomada (checkpoint antes do upsert — erro de banco deixa de perder a rodada); remover a trava `maxPaginas: 3` da UI.
- Elevar a cobertura de `importarProposicoes` (default atual de 5 páginas não cobre um ano).
- Revisar janelas-alvo em `src/lib/data/janelas.ts`.

Aceite: um ano-calendário completo de cada fonte via auto-continuar; zero rodadas perdidas em erro simulado de banco.

### v0.6.0 — Orquestrador robusto

- Re-tentativa de órgão com erro no auto-continuar (com limite e registro).
- Renovação de sessão Supabase por expiração do JWT, não "a cada N jobs".
- Telemetria de rodada consolidada no log `importacoes` (duração, motivo de parada).

Aceite: sessão de importação >1h sem intervenção manual; falha transitória recuperada sozinha; falha permanente visível e isolada.

### v0.7.0 — Qualidade visível

- Criar `/admin/lacunas` — UI para `converterFindingEmLacuna`/`criarLacuna`/`atualizarLacuna` (`src/lib/lacunas.functions.ts`), fechando o fluxo descrito em `docs/dominios/laboratorio-civico.md`.
- `QualidadeBanner` nas fichas de fornecedor, órgão, deputado e senador.

Aceite: fluxo finding→lacuna ponta a ponta pela UI; banners nas 4 superfícies; checklist de feature de `docs/padroes/desenvolvimento.md` cumprido.

### v0.8.0 — Carga histórica em massa

Release operacional: importar, fonte a fonte, a janela histórica máxima suportada (CGU, TSE, Câmara/Senado, PNCP, Transferegov, SICONFI), com plano próprio em `docs/planos/v0.8.0-carga-historica.md` definindo janela-alvo, ordem e estimativas por fonte.

Aceite: cobertura-alvo por fonte atingida e registrada em `/admin/dados`; findings triados ou convertidos em lacunas; nenhuma varredura travada; RELEASES.md documenta a cobertura final.

## Horizonte

### v0.9.0 — Automação periódica das importações

Não implementar antes das releases acima. Desenho já validado contra a infra:

- Rota de servidor sem UI (server route do TanStack Start) que valida um segredo em header contra `process.env.CRON_SECRET` (secret gerenciado como os demais do projeto) e executa **uma rodada com orçamento** do runner da v0.3.0, retornando `{concluido, proximoCursor}`.
- Agendador, em ordem de preferência: (a) `pg_cron` + `pg_net` no Supabase — extensões disponíveis no banco do projeto, habilitáveis por migration; (b) agendador externo (ex.: Make) chamando o mesmo endpoint com o mesmo segredo. Cron trigger nativo do Worker descartado como caminho principal (sem suporte documentado no pipeline de deploy gerenciado).
- Requisitos: endpoint nunca aberto (segredo obrigatório, 401 sem detalhe); lock no banco contra concorrência com rodadas manuais do admin.

### v1.0.0 — Critérios de primeira versão estável

Definir ao final da estabilização. No mínimo: carga histórica completa nas fontes suportadas, automação periódica ativa, suíte verde contínua e zero fragilidades conhecidas de importação.
