# Transferegov

- **URL base (convênios)**: via Portal CGU `/convenios` — usa o mesmo cliente do [Portal CGU](./portal-cgu.md).
- **URL base (emendas Pix)**: API aberta do Transferegov — `api.transferegov.dth.api.gov.br/transferenciasespeciais/plano_acao_especial`. (`discricionarias.transferegov.sistema.gov.br` é o site de consulta, usado só como link de saída.)
- **Janela**: convênios desde 2017 (consistência consolidada); emendas Pix desde 2020.
- **Documentação oficial**: <https://www.gov.br/transferegov/pt-br>

## Por que os convênios não vêm da API do Transferegov

Porque a API deles não existe. Verificado contra o portal e contra os specs em
**2026-08-20** — refazer o teste antes de confiar nesta seção de novo.

O portal <https://api-publica.transferegov.gestao.gov.br> separa três **APIs**
de um **download**:

| Módulo                                  | Acesso           | Base                                                 |
| --------------------------------------- | ---------------- | ---------------------------------------------------- |
| Transferências Especiais                | API              | `api-publica.transferegov.gestao.gov.br/especiais`   |
| Gestão de Parcerias                     | API              | `api-publica.transferegov.gestao.gov.br/parcerias`   |
| Transferências Fundo a Fundo            | API              | `api-publica.transferegov.gestao.gov.br/fundoafundo` |
| Transferências Discricionárias e Legais | **arquivos CSV** | `api-publica.transferegov.gestao.gov.br/downloads`   |

**Convênios e contratos de repasse vivem no último** — o próprio portal os
nomeia ali. Só CSV; a API está em cronograma oficial, com "Instrumentos"
previsto entre nov/2026 e fev/2027.

**Cuidado com o nome "Gestão de Parcerias".** Parece cobrir convênios e não
cobre: a palavra "convênio" não aparece nenhuma vez no OpenAPI dessa API (18
rotas), e os `tp_instrumento` reais de `/programa` são fundo a fundo, PRONON/
PRONAS, contrato de gestão, multa ambiental e incentivo à reciclagem. A
colisão de vocabulário já produziu a conclusão errada uma vez.

Consequência de redação, para código e para tela: **nada no projeto pode dizer
que os convênios vêm da API do Transferegov**. Eles vêm da CGU, que espelha o
Transferegov. Caminhos de saída estão no [ROADMAP.md](../../ROADMAP.md).

## Quem é quem (para não confundir de novo)

- **Transferegov** — sistema **operacional**: o balcão onde o ente propõe, assina, executa e presta contas das transferências voluntárias. O convênio _vive_ aqui.
- **Portal da Transparência (CGU)** — sistema de **publicidade**: espelha o que os operacionais registram. É de onde _importamos_.
- **Todo convênio tem as duas pontas** — órgão federal concedente e ente convenente — no MESMO registro. Amostra real de mai/2026: 9 de 9 itens do endpoint com código SICONV, órgão e convenente preenchidos juntos. Os dois "eixos" do site são ângulos de leitura do mesmo acervo, nunca dois conjuntos de convênios.
- Contraste com **contratos**: lá as duas fontes (CGU × PNCP) são sistemas de origem genuinamente distintos, com coberturas diferentes — o seletor de `/contratos` distingue fontes; o de `/convenios` distingue ângulos.

## O espelho é completo? Verificado (2026-08-20)

Amostra estratificada de 30 códigos do CSV oficial da origem (`siconv_convenio.zip`, 286.945 linhas) consultados um a um no espelho via `GET /api-de-dados/convenios/numero?numero=<codigo_siconv>` (o parâmetro `numero` recebe o CÓDIGO SICONV, não o nº formatado):

- **Universo: completo para convênios celebrados.** 15/15 assinados (2009–2025), 5/5 com prestação de contas aprovada e 2/2 anulados/rescindidos assinados estão no espelho. Só ficam fora propostas nunca assinadas (0/5) e cancelamentos pré-assinatura (0/2) — pipeline, não instrumento.
- **Campos: incompleto.** O espelho não publica execução financeira (`VL_EMPENHADO_CONV`, `VL_DESEMBOLSADO_CONV`).
- **Situação: pode estar DEFASADA no espelho.** Caso real: convênio 906502 — origem "Convênio Rescindido", espelho "EM EXECUÇÃO". E o vocabulário do espelho é mais pobre ("NORMAL" onde a origem diz "Prestação de Contas Concluída").

Consequência (v0.10.0): a origem **enriquece, não substitui** — colunas próprias (`situacao_origem`, `valor_empenhado`, `valor_desembolsado`) aplicadas por `codigo_siconv`, espelho jamais sobrescrito, divergência de situação exibida lado a lado na ficha.

## Relação com o Portal CGU (tabela única desde a v0.9.0)

O endpoint `/convenios` do Portal CGU alimenta **uma tabela só**: `convenios_cache`, com coluna `fonte` (`cgu` hoje; `transferegov` quando a API nativa existir). Os dois "eixos" do site — página-tema por execução federal e ângulo por ente — são consultas sobre ela.

Até a v0.9.0 eram duas tabelas (`cgu_convenios_cache` e `transferegov_instrumentos_cache`) com os mesmos registros mapeados por dois códigos diferentes — que divergiram em silêncio (links oficiais, rótulos de fonte). O mapeador único vive em `src/lib/data/real/convenio-row.ts`; os ids de importação `cgu_convenios` e `transferegov` continuam distintos no Histórico e na cobertura, porque descrevem **qual varredura** trouxe o dado, não onde ele mora.

## O que importamos

- **Convênios e contratos de repasse** (SICONV) via Portal CGU.
- **Transferências especiais** (EC 105/2019, conhecidas como "emendas Pix" sem finalidade definida).
- **Transferências com finalidade definida** (EC 105/2019).

## Peculiaridades

- Para emendas Pix, requisições usam User-Agent de navegador (o endpoint bloqueia clientes padrão).
- Paginação `offset/limit` no endpoint direto.
- Convênios usam o mesmo cliente e parser de valores do Portal CGU (`portal-client.ts`) — ver [`portal-cgu.ia.md`](./portal-cgu.ia.md).

## Quem consome

- [Convênios e transferências](../dominios/convenios-e-transferencias.md):
  - `/convenios`, `/convenios/$id`.
  - `/transferencias` — listagem unificada de emendas Pix.
  - `/transferencias/especiais/$id`, `/transferencias/finalidade/$id`.

## Links externos esperados

- Convênios: `https://portaldatransparencia.gov.br/convenios/<id>` ou consulta SICONV no Transferegov quando há código.
- Transferências especiais: página oficial no Transferegov.

## Conceitos relacionados

- [O que é convênio](../conceitos/o-que-e-convenio.md)
- [Emendas parlamentares](../conceitos/emendas-parlamentares.md)
