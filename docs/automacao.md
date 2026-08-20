# Automação periódica das importações

Desde a v0.11.0 as importações podem rodar sem operador. O desenho tem três peças, e a regra que as une: **o agendador é só mais um gatilho** — as rodadas são exatamente as do painel (mesmos núcleos, mesmo orçamento, mesma retomada, mesmo Histórico; `user_id` nulo marca rodada sem operador).

## As peças

1. **Rota `/api/cron-importar`** (POST) — interceptada em `src/server.ts`, antes do framework. Exige o header `x-cron-secret` igual ao secret `CRON_SECRET` do ambiente; sem o secret configurado, responde 401 para tudo (desligada por padrão). Cada chamada reivindica a próxima tarefa da fila, executa **uma rodada com orçamento** e devolve `{tarefa, importados, haMais}`.
2. **Fila `automacao_tarefas`** — declarativa, semeada pela migration com a rotação v1 (PNCP, convênios, CEAP, CEAPS, votações das duas casas, matérias, proposições, origem SICONV, IBGE). `ativo` liga/desliga por tarefa; `params` guarda escolhas (ex.: sigla das matérias); o claim usa `FOR UPDATE SKIP LOCKED` com lock que expira em 15 minutos. As janeladas importam sempre o **mês corrente (UTC)** — o mês anterior foi varrido nos tiques dele, e a coluna Resultado sabe ler zero de período recente.
3. **Agendador `pg_cron` + `pg_net`** — um tique a cada 5 minutos, que só dispara quando `automacao_config` (service_role only) tem linha ativa com a URL do site e o mesmo segredo. **Nada disso vive no repositório.**

## Ativação (papel do mantenedor)

1. Criar o secret **`CRON_SECRET`** no painel do Lovable Cloud (mesmo caminho dos demais secrets), com um valor longo e aleatório.
2. Inserir a config no banco (SQL no editor do Supabase/Lovable):

   ```sql
   INSERT INTO automacao_config (url, segredo)
   VALUES ('https://mutiraodedados.com.br', '<o mesmo valor de CRON_SECRET>');
   ```

3. Conferir: em ~5 min, `SELECT * FROM automacao_tarefas ORDER BY ultima_execucao DESC NULLS LAST;` deve mostrar `ultimo_resultado` preenchendo. Cada tique também grava a linha de rodada normal no Histórico de `/admin/dados`.

Para **pausar tudo**: `UPDATE automacao_config SET ativo = false;`. Uma tarefa só: `UPDATE automacao_tarefas SET ativo = false WHERE id = '...';`.

## Alternativa sem pg_cron (ex.: Make)

Qualquer agendador externo funciona: um cenário que faça `POST https://mutiraodedados.com.br/api/cron-importar` com o header `x-cron-secret` a cada N minutos. A resposta traz `haMais` — o cenário pode repetir a chamada até `false` se quiser esvaziar uma fonte no mesmo dia.

## Concorrência e limites

- Dois tiques simultâneos nunca pegam a mesma tarefa (SKIP LOCKED); um tique que morrer solta a tarefa em 15 min.
- Rodada manual do admin em paralelo é tolerada por desenho: upserts idempotentes + checkpoint por chave → o pior caso é trabalho repetido, nunca corrupção.
- Fora da rotação v1 (documentado, rodada de ajustes): SICONFI (varredura por conjunto de entes) e CGU contratos/licitações/emendas por órgão — exigem rotação própria de alvos.
