import { Link } from "@tanstack/react-router";
import { Lock, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useModules, type ModuleKey } from "@/hooks/use-modules";
import { ReactNode } from "react";

interface ModuleGuardProps {
  module: ModuleKey;
  title?: string;
  children: ReactNode;
}

export function ModuleGuard({ module, title, children }: ModuleGuardProps) {
  const { isEnabled, isLoading } = useModules();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh] text-white/60">
        Carregando...
      </div>
    );
  }

  if (!isEnabled(module)) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] px-4">
        <div className="max-w-md w-full text-center bg-gradient-to-br from-[#0A1020] to-[#0B1426] border border-[rgba(255,184,0,.18)] rounded-2xl p-8 shadow-xl">
          <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-gradient-to-br from-[#f59e0b]/20 to-transparent border border-[rgba(255,184,0,.25)] flex items-center justify-center">
            <Lock className="w-7 h-7 text-amber-400" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">
            {title ? `${title} desativado` : "Este módulo está desativado"}
          </h2>
          <p className="text-sm text-white/60 mb-6">
            Este recurso não está habilitado para sua barbearia. Você pode ativá-lo a qualquer momento nas configurações.
          </p>
          <Link to="/settings">
            <Button className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-black font-semibold rounded-xl h-11">
              <Settings className="w-4 h-4 mr-2" />
              Ativar em Configurações
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
