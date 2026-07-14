import { Button } from "@/components/ui/button";
import { Bell, BellOff, CheckCircle2, Loader2, BellRing } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { usePushNotifications, type PushAudience } from "@/hooks/use-push-notifications";

interface Props {
  customerPhone?: string | null;
  tenantId?: string | null;
  audience?: PushAudience;
  compact?: boolean;
}

export function PushOptInCard({ customerPhone, tenantId, audience = "customer", compact }: Props) {
  const { supported, permission, subscribed, loading, subscribe, unsubscribe } =
    usePushNotifications({ customerPhone, tenantId, audience });
  const [showHelp, setShowHelp] = useState(false);

  if (!supported) return null;

  const handle = async () => {
    if (subscribed) {
      await unsubscribe();
      toast.success("Notificações desativadas");
      return;
    }
    const res = await subscribe();
    if (res.ok) toast.success("Notificações ativadas 🔔");
    else if (res.error === "denied") toast.error("Permissão negada no navegador");
    else toast.error("Não foi possível ativar");
  };

  if (compact) {
    return (
      <Button
        onClick={handle}
        disabled={loading || permission === "denied"}
        variant="outline"
        size="sm"
        className="border-[#D4AF37]/40 text-[#D4AF37] hover:bg-[#D4AF37]/10"
      >
        {subscribed ? <BellOff className="h-4 w-4 mr-2" /> : <Bell className="h-4 w-4 mr-2" />}
        {subscribed ? "Desativar avisos" : "Ativar notificações"}
      </Button>
    );
  }

  const isDenied = permission === "denied";
  const isGranted = subscribed || permission === "granted";

  return (
    <div
      className="animate-fade-in rounded-[18px] border border-[#D4AF37]/25 bg-gradient-to-br from-[#14181f] to-[#0a0d13] p-5 shadow-[0_4px_20px_-8px_rgba(0,0,0,0.6)] transition-all hover:border-[#D4AF37]/40"
    >
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        {/* Icon */}
        <div className="h-12 w-12 shrink-0 rounded-full bg-[#1a1f28] ring-1 ring-[#D4AF37]/20 flex items-center justify-center">
          {isGranted ? (
            <CheckCircle2 className="h-6 w-6 text-emerald-400" />
          ) : (
            <Bell className="h-6 w-6 text-[#D4AF37]" />
          )}
        </div>

        {/* Text */}
        <div className="flex-1 min-w-0">
          <p className="text-white font-semibold text-[15px] leading-tight">
            {isGranted
              ? "Notificações ativadas"
              : isDenied
              ? "Notificações bloqueadas"
              : "Ativar notificações"}
          </p>
          <p className="mt-1 text-[13px] text-gray-400 leading-relaxed">
            {isGranted
              ? "Você receberá lembretes, confirmações e novidades neste dispositivo."
              : isDenied
              ? "As notificações estão bloqueadas neste navegador."
              : "Receba lembretes de agendamentos, confirmações e novidades diretamente no navegador."}
          </p>
          {isDenied && showHelp && (
            <p className="mt-2 text-[12px] text-gray-500 leading-relaxed animate-fade-in">
              Clique no ícone de cadeado ao lado do endereço do site → Permissões → Notificações → Permitir. Depois recarregue a página.
            </p>
          )}
        </div>

        {/* Action */}
        <div className="w-full sm:w-auto sm:shrink-0 mt-2 sm:mt-0">
          {isGranted ? (
            <div className="hidden sm:flex items-center gap-2 text-emerald-400 text-sm font-medium px-3">
              <CheckCircle2 className="h-4 w-4" />
              Ativadas
            </div>
          ) : isDenied ? (
            <Button
              onClick={() => setShowHelp((v) => !v)}
              variant="outline"
              className="w-full sm:w-auto sm:min-w-[170px] h-11 rounded-[12px] border-[#D4AF37]/40 text-[#D4AF37] hover:bg-[#D4AF37]/10 hover:text-[#D4AF37]"
            >
              Como liberar
            </Button>
          ) : (
            <Button
              onClick={handle}
              disabled={loading}
              className="group w-full sm:w-auto sm:min-w-[170px] sm:max-w-[220px] h-11 sm:h-11 px-[22px] rounded-[12px] font-semibold text-black bg-[#D4AF37] hover:bg-gradient-to-r hover:from-[#E9C766] hover:to-[#B8962E] shadow-[0_4px_14px_-4px_rgba(212,175,55,0.5)] hover:shadow-[0_6px_20px_-4px_rgba(212,175,55,0.7)] hover:-translate-y-[1px] transition-all duration-200 disabled:opacity-70 disabled:hover:translate-y-0"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Ativando...
                </>
              ) : (
                <>
                  <BellRing className="h-4 w-4 mr-2 transition-transform group-hover:scale-110" />
                  Ativar notificações
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
