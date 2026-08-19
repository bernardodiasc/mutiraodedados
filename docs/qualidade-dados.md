# Qualidade de dados

Nem todo dado oficial é confiável. O sistema detecta inconsistências e as expõe na página [`/qualidade`](https://mutiraodedados.com.br/qualidade).

## Os três tipos de sinal (taxonomia normativa)

Tudo o que a plataforma detecta automaticamente é um **sinal**, e todo sinal pertence a exatamente um de três tipos. Esta seção é a definição canônica — código, docs e skills referenciam daqui, nunca duplicam.

| Tipo                                      | O que é                                                                                                                                                                                                                             | Exemplos                                                                                                                                                                                     |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Alerta de qualidade** (`qualidade`)     | Defeito **técnico** do dado ou da importação. Diz respeito à integridade do dado em si, não ao seu significado.                                                                                                                     | CPF/CNPJ com dígito verificador inválido; valor negativo onde é impossível; data absurda; campo obrigatório vazio; sentinela (`#NULO#`, `-1`) vazando; duplicata no lote; encoding quebrado. |
| **Lacuna** (`lacuna`)                     | Ausência **detectável**: algo que _deveria existir_ segundo a regra de negócio ou a lei, mas **não é encontrado** na fonte.                                                                                                         | Eleito sem prestação de contas final; candidato sem declaração de bens obrigatória; ano/UF faltando na série histórica; órgão sem relatório fiscal do exercício.                             |
| **Sinal investigativo** (`investigativo`) | **Padrão detectável por cruzamento** de dados (entre tabelas, fontes ou anos). Não é defeito nem ausência — os dados estão corretos e completos, mas o cruzamento revela um padrão que merece atenção humana. **Nunca é acusação.** | Doador de campanha que vira fornecedor de contrato/emenda do mesmo parlamentar; evolução patrimonial atípica entre eleições; fornecedor que concentra as despesas de muitos candidatos.      |

**Regra de classificação:** se a detecção depende de **cruzar dados** (entre tabelas, fontes ou anos), é **sinal investigativo**. Se depende de verificar que algo esperado **não existe**, é **lacuna**. Se depende só de inspecionar o **próprio registro** (ou o lote de importação), é **alerta de qualidade**.

No banco, os três tipos moram na tabela `qa_findings`, distinguidos pela coluna `tipo` (`'qualidade' | 'lacuna' | 'investigativo'`, default `'qualidade'`).

> **Por que uma coluna, e não três tabelas?** O schema já tinha `qa_findings` (achados heurísticos) e `lacunas` (curadoria editorial de "informações que faltam", com ciclo próprio — ver [laboratório cívico](./dominios/laboratorio-civico.md)); a tabela `anomalias` citada em versões antigas dos docs nunca existiu (os sinais de contratos eram derivados em memória). A coluna `tipo` mantém o pipeline único (`flagQA`, revalidação, canais de denúncia, admin) para os três tipos. **Lacunas detectadas** nascem como finding `tipo='lacuna'` e podem ser **promovidas** à tabela `lacunas` (curadoria pública) pelo fluxo existente `converterFindingEmLacuna` — as duas coisas não se confundem: o finding é a detecção; a lacuna curada é o item editorial.

Sinais investigativos exigem sempre `AvisoMetodologico` na exposição pública: o padrão detectado não é irregularidade por si só.

## Campos do achado

Todo sinal vira um registro na tabela `qa_findings`, com:

- **Tipo**: `qualidade`, `lacuna` ou `investigativo` (ver taxonomia acima).
- **Severidade**:
  - `critico` — divergência confirmada ou erro grave (ex: valor mil vezes maior que outras fontes).
  - `aviso` — suspeita que precisa de verificação humana (ex: valor abaixo de R$ 100 num contrato). Sinais investigativos nascem sempre como `aviso`.
  - `info` — nota informativa, sem indicar erro.
- **Origem**:
  - `heuristica` — gerado por regra automática durante a ingestão.
  - `denuncia` — registrado por cidadão a partir do site.
- **Status**:
  - `aberto` — pendente de análise.
  - `corrigido_origem` — a fonte oficial corrigiu.
  - `falso_positivo` — análise humana descartou.
  - `resolvido` — encaminhado ao canal oficial e respondido.

## Página pública `/qualidade`

Lista todos os achados visíveis ao público. Cada item mostra:

- O que foi detectado (regra + evidência).
- Link para o registro afetado no próprio site (ex: `/contratos/123`).
- Link para o registro na fonte oficial (Portal da Transparência, PNCP, etc.).
- Botão para abrir um chamado no canal oficial correspondente (Fala.BR, SIC, suporte SICONFI).

O catálogo de canais por fonte está em `src/lib/data/qa-canais.ts`. O texto-base do chamado é gerado por `qa-template.ts` com a evidência já preenchida.

## Página `/qualidade/$id`

Detalhe de um achado individual. Mostra histórico, anexos e permite ao cidadão registrar que abriu protocolo no canal oficial.

## Painel admin

Em [`/admin/qualidade`](./admin.md) o admin pode:

- Marcar findings como `falso_positivo` ou `resolvido`.
- Anotar respostas recebidas dos canais oficiais.
- Filtrar por fonte, severidade e regra.

## Valores suspeitos do Portal CGU

A API da CGU tem um defeito **intermitente** de escala (÷100/1000/10000) que trunca valores tanto na listagem quanto no detalhe (aparece sob rate-limit; ao re-consultar mais tarde, a API costuma devolver o valor certo — por isso o defeito "não reproduz" na checagem manual).

A defesa da varredura de contratos: cada contrato da listagem é conferido contra o endpoint de detalhe (`/contratos/id`). Quando as duas leituras divergem em ≥ 100×, gravamos o valor **não-truncado** (que bate com o documento oficial) e registramos o alerta `valor_corrigido_listagem` — severidade `info`, já nascido resolvido (`corrigido_automaticamente`), com as leituras cruas e timestamps em `detalhes.evidencia_bruta` (prova pública da intermitência da API). `critico` fica reservado a divergências confirmadas não corrigíveis.

A re-checagem manual (unitária e em lote) usa a **mesma** lógica de decisão (`valorAutoritativoCgu` + `cguAindaSuspeito` em `src/lib/data/qa.ts`) e o mesmo cliente HTTP do ingest; quando só uma leitura está disponível e ela diverge do cache, o resultado é **inconclusivo** — nada é alterado e a suspeita permanece aberta (uma leitura única pode ser justamente a resposta degradada).

**Limitação documentada:** se listagem E detalhe vierem truncados na mesma escala ao mesmo tempo (razão ≈ 1), a divergência é indetectável naquele momento; o valor é corrigido numa leitura futura. Licitações, convênios e emendas não têm endpoint de detalhe por item — nessas entidades o mesmo defeito fica visível pela regra `valor_truncado_suspeito` (valor > 0 e < R$ 100).

As heurísticas antigas sobre a listagem (`possivel_ponto_fixo`, `valor_precisao_suspeita`, `valor_final_truncado_suspeito`) foram **aposentadas** — substituídas pela conferência por detalhe. Findings antigos dessas regras podem existir no banco e são resolvidos pela re-checagem.

## Relacionado

- Regras de heurística por fonte: `src/lib/data/qa.ts` (alertas de qualidade). Fontes com os três tipos separam por arquivo: `qualidade.ts`, `lacunas.ts`, `investigativos.ts` (ver a fonte TSE como referência).
- Catálogo de canais oficiais: `src/lib/data/qa-canais.ts`.
- Onde cada tipo aparece nas páginas públicas e no admin: [`dominios/anomalias-e-sinais.md`](./dominios/anomalias-e-sinais.md).
- Lacunas curadas (tabela `lacunas`, ciclo editorial): [`dominios/laboratorio-civico.md`](./dominios/laboratorio-civico.md).
