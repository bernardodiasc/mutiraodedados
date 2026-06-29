// Compatibilidade: o nome `ArtigosIndexView` continua exportado daqui e
// renderiza o Container (estado + query). A View pura está em
// `ArtigosIndexListView.tsx` e o Container em `containers/ArtigosIndexContainer.tsx`.
export { ArtigosIndexContainer as ArtigosIndexView } from "@/containers/ArtigosIndexContainer";
export { ArtigosIndexListView } from "@/components/ArtigosIndexListView";
