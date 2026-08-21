import React from "react";
import { Download, CheckCircle2, Share, PlusSquare, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { usePwaInstall } from "@/hooks/use-pwa-install";
import { cn } from "@/lib/utils";

interface PwaInstallButtonProps {
  variant?: "button" | "card" | "compact";
  className?: string;
  label?: string;
}

export function PwaInstallButton({
  variant = "button",
  className,
  label = "Instalar Aplicativo",
}: PwaInstallButtonProps) {
  const { isInstalled, isIOS, showIOSGuide, setShowIOSGuide, promptInstall } = usePwaInstall();

  if (isInstalled) {
    if (variant === "compact") {
      return (
        <span className={cn("inline-flex items-center gap-1.5 text-[10px] font-bold text-emerald-400 uppercase tracking-widest", className)}>
          <CheckCircle2 size={12} /> App Instalado
        </span>
      );
    }
    return (
      <div className={cn("flex items-center gap-2 p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold", className)}>
        <CheckCircle2 size={16} />
        <span>Aplicativo instalado com sucesso</span>
      </div>
    );
  }

  return (
    <>
      {variant === "card" ? (
        <div className={cn("relative overflow-hidden p-5 rounded-3xl bg-gradient-to-br from-white/[0.06] to-white/[0.02] border border-white/10 hover:border-gold/30 transition-all group", className)}>
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-2xl bg-gold/10 border border-gold/20 flex items-center justify-center text-gold shrink-0 group-hover:scale-105 transition-transform">
                <Smartphone size={24} />
              </div>
              <div>
                <h4 className="text-sm font-black text-white uppercase tracking-tight">Aplicativo Barbex</h4>
                <p className="text-xs text-zinc-400 mt-0.5">Instale no seu celular para acesso rápido e notificações.</p>
              </div>
            </div>
            <Button
              onClick={promptInstall}
              className="h-10 px-4 rounded-xl bg-gold hover:bg-gold/90 text-black font-black uppercase text-xs tracking-widest transition-all shrink-0 active:scale-95"
            >
              <Download size={14} className="mr-1.5" /> Instalar
            </Button>
          </div>
        </div>
      ) : variant === "compact" ? (
        <button
          onClick={promptInstall}
          className={cn("inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-gold hover:text-gold/80 transition-colors", className)}
        >
          <Download size={13} />
          {label}
        </button>
      ) : (
        <Button
          onClick={promptInstall}
          className={cn("h-11 px-5 rounded-2xl bg-gold hover:bg-gold/90 text-black font-black uppercase text-xs tracking-widest transition-all active:scale-95 shadow-[0_4px_16px_rgba(212,175,55,0.2)]", className)}
        >
          <Download size={15} className="mr-2" />
          {label}
        </Button>
      )}

      {/* iOS Instructions Modal */}
      <Dialog open={showIOSGuide} onOpenChange={setShowIOSGuide}>
        <DialogContent className="bg-[#0b0f17] border border-white/10 text-white max-w-sm rounded-3xl p-6 shadow-2xl">
          <DialogHeader className="space-y-2 text-center">
            <div className="mx-auto h-12 w-12 rounded-2xl bg-gold/10 border border-gold/20 flex items-center justify-center text-gold">
              <Smartphone size={24} />
            </div>
            <DialogTitle className="text-lg font-black uppercase tracking-tight text-white">
              Instalar no iPhone / iPad
            </DialogTitle>
            <DialogDescription className="text-xs text-zinc-400">
              Siga os passos abaixo no Safari para adicionar à tela de início:
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4 text-xs text-zinc-300">
            <div className="flex items-center gap-3 p-3 rounded-2xl bg-white/5 border border-white/10">
              <div className="h-8 w-8 rounded-xl bg-gold/10 flex items-center justify-center text-gold shrink-0">
                <Share size={16} />
              </div>
              <p>1. Toque no botão <strong>Compartilhar</strong> na barra do Safari.</p>
            </div>

            <div className="flex items-center gap-3 p-3 rounded-2xl bg-white/5 border border-white/10">
              <div className="h-8 w-8 rounded-xl bg-gold/10 flex items-center justify-center text-gold shrink-0">
                <PlusSquare size={16} />
              </div>
              <p>2. Role para baixo e selecione <strong>Adicionar à Tela de Início</strong>.</p>
            </div>
          </div>

          <Button
            onClick={() => setShowIOSGuide(false)}
            className="w-full h-11 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-bold uppercase text-xs tracking-wider"
          >
            Entendi
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
