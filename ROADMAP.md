# ROADMAP — engenharia

Só futuro. Trabalho entregue mora no [RELEASES.md](./RELEASES.md); processo e convenções no [WORKFLOW.md](./WORKFLOW.md). Este roadmap é de engenharia — o roadmap público cidadão vive em [/roadmap](https://mutiraodedados.com.br/roadmap) (tabela `roadmap_itens`).

## Visão

Estabilizar as funcionalidades existentes para **importar todos os dados históricos possíveis** nas fontes que a plataforma já suporta, com qualidade garantida por sinais e testes. Automação periódica das importações é o horizonte final — cada release de estabilização deve manter os runners de importação chamáveis sem browser, idempotentes e com estado no banco, para que a automação seja apenas um novo gatilho sobre o mesmo código.

## Release em andamento

Nenhuma. A v0.12.0 (revisão das páginas públicas do Explorar) foi entregue em 2026-08-24; a próxima versão é a **rodada de testes manuais e ajustes do mantenedor**, que definirá o escopo seguinte.

## Backlog sequenciado

**Rodada de testes manuais e ajustes do mantenedor** (roteiro consolidado pós-v0.11.0), agora incluindo os fluxos revistos na v0.12.0. Candidatos a entrar depois (da rodada de ajustes e do horizonte): rotação de SICONFI e CGU por órgão na automação, sinal espelho×origem, UI de automação no admin.

Deixados de fora da v0.12.0, por não serem necessários ao escopo:

- Índice `pg_trgm` para a busca unificada e para os `count` das listagens — só se a carga histórica mostrar lentidão.
- Seção de partidos no hub de eleições (hoje a entrada para `/eleicoes/partidos/$sigla` é pelos badges das listas e fichas).
- Migração das ~35 ocorrências restantes do idiom de card à mão para `Cartao` nas rotas fora do grupo Explorar.

## Horizonte

Sem números de versão — a ordem aqui muda com frequência; só marcos MAJOR são versionados.

### Fontes novas que a API do Transferegov já expõe

O levantamento de 2026-08-20 achou dois módulos com API aberta que o projeto **não** cobre, ambos com dinheiro que hoje escapa da plataforma:

- **Transferências Fundo a Fundo** (`/fundoafundo`) — repasse direto a fundos estaduais e municipais, sem convênio. É volume alto e fiscalização baixa.
- **Gestão de Parcerias** (`/parcerias`) — fundo a fundo da Saúde, PRONON/PRONAS, contratos de gestão, multas ambientais. Instrumentos que hoje não aparecem em lugar nenhum do site.

Avaliar valor cívico antes de priorizar: nenhum dos dois é convênio, e o nome "parcerias" não deve ser lido como tal.

### Sinal de qualidade: situação espelho × origem

O enriquecimento da v0.10.0 revelou espelho defasado (convênio rescindido exibido "em execução"). A ficha já mostra a divergência; falta promovê-la a regra do catálogo de sinais (finding automático por convênio divergente), entrando no fluxo finding→lacuna.

### Carga histórica em massa (operação, não engenharia)

A **capacidade** já foi entregue nas v0.3.0–v0.7.0 (varredura em massa, retomada, orçamento, histórico, classificação de resultado). O que resta é a **operação**: rodar, fonte a fonte, a janela histórica máxima suportada (CGU, TSE, Câmara/Senado, PNCP, SICONFI) — trabalho de operador no site, que combina com a rodada de testes manuais do mantenedor. Plano operacional próprio em `docs/planos/carga-historica.md` quando for começar, definindo janela-alvo, ordem e estimativas por fonte.

Aceite: cobertura-alvo por fonte atingida e registrada em `/admin/dados`; findings triados ou convertidos em lacunas; nenhuma varredura travada; RELEASES.md documenta a cobertura final.

### v1.0.0 — Critérios de primeira versão estável

Definir ao final da estabilização. No mínimo: carga histórica completa nas fontes suportadas, automação periódica ativa, suíte verde contínua e zero fragilidades conhecidas de importação.
