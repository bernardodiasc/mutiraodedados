// Re-export do Container para manter compatibilidade com call-sites antigos.
// O componente foi dividido em:
//   - src/containers/AnomaliaInvestigacaoContainer.tsx (estado + server-fn)
//   - src/components/AnomaliaInvestigacaoView.tsx       (View stateless)
//   - src/lib/anomalia-investigacao/{logic,types,mocks}.ts
export { AnomaliaInvestigacaoContainer as AnomaliaInvestigacao } from "@/containers/AnomaliaInvestigacaoContainer";
export type { AnomaliaActions } from "@/lib/anomalia-investigacao/types";
