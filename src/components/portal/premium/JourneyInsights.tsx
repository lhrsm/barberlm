import * as React from "react";
import { motion } from "framer-motion";
import {
  Scissors,
  Wallet,
  Gift,
  CalendarClock,
  TrendingDown,
  Crown,
  Sparkles,
} from "lucide-react";
import { differenceInDays } from "date-fns";
import { cn } from "@/lib/utils";

type Insight = {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: "gold" | "emerald" | "info" | "warn";
};

type Props = {
  appointments: any[];
  customerData: any;
  mySubscription: any;
  loyaltyRewards: any[];
  onNewAppointment?: () => void;
};

export function JourneyInsights({
  appointments,
  customerData,
  mySubscription,
  loyaltyRewards,
  onNewAppointment,
}: Props) {
  const insights: Insight[] = [];

  const lastCompleted = appointments
    .filter((a) => a.status === "completed")
    .sort((a, b) => +new Date(b.start_time) - +new Date(a.start_time))[0];

  if (lastCompleted) {
    const days = differenceInDays(new Date(), new Date(lastCompleted.start_time));
    if (days >= 20) {
      insights.push({
        id: "haircut-time",
        title: `Já faz ${days} dias desde seu último corte`,
        description: "Que tal renovar o visual? Seus barbeiros favoritos estão prontos.",
        icon: Scissors,
        tone: "gold",
      });
    }
  } else {
    insights.push({
      id: "first-visit",
      title: "Sua primeira experiência espera por você",
      description: "Agende seu primeiro atendimento e ganhe benefícios exclusivos.",
      icon: Sparkles,
      tone: "gold",
    });
  }

  const cashback = Number(customerData?.cashback_balance || 0);
  if (cashback > 0) {
    insights.push({
      id: "cashback",
      title: `Você tem R$ ${cashback.toFixed(2)} em cashback`,
      description: "Use no seu próximo atendimento para pagar menos.",
      icon: Wallet,
      tone: "emerald",
    });
  }

  const credits = Number(customerData?.credits || 0);
  if (credits > 0) {
    insights.push({
      id: "credits",
      title: `R$ ${credits.toFixed(2)} em créditos disponíveis`,
      description: "Seus créditos ficam ativos para usar quando quiser.",
      icon: Wallet,
      tone: "emerald",
    });
  }

  const unclaimedRewards = (loyaltyRewards || []).filter((r: any) => !r.redeemed_at).length;
  if (unclaimedRewards > 0) {
    insights.push({
      id: "loyalty-rewards",
      title: `${unclaimedRewards} ${unclaimedRewards === 1 ? "recompensa" : "recompensas"} para resgatar`,
      description: "Você acumulou benefícios prontos para usar.",
      icon: Gift,
      tone: "gold",
    });
  }

  if (mySubscription?.next_billing_date) {
    const days = differenceInDays(new Date(mySubscription.next_billing_date), new Date());
    if (days >= 0 && days <= 15) {
      insights.push({
        id: "renewal",
        title: `Seu plano renova em ${days} ${days === 1 ? "dia" : "dias"}`,
        description: "Fique tranquilo — a renovação é automática.",
        icon: CalendarClock,
        tone: "info",
      });
    }
  }

  if (mySubscription) {
    const savings = appointments
      .filter((a) => a.status === "completed" && a.covered_by_subscription)
      .reduce((s, a) => s + Number(a.service_price || 0), 0);
    if (savings > 0) {
      insights.push({
        id: "savings",
        title: `Você economizou R$ ${savings.toFixed(0)} com seu plano`,
        description: "Isso é o valor que você deixou de pagar por ser assinante.",
        icon: TrendingDown,
        tone: "emerald",
      });
    }
  } else {
    insights.push({
      id: "subscribe",
      title: "Descubra o Clube Barbex",
      description: "Assine e desbloqueie benefícios exclusivos, cashback e prioridade.",
      icon: Crown,
      tone: "gold",
    });
  }

  if (insights.length === 0) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-[0.3em] font-black text-gold">
            Personalizado para você
          </p>
          <h2 className="text-lg md:text-xl font-black text-white mt-1">Sua Jornada Barbex</h2>
        </div>
        {onNewAppointment && (
          <button
            onClick={onNewAppointment}
            className="hidden md:inline-flex items-center gap-2 text-[11px] uppercase tracking-widest font-black text-gold hover:text-[#F5D061] transition-colors"
          >
            Novo agendamento →
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {insights.slice(0, 6).map((it, i) => (
          <motion.div
            key={it.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05, duration: 0.35 }}
            className={cn(
              "group relative overflow-hidden rounded-2xl border p-4 backdrop-blur",
              "bg-white/[0.03] hover:bg-white/[0.06] transition-all duration-300",
              it.tone === "gold" && "border-gold/25 hover:border-gold/50",
              it.tone === "emerald" && "border-emerald-500/20 hover:border-emerald-500/40",
              it.tone === "info" && "border-sky-500/20 hover:border-sky-500/40",
              it.tone === "warn" && "border-amber-500/25 hover:border-amber-500/50",
            )}
          >
            <div
              className={cn(
                "h-9 w-9 rounded-xl grid place-items-center mb-3",
                it.tone === "gold" && "bg-gold/15 text-gold",
                it.tone === "emerald" && "bg-emerald-500/15 text-emerald-400",
                it.tone === "info" && "bg-sky-500/15 text-sky-400",
                it.tone === "warn" && "bg-amber-500/15 text-amber-400",
              )}
            >
              <it.icon className="h-4 w-4" />
            </div>
            <p className="text-sm font-black text-white leading-snug">{it.title}</p>
            <p className="text-xs text-gray-400 mt-1 leading-relaxed">{it.description}</p>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
