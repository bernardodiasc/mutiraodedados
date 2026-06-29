// Re-export do Container para manter compatibilidade com call-sites antigos.
// Estrutura nova:
//   - src/containers/CoberturaMatrixContainer.tsx (estado + server-fn + jobs)
//   - src/components/CoberturaMatrixView.tsx       (View stateless)
//   - src/lib/cobertura-matrix/{logic,logic.test}.ts
export { CoberturaMatrixContainer as CoberturaMatrix } from "@/containers/CoberturaMatrixContainer";
export type { CoberturaJob } from "@/lib/data/cobertura-jobs";
