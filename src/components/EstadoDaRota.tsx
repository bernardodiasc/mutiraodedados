import type { ReactNode } from "react";

/**
 * `notFoundComponent` e `errorComponent` das fichas: mesma aparência das
 * rotas /fornecedores/$cnpj e /entes/$codigo. O texto e o link de volta à
 * listagem vêm de cada rota, em `children`.
 */
export function RegistroNaoEncontrado({
  titulo,
  children,
}: {
  titulo: string;
  children?: ReactNode;
}) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-20 text-center">
      <h1 className="font-display text-3xl">{titulo}</h1>
      {children && <p className="text-sm text-muted-foreground mt-2">{children}</p>}
    </div>
  );
}

export function ErroAoCarregar({ error }: { error: Error }) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-20">
      <h1 className="font-display text-2xl">Erro</h1>
      <p>{error.message}</p>
    </div>
  );
}
