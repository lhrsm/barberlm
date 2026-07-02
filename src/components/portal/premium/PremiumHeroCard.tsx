import * as React from "react";
import { motion } from "framer-motion";
import {
  User as UserIcon,
  Crown,
  Sparkles,
  Gem,
  Award,
  Star,
  Calendar as CalendarIcon,
  Wallet,
  Coins,
  Clock,
  TrendingDown,
  Scissors,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

type Props = {
  client: any;
  shop: any;
  customerData: any;
  mySubscription: any;
  appointments: any[];
};

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return { text: "Bom dia", icon: "☀️" };
  if (h < 18) return { text: "Boa tarde", icon: "🌤️" };
  return { text: "Boa noite", icon: "🌙" };
}

function computeTier(completedCount: number, isSubscriber: boolean) {
  if (isSubscriber) return { label: "Assinante Premium", icon: Crown, color: "#D4AF37" };
  if (completedCount >= 30) return { label: "Cliente Diamante", icon: Gem, color: "#7DD3FC" };
  if (completedCount >= 15) return { label: "Cliente Ouro", icon: Award, color: "#F5D061" };
  if (completedCount >= 5) return { label: "Cliente VIP", icon: Star, color: "#C0C0C0" };
  return { label: "Cliente Bronze", icon: Star, color: "#CD7F32" };
}

function calcSavings(appts: any[]) {
  // Serviços cobertos por assinatura ou créditos/cashback usados = economia
  return appts
    .filter((a) => a.status === "completed")
    .reduce((s, a) => {
      if (a.covered_by_subscription) return s + Number(a.service_price || 0);
      return s + Number(a.credits_used || 0) + Number(a.cashback_used || 0);
    }, 0);
}

