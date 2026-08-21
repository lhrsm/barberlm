import React from "react";
import { Download, X, Share, PlusSquare, CheckCircle, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { usePwaInstall } from "@/hooks/use-pwa-install";
import { cn } from "@/lib/utils";

interface Props {
  barbershopName?: string;
  className?: string;
  variant?: "floating" | "inline";
}

export function InstallBarbexAppPrompt({ barbershopName = "Barbex", className, variant = "floating" }: Props) {
  const {
    isInstalled,
    isInstallable,
    isIOS,
    isDismissed,
    showIOSGuide,
    setShowIOSGuide,
    promptInstall,
    dismissPrompt,
  } = usePwaInstall();

  // If already running standalone or user dismissed or browser doesn't support install
  if (isInstalled || isDismissed || !isInstallable) {
    return null;
  }

  return (
    <>
      <div
        className={cn(
          variant === "floating"
            ? "fixed bottom-4 left-4 right-4 md:left-auto md:right-6 md:bottom-6 z-40 max-w-md animate-in slide-in-from-bottom-5 duration-300"
            : "w-full",
          className
        )}
      >
        <div className="relative rounded-2xl bg-gradient-to-br from-zinc-900/95 via-zinc-950/95 to-black/95 border border-gold/30 p-4 shadow-[0_12px_40px_-10px_rgba(0,0,0,0.8),0_0_25px_rgba(212,175,55,0.15)] backdrop-blur-xl">
          {/* Close button */}
          <button
            type="button"
            onClick={dismissPrompt}
            aria-label="Agora não"
            className="absolute right-3 top-3 h-8 w-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="flex items-start gap-3.5 pr-6">
            <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-gold/20 to-gold/5 border border-gold/40 flex items-center justify-center text-gold shrink-0 mt-0.5">
              <Download className="h-5 w-5" />
            </div>

            <div className="space-y-1">
              <h4 className="text-sm font-bold text-white tracking-tight">
                Instalar aplicativo {barbershopName ? `da ${barbershopName}` : ""}
              </h4>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Tenha acesso rápido aos seus agendamentos, Clube Barbex e benefícios direto da tela inicial.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 mt-4 pt-3 border-t border-white/5">
            <Button
              type="button"
              onClick={promptInstall}
              className="flex-1 h-10 rounded-xl bg-gradient-to-r from-gold to-[#F5D061] text-black font-black text-xs uppercase tracking-wider hover:opacity-95 shadow-[0_4px_16px_rgba(212,175,55,0.25)] transition-all active:scale-[0.98]"
            >
              <Download className="h-4 w-4 mr-1.5" />
              Instalar
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={dismissPrompt}
              className="h-10 px-3.5 rounded-xl text-xs font-bold text-zinc-400 hover:text-white hover:bg-white/5"
            >
              Agora não
            </Button>
          </div>
        </div>
      </div>

      {/* iOS Safari Step-by-Step Guidance Modal */}
      {isIOS && (
        <Dialog open={showIOSGuide} onOpenChange={setShowIOSGuide}>
          <DialogContent className="max-w-sm rounded-3xl bg-zinc-950 border-gold/30 text-white p-6">
            <DialogHeader className="space-y-2 text-left">
              <div className="h-10 w-10 rounded-xl bg-gold/15 border border-gold/30 flex items-center justify-center text-gold mb-1">
                <Smartphone className="h-5 w-5" />
              </div>
              <DialogTitle className="text-lg font-black tracking-tight text-white">
                Como instalar no seu iPhone
              </DialogTitle>
              <DialogDescription className="text-xs text-zinc-400">
                Siga os 3 passos abaixo no navegador Safari para adicionar à tela de início:
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3.5 py-3">
              <div className="flex items-start gap-3 p-3 rounded-xl bg-white/5 border border-white/5">
                <div className="h-6 w-6 rounded-full bg-gold text-black font-black text-xs flex items-center justify-center shrink-0 mt-0.5">
                  1
                </div>
                <div className="text-xs">
                  <span className="font-bold text-white">Toque no botão Compartilhar</span>
                  <p className="text-zinc-400 mt-0.5 flex items-center gap-1">
                    Procure pelo ícone <Share className="h-3.5 w-3.5 text-gold inline" /> na barra inferior do Safari.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-xl bg-white/5 border border-white/5">
                <div className="h-6 w-6 rounded-full bg-gold text-black font-black text-xs flex items-center justify-center shrink-0 mt-0.5">
                  2
                </div>
                <div className="text-xs">
                  <span className="font-bold text-white">Adicionar à Tela de Início</span>
                  <p className="text-zinc-400 mt-0.5 flex items-center gap-1">
                    Role a lista de opções e toque em <PlusSquare className="h-3.5 w-3.5 text-gold inline" /> <strong>"Adicionar à Tela de Início"</strong>.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-xl bg-white/5 border border-white/5">
                <div className="h-6 w-6 rounded-full bg-gold text-black font-black text-xs flex items-center justify-center shrink-0 mt-0.5">
                  3
                </div>
                <div className="text-xs">
                  <span className="font-bold text-white">Confirmar</span>
                  <p className="text-zinc-400 mt-0.5">
                    Toque em <strong>"Adicionar"</strong> no canto superior direito para finalizar.
                  </p>
                </div>
              </div>
            </div>

            <Button
              type="button"
              onClick={() => setShowIOSGuide(false)}
              className="w-full h-10 rounded-xl bg-gold text-black font-bold text-xs uppercase tracking-wider"
            >
              Entendido
            </Button>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
