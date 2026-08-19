import * as React from "react";
import { useDataSource } from "@/lib/data-store";
import { AdminSinaisView } from "@/components/AdminSinaisView";
import { filtrarSinais, ordenarPorSeveridade, regrasUnicas } from "@/lib/admin-sinais/logic";

export default function AdminSinaisContainer() {
  const ds = useDataSource();
  const all = React.useMemo(() => ordenarPorSeveridade(ds.listAnomalias()), [ds]);

  const [regraSel, setRegraSel] = React.useState<string | null>(null);
  const [sevSel, setSevSel] = React.useState<string | null>(null);
  const [statusSel, setStatusSel] = React.useState<string>("aberto");

  const filtrados = React.useMemo(
    () => filtrarSinais(all, regraSel, sevSel),
    [all, regraSel, sevSel],
  );
  const regras = React.useMemo(() => regrasUnicas(all), [all]);

  return (
    <AdminSinaisView
      all={all}
      filtrados={filtrados}
      regras={regras}
      regraSel={regraSel}
      sevSel={sevSel}
      statusSel={statusSel}
      onToggleRegra={(r) => setRegraSel(regraSel === r ? null : r)}
      onToggleSev={(s) => setSevSel(sevSel === s ? null : s)}
      onStatusChange={setStatusSel}
      onLimpar={() => {
        setRegraSel(null);
        setSevSel(null);
      }}
    />
  );
}
