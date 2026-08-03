import * as React from "react";
import { motion } from "framer-motion";
import {
  Sparkles,
  Scissors,
  Wallet,
  Coins,
  Gift,
  Trophy,
  Ticket,
  Star,
  CalendarClock,
  Crown,
  Package,
  Award,
  Clock,
  TrendingUp,
  Target,
  Users,
  ChartBar,
  PiggyBank,
  Zap,
  ArrowRight,
} from "lucide-react";
import { format, differenceInDays, subMonths, startOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { generateRecommendations, type Recommendation } from "./recommendationEngine";

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  Sparkles, Scissors, Wallet, Coins, Gift, Trophy, Ticket, Star,
  CalendarClock, Crown, Package,
};

const TONE_STYLES: Record<string, { border: string; bg: string; icon: string; badge: string }> = {
  gold: {
    border: "border-gold/25 hover:border-gold/60",
    bg: "bg-gold/[0.04]",
    icon: "bg-gold/15 text-gold",
    badge: "bg-gold/15 text-gold border-gold/30",
  },
  emerald: {
    border: "border-emerald-500/20 hover:border-emerald-500/50",
    bg: "bg-emerald-500/[0.03]",
    icon: "bg-emerald-500/15 text-emerald-400",
    badge: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  },
  info: {
    border: "border-sky-500/20 hover:border-sky-500/50",
    bg: "bg-sky-500/[0.03]",
    icon: "bg-sky-500/15 text-sky-400",
    badge: "bg-sky-500/15 text-sky-400 border-sky-500/30",
  },
  warn: {
    border: "border-amber-500/25 hover:border-amber-500/60",
    bg: "bg-amber-500/[0.03]",
    icon: "bg-amber-500/15 text-amber-400",
    badge: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  },
  violet: {
    border: "border-violet-500/25 hover:border-violet-500/60",
    bg: "bg-violet-500/[0.03]",
    icon: "bg-violet-500/15 text-violet-400",
    badge: "bg-violet-500/15 text-violet-400 border-violet-500/30",
  },
};

type Tier = { name: string; min: number; color: string; glow: string; icon: React.ComponentType<any> };
const TIERS: Tier[] = [
  { name: "Bronze", min: 0, color: "#CD7F32", glow: "rgba(205,127,50,0.35)", icon: Award },
  { name: "Prata", min: 5, color: "#C0C0C0", glow: "rgba(192,192,192,0.35)", icon: Award },
  { name: "Ouro", min: 12, color: "#D4AF37", glow: "rgba(212,175,55,0.5)", icon: Trophy },
  { name: "Diamante", min: 25, color: "#B9F2FF", glow: "rgba(185,242,255,0.5)", icon: Crown },
];

type Props = {
  appointments: any[];
  customerData: any;
  mySubscription: any;
  loyaltyRewards: any[];
  sales: any[];
  coupons?: any[];
  onAction?: (event: string) => void;
};

