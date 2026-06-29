---
name: auditoria-cidada-fontes-dados
description: Diretrizes de criação, manutenção e monitoramento de fontes de dados no ecossistema da Auditoria Cidadã. Carregar ao criar novas tabelas cache, jobs de importação, regras de QA ou controles de limpeza de dados.
---

# Inclusão e Manutenção de Fontes de Dados

Para integrar ou manter qualquer fonte de dados no ecossistema (ex: contratos do Portal da Transparência, Câmara, Senado, PNCP, etc.), siga estritamente o ciclo de vida definido abaixo.

Consulte a documentação correspondente em:
- [`docs/importacao.md`](/docs/importacao.md) e [`docs/importacao.ia.md`](/docs/importacao.ia.md)
- [`docs/guia-nova-fonte.md`](/docs/guia-nova-fonte.md) e [`docs/guia-nova-fonte.ia.md`](/docs/guia-nova-fonte.ia.md)
- Fontes individuais: [`docs/fontes/`](/docs/fontes/)

---

## Ciclo de Vida da Fonte de Dados

### 1. Ingestão e Integração de APIs
- As chamadas para APIs oficiais devem ser feitas exclusivamente do lado do servidor via `createServerFn` e protegidas com `ensureAdmin`.
- Respeite a janela de disponibilidade configurada em `src/lib/data/janelas.ts` antes de gastar recursos de requisições.
- Utilize tratamentos de erros transitórios (retries com backoff em 429/5xx).
- Disponibilize filtros por datas, órgãos ou locais no formulário de importação localizado no painel admin `/admin/dados`.

### 2. Armazenamento, RLS e GRANTs
- Grave os dados normalizados em tabelas `<fonte>_<entidade>_cache` em blocos de até 200 registros.
- As tabelas de cache devem ter RLS ativa com permissão de leitura (`SELECT`) para perfis `anon` e `authenticated` e controle de escrita restrito a `service_role` (via server functions admin).

### 3. Sanitização de Informações Pessoais (LGPD)
- Campos de texto livre (objeto do contrato, justificativas) devem ser higienizados usando `sanitizarTextoPublico` de `src/lib/sanitize.ts` antes da gravação em cache para mascarar dados pessoais (CPF, e-mail, telefone, CEP).

### 4. Qualidade dos Dados (QA Findings e Anomalias)
- Implemente regras de verificação em `src/lib/data/qa.ts` (ex: valores zerados, datas no futuro) e registre falhas em `qa_findings` gerando flags de QA.
- Trate e gerencie esses registros nas páginas:
  - `/qualidade` e `/admin/qualidade` (painel de curadoria de inconformidades)
  - `/lacunas` (exposição de lacunas confirmadas)
  - `/anomalias` (padrões de gasto suspeitos sobre dados formalmente válidos)
  - `/transparencia-institucional` (relatórios agregados de conformidade)

### 5. Limpeza de Dados e Reset Seletivo
- Registre a fonte e suas tabelas filhas no catálogo `FONTES_LIMPEZA` de `src/lib/data/limpeza.ts`.
- Isso possibilita ao administrador limpar dados parciais ou restaurar o histórico a partir de `/admin/dados` (manutenção).

### 6. Auditabilidade e Histórico
- Toda importação realizada deve registrar logs na tabela `importacoes`.
- Apresente esse histórico nas interfaces:
  - `/admin/dados` (histórico de execuções de sincronização)
  - `/cobertura` (cruzamento de dados sincronizados por modalidade e período)

### 7. Monitoramento de Cobertura
- Adicione a fonte e suas tabelas-alvo em `src/lib/data/cobertura-jobs.ts`.
- Integre os contadores na tela pública `/cobertura` e na interface administrativa `/admin/dados` (cobertura) para acompanhar o andamento das varreduras em relação à totalidade de dados oficiais.
