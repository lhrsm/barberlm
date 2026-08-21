import * as React from "react";
import { motion } from "framer-motion";
import {
  Calendar as CalendarIcon,
  ShoppingBag,
  Wallet,
  Coins,
  Gift,
  Star,
  Ticket,
  Users,
  Sparkles,
  TrendingDown,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  appointments: any[];
  sales: any[];
  customerData: any;
  loyaltyRewards: any[];
  onNavigate?: (tab: string) => void;
  onSubscribe?: () => void;
  subscriptionsEnabled?: boolean;
};

/**
 * Painel do Cliente NÃO assinante.
 * Layout enxuto, sem cards de assinatura. Foco em histórico, fidelidade e CTA
 * para conhecer o Clube Barbex quando assinaturas estiverem habilitadas.
 */
export function MemberDashboard({
  appointments,
  sales,
  customerData,
  loyaltyRewards,
  onNavigate,
  onSubscribe,
  subscriptionsEnabled,
}: Props) {
  const completed = appointments.filter((a) => a.status === "completed").length;
  const productsCount = sales?.length || 0;
  const credits = Number(customerData?.credits || 0);
  const cashback = Number(customerData?.cashback_balance || 0);
  const loyaltyPoints = Number(customerData?.loyalty_points || 0);
  const reviewsGiven = appointments.filter(
    (a) => a.reviewStatus === "reviewed" || (a.appointment_reviews && (a.appointment_reviews.submitted_at || a.appointment_reviews.barbershop_rating || a.appointment_reviews.service_rating)) || a.review?.submitted_at
  ).length;
  const unclaimed = (loyaltyRewards || []).filter((r: any) => !r.redeemed_at).length;
  const savings = appointments
    .filter((a) => a.status === "completed")
    .reduce(
      (s, a) =>
        s + Number(a.credits_used || 0) + Number(a.cashback_used || 0),
      0,
    );

  const cards = [
    {
      id: "appointments",
      label: "Agendamentos",
      value: String(completed),
      hint: "atendimentos concluídos",
      icon: CalendarIcon,
      accent: "white",
      tab: "appointments",
    },
    {
      id: "products",
      label: "Produtos",
      value: String(productsCount),
      hint: "compras realizadas",
      icon: ShoppingBag,
      accent: "white",
    },
    {
      id: "credits",
      label: "Créditos",
      value: `R$ ${credits.toFixed(2)}`,
      hint: "disponível",
      icon: Coins,
      accent: "emerald",
      tab: "finances",
    },
    {
      id: "cashback",
      label: "Cashback",
      value: `R$ ${cashback.toFixed(2)}`,
      hint: "saldo ativo",
      icon: Wallet,
      accent: "gold",
      tab: "finances",
    },
    {
      id: "loyalty",
      label: "Fidelidade",
      value: `${loyaltyPoints}`,
      hint: "pontos acumulados",
      icon: Gift,
      accent: "gold",
      tab: "loyalty",
    },
    {
      id: "reviews",
      label: "Avaliações",
      value: String(reviewsGiven),
      hint: "feitas por você",
      icon: Star,
      accent: "white",
    },
    {
      id: "rewards",
      label: "Recompensas",
      value: String(unclaimed),
      hint: "prontas para resgate",
      icon: Ticket,
      accent: "emerald",
      tab: "loyalty",
    },
    {
      id: "savings",
      label: "Economia",
      value: `R$ ${savings.toFixed(0)}`,
      hint: "acumulada",
      icon: TrendingDown,
      accent: "emerald",
    },
    {
      id: "referrals",
      label: "Indicações",
      value: "0",
      hint: "amigos convidados",
      icon: Users,
      accent: "white",
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.3em] font-black text-white/60">
            Visão geral
          </p>
          <h2 className="text-lg md:text-xl font-black text-white mt-1">
            Sua Central de Cliente
          </h2>
        </div>
        {subscriptionsEnabled && onSubscribe && (
          <button
            type="button"
            onClick={onSubscribe}
            className={cn(
              "hidden sm:inline-flex items-center gap-2 h-9 px-4 rounded-full",
              "bg-gradient-to-r from-gold to-[#F5D061] text-black text-xs font-black uppercase tracking-wider",
              "shadow-[0_6px_20px_rgba(212,175,55,0.35)] transition-all duration-300",
              "hover:-translate-y-0.5 hover:shadow-[0_10px_28px_rgba(212,175,55,0.5)]",
            )}
          >
            <Sparkles className="h-3.5 w-3.5" /> Conhecer Clube Barbex
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {cards.map((c, i) => (
          <motion.button
            type="button"
            key={c.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.03, duration: 0.3 }}
            onClick={() => c.tab && onNavigate?.(c.tab)}
            className={cn(
              "group text-left relative overflow-hidden rounded-2xl border p-4 backdrop-blur",
              "bg-white/[0.03] hover:bg-white/[0.06] transition-all duration-300",
              "border-white/10 hover:border-white/25 hover:-translate-y-0.5",
              c.accent === "gold" && "hover:border-gold/50",
              c.accent === "emerald" && "hover:border-emerald-500/40",
            )}
          >
            <div className="flex items-center justify-between mb-3">
              <div
                className={cn(
                  "h-8 w-8 rounded-xl grid place-items-center",
                  c.accent === "gold" && "bg-gold/15 text-gold",
                  c.accent === "emerald" && "bg-emerald-500/15 text-emerald-400",
                  c.accent === "white" && "bg-white/10 text-white/80",
                )}
              >
                <c.icon className="h-4 w-4" />
              </div>
            </div>
            <p className="text-[9px] uppercase tracking-widest font-black text-gray-500">
              {c.label}
            </p>
            <p
              className={cn(
                "mt-0.5 text-lg md:text-xl font-black truncate",
                c.accent === "gold"
                  ? "text-gold"
                  : c.accent === "emerald"
                  ? "text-emerald-400"
                  : "text-white",
              )}
            >
              {c.value}
            </p>
            <p className="text-[10px] text-gray-500 mt-0.5 truncate">{c.hint}</p>
          </motion.button>
        ))}
      </div>
    </div>
  );
}
