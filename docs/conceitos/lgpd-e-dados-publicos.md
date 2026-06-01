# LGPD e dados públicos

A **Lei Geral de Proteção de Dados** (Lei 13.709/2018, LGPD) não se aplica apenas a empresas privadas — vale também para dados pessoais que aparecem em portais públicos.

## A tensão

O Portal da Transparência publica, por obrigação legal, dados de contratos e convênios. Mas alguns campos livres (descrição do objeto, observações) trazem CPF, telefone, e-mail de servidores ou particulares. O fato de **estar publicado** não autoriza qualquer terceiro a **republicar sem critério** — a LGPD exige minimização e proporcionalidade.

## O que o site faz

Antes de gravar qualquer texto livre, aplicamos `sanitizarTextoPublico` (`src/lib/sanitize.ts`):

- **CPF** → `[CPF removido]`
- **E-mail** → `[e-mail removido]`
- **Telefone** (com DDD entre parênteses ou +55) → `[telefone removido]`
- **CEP** → `[CEP removido]`

**CNPJ permanece** — é identificador empresarial público, não dado pessoal.

## Por que telefone só é mascarado em padrões inequívocos

Números com 10–11 dígitos sem contexto podem ser matrícula funcional, número de processo, etc. Mascarar agressivamente geraria falsos positivos que tornariam o texto incompreensível. O regex pega só o padrão telefone-com-DDD.

## Re-sanitização retroativa

Se descobrimos um padrão novo de PII, podemos rodar `ressanitizarContratosCache` (server function admin) para varrer registros antigos e reaplicar as máscaras. Idempotente.

## Cidadão pode pedir remoção?

Se um dado pessoal vazou para o cache mesmo após sanitização, o cidadão pode pedir remoção via `/contestar`. Avaliamos caso a caso conforme as bases legais da LGPD.