---
name: auditoria-cidada-features-roadmap
description: Padrão para rastreamento de tarefas, correção de bugs e novas seções no Roadmap do projeto. Sempre carregar ao concluir qualquer feature ou alteração no código para gerar o bloco de dados de registro.
---

# Rastreamento de Features e Atualização de Roadmap

Toda modificação relevante no projeto — incluindo a inclusão de uma nova fonte de dados, a resolução de um bug crítico, ou a criação de uma nova seção visual no site — deve ser devidamente rastreada no Roadmap do Auditoria Cidadã.

Ao concluir e gerar qualquer alteração no código, você deve **obrigatoriamente** emitir no final da sua resposta um bloco JSON estruturado para o desenvolvedor copiar e colar manualmente na interface de administração `/admin/roadmap`.

---

## Formato do Bloco de Roadmap

```json
{
  "titulo": "Título Curto e Amigável (ex: Visualização de gastos da CEAP da Câmara)",
  "descricao": "Descreva a funcionalidade, tarefa ou problema corrigido do ponto de vista de quem usa o site. O que o cidadão pode fazer agora que não conseguia antes? Qual problema foi resolvido? Escreva em pt-BR simples, sem jargões técnicos.",
  "status": "concluido",
  "publico": true,
  "notas": "Notas técnicas para desenvolvedores e agentes de IA. Inclua: arquivos modificados (use links absolutos relativos à raiz do projeto e.g. /src), decisões de arquitetura, migrations aplicadas, e considerações de segurança/LGPD. Este campo é privado e não aparece nas páginas públicas."
}
```

## Diretrizes de Conteúdo

### `titulo`
Máximo 60 caracteres. Foque no impacto prático e no contexto cidadão.
- ✅ "Importação de contratos do Portal da Transparência"
- ✅ "Correção de valores truncados nos contratos da CGU"
- ❌ "Refatoração de componentes para o padrão Container/View"

### `descricao`
**Descreve a tarefa/funcionalidade/problema**, não a conclusão técnica do trabalho. Deve responder: *O que o cidadão, pesquisador ou administrador pode fazer agora? Qual problema deixa de existir?*
- ✅ "Permite que cidadãos visualizem e filtrem todos os contratos do Executivo Federal com dados de valor, vigência e fornecedor. Os valores são automaticamente verificados contra a fonte oficial para detectar divergências."
- ✅ "Corrige exibição de valores de contratos que apareciam incorretos (cerca de 10.000× menores que o real) por um bug na API da CGU. Os valores agora são cruzados com o endpoint de detalhe antes de serem armazenados."
- ❌ "Concluímos a migração dos padrões técnicos do projeto para a pasta pública de documentação e a refatoração de componentes legados para o modelo desacoplado Container/View/logic."

### `status`
- `"concluido"` — para a maioria das entregas.
- `"em_andamento"` — para entregas parciais (ex: importação funcionando, mas UI ainda incompleta).
- `"planejado"` — para registrar intenções futuras.

### `publico`
- `true` — para qualquer coisa que impacte a experiência do cidadão ou pesquisador.
- `false` — exclusivo para melhorias internas de infraestrutura sem impacto visível para o usuário final.

### `notas`
Campo técnico interno. Inclua:
- Arquivos criados ou modificados (use links absolutos relativos à raiz do projeto e.g. `/src`)
- Migrations aplicadas
- Componentes refatorados
- Regras de QA adicionadas
- Considerações de segurança (LGPD, RLS, autenticação)
