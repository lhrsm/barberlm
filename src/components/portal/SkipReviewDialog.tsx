import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AlertCircle, ArrowLeft, Loader2 } from "lucide-react";

interface SkipReviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointment: any;
  onSkipped?: (appointment: any) => void;
}

export function SkipReviewDialog({
  open,
  onOpenChange,
  appointment,
  onSkipped,
}: SkipReviewDialogProps) {
  const [submitting, setSubmitting] = useState(false);

  if (!appointment) return null;

  const handleConfirmSkip = async () => {
    setSubmitting(true);
    try {
      // Chamada canônica da RPC segura
      const { data, error } = await (supabase.rpc as any)("set_appointment_review_decision", {
        p_appointment_id: appointment.id,
        p_decision: "skipped",
      });

      if (error) {
        throw new Error(error.message || "Erro ao registrar recusa de avaliação no servidor.");
      }

      if (!data || (data as any).success !== true) {
        throw new Error((data as any)?.error || "Operação não confirmada pelo servidor.");
      }

      toast.success("Decisão registrada: você optou por não avaliar este atendimento.");
      onOpenChange(false);
      onSkipped?.(appointment);
    } catch (e: any) {
      console.error("[SKIP_REVIEW] Error skipping review:", e);
      toast.error("Erro ao registrar decisão: " + (e.message || "Tente novamente"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#0b0f17] border border-white/10 text-white max-w-md rounded-3xl p-6 sm:p-8 shadow-2xl">
        <DialogHeader className="space-y-3 text-center sm:text-left">
          <div className="mx-auto sm:mx-0 h-12 w-12 rounded-2xl bg-zinc-800/80 border border-zinc-700/50 flex items-center justify-center text-zinc-400">
            <AlertCircle className="h-6 w-6 text-gold/80" />
          </div>
          <DialogTitle className="text-xl sm:text-2xl font-black uppercase tracking-tight text-white">
            Tem certeza de que não deseja avaliar este atendimento?
          </DialogTitle>
          <DialogDescription className="text-zinc-400 text-sm leading-relaxed">
            Você poderá encerrar esta etapa sem enviar uma avaliação.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="flex flex-col-reverse sm:flex-row gap-3 pt-6 sm:pt-4">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
            className="w-full sm:w-auto h-12 sm:h-11 rounded-xl text-zinc-400 hover:text-white hover:bg-white/5 font-bold uppercase tracking-widest text-xs min-h-[44px]"
          >
            <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
          </Button>

          <Button
            type="button"
            onClick={handleConfirmSkip}
            disabled={submitting}
            className="w-full sm:w-auto h-12 sm:h-11 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 font-black uppercase tracking-widest text-xs transition-all min-h-[44px]"
          >
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Registrando...
              </>
            ) : (
              "Não quero avaliar"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
