"use client";

import { useEffect } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

const RELOAD_FLAG = "beni:recarregado-por-versao";

/**
 * Tela de erro do app.
 *
 * Existe principalmente por causa de um caso previsível: a implantação troca o
 * servidor enquanto alguém está com a aba aberta. As Server Actions da página
 * antiga deixam de existir na versão nova e o Next devolve "Failed to find
 * Server Action" — na prática, um clique que não faz nada e um erro que só
 * quem escreveu o Next entende.
 *
 * Não há o que consertar nesse caso: a página é que está velha. Então
 * recarregamos sozinhos, uma única vez (a trava evita laço se o erro voltar),
 * e a pessoa segue sem saber que houve uma troca de versão.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const versaoTrocada = /Failed to find Server Action|deployment/i.test(
    error.message,
  );

  useEffect(() => {
    if (!versaoTrocada) return;
    if (sessionStorage.getItem(RELOAD_FLAG)) return;
    sessionStorage.setItem(RELOAD_FLAG, "1");
    location.reload();
  }, [versaoTrocada]);

  useEffect(() => {
    if (!versaoTrocada) sessionStorage.removeItem(RELOAD_FLAG);
  }, [versaoTrocada]);

  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
      <h1 className="text-lg font-semibold">
        {versaoTrocada ? "Atualizando para a versão nova…" : "Algo deu errado"}
      </h1>
      <p className="max-w-md text-sm text-muted-foreground">
        {versaoTrocada
          ? "Uma nova versão do Beni foi publicada enquanto esta aba estava aberta. Estou recarregando para você continuar de onde parou."
          : "Não consegui carregar esta tela. Tentar de novo costuma resolver; se insistir, me avise o que você estava fazendo."}
      </p>
      <Button onClick={() => (versaoTrocada ? location.reload() : reset())}>
        <RefreshCw className="size-4" />
        {versaoTrocada ? "Recarregar agora" : "Tentar de novo"}
      </Button>
    </div>
  );
}
