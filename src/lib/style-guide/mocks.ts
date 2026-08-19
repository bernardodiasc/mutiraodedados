// Mocks estáticos para o style guide /estilo.
// Nada aqui toca o banco — todos os componentes podem ser renderizados isoladamente.

export type QaFindingMock = {
  id: string;
  fonte: string;
  regra: string;
  status: "aberto" | "confirmado" | "reportado" | "resolvido" | "falso_positivo";
  severidade: "critico" | "aviso" | "info";
  entidade_tipo: string;
  entidade_id: string;
  descricao: string;
  detectado_em: string;
  pii_detectada?: boolean;
};

export const qaFindingMocks: QaFindingMock[] = [
  {
    id: "mock-1",
    fonte: "portal-cgu",
    regra: "valor_acima_do_limite_dispensa",
    status: "aberto",
    severidade: "critico",
    entidade_tipo: "contrato",
    entidade_id: "00000000000001",
    descricao:
      "Contrato com valor R$ 250.000 firmado por dispensa, acima do teto de R$ 50.000 da Lei 14.133.",
    detectado_em: "2026-05-20",
    pii_detectada: false,
  },
  {
    id: "mock-2",
    fonte: "transferegov",
    regra: "cpf_no_objeto",
    status: "confirmado",
    severidade: "aviso",
    entidade_tipo: "convenio",
    entidade_id: "987654",
    descricao: "Campo 'objeto' contém possível CPF (mascarado na exibição pública).",
    detectado_em: "2026-05-12",
    pii_detectada: true,
  },
  {
    id: "mock-3",
    fonte: "siconfi",
    regra: "rcl_negativa",
    status: "resolvido",
    severidade: "info",
    entidade_tipo: "rreo",
    entidade_id: "3550308-2025-3",
    descricao: "RCL negativa em RREO retificado pelo município após reporte oficial.",
    detectado_em: "2026-03-02",
  },
];

export type ContratoMock = {
  id: string;
  numero: string;
  orgao: string;
  fornecedor: string;
  cnpj: string;
  valor: number;
  vigencia_inicio: string;
  vigencia_fim: string;
  fonte: "portal-cgu" | "pncp";
  link_oficial: string;
};

export const contratoMocks: ContratoMock[] = [
  {
    id: "c-001",
    numero: "12/2025",
    orgao: "Ministério da Saúde",
    fornecedor: "Acme Suprimentos Hospitalares Ltda",
    cnpj: "12.345.678/0001-90",
    valor: 1_245_300,
    vigencia_inicio: "2025-01-15",
    vigencia_fim: "2026-01-14",
    fonte: "portal-cgu",
    link_oficial: "https://portaldatransparencia.gov.br/contratos",
  },
  {
    id: "c-002",
    numero: "08/2026",
    orgao: "Prefeitura de Curitiba",
    fornecedor: "Construtora Beta S.A.",
    cnpj: "98.765.432/0001-10",
    valor: 87_500,
    vigencia_inicio: "2026-02-01",
    vigencia_fim: "2026-08-01",
    fonte: "pncp",
    link_oficial: "https://pncp.gov.br/app/contratos",
  },
];

export type ConvenioMock = {
  id: string;
  numero: string;
  concedente: string;
  proponente: string;
  uf: string;
  valor_global: number;
  situacao: "Em execução" | "Concluído" | "Prestação de contas";
};

export const convenioMocks: ConvenioMock[] = [
  {
    id: "cv-001",
    numero: "900123/2024",
    concedente: "Ministério do Desenvolvimento Regional",
    proponente: "Município de Garanhuns/PE",
    uf: "PE",
    valor_global: 3_400_000,
    situacao: "Em execução",
  },
];

export type DeputadoMock = {
  id: string;
  nome: string;
  partido: string;
  uf: string;
  legislatura: number;
  foto: string;
};

export const deputadoMocks: DeputadoMock[] = [
  {
    id: "204554",
    nome: "Joana da Silva",
    partido: "PSOL",
    uf: "RJ",
    legislatura: 57,
    foto: "https://www.camara.leg.br/internet/deputado/bandep/204554.jpg",
  },
];
