# ROADMAP — engenharia

Só futuro. Trabalho entregue mora no [RELEASES.md](./RELEASES.md); processo e convenções no [WORKFLOW.md](./WORKFLOW.md). Este roadmap é de engenharia — o roadmap público cidadão vive em [/roadmap](https://mutiraodedados.com.br/roadmap) (tabela `roadmap_itens`).

## Visão

Estabilizar as funcionalidades existentes para **importar todos os dados históricos possíveis** nas fontes que a plataforma já suporta, com qualidade garantida por sinais e testes. Automação periódica das importações é o horizonte final — cada release de estabilização deve manter os runners de importação chamáveis sem browser, idempotentes e com estado no banco, para que a automação seja apenas um novo gatilho sobre o mesmo código.

Evolução planejada: ampliar a **busca unificada por qualquer assunto**, conectando dados externos legislativos e financeiros, pessoas, debates, normas e documentos ao longo das legislaturas. Notas, tutoriais e mapas dão contexto e ensinam a investigar; não haverá catálogo fixo de temas nem novo tipo de artigo. Tributação, compras públicas e emendas são exemplos de validação e pautas editoriais, não limites da busca. O resumo do programa está abaixo, em "Busca unificada e investigação com dados externos".

## Release em andamento

Nenhuma. A v0.13.0 fechou em 2026-09-25 ([RELEASES](./RELEASES.md)). A próxima é a v0.14.0 (UX de `/buscar`, abaixo), promovida quando a primeira issue do milestone dela começar.

## Backlog sequenciado

**Rodada de testes manuais e ajustes do mantenedor**, pelos roteiros de [`docs/qa/`](./docs/qa/README.md), cobrindo as entregas v0.7.0–v0.13.0 ainda sem validação manual — inclusive as rodadas reais de importação de Câmara (votações e votos desde 2003), Senado e SICONFI (RGF), que saíram do aceite da v0.13.0. Candidatos a entrar depois (da rodada de ajustes e do horizonte): rotação de SICONFI e CGU por órgão na automação, sinal espelho×origem, UI de automação no admin.

**Testes automatizados — em planejamento, release a definir.** Além do Vitest de lógica pura: primeiro _evals de dados_ (rodadas reais de importação conferidas automaticamente — contagens, log `importacoes`, retomada, cobertura), depois _e2e de UI_ nos fluxos de maior valor. Em aberto: ambiente onde rodam, ferramenta, dados de teste e se bloqueiam merge ou vigiam periodicamente. Evals de conteúdo gerado por LLM ficam fora.

Deixados de fora da v0.12.0, por não serem necessários ao escopo:

- Índice `pg_trgm` para a busca unificada e para os `count` das listagens — só se a carga histórica mostrar lentidão.
- Seção de partidos no hub de eleições (hoje a entrada para `/eleicoes/partidos/$sigla` é pelos badges das listas e fichas).
- Migração das ~35 ocorrências restantes do idiom de card à mão para `Cartao` nas rotas fora do grupo Explorar.

### Busca unificada e investigação com dados externos — programa v0.14.0–v0.22.0

Planejado em 2026-09-24 e renumerado em 2026-09-25 (a v0.13.0 foi usada pela rodada de correções e processo), sem autorização implícita de implementação ou importação. Depois da estabilização, **uma release por vez** é promovida à seção em andamento; hotfixes usam PATCH e a numeração se ajusta se outra MINOR entrar antes. Este é o resumo público; o plano completo e as decisões transversais em aberto (arquitetura do índice de busca, identidade entre fontes, histórico de registros, documentos e OCR, dados pessoais na busca) andam em issues do repositório privado e voltam para cá quando mudarem escopo ou aceite.

**O que a pessoa deve conseguir fazer:** pesquisar qualquer assunto em `/buscar` e encontrar propostas, normas, debates, participantes, séries e instrumentos financeiros; acompanhar a história de cada registro; atravessar ligações entre Casas e fontes; comparar períodos e textos; e ler notas, tutoriais e mapas que ensinam a interpretar e investigar esse material.

**Princípios que valem para todas as releases:**

- **Busca livre como entrada.** Sem catálogo de temas, `/temas`, cadastro de assunto ou nova categoria editorial; a consulta é um recorte do visitante, compartilhável e salvável no caderno. Tributação, compras públicas e emendas são casos de validação e pautas editoriais, não limites da busca.
- **Busca lexical no banco.** Português sem acento/caixa, IDs normalizados, relevância explicável e "por que apareceu"; sem busca vetorial, LLM ou banco de grafos. A busca lê só o acervo local — nunca dispara importação ou chamada externa.
- **Fatos com prova.** Relação entre registros só aparece como fato quando a fonte a declara ou há correspondência documental revisada; semelhança de nome ou texto é candidato interno. Convidado não é participante, contratado não é pago, "não localizado" não é zero, aumento depois de uma lei não prova causa.
- **Entrega integral por tipo de dado.** Cada tipo novo ou ampliado entrega o pacote completo: fonte homologada, schema e permissões, importação e atualização, admin, limpeza, QA, cobertura, lacunas, sinais quando aplicáveis, busca, página acessível pelos hubs Congresso/Câmara/Senado, documentação e rodada real. Só tabela, importer ou item de menu não contam como suportado.
- **Escopo legislativo federal.** Fora: legislação estadual/municipal completa, redes sociais, transcrição de vídeos, ranking de parlamentares, detecção de fraude por IA e atribuição causal automática de gasto a lei.

| Versão  | Frente e entrega                                       | Páginas novas                                                                                                        | Critério central de aceite                                                                                                                                                                                                             |
| ------- | ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| v0.14.0 | 1 — UX de `/buscar` sobre as coleções atuais           | —                                                                                                                    | Visão geral com categorias colapsáveis e 3 prévias; categoria única paginada (20/50/100); facetas e contagens calculadas no servidor sobre todo o resultado; estado na URL; erro parcial visível; mobile, teclado e 320 px.            |
| v0.15.0 | 2 — Cobertura de todo o acervo público existente       | —                                                                                                                    | Todos os tipos públicos já suportados na busca (parlamentares, CEAP/CEAPS, proposições, votos, dados eleitorais, órgãos/entes, SICONFI, artigos, sinais, ajuda), com destino direto até o sub-registro; diagnóstico da busca no admin. |
| v0.16.0 | 3 — Trajetórias legislativas nas duas Casas            | `/propostas/$id`, `/congresso/propostas`, `/admin/vinculos`                                                          | Metadados de 2019 em diante nas duas Casas; tramitação versionada, autoria estruturada, relações entre propostas; mesma proposta nas duas Casas só unida com prova; atualização alcança proposta antiga.                               |
| v0.17.0 | 3 — Debates, documentos, órgãos e participantes        | `/documentos/$id`, `/eventos/$id`, `/pessoas/$id`, `/organizacoes/$id`, listas de órgãos/eventos/documentos por Casa | Emendas ao texto, pareceres, requerimentos, comissões, audiências, discursos e CPIs; trecho pesquisado leva à versão e página exatas; OCR incompleto aparece como tal.                                                                 |
| v0.18.0 | 3 — Normas, versões, vetos e decisões                  | `/normas/$id`, `/congresso/normas`, `/congresso/votacoes`                                                            | Texto por dispositivo e versões quando a fonte oferece; vetos por item; comparação de duas versões; ausência de regulamento não vira omissão.                                                                                          |
| v0.19.0 | 3 — Sumários factuais e comparação de legislaturas     | `/congresso/legislaturas/$id`, `/congresso/comparar`                                                                 | 55ª e 56ª comparadas só nas dimensões comparáveis, 57ª marcada como parcial; toda contagem abre sua lista; sem nota de desempenho.                                                                                                     |
| v0.20.0 | 3 — Séries fiscais, arrecadação e orçamento            | `/series/$id`, `/orcamento`, `/orcamento/$id`                                                                        | Receita Federal, SIOP e SICONFI com unidade, edição e método; valor do gráfico chega à célula oficial; estimativa separada de observação.                                                                                              |
| v0.21.0 | 3 — Documentos de execução e vínculos financeiros      | `/despesas`, `/despesas/$id`                                                                                         | Empenho, liquidação e pagamento ligados a contratos, emendas e convênios só com chave documental; cadeia incompleta mostra onde para; fases nunca somadas entre si.                                                                    |
| v0.22.0 | 3 — Estudos externos, exportação e sínteses editoriais | —                                                                                                                    | Avaliações oficiais (CMAP, IFI, Ipea, órgãos de controle) pesquisáveis como documentos externos; exportação em CSV/Markdown com consulta, fontes e versões.                                                                            |

**Produção editorial:** 19 pautas de notas, tutoriais e mapas novos ou revisados, entregues junto com a funcionalidade que ensinam — da v0.14.0 ("Como pesquisar um assunto em várias fontes", "Da licitação ao contrato", "Por que uma busca sem resultados não encerra a investigação") à v0.22.0 ("Como investigar se uma lei alcançou seu objetivo"). Mapas reutilizam o Kit de prompts existente; sem editor paralelo de análises. Esta sequência substitui uma distribuição anterior (então numerada v0.13.0–v0.19.0) e separa UX e cobertura antes da expansão legislativa. Nenhuma release do programa foi iniciada.

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
