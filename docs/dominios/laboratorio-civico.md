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

| Rota                  | Quem vê       | O que faz                                                                                     |
| --------------------- | ------------- | --------------------------------------------------------------------------------------------- |
| `/perguntas`          | Público       | Modelos curados + investigações publicadas.                                                   |
| `/perguntas/$slug`    | Público       | Página da investigação publicada (sem expor autor).                                           |
| `/caderno`            | Usuário       | Lista de perguntas do usuário + itens salvos + anotações soltas.                              |
| `/caderno/$id`        | Autor/admin   | Pasta de investigação (itens, ações solicitar publicação / encerrar / arquivar / excluir).    |
| `/caderno/nova`       | Usuário       | Cria pergunta em branco ou a partir de modelo (`?modelo=<id>`).                               |
| `/admin/perguntas`    | Admin         | Modelos (CRUD) e Moderação (em_revisao → publicada/privada).                                  |
| `/lacunas`            | Público       | Mapa público de informações que faltam.                                                       |
| `/afirmacoes`         | Público       | Conteúdo editorial curado.                                                                    |
| `/trilhas`            | Público       | Trilhas guiadas de investigação.                                                              |

## Componentes transversais

- `BotaoSalvarPergunta` — adiciona uma pergunta ao caderno (requer login).
- `BotaoSalvarItem` — salva um item polimórfico (órgão, contrato, etc.) no caderno.
- `AnotacoesCaderno` — CRUD de anotações em markdown (reaproveita `RichTextEditor`).
- `BlocoLacuna` / `BlocoRastreabilidade` / `RodapeInvestigativo` — blocos de página de detalhe.
- `PainelModosLeitura` — leituras alternativas curadas (causal, epistemológica, etc.).

## Server functions

Por domínio (em `src/lib/`):

- `pergunta-modelos.functions.ts` — `listarModelosAtivos`, `obterModelo` (público); `listarTodosModelos`, `criarModelo`, `atualizarModelo`, `excluirModelo` (admin).
- `perguntas.functions.ts` — `criarPergunta`, `listarMinhasPerguntas`, `obterPergunta`, `atualizarPergunta`, `excluirPergunta`, `solicitarPublicacao`, `arquivarPergunta`, `reabrirPergunta`, `encerrarPergunta`; `listarPerguntasPublicas`, `obterPerguntaPublica` (público); `listarPerguntasEmRevisao`, `aprovarPergunta`, `rejeitarPergunta`, `despublicarPergunta` (admin).
- `pergunta-itens.functions.ts` — `listarItensDaPergunta`, `adicionarItem`, `removerItem`; `listarItensPublicos` (público).
- `itens-salvos.functions.ts` — `salvarItem`, `listarMeusItens`, `verificarItemSalvo`, `excluirItem` (suporta tipo `fornecedor`).
- `anotacoes.functions.ts` — `criarAnotacao`, `atualizarAnotacao`, `listarMinhasAnotacoes`, `excluirAnotacao` (com `pergunta_id` opcional).
- `lacunas.functions.ts` — `listarLacunasPublicas`, `criarLacuna`, `atualizarLacuna`, `converterFindingEmLacuna` (admin).

Tudo usa `createServerFn` + `requireSupabaseAuth` quando exige sessão. Páginas públicas usam o publishable client. Esquema das tabelas em [`modelo-dados.ia.md`](../modelo-dados.ia.md).

## Como lacunas nascem

- **Automaticamente:** trigger `tg_qa_findings_lacuna` cria uma lacuna sempre que um `qa_finding` chega ao estado `severidade='critico' AND status='confirmado'`. O vínculo fica em `lacunas.origem_qa_finding_id` (1:1 — não duplica).
- **Manualmente:** admin converte findings de severidade `aviso` ou outros estados via `/admin/lacunas` (server fn `converterFindingEmLacuna`).

Critérios resumidos:

| Severidade do finding | Status                | Vira lacuna?                  |
| --------------------- | --------------------- | ----------------------------- |
| `critico`             | `confirmado`          | **Sim, automaticamente**      |
| `critico`             | `aberto` ou outro     | Não — admin pode promover     |
| `aviso` ou inferior   | qualquer              | Não — admin pode promover     |

## Vocabulário cidadão

A UI usa rótulos cidadãos; o código mantém o termo técnico (ver `.lovable/plan.md`, seção 5).

| Código        | UI                                       |
| ------------- | ---------------------------------------- |
| Evidência     | Fonte / O que comprova                   |
| Lacuna        | Informação que falta                     |
| Afirmação     | O que foi prometido / declarado          |
| Investigação  | Caderno de investigação                  |
| Visibilidade  | Privado / Com link / Público             |

## Princípios

Toda extensão deste módulo deve passar nos três testes da seção 14.8 do plano:

1. Ajuda a formular uma pergunta melhor?
2. Ajuda a reunir ou compreender evidências?
3. Ajuda a preservar a memória pública?