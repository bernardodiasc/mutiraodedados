# ROADMAP — engenharia

Só futuro. Trabalho entregue mora no [RELEASES.md](./RELEASES.md); processo e convenções no [WORKFLOW.md](./WORKFLOW.md). Este roadmap é de engenharia — o roadmap público cidadão vive em [/roadmap](https://mutiraodedados.com.br/roadmap) (tabela `roadmap_itens`).

## Visão

Estabilizar as funcionalidades existentes para **importar todos os dados históricos possíveis** nas fontes que a plataforma já suporta, com qualidade garantida por sinais e testes. Automação periódica das importações é o horizonte final — cada release de estabilização deve manter os runners de importação chamáveis sem browser, idempotentes e com estado no banco, para que a automação seja apenas um novo gatilho sobre o mesmo código.

## Release em andamento

Nenhuma. A próxima a abrir é a **v0.7.0** do backlog abaixo.

## Backlog sequenciado

Ordem por dependência técnica rumo à carga histórica. Cada release fecha conforme o [WORKFLOW.md](./WORKFLOW.md).

### v0.7.0 — `/cobertura` completa e legível + IBGE como fonte

Duas frentes que se encontram na mesma tela.

**`/cobertura` organizada.** Após os testes manuais da v0.6.0 o mantenedor apontou fontes e dados faltando. Levantar, antes de mexer: quais dos 17 ids que gravam rodada em `importacoes` (lista em `src/lib/data/fonte-rotulos.ts`) têm linha na cobertura, e quais não têm; se cada um usa a granularidade certa (mês, ano, período fiscal); e se as RPCs de cobertura cobrem todas as tabelas `*_cache`. O teste-guarda de paridade deve valer aqui como já vale para limpeza e sinais — uma lista-espelho que falha quando uma fonte nova não aparece na cobertura.

**IBGE vira fonte de dados de primeira classe**, com o mesmo tratamento das demais: tabela de cache dos entes federativos, importação retomável, entrada em `FONTES_LIMPEZA`, cobertura e janela. Hoje a lista de municípios é buscada no navegador a cada uso e a de UFs é constante no código — nenhuma das duas passa pelo contrato de fonte.

Aceite: toda fonte que grava rodada aparece em `/cobertura`, com teste-guarda; IBGE sob o contrato de fonte.

### v0.8.0 — Matérias do Senado migram para `/processo`

O endpoint `materia/pesquisa/lista` passou da data de desativação que ele mesmo anuncia (2026-02-01) e já mudou o formato uma vez sem avisar — o que fez a varredura descartar 902 matérias em silêncio e registrar "consultado, sem dados". O substituto oficial é `legis.senado.leg.br/dadosabertos/processo`.

Aceite: `senado_materias_cache` alimentada pelo novo serviço, sob o mesmo contrato de fonte; o endpoint velho sai do código; `docs/fontes/senado.md` perde o aviso de descontinuação.

### v0.9.0 — Uma tabela para convênios, com coluna de fonte

Hoje o mesmo convênio pode existir em `cgu_convenios_cache` **e** em `transferegov_instrumentos_cache`, vindo do mesmo endpoint e da mesma requisição. A comparação das duas (2026-08-20) mostra que a separação não guarda dados diferentes:

- **11 colunas idênticas** nas duas.
- **9 pares que são o mesmo campo bruto com nome diferente** — `valor`/`valor_global` e `valor_liberado`/`valor_repasse` saem de `raw.valor` e `raw.valorLiberado`; `convenente_*`/`beneficiario_*` de `raw.convenente`; `tipo_instrumento`/`modalidade` caem no mesmo `tipoInstrumento.descricao`.
- **Poucas colunas realmente exclusivas**, e todas presentes no payload que as duas recebem: a CGU mapeia `dataReferencia` (→ `ano`, `mes_referencia`) e `orgao`; a outra mapeia `dataAssinatura` e `unidadeGestora.orgaoVinculado`. Cada lado deixou de mapear o que o outro mapeou — não houve dado a mais em lugar nenhum.

O custo dessa duplicação é concreto: dois pipelines de QA, duas entradas de limpeza, duas RPCs de cobertura, dois conjuntos de sinais e a chance permanente de os dois divergirem sem ninguém notar — foi assim que os links oficiais e os rótulos de fonte divergiram.

**Desenho alvo:** uma tabela do tipo de dado (`convenios_cache`) com o superconjunto de colunas e uma coluna **`fonte`**. Os dois "ângulos" viram consultas sobre ela, e quando a origem do Transferegov entrar (v0.10.0) ela ocupa a mesma tabela com `fonte` própria — aí a distinção volta a ser real e o modelo já a comporta.

**Não é patch.** Exige migration com movimentação de dados, deduplicação por id (os ids sintéticos `num-XXXX` de um lado não batem com os do outro), e rewire de QA, limpeza, cobertura, sinais e status. Merece plano próprio em `docs/planos/`.

### v0.10.0 — Convênios pela origem (Transferegov), por um dos dois caminhos

Hoje os dois ângulos de `/convenios` saem do mesmo endpoint `/convenios` do Portal CGU. Não é preferência: o módulo **Transferências Discricionárias e Legais** do Transferegov — onde ficam convênios e contratos de repasse — não tem API. Verificado em 2026-08-20; a tabela de módulos e o método do teste estão em [docs/fontes/transferegov.md](./docs/fontes/transferegov.md).

Dois caminhos, e o primeiro não depende de esperar:

- **(a) CSV do módulo Discricionárias e Legais** — disponível hoje. Exige um contrato de fonte diferente do resto do projeto: arquivo inteiro versionado em vez de paginação por janela, então a retomada passa a ser por bloco de linhas e a cobertura por data de publicação do arquivo. É a via para ter o dado na origem antes de 2027.
- **(b) API nativa, quando sair** — cronograma oficial prevê "Instrumentos" entre nov/2026 e fev/2027. Encaixa direto no contrato de fonte atual.

Em qualquer um dos dois, `transferegov_instrumentos_cache` passa a ser alimentada pela origem e o seletor de `/convenios` volta a distinguir **fontes**, não só ângulos de leitura.

### v0.11.0 — Fontes novas que a API do Transferegov já expõe

O levantamento de 2026-08-20 achou dois módulos com API aberta que o projeto **não** cobre, ambos com dinheiro que hoje escapa da plataforma:

- **Transferências Fundo a Fundo** (`/fundoafundo`) — repasse direto a fundos estaduais e municipais, sem convênio. É volume alto e fiscalização baixa.
- **Gestão de Parcerias** (`/parcerias`) — fundo a fundo da Saúde, PRONON/PRONAS, contratos de gestão, multas ambientais. Instrumentos que hoje não aparecem em lugar nenhum do site.

Avaliar valor cívico antes de priorizar: nenhum dos dois é convênio, e o nome "parcerias" não deve ser lido como tal.

### v0.12.0 — Qualidade visível

- Criar `/admin/lacunas` — UI para `converterFindingEmLacuna`/`criarLacuna`/`atualizarLacuna` (`src/lib/lacunas.functions.ts`), fechando o fluxo descrito em `docs/dominios/laboratorio-civico.md`.
- `QualidadeBanner` nas fichas de fornecedor, órgão, deputado e senador.

Aceite: fluxo finding→lacuna ponta a ponta pela UI; banners nas 4 superfícies; checklist de feature de `docs/padroes/desenvolvimento.md` cumprido.

### v0.13.0 — Carga histórica em massa

Release operacional: importar, fonte a fonte, a janela histórica máxima suportada (CGU, TSE, Câmara/Senado, PNCP, Transferegov, SICONFI), com plano próprio em `docs/planos/v0.13.0-carga-historica.md` definindo janela-alvo, ordem e estimativas por fonte.

Aceite: cobertura-alvo por fonte atingida e registrada em `/admin/dados`; findings triados ou convertidos em lacunas; nenhuma varredura travada; RELEASES.md documenta a cobertura final.

## Horizonte

### v0.14.0 — Automação periódica das importações

Não implementar antes das releases acima. Desenho já validado contra a infra:

- Rota de servidor sem UI (server route do TanStack Start) que valida um segredo em header contra `process.env.CRON_SECRET` (secret gerenciado como os demais do projeto) e executa **uma rodada com orçamento** do runner da v0.3.0, retornando `{concluido, proximoCursor}`.
- Agendador, em ordem de preferência: (a) `pg_cron` + `pg_net` no Supabase — extensões disponíveis no banco do projeto, habilitáveis por migration; (b) agendador externo (ex.: Make) chamando o mesmo endpoint com o mesmo segredo. Cron trigger nativo do Worker descartado como caminho principal (sem suporte documentado no pipeline de deploy gerenciado).
- Requisitos: endpoint nunca aberto (segredo obrigatório, 401 sem detalhe); lock no banco contra concorrência com rodadas manuais do admin.

### v1.0.0 — Critérios de primeira versão estável

Definir ao final da estabilização. No mínimo: carga histórica completa nas fontes suportadas, automação periódica ativa, suíte verde contínua e zero fragilidades conhecidas de importação.
