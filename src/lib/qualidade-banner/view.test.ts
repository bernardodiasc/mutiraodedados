import { describe, expect, it } from "vitest";
import { QualidadeBannerView } from "@/components/QualidadeBannerView";

// A View é função pura das props (sem hooks): dá para chamá-la direto e
// inspecionar a decisão de renderizar, sem DOM.
describe("QualidadeBannerView — só aparece quando há finding", () => {
  it("sem findings não renderiza nada", () => {
    expect(
      QualidadeBannerView({ findingsCount: 0, principalFinding: null, isLoading: false }),
    ).toBeNull();
  });

  it("contagem positiva mas sem finding principal também não renderiza", () => {
    expect(
      QualidadeBannerView({ findingsCount: 2, principalFinding: null, isLoading: false }),
    ).toBeNull();
  });

  it("com finding renderiza o aviso", () => {
    expect(
      QualidadeBannerView({
        findingsCount: 1,
        principalFinding: { id: "f1", status: "aberto", regra: "valor_muito_baixo" },
        isLoading: false,
      }),
    ).not.toBeNull();
  });
});
