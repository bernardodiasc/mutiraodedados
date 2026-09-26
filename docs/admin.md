# Painel admin

Acesso em `/admin`. Restrito a usuários com papel `admin` em `user_roles`. O primeiro usuário a se cadastrar vira admin automaticamente; admins subsequentes precisam ser promovidos via banco.

## Layout

- `src/routes/_authenticated.tsx` — exige sessão; redireciona para `/login`.
- `src/components/AdminNav.tsx` — barra de navegação entre as abas do admin.
- `src/lib/admin-guard.ts` — `ensureAdminBeforeLoad` confere o papel antes de renderizar.

## Abas

### `/admin` — Dashboard

Atalhos para as outras seções e visão rápida do estado da ingestão.

### `/admin/dados` — Ingestão

Tela principal de importação. Componente: `AdminImportPanel`. Permite disparar ingestão por fonte, intervalo de datas e filtros (UF, IBGE, órgão). Cada fonte aparece como uma seção própria — veja [`importacao.md`](./importacao.md) para o fluxo comum.

A aba **Histórico** lista as linhas de rodada de `importacoes`, da mais recente para a mais antiga, com o [gatilho](./importacao.md#gatilho-e-execução) de cada uma e, na última rodada de uma execução, o veredito da conferência com o motivo. Os filtros do topo são aplicados no servidor (a rolagem continua carregando páginas do mesmo recorte) e ficam na URL, então um link já abre o Histórico filtrado:

| Parâmetro     | Valores                                                                  |
| ------------- | ------------------------------------------------------------------------ |
| `fonte`       | id da fonte em `importacoes.fonte` (ex.: `camara_vot`)                   |
| `gatilho`     | `painel`, `cron` ou `ferramenta`                                         |
| `resultado`   | classificação da rodada (ex.: `erro_nosso`, `erro_origem`, `sem_dados`)  |
| `conferencia` | `aprovada`, `inconclusiva` ou `reprovada` (`conferencia->>estado`)       |
| `de` / `ate`  | período de `consultado_em`, `AAAA-MM-DD`, dias de Brasília, fim incluído |
| `execucao`    | `execucao_id` da janela pedida pela ferramenta                           |
| `parada`      | motivo de parada: `fim`, `tempo`, `subrequisicoes`, `erro` ou `passos`   |

Cada linha de rodada mostra também as [métricas de desempenho](./importacao.md#métricas-da-rodada): duração, itens, itens por segundo (derivado na tela), subrequisições e motivo de parada. Linhas anteriores a essas colunas, e as linhas por consulta do SICONFI, mostram "—". Acima da tabela, um **resumo do recorte** soma as métricas de todas as rodadas que passam nos filtros (não só das carregadas) e dá a média por rodada, os itens por segundo do recorte e quantas rodadas pararam por cada motivo — filtre a fonte e o período para comparar antes × depois. O resumo vem da função `resumo_historico_importacoes`, com os mesmos filtros da listagem.

Exemplo: `/admin/dados?fonte=camara_vot&execucao=<uuid>` mostra todas as rodadas daquela janela. Valor desconhecido é ignorado; um link com filtros abre direto na aba Histórico. A lógica fica em `src/lib/admin-import/historico-filtros.ts`.

### `/admin/qualidade` — Curadoria de QA

Lista todos os `qa_findings`. Permite marcar como `falso_positivo`, `resolvido` ou anotar resposta do canal oficial. Detalhado em [`qualidade-dados.md`](./qualidade-dados.md).

### `/admin/sinais` — Anomalias

Gestão dos sinais investigativos detectados sobre dados corretos (ex: fracionamento, concentração de fornecedor). Diferente de QA — aqui o dado oficial está certo, mas o **padrão** é suspeito. Ver [`dominios/anomalias-e-sinais.md`](./dominios/anomalias-e-sinais.md).

### `/admin/artigos` — Editor editorial

Editor Markdown para criar/editar mapas, tutoriais e notas. Toca tabela `artigos`. Slug amigável é usado nas rotas públicas `/mapas/$slug`, `/tutoriais/$slug`, `/notas/$slug`.

### `/admin/prompts` — Prompts do Kit

CRUD dos prompts do Kit de investigação (`prompt_modelos`) e vínculo N:N com mapas (`mapa_prompts`). Um prompt só aparece no site quando está `ativo` **e** vinculado a um mapa público.

Cada variável do prompt (`{{var}}`) é editada aqui com **nome**, **dica** de preenchimento e **link interno** para onde colher o dado. Esse link deve apontar para a página que os passos daquele mapa indicam (ex.: `/emendas` no mapa das emendas, `/camara/deputados` na cota parlamentar) — não há catálogo hardcoded no código; tudo se ajusta por esta tela. Ver [`dominios/laboratorio-civico.md`](./dominios/laboratorio-civico.md).

### `/admin/marcacoes` — Moderação

Modera contribuições da comunidade (marcações em registros pelos usuários).

### `/admin/analises` — Análises

Espaço para análises editoriais cruzando dados de várias fontes.

### `/admin/roadmap` — Roadmap público

Gestão dos itens visíveis em `/roadmap`.

## Área do usuário (não-admin)

- `/minhas-marcacoes` — registros que o usuário marcou para acompanhar.

## Importante

- Toda escrita em caches/tabelas operacionais passa por server function admin — usuários comuns só leem (RLS).
- Logs de ingestão (`importacoes`) ficam públicos por princípio de transparência.
