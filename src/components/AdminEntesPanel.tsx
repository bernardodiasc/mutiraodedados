/**
 * Shim de compatibilidade: a implementação foi movida para o
 * AdminEntesContainer + AdminEntesView. Mantemos `EntesPanel` exportado para
 * não quebrar imports existentes (AdminImportPanel).
 */
export { AdminEntesContainer as EntesPanel } from "@/containers/AdminEntesContainer";