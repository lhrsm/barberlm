import { Button } from "@/components/ui/button";
import { Bell, BellOff, CheckCircle2 } from "lucide-react";
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

  return (
    <div className="rounded-2xl border border-[#D4AF37]/30 bg-gradient-to-br from-[#0b0f17] to-black p-5 flex items-center gap-4">
      <div className="h-12 w-12 rounded-full bg-[#D4AF37]/15 flex items-center justify-center">
        {subscribed ? <CheckCircle2 className="h-6 w-6 text-emerald-400" /> : <Bell className="h-6 w-6 text-[#D4AF37]" />}
      </div>
      <div className="flex-1">
        <p className="text-white font-black">
          {subscribed ? "Notificações ativas" : "Ativar notificações"}
        </p>
        <p className="text-xs text-gray-400">
          {subscribed
            ? "Você receberá alertas de agendamentos e promoções neste dispositivo."
            : "Receba lembretes, confirmações e novidades direto no navegador."}
        </p>
      </div>
      <Button
        onClick={handle}
        disabled={loading || permission === "denied"}
        className={
          subscribed
            ? "bg-white/10 hover:bg-white/20 text-white"
            : "bg-[#D4AF37] hover:bg-[#B8962E] text-black font-black"
        }
      >
        {loading ? "..." : subscribed ? "Desativar" : "Ativar"}
      </Button>
    </div>
  );
}
