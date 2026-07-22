import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { previewAddon, subscribeToAddon } from "@/utils/addons.functions";
import { getStripeEnvironment } from "@/lib/stripe";
import { Loader2, Check, AlertCircle, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  addon: {
    id: string;
    name: string;
    description: string | null;
    monthly_price: number;
    benefits?: string[];
  } | null;
  onSuccess?: () => void;
}

export function SubscribeAddonDialog({ open, onOpenChange, addon, onSuccess }: Props) {
  const [submitting, setSubmitting] = useState(false);
  const qc = useQueryClient();
  const env = (() => { try { return getStripeEnvironment(); } catch { return "sandbox" as const; } })();

  const { data: preview, isLoading: loadingPreview, error: previewError } = useQuery({
    queryKey: ["addon-preview", addon?.id, env],
    queryFn: async () => {
      if (!addon) return null;
      const r = await previewAddon({ data: { addonId: addon.id, environment: env } });
      if (!r.ok) throw new Error(r.error);
      return r;
    },
    enabled: !!addon && open,
    staleTime: 30_000,
  });

  const handleConfirm = async () => {
    if (!addon) return;
    setSubmitting(true);
    try {
      const r = await subscribeToAddon({ data: { addonId: addon.id, environment: env } });
      if (!r.ok) throw new Error(r.error);
      toast.success(`${addon.name} contratado com sucesso!`);
      qc.invalidateQueries({ queryKey: ["tenant-addons"] });
      qc.invalidateQueries({ queryKey: ["my-addons"] });
      onOpenChange(false);
      onSuccess?.();
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao contratar");
    } finally {
      setSubmitting(false);
    }
  };

  if (!addon) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#0A1020] border-white/10 text-white max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl">Contratar {addon.name}</DialogTitle>
          <DialogDescription className="text-white/60">
            Confirme os detalhes da contratação. O acesso é liberado imediatamente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {addon.description && (
            <p className="text-sm text-white/70">{addon.description}</p>
          )}

          {Array.isArray(addon.benefits) && addon.benefits.length > 0 && (
            <ul className="space-y-1.5">
              {addon.benefits.slice(0, 4).map((b, i) => (
                <li key={i} className="text-xs text-white/70 flex items-start gap-2">
                  <Check className="w-3 h-3 text-emerald-400 shrink-0 mt-0.5" />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          )}

          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 space-y-2">
            {loadingPreview ? (
              <div className="flex items-center gap-2 text-white/60 text-sm">
                <Loader2 className="w-4 h-4 animate-spin" /> Calculando cobrança...
              </div>
            ) : previewError ? (
              <div className="flex items-start gap-2 text-red-300 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{(previewError as Error).message}</span>
              </div>
            ) : preview && preview.ok ? (
              <>
                <div className="flex justify-between text-sm">
                  <span className="text-white/60">Cobrança proporcional agora</span>
                  <span className="font-bold text-white">
                    R$ {Math.max(0, preview.prorationAmount).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-white/60">Preço mensal a partir do próximo ciclo</span>
                  <span className="font-bold text-emerald-400">
                    R$ {preview.unitPrice.toFixed(2)}
                  </span>
                </div>
                {preview.nextInvoiceDate && (
                  <div className="flex justify-between text-xs text-white/50 pt-2 border-t border-white/5">
                    <span>Próxima fatura</span>
                    <span>{new Date(preview.nextInvoiceDate).toLocaleDateString("pt-BR")}</span>
                  </div>
                )}
              </>
            ) : null}
          </div>

          <p className="text-[11px] text-white/40">
            Você pode cancelar a qualquer momento pela página de assinatura. O acesso é mantido até o fim do ciclo pago.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={submitting || loadingPreview || !!previewError}
            className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-black font-bold"
          >
            {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Confirmar contratação
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
