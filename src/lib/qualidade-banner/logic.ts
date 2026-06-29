export type QaFindingStatus = "aberto" | "confirmado" | "reportado" | string;

export const STATUS_LABEL: Record<string, string> = {
  aberto: "em análise",
  confirmado: "divergência confirmada",
  reportado: "reportada ao órgão",
};

export function obterRotuloStatus(status: QaFindingStatus): string {
  return STATUS_LABEL[status] ?? status;
}

export type QaFindingSimples = {
  id: string;
  status: QaFindingStatus;
  regra: string;
};

export type QualidadeBannerViewProps = {
  findingsCount: number;
  principalFinding: QaFindingSimples | null;
  isLoading: boolean;
};
