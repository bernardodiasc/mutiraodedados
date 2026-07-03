import * as React from "react";
import { AdminPerguntasView, type AdminPerguntasAba } from "@/components/AdminPerguntasView";
import { PerguntasModelosContainer } from "@/containers/PerguntasModelosContainer";
import { PerguntasModeracaoContainer } from "@/containers/PerguntasModeracaoContainer";
import { PerguntasPublicasContainer } from "@/containers/PerguntasPublicasContainer";

export function AdminPerguntasContainer() {
  const [aba, setAba] = React.useState<AdminPerguntasAba>("modelos");
  return (
    <AdminPerguntasView aba={aba} onAbaChange={setAba}>
      {aba === "modelos" ? (
        <PerguntasModelosContainer />
      ) : aba === "moderacao" ? (
        <PerguntasModeracaoContainer />
      ) : (
        <PerguntasPublicasContainer />
      )}
    </AdminPerguntasView>
  );
}

AdminPerguntasContainer.displayName = "AdminPerguntasContainer";
