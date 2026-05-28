UPDATE public.artigos
SET conteudo_md = replace(
      replace(
        conteudo_md,
        '- **Convênios**: ingerimos do espelho CGU (`/convenios`) e armazenamos em `transferegov_instrumentos_cache`. A página é [Transferências da União](/transferencias).',
        '- **Convênios e contratos de repasse**: ingerimos do espelho CGU (`/convenios`) e armazenamos em `transferegov_instrumentos_cache`. A página é [Convênios](/convenios).'
      ),
      '- **Transferências Especiais** e **Finalidade Definida**: ingerimos direto da **API oficial do Transferegov** e armazenamos em `transferegov_emendas_cache`, com modalidade discriminada. Páginas: [Especiais](/transferencias/especiais) e [Finalidade Definida](/transferencias/finalidade).',
      '- **Transferências diretas (EC 105)** — Especiais (livre aplicação) e com Finalidade Definida (carimbadas): ingerimos da **API oficial do Transferegov** (Especiais) e do **Portal da Transparência** (Finalidade Definida), armazenando ambas em `transferegov_emendas_cache` com a modalidade discriminada. As duas convivem na mesma [página de Transferências diretas](/transferencias), com filtro por modalidade e distinção visual por cor.'
    ),
    updated_at = now()
WHERE slug = 'transferegov';