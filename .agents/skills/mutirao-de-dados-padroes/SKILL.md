---
name: mutirao-de-dados-padroes
description: Padrões obrigatórios de desenvolvimento do Mutirão de Dados (Container/View/logic, server functions, migrations, rotas, design tokens, pt-BR cidadão). Carregar ao criar/modificar componentes, server functions, migrations ou rotas.
---

# Padrões do projeto Mutirão de Dados

Este projeto segue diretrizes de design, arquitetura e banco de dados específicas para manter o código testável, o style guide vivo e a semântica compreensível pelo cidadão comum.

As diretrizes detalhadas foram extraídas para a pasta `docs/padroes/` do repositório, garantindo compatibilidade multiplataforma (Claude Code, Cursor e Antigravity).

## Referências Obrigatórias

Sempre que atuar em código ou estrutura do projeto, consulte a documentação aplicável:

- **Arquitetura Container × View × logic.ts**:
  Consulte [container-view-logic.md](/docs/padroes/container-view-logic.md) para o template canônico, casos de formulário e regras de desacoplamento de I/O de componentes apresentacionais.

- **Server Functions (`createServerFn`)**:
  Consulte [server-functions.md](/docs/padroes/server-functions.md) para saber como construir endpoints seguros utilizando autenticação via middleware, validação com Zod e tratamento de erros cidadãos.

- **Banco de Dados (Migrations, RLS e GRANTs)**:
  Consulte [migrations.md](/docs/padroes/migrations.md) para o template de tabelas operacionais e públicas, políticas RLS de usuário/admin e tratamento de permissões (`GRANT`).

- **Diretrizes Gerais**:
  Consulte [desenvolvimento.md](/docs/padroes/desenvolvimento.md) para padrões de roteamento TanStack Start (metadados e loaders), design tokens e cores semânticas da interface, vocabulário pt-BR cidadão recomendado, antipadrões comuns e o checklist de features prontas.
