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