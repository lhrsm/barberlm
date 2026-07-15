import { useRouter } from "@tanstack/react-router";
import { AlertTriangle, Home, RefreshCw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";

export function DefaultRouteError({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="max-w-md w-full glass rounded-3xl border border-rose-500/30 bg-rose-500/5 p-8 text-center space-y-4">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-rose-500/20 flex items-center justify-center">
          <AlertTriangle className="w-7 h-7 text-rose-400" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-white">Algo deu errado</h2>
          <p className="text-sm text-white/60 mt-1">
            {error?.message || "Erro inesperado ao carregar esta página."}
          </p>
        </div>
        <div className="flex gap-2 justify-center pt-2">
          <Button
            variant="outline"
            className="border-white/20 text-white hover:bg-white/10"
            onClick={() => {
              reset();
              router.invalidate();
            }}
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Tentar novamente
          </Button>
          <Button
            className="bg-white/10 hover:bg-white/20 text-white"
            onClick={() => router.navigate({ to: "/" })}
          >
            <Home className="w-4 h-4 mr-2" />
            Início
          </Button>
        </div>
      </div>
    </div>
  );
}

export function DefaultRouteNotFound() {
  const router = useRouter();
  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="max-w-md w-full glass rounded-3xl border border-white/10 p-8 text-center space-y-4">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center">
          <Search className="w-7 h-7 text-white/70" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-white">Página não encontrada</h2>
          <p className="text-sm text-white/60 mt-1">
            O recurso solicitado não existe ou foi movido.
          </p>
        </div>
        <Button
          className="bg-white/10 hover:bg-white/20 text-white"
          onClick={() => router.navigate({ to: "/" })}
        >
          <Home className="w-4 h-4 mr-2" />
          Voltar para o início
        </Button>
      </div>
    </div>
  );
}