export function PremiumHeroCard({
  client,
  shop,
  customerData,
  mySubscription,
  appointments,
}: Props) {
  const { text, icon } = greeting();
  const completed = appointments.filter((a) => a.status === "completed").length;
  const isSubscriber = !!mySubscription && mySubscription.status === "active";
  const tier = computeTier(completed, isSubscriber);
  const TierIcon = tier.icon;

  const lastVisit = appointments
    .filter((a) => a.status === "completed")
    .sort((a, b) => +new Date(b.start_time) - +new Date(a.start_time))[0];

  const nextAppt = appointments
    .filter((a) => ["scheduled", "confirmed"].includes(a.status) && new Date(a.start_time) >= new Date())
    .sort((a, b) => +new Date(a.start_time) - +new Date(b.start_time))[0];

  const createdAt = customerData?.created_at ? new Date(customerData.created_at) : null;
  const savings = calcSavings(appointments);
  const credits = Number(customerData?.credits || 0);
  const cashback = Number(customerData?.cashback_balance || 0);

  const stats = [
    createdAt && {
      label: "Cliente desde",
      value: format(createdAt, "MMM yyyy", { locale: ptBR }),
      icon: CalendarIcon,
    },
    lastVisit && {
      label: "Última visita",
      value: format(new Date(lastVisit.start_time), "dd/MM", { locale: ptBR }),
      icon: Clock,
    },
    nextAppt && {
      label: "Próximo",
      value: format(new Date(nextAppt.start_time), "dd/MM 'às' HH:mm", { locale: ptBR }),
      icon: Scissors,
    },
    {
      label: "Atendimentos",
      value: String(completed),
      icon: Award,
    },
    {
      label: "Economia",
      value: `R$ ${savings.toFixed(0)}`,
      icon: TrendingDown,
      accent: "emerald",
    },
    {
      label: "Cashback",
      value: `R$ ${cashback.toFixed(0)}`,
      icon: Wallet,
      accent: "gold",
    },
    {
      label: "Créditos",
      value: `R$ ${credits.toFixed(0)}`,
      icon: Coins,
      accent: "emerald",
    },
  ].filter(Boolean) as Array<{
    label: string;
    value: string;
    icon: React.ComponentType<{ className?: string }>;
    accent?: "gold" | "emerald";
  }>;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className={cn(
        "relative overflow-hidden rounded-3xl border p-6 md:p-8",
        "bg-gradient-to-br from-[#0B0B0F] via-[#0A0A0A] to-black",
        isSubscriber
          ? "border-[#D4AF37]/40 shadow-[0_20px_60px_-20px_rgba(212,175,55,0.35)]"
          : "border-white/10 shadow-[0_20px_60px_-30px_rgba(255,255,255,0.15)]",
      )}
    >
      {/* Ambient glow */}
      <div
        className={cn(
          "pointer-events-none absolute -top-32 -right-24 h-72 w-72 rounded-full blur-3xl opacity-40",
          isSubscriber ? "bg-[#D4AF37]/20" : "bg-white/5",
        )}
      />
      <div className="pointer-events-none absolute -bottom-40 -left-24 h-72 w-72 rounded-full bg-[#F59E0B]/10 blur-3xl opacity-30" />

      <div className="relative">
        <div className="flex flex-col md:flex-row md:items-center gap-5">
          <div className="relative">
            {customerData?.avatar_url ? (
              <img
                src={customerData.avatar_url}
                alt={client?.name}
                className={cn(
                  "h-20 w-20 md:h-24 md:w-24 rounded-2xl object-cover border-2",
                  isSubscriber ? "border-[#D4AF37]" : "border-white/20",
                )}
              />
            ) : (
              <div
                className={cn(
                  "h-20 w-20 md:h-24 md:w-24 rounded-2xl grid place-items-center border-2 bg-white/5",
                  isSubscriber ? "border-[#D4AF37] text-[#D4AF37]" : "border-white/20 text-white/70",
                )}
              >
                <UserIcon className="h-10 w-10" />
              </div>
            )}
            {isSubscriber && (
              <div className="absolute -top-2 -right-2 h-8 w-8 rounded-full bg-gradient-to-br from-[#D4AF37] to-[#F5D061] grid place-items-center shadow-lg ring-2 ring-black">
                <Crown className="h-4 w-4 text-black" />
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-xs uppercase tracking-[0.3em] font-black text-[#D4AF37]/80">
              {text}, {icon}
            </p>
            <h1 className="mt-1 text-2xl md:text-4xl font-black text-white tracking-tight truncate">
              {client?.name}
            </h1>
            <p className="text-sm text-gray-400 mt-1">
              Bem-vindo à sua área exclusiva na{" "}
              <span className="text-white font-bold">{shop?.business_name}</span>
            </p>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Badge
                className="border-0 font-black uppercase text-[10px] tracking-wider gap-1"
                style={{
                  backgroundColor: `${tier.color}20`,
                  color: tier.color,
                  border: `1px solid ${tier.color}55`,
                }}
              >
                <TierIcon className="h-3 w-3" /> {tier.label}
              </Badge>
              {isSubscriber && mySubscription?.plan?.name && (
                <Badge className="bg-[#D4AF37] text-black font-black uppercase text-[10px] tracking-wider gap-1 border-0">
                  <Sparkles className="h-3 w-3" /> {mySubscription.plan.name}
                </Badge>
              )}
              {completed >= 10 && (
                <Badge
                  variant="outline"
                  className="bg-emerald-500/10 border-emerald-500/40 text-emerald-300 text-[10px] uppercase font-bold"
                >
                  Fiel
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Quick stats strip */}
        <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-2">
          {stats.map((s) => (
            <div
              key={s.label}
              className={cn(
                "rounded-xl border p-3 backdrop-blur transition-all duration-300",
                "bg-white/[0.03] border-white/10 hover:bg-white/[0.06] hover:border-white/20",
              )}
            >
              <div className="flex items-center gap-1.5 text-[9px] uppercase tracking-widest font-black text-gray-500">
                <s.icon className="h-3 w-3" /> {s.label}
              </div>
              <div
                className={cn(
                  "mt-1 font-black text-sm md:text-base truncate",
                  s.accent === "gold"
                    ? "text-[#D4AF37]"
                    : s.accent === "emerald"
                    ? "text-emerald-400"
                    : "text-white",
                )}
              >
                {s.value}
              </div>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
