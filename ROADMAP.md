# ROADMAP — engenharia

Só futuro. Trabalho entregue mora no [RELEASES.md](./RELEASES.md); processo e convenções no [WORKFLOW.md](./WORKFLOW.md). Este roadmap é de engenharia — o roadmap público cidadão vive em [/roadmap](https://mutiraodedados.com.br/roadmap) (tabela `roadmap_itens`).

## Visão

Estabilizar as funcionalidades existentes para **importar todos os dados históricos possíveis** nas fontes que a plataforma já suporta, com qualidade garantida por sinais e testes. Automação periódica das importações é o horizonte final — cada release de estabilização deve manter os runners de importação chamáveis sem browser, idempotentes e com estado no banco, para que a automação seja apenas um novo gatilho sobre o mesmo código.

## Release em andamento — v0.6.0: orquestrador robusto

Com as fontes retomáveis, o gargalo passa a ser o orquestrador no navegador: um órgão que falha não é re-tentado, a sessão é renovada por contagem de jobs em vez de por expiração, e o log não registra por que uma rodada parou.

**Escopo**

- Re-tentativa de órgão com erro no auto-continuar, com limite e registro.
- Renovação de sessão Supabase por expiração do JWT, não "a cada N jobs".
- Telemetria de rodada no log `importacoes`: duração, motivo de parada (tempo, custo, fim) e custo gasto.

**Critérios de aceite**

- Sessão de importação de mais de uma hora sem intervenção manual.
- Falha transitória de um órgão recuperada sozinha; falha permanente visível e isolada.
- O Histórico mostra por que cada rodada parou.

## Backlog sequenciado

Ordem por dependência técnica rumo à carga histórica. Cada release fecha conforme o [WORKFLOW.md](./WORKFLOW.md).

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