export function JourneyBarbex({
  appointments,
  customerData,
  mySubscription,
  loyaltyRewards,
  sales,
  coupons,
  onAction,
}: Props) {
  const dispatch = (event: string) => {
    if (onAction) onAction(event);
    else if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(event));
  };

  const recommendations = React.useMemo(
    () => generateRecommendations({ appointments, customerData, mySubscription, loyaltyRewards, sales, coupons }),
    [appointments, customerData, mySubscription, loyaltyRewards, sales, coupons],
  );

  // ---------- Tier ----------
  const completed = appointments.filter((a) => a.status === "completed");
  const completedCount = completed.length;
  const totalSpent = completed.reduce((s, a) => s + Number(a.service_price || a.total_price || 0), 0);
  const currentTier = [...TIERS].reverse().find((t) => completedCount >= t.min) || TIERS[0];
  const nextTier = TIERS.find((t) => t.min > completedCount);
  const tierProgress = nextTier
    ? Math.min(100, ((completedCount - currentTier.min) / (nextTier.min - currentTier.min)) * 100)
    : 100;

  // ---------- Timeline ----------
  const timeline: { icon: React.ComponentType<any>; title: string; date: Date; color: string }[] = [];
  if (completed.length) {
    const first = completed.sort((a, b) => +new Date(a.start_time) - +new Date(b.start_time))[0];
    timeline.push({ icon: Sparkles, title: "Primeiro atendimento", date: new Date(first.start_time), color: "#D4AF37" });
    const last = completed[completed.length - 1];
    if (completed.length > 1) {
      timeline.push({ icon: Scissors, title: "Último atendimento", date: new Date(last.start_time), color: "#C0C0C0" });
    }
  }
  if (sales?.[0]) timeline.push({ icon: Package, title: "Última compra de produto", date: new Date(sales[0].created_at), color: "#7dd3fc" });
  const lastReward = (loyaltyRewards || []).sort(
    (a: any, b: any) => +new Date(b.redeemed_at || b.created_at || 0) - +new Date(a.redeemed_at || a.created_at || 0),
  )[0];
  if (lastReward) timeline.push({ icon: Gift, title: "Última recompensa", date: new Date(lastReward.redeemed_at || lastReward.created_at), color: "#D4AF37" });
  if (mySubscription?.started_at) timeline.push({ icon: Crown, title: "Assinatura iniciada", date: new Date(mySubscription.started_at), color: "#F5D061" });
  timeline.sort((a, b) => +b.date - +a.date);

  // ---------- Favorite services ----------
  const serviceCount = new Map<string, number>();
  completed.forEach((a) => {
    const name = a.services?.name || a.service_name;
    if (name) serviceCount.set(name, (serviceCount.get(name) || 0) + 1);
  });
  const favServices = Array.from(serviceCount.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  // ---------- Favorite barbers ----------
  const barberCount = new Map<string, number>();
  completed.forEach((a) => {
    const name = a.barbers?.name;
    if (name) barberCount.set(name, (barberCount.get(name) || 0) + 1);
  });
  const favBarbers = Array.from(barberCount.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  // ---------- Spending (12 months) ----------
  const months: { label: string; total: number }[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = startOfMonth(subMonths(new Date(), i));
    months.push({ label: format(d, "MMM", { locale: ptBR }), total: 0 });
  }
  completed.forEach((a) => {
    const idx = 11 - differenceInDays(startOfMonth(new Date()), startOfMonth(new Date(a.start_time))) / 30;
    const monthDiff = 11 - (new Date().getMonth() - new Date(a.start_time).getMonth() + 12 * (new Date().getFullYear() - new Date(a.start_time).getFullYear()));
    if (monthDiff >= 0 && monthDiff < 12) {
      months[monthDiff].total += Number(a.service_price || a.total_price || 0);
    }
  });
  (sales || []).forEach((s) => {
    const monthDiff = 11 - (new Date().getMonth() - new Date(s.created_at).getMonth() + 12 * (new Date().getFullYear() - new Date(s.created_at).getFullYear()));
    if (monthDiff >= 0 && monthDiff < 12) {
      months[monthDiff].total += Number(s.total_price || s.price || 0);
    }
  });
  const maxMonth = Math.max(1, ...months.map((m) => m.total));

  // ---------- Savings ----------
  const cashbackUsed = completed.reduce((s, a) => s + Number(a.cashback_used || 0), 0);
  const creditsUsed = completed.reduce((s, a) => s + Number(a.credits_used || 0), 0);
  const subCovered = completed
    .filter((a) => a.covered_by_subscription)
    .reduce((s, a) => s + Number(a.service_price || 0), 0);
  const totalSaved = cashbackUsed + creditsUsed + subCovered;

  // ---------- Goals ----------
  const goals = [
    {
      title: "Corte a cada 20 dias",
      progress: (() => {
        const last = completed.find((a) => (a.services?.name || "").toLowerCase().includes("corte"));
        if (!last) return 0;
        const d = differenceInDays(new Date(), new Date(last.start_time));
        return Math.max(0, Math.min(100, ((20 - d) / 20) * 100));
      })(),
    },
    {
      title: "Barba sempre alinhada",
      progress: (() => {
        const last = completed.find((a) => (a.services?.name || "").toLowerCase().includes("barba"));
        if (!last) return 0;
        const d = differenceInDays(new Date(), new Date(last.start_time));
        return Math.max(0, Math.min(100, ((10 - d) / 10) * 100));
      })(),
    },
    {
      title: "Acumular R$ 100 em Cashback",
      progress: Math.min(100, (Number(customerData?.cashback_balance || 0) / 100) * 100),
    },
  ];

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="space-y-6"
    >
      {/* Header */}
      <div>
        <p className="text-[10px] uppercase tracking-[0.3em] font-black text-gold flex items-center gap-2">
          <Sparkles className="h-3 w-3" /> Central de Relacionamento
        </p>
        <h2 className="text-2xl md:text-3xl font-black text-white mt-1">Sua Jornada Barbex</h2>
        <p className="text-sm text-gray-400 mt-1">
          Acompanhe sua evolução como cliente e descubra recomendações personalizadas.
        </p>
      </div>

      {/* Tier / Status */}
      <div
        className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-white/[0.04] to-transparent p-6 md:p-8 backdrop-blur-xl"
      >
        <div
          className="pointer-events-none absolute -top-24 -right-24 h-60 w-60 rounded-full blur-3xl opacity-50"
          style={{ background: currentTier.glow }}
        />
        <div className="relative flex flex-wrap items-center justify-between gap-4 mb-5">
          <div className="flex items-center gap-4">
            <div
              className="h-14 w-14 rounded-2xl grid place-items-center"
              style={{
                background: currentTier.color + "20",
                border: `1.5px solid ${currentTier.color}80`,
                boxShadow: `0 10px 30px ${currentTier.glow}`,
              }}
            >
              <currentTier.icon className="h-6 w-6" style={{ color: currentTier.color }} />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.3em] text-gray-400 font-black">Seu nível</p>
              <p className="text-2xl font-black text-white">
                Cliente <span style={{ color: currentTier.color }}>{currentTier.name}</span>
              </p>
            </div>
          </div>
          <div className="flex gap-6">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-gray-500 font-black">Atendimentos</p>
              <p className="text-2xl font-black text-white">{completedCount}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest text-gray-500 font-black">Investido</p>
              <p className="text-2xl font-black text-white">R$ {totalSpent.toFixed(0)}</p>
            </div>
          </div>
        </div>

        <div className="relative">
          <div className="grid grid-cols-4 gap-2 mb-3">
            {TIERS.map((t) => {
              const active = completedCount >= t.min;
              const Icon = t.icon;
              return (
                <div key={t.name} className="text-center">
                  <div
                    className={cn(
                      "mx-auto h-9 w-9 rounded-full grid place-items-center transition-all",
                      active ? "scale-100" : "scale-90 opacity-50",
                    )}
                    style={{
                      background: active ? t.color + "25" : "rgba(255,255,255,0.05)",
                      border: `1.5px solid ${active ? t.color : "rgba(255,255,255,0.15)"}`,
                      boxShadow: active ? `0 0 20px ${t.glow}` : "none",
                    }}
                  >
                    <Icon className="h-4 w-4" style={{ color: active ? t.color : "#666" }} />
                  </div>
                  <p className="mt-1.5 text-[10px] uppercase tracking-wider font-black" style={{ color: active ? t.color : "#666" }}>
                    {t.name}
                  </p>
                  <p className="text-[9px] text-gray-500">{t.min}+</p>
                </div>
              );
            })}
          </div>
          <div className="h-2 rounded-full bg-white/5 overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${tierProgress}%` }}
              transition={{ duration: 1, ease: "easeOut" }}
              className="h-full rounded-full"
              style={{
                background: `linear-gradient(90deg, ${currentTier.color}, ${nextTier?.color || currentTier.color})`,
                boxShadow: `0 0 12px ${currentTier.glow}`,
              }}
            />
          </div>
          <p className="mt-4 text-sm text-gray-300 text-center">
            {nextTier ? (
              <>
                Faltam{" "}
                <span className="font-black text-gold">{nextTier.min - completedCount}</span>{" "}
                {nextTier.min - completedCount === 1 ? "atendimento" : "atendimentos"} para atingir o nível{" "}
                <span className="font-black" style={{ color: nextTier.color }}>{nextTier.name}</span>.
              </>
            ) : (
              <>Você atingiu o nível máximo. Parabéns!</>
            )}
          </p>
        </div>
      </div>

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Zap className="h-4 w-4 text-gold" />
            <h3 className="text-sm uppercase tracking-widest font-black text-white">Recomendado para você</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {recommendations.slice(0, 6).map((rec, i) => {
              const Icon = ICONS[rec.icon] || Sparkles;
              const t = TONE_STYLES[rec.tone];
              return (
                <motion.button
                  key={rec.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04, duration: 0.3 }}
                  onClick={() => dispatch(rec.actionEvent)}
                  className={cn(
                    "group relative overflow-hidden rounded-2xl border p-4 text-left transition-all backdrop-blur",
                    "hover:-translate-y-0.5 hover:shadow-[0_10px_30px_-10px_rgba(212,175,55,0.25)]",
                    t.border, t.bg,
                  )}
                >
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className={cn("h-9 w-9 rounded-xl grid place-items-center", t.icon)}>
                      <Icon className="h-4 w-4" />
                    </div>
                    {rec.badge && (
                      <span className={cn("text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-full border", t.badge)}>
                        {rec.badge}
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-black text-white leading-snug">{rec.title}</p>
                  <p className="text-xs text-gray-400 mt-1 leading-relaxed">{rec.description}</p>
                  <div className="mt-3 flex items-center gap-1 text-[11px] uppercase tracking-widest font-black text-gold group-hover:text-[#F5D061]">
                    {rec.actionLabel} <ArrowRight className="h-3 w-3" />
                  </div>
                </motion.button>
              );
            })}
          </div>
        </div>
      )}

      {/* Grid: goals + savings */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 rounded-3xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-xl">
          <div className="flex items-center gap-2 mb-4">
            <Target className="h-4 w-4 text-gold" />
            <h3 className="text-sm uppercase tracking-widest font-black text-white">Seus objetivos</h3>
          </div>
          <div className="space-y-4">
            {goals.map((g, i) => (
              <div key={i}>
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-sm text-white font-semibold">{g.title}</p>
                  <p className="text-xs text-gold font-black">{g.progress.toFixed(0)}%</p>
                </div>
                <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${g.progress}%` }}
                    transition={{ duration: 0.8, delay: i * 0.1 }}
                    className="h-full rounded-full bg-gradient-to-r from-gold to-[#F5D061]"
                    style={{ boxShadow: "0 0 10px rgba(212,175,55,0.4)" }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-3xl border border-emerald-500/25 bg-gradient-to-br from-emerald-950/30 to-transparent p-6 backdrop-blur-xl relative overflow-hidden">
          <div className="pointer-events-none absolute -top-16 -right-16 h-40 w-40 rounded-full bg-emerald-500/15 blur-3xl" />
          <div className="relative">
            <div className="flex items-center gap-2 mb-3">
              <PiggyBank className="h-4 w-4 text-emerald-400" />
              <h3 className="text-sm uppercase tracking-widest font-black text-white">Sua economia</h3>
            </div>
            <p className="text-xs text-gray-400 mb-2">Você já economizou</p>
            <p className="text-4xl font-black text-emerald-400">R$ {totalSaved.toFixed(0)}</p>
            <p className="text-xs text-gray-400 mt-2">usando cashback, créditos e benefícios do Barbex.</p>
          </div>
        </div>
      </div>

      {/* Spending chart */}
      <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-xl">
        <div className="flex items-center gap-2 mb-5">
          <ChartBar className="h-4 w-4 text-gold" />
          <h3 className="text-sm uppercase tracking-widest font-black text-white">Gastos nos últimos 12 meses</h3>
        </div>
        <div className="flex items-end gap-1.5 h-32">
          {months.map((m, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
              <div className="w-full flex-1 flex items-end">
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: `${(m.total / maxMonth) * 100}%` }}
                  transition={{ duration: 0.6, delay: i * 0.03 }}
                  className="w-full rounded-t bg-gradient-to-t from-gold/40 to-[#F5D061]/80"
                  style={{ boxShadow: m.total > 0 ? "0 0 8px rgba(212,175,55,0.3)" : "none" }}
                  title={`R$ ${m.total.toFixed(0)}`}
                />
              </div>
              <p className="text-[9px] uppercase text-gray-500 font-black">{m.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Favorites + Timeline */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Favorite services */}
        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-xl">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="h-4 w-4 text-gold" />
            <h3 className="text-sm uppercase tracking-widest font-black text-white">Serviços favoritos</h3>
          </div>
          {favServices.length === 0 ? (
            <p className="text-sm text-gray-500">Após seu primeiro atendimento, seus favoritos aparecem aqui.</p>
          ) : (
            <ul className="space-y-2">
              {favServices.map(([name, count], i) => (
                <li key={name} className="flex items-center justify-between gap-3 rounded-xl border border-white/5 bg-white/[0.02] p-3 hover:border-gold/30 transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="h-7 w-7 rounded-lg bg-gold/15 text-gold grid place-items-center text-xs font-black">
                      #{i + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm text-white font-semibold truncate">{name}</p>
                      <p className="text-[11px] text-gray-500">{count}× realizado{count > 1 ? "s" : ""}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => dispatch("OPEN_BOOKING_MODAL")}
                    className="text-[10px] uppercase tracking-widest font-black text-gold hover:text-[#F5D061]"
                  >
                    Agendar
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Favorite barbers */}
        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-xl">
          <div className="flex items-center gap-2 mb-4">
            <Users className="h-4 w-4 text-gold" />
            <h3 className="text-sm uppercase tracking-widest font-black text-white">Barbeiros favoritos</h3>
          </div>
          {favBarbers.length === 0 ? (
            <p className="text-sm text-gray-500">Escolha um profissional para agendar seu próximo atendimento.</p>
          ) : (
            <ul className="space-y-2">
              {favBarbers.map(([name, count], i) => (
                <li key={name} className="flex items-center justify-between gap-3 rounded-xl border border-white/5 bg-white/[0.02] p-3 hover:border-gold/30 transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-9 w-9 rounded-full bg-gradient-to-br from-gold to-[#8a6d1a] grid place-items-center text-black font-black text-sm">
                      {name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm text-white font-semibold truncate">{name}</p>
                      <p className="text-[11px] text-gray-500">{count} atendimento{count > 1 ? "s" : ""}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => dispatch("OPEN_BOOKING_MODAL")}
                    className="text-[10px] uppercase tracking-widest font-black text-gold hover:text-[#F5D061]"
                  >
                    Agendar
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Timeline */}
      {timeline.length > 0 && (
        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-xl">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="h-4 w-4 text-gold" />
            <h3 className="text-sm uppercase tracking-widest font-black text-white">Sua linha do tempo</h3>
          </div>
          <ol className="relative border-l border-white/10 pl-6 space-y-4">
            {timeline.map((t, i) => {
              const Icon = t.icon;
              return (
                <li key={i} className="relative">
                  <span
                    className="absolute -left-[34px] top-0 h-6 w-6 rounded-full grid place-items-center"
                    style={{ background: t.color + "20", border: `1.5px solid ${t.color}80` }}
                  >
                    <Icon className="h-3 w-3" style={{ color: t.color }} />
                  </span>
                  <p className="text-sm font-semibold text-white">{t.title}</p>
                  <p className="text-[11px] text-gray-500">
                    {format(t.date, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                  </p>
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </motion.section>
  );
}
