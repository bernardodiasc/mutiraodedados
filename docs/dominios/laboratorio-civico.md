# Laboratório cívico — perguntas, caderno, lacunas

Conjunto de páginas e tabelas que materializam o núcleo do projeto: **perguntas, evidências e memória** (ver `.lovable/plan.md`, seção 2). Implementa os modos **Perguntar** e **Investigar**.

## Pergunta como pasta de investigação

Uma **pergunta** é a unidade organizadora do caderno. Toda pergunta:

- nasce **privada** dentro do caderno de um usuário;
- reúne **itens** (contratos, órgãos, fornecedores, lacunas, links, anotações);
- pode permanecer privada indefinidamente;
- pode ser **publicada** (após revisão do admin) sem expor o autor;
- pode ser **encerrada** depois de publicada — vira memória pública;
- pode ser **arquivada** quando ainda é privada — sai do caderno ativo.

Um **modelo de pergunta** (`pergunta_modelos`) é um ponto de partida curado pelo admin. Não pertence a usuário, não tem estado, não vira pública. Ao usar um modelo, criamos uma **pergunta nova** no caderno do usuário, copiando título e contexto.

## Kit de investigação (mapas → prompts)

O projeto **não embute LLM** (por custo): a experiência é levar o cidadão até onde os dados estão e deixá-lo **copiar dados / baixar CSV / ir à fonte oficial** para colar na _própria IA_.

- Um **mapa** (artigo `categoria='mapa'`) é um procedimento investigativo reutilizável: os passos dizem _onde colher os dados_, por links internos e externos.
- O **Kit** é o painel lateral que aparece só em mapas (`KitInvestigacao`). Rola junto com a página (não é sticky, porque é alto). No topo: "Copiar texto do mapa", "Adicionar ao caderno" e links para **Meu caderno** e para as **pastas em uso** (as perguntas do usuário que já contêm prompts deste mapa — `listarPastasComPrompts`).
- Cada prompt é **collapsible**: ao abrir mostra a descrição, a lista **"O que preencher"**, o **texto do prompt visível** e os botões "Copiar prompt" / "Adicionar ao caderno".
- Um **prompt** (`prompt_modelos`) é um objetivo com placeholders `{{var}}` que o cidadão preenche com o que colheu. Vários prompts servem a um mapa e um prompt serve a vários mapas (N:N via `mapa_prompts`).
- Primitivos são **contextuais**: `BotaoCopiar` onde há texto/dados copiáveis; `BotaoBaixarCsv` só onde há tabela; `BotaoFonteOficial` em registros com origem oficial; `BotaoSalvarItem` em entidades, artigos e prompts. Não vivem no texto do mapa — vivem nas páginas de destino.

### Regra: o Kit precisa fazer sentido com o mapa (e é editável, não hardcoded)

Cada variável do prompt vive em `prompt_modelos.variaveis` (**jsonb**), carregando os próprios metadados: `{ nome, dica?, href?, hrefLabel? }`. O `href` é uma **rota interna** (começa com `/`) apontando para **a página que os passos daquele mapa mandam usar** — ex.: no mapa das emendas o `cole_o_csv` aponta para `/emendas`; no mapa da cota parlamentar, para `/camara/deputados`. A mesma variável pode ter link diferente em mapas diferentes, porque o metadado é por-prompt, não global.

- **Toda a edição de dica/link acontece em `/admin/prompts`** — nunca no código. Não há catálogo hardcoded de variáveis.
- `src/lib/kit-investigacao/logic.ts` só **normaliza** (rótulo humanizado, dica padrão, descarta link externo) e tolera o formato legado (array de strings). Não guarda conhecimento de domínio.
- Ao criar/editar um prompt, confira que cada link leva à página onde aquele dado é colhido **naquele mapa**. Vale para os mapas atuais e para qualquer mapa futuro.

## Caderno como bancada de composição

A pasta acumula **itens heterogêneos** (mapas, artigos, prompts, entidades, buscas). Na página da pasta o cidadão marca o que quer e **"Copiar selecionados"** monta um único texto para a IA, na ordem **procedimento → dados → prompt** (`caderno-composicao.functions.ts`).

