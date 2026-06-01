# Guia: adicionar uma nova fonte

Checklist humano antes de mexer em código. O passo-a-passo técnico está em [`guia-nova-fonte.ia.md`](./guia-nova-fonte.ia.md).

## Antes de codar

1. **A fonte é oficial e estável?** Preferimos APIs governamentais com SLA público. Raspagem (scraping) só como último recurso.
2. **Qual é a janela de disponibilidade?** Desde que ano os dados existem? Há lacunas conhecidas?
3. **Precisa de chave de API?** Se sim, registre o nome da env var (padrão: `<FONTE>_API_KEY`).
4. **Quais entidades vamos importar?** Lista enxuta — só o que tem domínio claro no site.
5. **Para que página(s) pública(s) vai servir?** Se não tem rota planejada, não importe ainda.
6. **Como o cidadão denuncia um erro?** Fala.BR, SIC, suporte específico? Vai virar entrada em `qa-canais.ts`.
7. **Há PII em algum campo livre?** Se sim, confirmar que `sanitizarTextoPublico` cobre ou adicionar regra.

## Durante a implementação

- Crie a pasta `src/lib/data/<fonte>/`.
- Server function de ingestão sempre usa `requireSupabaseAuth` + `ensureAdmin`.
- Use o cliente compartilhado `portal-client.ts` apenas se a API for compatível (mesma autenticação CGU). Caso contrário, crie cliente próprio com mesmo padrão de retry.
- Adicione a fonte em `src/lib/data/janelas.ts` com o ano de início.
- Crie regras de QA correspondentes em `src/lib/data/qa.ts`.
- Adicione um arquivo em `docs/fontes/<nova-fonte>.md` seguindo o padrão das fontes existentes.

## Antes de mergear

- Página `/admin/dados` precisa expor a nova fonte (ver `AdminImportPanel`).
- Página `/cobertura` precisa enxergar (ajustar `cobertura-jobs.ts`).
- Rota pública correspondente existe e tem `head()` com metadados próprios.
- Documentação atualizada: `fontes/<nova>.md`, link em `fontes/README.md`, domínio relacionado em `dominios/`.
- Se introduziu conceito do mundo real novo (ex: novo tipo de transferência), adicione em `conceitos/`.

## Regras de ouro

- **Nunca chame API oficial direto do browser.** Sempre via server function.
- **Nunca importe sem log em `importacoes`.**
- **Sanitização é obrigatória** para qualquer campo livre.
- **Janela primeiro**: rejeite período fora antes de gastar request.