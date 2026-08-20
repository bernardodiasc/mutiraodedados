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

## Relação com o Portal CGU (dois eixos)

O endpoint `/convenios` do Portal CGU alimenta **dois lugares**, por decisão de projeto:

- **Eixo "Por fonte" (esta página)**: `transferegov_instrumentos_cache` + `transferegov_emendas_cache` (EC 105). O Transferegov é a fonte nativa dos instrumentos e das emendas Pix.
- **Eixo "Por tema"**: `cgu_convenios_cache` / `cgu_emendas_cache` (tabelas separadas, pipelines de QA/cobertura/limpeza próprios), exibido nas páginas-tópico [Convênios](../dominios/convenios-e-transferencias.md) e Emendas.

Há **sobreposição deliberada**: o mesmo `/convenios` e `/emendas` são ingeridos nas duas tabelas para isolar os dois eixos. A entidade-tópico **Transferências** (endpoint `/transferencias`) é **doc-only** — ver [sanções e preços](./sancoes-precos-referencia.md) (403 + sobreposição com EC 105).

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
