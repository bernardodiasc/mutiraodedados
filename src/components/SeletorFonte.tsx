import * as React from "react";

/**
 * Seletor de recorte para um tipo de dado que aparece em mais de uma leitura.
 *
 * A regra do projeto é: **uma página por tipo de dado**, com o recorte
 * escolhido aqui e refletido na URL (`?fonte=`), de modo que a busca continue
 * compartilhável.
 *
 * Cada opção declara **recorte** e **fonte**, e as duas informações são
 * independentes. Às vezes mudam as duas — contratos vêm do Portal CGU (só
 * Executivo Federal) **ou** do PNCP (todos os entes). Às vezes muda só o
 * recorte — os dois ângulos de convênios saem do mesmo Portal CGU, porque o
 * Transferegov ainda não publica API destes instrumentos. Declarar a fonte
 * repetida é o certo: dizer "Transferegov" onde o dado é da CGU seria informar
 * ao visitante uma procedência que não temos.
 */
export type OpcaoFonte<T extends string> = {
  id: T;
  /** Rótulo curto do recorte, à frente do nome da fonte. */
  recorte: string;
  /** Nome da fonte oficial. */
  fonte: string;
};

export function SeletorFonte<T extends string>({
  opcoes,
  valor,
  onChange,
}: {
  opcoes: ReadonlyArray<OpcaoFonte<T>>;
  valor: T;
  onChange: (id: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Fonte dos dados">
      {opcoes.map((o) => {
        const ativo = o.id === valor;
        return (
          <button
            key={o.id}
            type="button"
            aria-pressed={ativo}
            onClick={() => onChange(o.id)}
            className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
              ativo
                ? "border-accent bg-accent/10 text-foreground"
                : "border-border text-muted-foreground hover:bg-muted"
            }`}
          >
            {o.recorte} · {o.fonte}
          </button>
        );
      })}
    </div>
  );
}
