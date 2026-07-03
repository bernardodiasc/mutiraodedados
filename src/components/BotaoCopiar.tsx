import { useRef, useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { Button, type ButtonProps } from "@/components/ui/button";

export type BotaoCopiarProps = {
  /** Texto a copiar — função para que a montagem só ocorra no clique. */
  obterTexto: () => string;
  /** Rótulo do botão; omita para botão só-ícone (usa `titulo` como tooltip). */
  rotulo?: string;
  titulo?: string;
  mensagemToast?: string;
  size?: ButtonProps["size"];
  variant?: ButtonProps["variant"];
  className?: string;
};

/** Primitivo "Copiar": clipboard + toast + estado transitório "copiado". */
export function BotaoCopiar({
  obterTexto,
  rotulo,
  titulo,
  mensagemToast = "Copiado para a área de transferência",
  size = "sm",
  variant = "outline",
  className,
}: BotaoCopiarProps) {
  const [copiado, setCopiado] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onClick = async () => {
    try {
      await navigator.clipboard.writeText(obterTexto());
      setCopiado(true);
      toast.success(mensagemToast);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopiado(false), 2000);
    } catch {
      toast.error("Não foi possível copiar. Copie manualmente.");
    }
  };

  const Icone = copiado ? Check : Copy;
  return (
    <Button
      type="button"
      size={size}
      variant={variant}
      className={className}
      title={titulo ?? rotulo ?? "Copiar"}
      onClick={onClick}
    >
      <Icone className="size-3.5" />
      {rotulo && <span>{copiado ? "Copiado" : rotulo}</span>}
    </Button>
  );
}
BotaoCopiar.displayName = "BotaoCopiar";
