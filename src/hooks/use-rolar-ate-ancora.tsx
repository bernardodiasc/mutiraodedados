import { useEffect } from "react";

/**
 * Rola até o elemento da âncora da URL (`#item-…`) quando o conteúdo carrega
 * no cliente — o navegador só rola sozinho se o elemento já está no HTML da
 * primeira resposta. Usado pelos destinos da busca com âncora.
 */
export function useRolarAteAncora(pronto: boolean) {
  useEffect(() => {
    if (!pronto || typeof window === "undefined" || !window.location.hash) return;
    const alvo = document.getElementById(decodeURIComponent(window.location.hash.slice(1)));
    alvo?.scrollIntoView({ block: "start" });
  }, [pronto]);
}
