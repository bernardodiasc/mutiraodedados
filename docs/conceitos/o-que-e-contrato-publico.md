# O que é um contrato público

Um contrato público é um acordo formal entre um órgão da administração pública (federal, estadual, municipal) e uma pessoa física ou jurídica para fornecer um bem, prestar um serviço ou executar uma obra. Em troca, o ente público paga com dinheiro do orçamento.

## Como nasce

1. **Necessidade identificada** pelo órgão (ex: precisa de papel para o ano).
2. **Licitação** — processo competitivo. Modalidades comuns:
   - **Pregão** — para bens e serviços comuns.
   - **Concorrência** — obras e serviços de maior valor.
   - **Dispensa** — quando a lei permite pular a licitação (valor baixo, emergência).
   - **Inexigibilidade** — quando só existe um fornecedor possível (exclusividade técnica).
3. **Adjudicação** — o vencedor é declarado.
4. **Assinatura do contrato** — o que entra no Portal da Transparência.
5. **Execução** — empresa entrega; órgão recebe e atesta.
6. **Pagamento** — empenho → liquidação → pagamento.

## Empenhado, liquidado, pago

Esses três valores frequentemente diferem:

- **Empenhado** — orçamento reservado (compromisso).
- **Liquidado** — entrega confirmada e fatura aceita.
- **Pago** — dinheiro saiu da conta da União.

Um contrato pode estar empenhado mas nunca pago (se foi cancelado, por exemplo). O site mostra principalmente o **valor do contrato** (compromisso total).

## O que tem em "objeto"

O **objeto** é a descrição do que está sendo contratado. Em tese é técnico ("aquisição de 500 resmas de papel A4 alcalino 75g"), mas na prática vem com erros de digitação, abreviações, e às vezes PII (CPF, telefone) que o sistema mascara automaticamente.

## Por que fracionamento é suspeito

A lei impõe limites para dispensa por baixo valor. Se um órgão divide uma compra grande em várias compras pequenas para fugir da licitação, isso é **fracionamento de despesa** — irregularidade. Aparece em [`/anomalias`](../dominios/anomalias-e-sinais.md) quando detectado.

## Quem é o contratante e quem é o fornecedor

- **Contratante** = órgão público (ex: Ministério da Saúde).
- **Fornecedor / contratado** = pessoa jurídica (CNPJ) ou física (CPF, raro).

No site, fornecedores ganham página própria (`/fornecedores/$cnpj`) para acompanhar o histórico — útil para detectar empresas que vivem de contratos públicos ou recebem desproporcionalmente de um único órgão.

## Leis relevantes

- **Lei 8.666/1993** — antiga lei de licitações (ainda vale para alguns contratos antigos em vigência).
- **Lei 14.133/2021** — Nova Lei de Licitações, vigente para novos contratos desde 2021. Centraliza publicação no [PNCP](./pncp-e-nova-lei-licitacoes.md).
