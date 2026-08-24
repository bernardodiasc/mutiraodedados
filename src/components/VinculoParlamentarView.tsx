import { BadgeCheck } from "lucide-react";
import { SecaoVinculos } from "@/components/SecaoVinculos";
import type { VinculoItem } from "@/lib/secao-vinculos/logic";
import type { ParlamentarVinculado } from "@/lib/data/tse/queries.functions";

export type VinculoParlamentarViewProps = {
  parlamentares: ParlamentarVinculado[];
};

/**
 * Ponte da candidatura para o mandato — a volta do que a ficha do parlamentar
 * já fazia na ida. Composição da `SecaoVinculos` (padrão único de vínculo
 * entre fontes); some quando não há vínculo.
 */
export function VinculoParlamentarView({ parlamentares }: VinculoParlamentarViewProps) {
  if (parlamentares.length === 0) return null;

  const itens: VinculoItem[] = parlamentares.map((p) => {
    const casa = p.tipo === "deputado" ? "Deputado federal · Câmara" : "Senador · Senado";
    const detalhe = [p.partido, p.uf].filter(Boolean).join(" · ");
    const origem = p.origemEhAtual
      ? "vínculo por esta candidatura"
      : `vínculo pela candidatura de ${p.anoOrigem}`;
    return {
      chave: `${p.tipo}-${p.id}`,
      titulo: p.nome,
      subtitulo: [casa, detalhe, origem].filter(Boolean).join(" · "),
      to: p.tipo === "deputado" ? "/camara/deputados/$id" : "/senado/senadores/$id",
      params: { id: p.id },
      inferido: p.matchMetodo !== "cpf",
    };
  });

  return (
    <SecaoVinculos
      titulo="Mandato no Mutirão de Dados"
      icone={BadgeCheck}
      descricao={
        parlamentares.length === 1
          ? "Esta pessoa também tem ficha como parlamentar em exercício — com gastos de cota, votações e proposições."
          : "Esta pessoa tem mais de uma ficha de parlamentar em exercício no site."
      }
      itens={itens}
      avisoInferido="Vínculo deduzido por nome, UF e partido — o TSE não divulgou o CPF nessa candidatura. Homônimo pode gerar ligação errada; confira antes de citar."
    />
  );
}
VinculoParlamentarView.displayName = "VinculoParlamentarView";
