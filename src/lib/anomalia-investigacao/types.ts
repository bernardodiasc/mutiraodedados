import type { AnomaliaInput } from "@/lib/anomalia";

/**
 * Referência a um endpoint oficial da API do Portal da Transparência.
 * Em vez de manter um executor de curl em paralelo, apontamos pro
 * Swagger UI oficial — lá o usuário monta a requisição com a própria
 * chave e vê a resposta crua.
 */
export type AnomaliaInvestigacaoCurl = {
  label: string;
  url: string;
  nota?: string;
};

export type AnomaliaActions = {
  onRevalidar?: () => Promise<void>;
  onConfirmar?: () => Promise<void>;
  onReportar?: (canal: string, protocolo: string) => Promise<void>;
  onMarcarFalsoPositivo?: () => Promise<void>;
  onMarcarCorrigido?: () => Promise<void>;
  onSalvarNota?: (nota: string) => Promise<void>;
};

export type AnomaliaInvestigacaoViewProps = {
  anomalia: AnomaliaInput;
  actions?: AnomaliaActions;
  modo?: "admin" | "publico";
  curls?: AnomaliaInvestigacaoCurl[];
  flush?: boolean;
  nota: string;
  onNotaChange: (n: string) => void;
  busy: string | null;
  onRun: (key: string, fn?: () => Promise<void>) => void;
  modalAberto: boolean;
  onModalOpenChange: (open: boolean) => void;
};