- **Salvar uma busca filtrada** (`BotaoSalvarBusca`, tipo `busca`): a lista com o filtro ativo vira um **link dinâmico** no caderno, sem cópia dos dados. Pré-requisito: filtros na URL (`validateSearch` + `Route.useSearch()` + `navigate({ search })`) — feito em `emendas`, `licitacoes`, `convenios`, `camara_.deputados`, `senado_.senadores`.
- **Snapshot de prova + detecção de mudança**: ao salvar uma entidade, guarda-se uma cópia canônica dos dados (`conteudo_snapshot` + `snapshot_hash`). "Verificar mudança" re-busca o dado ao vivo (dispatcher por tipo: `contrato`, `emenda`, `convenio`, `licitacao`) e compara pelo hash; divergência marca o item **sem** substituir a prova — só "Atualizar snapshot" (ação explícita) troca. `fornecedor`/`orgao` não são verificáveis (montados no data-store do cliente, sem fn por id).

### Estados (`pergunta_status`)

```
privada ──[solicitar publicação]──▶ em_revisao
em_revisao ──[admin aprovar]──▶ publicada      (visibilidade_publica=true)
em_revisao ──[admin rejeitar]──▶ privada        (com motivo_rejeicao)
publicada ──[admin despublicar]──▶ privada      (visibilidade_publica=false)
publicada ──[autor/admin encerrar]──▶ encerrada (continua pública; memória)
privada ──[autor arquivar]──▶ arquivada         (fora do caderno ativo)
arquivada ──[autor reabrir]──▶ privada
```

- **Arquivar** = pessoal (a pergunta nunca foi pública).
- **Encerrar** = editorial (a investigação terminou, continua acessível em `/perguntas/$slug`).

## Páginas

| Rota               | Quem vê     | O que faz                                                                                  |
| ------------------ | ----------- | ------------------------------------------------------------------------------------------ |
| `/perguntas`       | Público     | Modelos curados + investigações publicadas.                                                |
| `/perguntas/$slug` | Público     | Página da investigação publicada (sem expor autor).                                        |
| `/caderno`         | Usuário     | Lista de perguntas do usuário + itens salvos + anotações soltas.                           |
| `/caderno/$id`     | Autor/admin | Pasta de investigação (itens, ações solicitar publicação / encerrar / arquivar / excluir). |
| `/caderno/nova`    | Usuário     | Cria pergunta em branco ou a partir de modelo (`?modelo=<id>`).                            |
| `/admin/perguntas` | Admin       | Modelos (CRUD) e Moderação (em_revisao → publicada/privada).                               |
| `/admin/prompts`   | Admin       | CRUD de prompts do Kit e vínculo N:N com mapas.                                            |
| `/lacunas`         | Público     | Mapa público de informações que faltam.                                                    |
| `/afirmacoes`      | Público     | Conteúdo editorial curado.                                                                 |
| `/trilhas`         | Público     | Trilhas guiadas de investigação.                                                           |

## Componentes transversais

- `BotaoSalvarPergunta` — adiciona uma pergunta ao caderno (requer login).
- `BotaoSalvarItem` — salva um item polimórfico (órgão, contrato, etc.) no caderno; prop `snapshotDe` grava o snapshot de prova.
- `BotaoSalvarBusca` — salva a lista filtrada como link dinâmico (tipo `busca`).
- `BotaoCopiar` / `BotaoBaixarCsv` / `BotaoFonteOficial` — primitivos contextuais (ver style guide, grupo Primitivos → "Botões de ação (Kit)").
- `KitInvestigacao` — painel lateral dos mapas (procedimento + prompts).
- `AnotacoesCaderno` — CRUD de anotações em markdown (reaproveita `RichTextEditor`).
- `BlocoLacuna` / `BlocoRastreabilidade` / `RodapeInvestigativo` — blocos de página de detalhe.
- `PainelModosLeitura` — leituras alternativas curadas (causal, epistemológica, etc.).

## Server functions

Por domínio (em `src/lib/`):

