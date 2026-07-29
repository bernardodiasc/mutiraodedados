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
- **Os três tipos de sinal** (ver [qualidade-dados](./qualidade-dados.md)): planeje regras de **qualidade** (defeitos do dado), **lacunas** (ausências detectáveis) e, quando houver cruzamento possível, **sinais investigativos** — em `src/lib/data/<fonte>/qualidade.ts`, `lacunas.ts` e `investigativos.ts`. Fonte sem nenhum sinal planejado é sinal de escopo mal definido.
- Adicione um arquivo em `docs/fontes/<nova-fonte>.md` seguindo o padrão das fontes existentes.

## Antes de mergear — o "arsenal" completo da fonte

Uma fonte só está pronta quando entrega o arsenal completo, não só a importação:

- Página `/admin/dados` precisa expor a nova fonte (ver `AdminImportPanel`).
- Página `/cobertura` precisa enxergar (ajustar `cobertura-jobs.ts`).
- Rota pública correspondente existe e tem `head()` com metadados próprios.
- **Sinais implementados nos três tipos aplicáveis** e visíveis nas páginas públicas (não só no admin); sinais investigativos com `AvisoMetodologico`.
- **Regras explicadas em `/metodologia`** — toda regra que gera sinal tem explicação pública.
- **Materiais de apoio**: pelo menos um tutorial ou mapa investigativo que use a fonte, e uma nota de campo registrando o processo de integração (decisões, surpresas, limitações).
- Documentação atualizada: `fontes/<nova>.md`, link em `fontes/README.md`, domínio relacionado em `dominios/`.
- Skill em `.agents/skills/` quando a fonte tem operação própria (importação chunked, parsers por ano etc.), referenciando os docs — sem duplicar regra de negócio.
- Se introduziu conceito do mundo real novo (ex: novo tipo de transferência), adicione em `conceitos/`.

## Regras de ouro

- **Nunca chame API oficial direto do browser.** Sempre via server function.
- **Nunca importe sem log em `importacoes`.**
- **Sanitização é obrigatória** para qualquer campo livre.
- **Janela primeiro**: rejeite período fora antes de gastar request.