- `pergunta-modelos.functions.ts` — `listarModelosAtivos`, `obterModelo` (público); `listarTodosModelos`, `criarModelo`, `atualizarModelo`, `excluirModelo` (admin).
- `prompt-modelos.functions.ts` — `listarPromptsDoMapa` (público); `listarTodosPrompts`, `criarPrompt`, `atualizarPrompt`, `excluirPrompt`, `vincularPrompt`, `desvincularPrompt`, `listarVinculosAdmin` (admin).
- `caderno-composicao.functions.ts` — `montarComposicaoDaPasta` ("Copiar selecionados": resolve artigos por slug e prompts por id, injeta snapshots das entidades salvas).
- `perguntas.functions.ts` — `criarPergunta`, `listarMinhasPerguntas`, `obterPergunta`, `atualizarPergunta`, `excluirPergunta`, `solicitarPublicacao`, `arquivarPergunta`, `reabrirPergunta`, `encerrarPergunta`; `listarPerguntasPublicas`, `obterPerguntaPublica` (público); `listarPerguntasEmRevisao`, `aprovarPergunta`, `rejeitarPergunta`, `despublicarPergunta` (admin).
- `pergunta-itens.functions.ts` — `listarItensDaPergunta`, `adicionarItem`, `removerItem`, `listarPastasComPrompts` (pastas do usuário que contêm dados prompts); `listarItensPublicos` (público).
- `itens-salvos.functions.ts` — `salvarItem` (grava snapshot canônico opcional), `listarMeusItens`, `verificarItemSalvo`, `verificarSnapshotItem` (re-busca ao vivo e compara pelo hash), `excluirItem`.
- `anotacoes.functions.ts` — `criarAnotacao`, `atualizarAnotacao`, `listarMinhasAnotacoes`, `excluirAnotacao` (com `pergunta_id` opcional).
- `lacunas.functions.ts` — `listarLacunasPublicas`, `criarLacuna`, `atualizarLacuna`, `converterFindingEmLacuna` (admin).

Tudo usa `createServerFn` + `requireSupabaseAuth` quando exige sessão. Páginas públicas usam o publishable client. Esquema das tabelas em [`modelo-dados.ia.md`](../modelo-dados.ia.md).

## Como lacunas nascem

Na [taxonomia dos três tipos de sinal](../qualidade-dados.md), **lacuna** é a ausência detectável: algo que deveria existir segundo a regra de negócio ou a lei, mas não é encontrado na fonte. A detecção automática grava um finding `tipo='lacuna'` em `qa_findings`; a tabela `lacunas` deste módulo é a camada **curada** (editorial, com ciclo próprio) construída a partir desses findings ou manualmente.

- **Automaticamente:** trigger `tg_qa_findings_lacuna` cria uma lacuna sempre que um `qa_finding` chega ao estado `severidade='critico' AND status='confirmado'`. O vínculo fica em `lacunas.origem_qa_finding_id` (1:1 — não duplica).
- **Manualmente:** admin converte findings de severidade `aviso` ou outros estados via `/admin/lacunas` (server fn `converterFindingEmLacuna`).

Critérios resumidos:

| Severidade do finding | Status            | Vira lacuna?              |
| --------------------- | ----------------- | ------------------------- |
| `critico`             | `confirmado`      | **Sim, automaticamente**  |
| `critico`             | `aberto` ou outro | Não — admin pode promover |
| `aviso` ou inferior   | qualquer          | Não — admin pode promover |

## Vocabulário cidadão

A UI usa rótulos cidadãos; o código mantém o termo técnico (ver `.lovable/plan.md`, seção 5).

| Código       | UI                              |
| ------------ | ------------------------------- |
| Evidência    | Fonte / O que comprova          |
| Lacuna       | Informação que falta            |
| Afirmação    | O que foi prometido / declarado |
| Investigação | Caderno de investigação         |
| Visibilidade | Privado / Com link / Público    |

## Princípios

Toda extensão deste módulo deve passar nos três testes da seção 14.8 do plano:

1. Ajuda a formular uma pergunta melhor?
2. Ajuda a reunir ou compreender evidências?
3. Ajuda a preservar a memória pública?
