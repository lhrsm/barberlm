import * as React from "react";
import { motion } from "framer-motion";
import {
  Crown,
  Scissors,
  Sparkles,
  CheckCircle2,
  TrendingDown,
  Calendar,
  Wallet,
  Coins,
  Gift,
  ArrowRight,
  ShieldCheck,
  Zap,
  ShoppingBag
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { SubscribePlanModal } from "@/components/portal/SubscribePlanModal";

interface NonSubscriberDashboardProps {
  client: any;
  shop: any;
  slug: string;
  customerData: any;
  subscriptionPlans: any[];
  appointments: any[];
  onNewAppointment: () => void;
  onNavigate: (tab: string) => void;
  onRefresh?: () => void;
}

export function NonSubscriberDashboard({
  client,
  shop,
  slug,
  customerData,
  subscriptionPlans,
  appointments,
  onNewAppointment,
  onNavigate,
  onRefresh,
}: NonSubscriberDashboardProps) {
  const [selectedPlanForSubscribe, setSelectedPlanForSubscribe] = React.useState<any | null>(null);
  const [subscribeModalOpen, setSubscribeModalOpen] = React.useState(false);

  const plansRef = React.useRef<HTMLDivElement>(null);

  const scrollToPlans = () => {
    plansRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const completed = appointments.filter((a) => a.status === "completed").length;
  const credits = Number(customerData?.credits || 0);
  const cashback = Number(customerData?.cashback_balance || 0);

  // Filtra planos ativos da barbearia
  const activePlans = subscriptionPlans?.length > 0
    ? subscriptionPlans.filter((p) => p.active !== false && p.is_active !== false)
    : [];

  const handleOpenSubscribe = (plan?: any) => {
    setSelectedPlanForSubscribe(plan || activePlans[0] || null);
    setSubscribeModalOpen(true);
  };

  return (
    <div className="space-y-8 text-left">
      {/* 1. HERO COMERCIAL DO CLUBE BARBEX */}
      <div className="relative overflow-hidden rounded-3xl border border-gold/40 bg-gradient-to-br from-zinc-950 via-black to-zinc-900 p-6 md:p-10 shadow-2xl">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-64 h-64 bg-gold/15 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-3 max-w-xl">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-xl bg-gold/15 text-gold border border-gold/30 flex items-center justify-center">
                <Crown size={18} />
              </div>
              <span className="text-xs font-black uppercase tracking-widest text-gold">
                Clube Barbex
              </span>
            </div>

            <h2 className="text-2xl md:text-3xl font-black text-white uppercase tracking-tight">
              Conheça o Clube Barbex
            </h2>

            <p className="text-sm md:text-base text-zinc-300 font-medium leading-relaxed">
              Tenha serviços incluídos todos os meses e benefícios exclusivos na sua barbearia favorita.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Button
                onClick={() => handleOpenSubscribe()}
                className="h-12 px-6 rounded-2xl bg-gold hover:bg-gold/90 text-black font-black uppercase text-xs tracking-wider shadow-lg active:scale-95 transition-all"
              >
                <Crown size={15} className="mr-2" /> Assinar Clube Barbex
              </Button>

              <Button
                variant="outline"
                onClick={scrollToPlans}
                className="h-12 px-5 rounded-2xl border-white/15 bg-white/5 hover:bg-white/10 text-white font-bold uppercase text-xs tracking-wider transition-all"
              >
                Ver planos
              </Button>
            </div>
          </div>

          <div className="hidden lg:flex flex-col items-center justify-center p-6 rounded-2xl bg-zinc-900/80 border border-gold/20 text-center shrink-0 w-60">
            <Sparkles className="text-gold mb-2" size={28} />
            <span className="text-xs font-extrabold uppercase text-white">Economia Recorrente</span>
            <span className="text-[11px] text-zinc-400 mt-1">Cortes e barbas com desconto fixo todo mês</span>
          </div>
        </div>
      </div>

      {/* 2. BENEFÍCIOS DO CLUBE */}
      <div className="space-y-4">
        <h3 className="text-lg font-black text-white uppercase tracking-wider flex items-center gap-2">
          <Sparkles size={18} className="text-gold" /> Vantagens de ser Assinante
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {[
            {
              icon: Scissors,
              title: "Serviços Incluídos",
              desc: "Cortes e barbas cobertos 100% pelo plano sem pagar nada a mais no dia.",
            },
            {
              icon: Calendar,
              title: "Franquia Mensal",
              desc: "Quantidade garantida de atendimentos por mês para manter seu visual sempre impecável.",
            },
            {
              icon: Crown,
              title: "Benefícios Exclusivos",
              desc: "Descontos especiais em produtos, atendimento preferencial e ações VIP.",
            },
            {
              icon: Zap,
              title: "Mais Praticidade",
              desc: "Agendamento rápido pelo WhatsApp ou portal com confirmação instantânea.",
            },
            {
              icon: TrendingDown,
              title: "Economia Recorrente",
              desc: "Pague menos por cada serviço em comparação ao valor avulso de tabela.",
            },
          ].map((item, idx) => {
            const Icon = item.icon;
            return (
              <div
                key={idx}
                className="p-4 rounded-2xl bg-zinc-950 border border-white/10 flex flex-col justify-between space-y-2 hover:border-gold/30 transition-all"
              >
                <div className="h-9 w-9 rounded-xl bg-gold/10 text-gold flex items-center justify-center shrink-0">
                  <Icon size={18} />
                </div>
                <div>
                  <h4 className="text-xs font-black text-white uppercase">{item.title}</h4>
                  <p className="text-[11px] text-zinc-400 mt-1 leading-snug">{item.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. VITRINE DE PLANOS */}
      <div ref={plansRef} className="space-y-4 pt-2">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-black text-white uppercase tracking-wider flex items-center gap-2">
            <Crown size={18} className="text-gold" /> Planos Disponíveis
          </h3>
          <span className="text-xs text-zinc-400">Escolha o plano ideal para você</span>
        </div>

        {activePlans.length === 0 ? (
          <div className="p-8 rounded-2xl bg-zinc-950 border border-white/10 text-center text-zinc-400 text-xs">
            Planos de assinatura em atualização pela barbearia. Consulte a recepção.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {activePlans.map((plan: any) => {
              const price = Number(plan.monthly_price ?? plan.price ?? 0);
              const maxUses = plan.max_uses_per_month ?? 8;
              const services = Array.isArray(plan.plan_services)
                ? plan.plan_services.map((ps: any) => ps.service?.name || ps.name).filter(Boolean)
                : ["Corte Tesoura", "Corte Máquina", "Barba", "Combo Cabelo + Barba"];

              return (
                <div
                  key={plan.id}
                  className="rounded-3xl border border-gold/30 bg-zinc-950 p-6 shadow-xl flex flex-col justify-between space-y-6 hover:border-gold transition-all relative overflow-hidden group"
                >
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xl font-black text-white">{plan.name}</h4>
                      <Badge className="bg-gold/15 text-gold border-gold/30 text-[9px] font-black uppercase px-2 py-0.5">
                        {maxUses} serviços/mês
                      </Badge>
                    </div>

                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-black text-gold">
                        R$ {price.toFixed(2).replace(".", ",")}
                      </span>
                      <span className="text-xs text-zinc-400 font-bold">/mês</span>
                    </div>

                    {plan.description && (
                      <p className="text-xs text-zinc-400 leading-snug">{plan.description}</p>
                    )}

                    <div className="pt-3 border-t border-white/10 space-y-2">
                      <span className="text-[10px] uppercase font-bold text-zinc-400 block tracking-wider">
                        Serviços Incluídos:
                      </span>
                      <ul className="space-y-1.5">
                        {services.map((svc: string, sIdx: number) => (
                          <li key={sIdx} className="flex items-center gap-2 text-xs text-zinc-300">
                            <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
                            <span>{svc}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <Button
                    onClick={() => handleOpenSubscribe(plan)}
                    className="w-full h-12 rounded-2xl bg-gold hover:bg-gold/90 text-black font-black uppercase text-xs tracking-wider shadow-lg active:scale-95 transition-all"
                  >
                    Assinar este plano
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 4. RECURSOS NORMAIS DO CLIENTE (ATENDIMENTOS, CRÉDITOS, CASHBACK) */}
      <div className="pt-4 border-t border-white/10 space-y-4">
        <h3 className="text-base font-black text-white uppercase tracking-wider">
          Sua Conta & Histórico
        </h3>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <button
            type="button"
            onClick={onNewAppointment}
            className="p-4 rounded-2xl bg-zinc-900 border border-white/10 hover:border-gold/40 hover:bg-zinc-800/80 transition-all text-left group"
          >
            <Scissors size={18} className="text-gold mb-2 group-hover:scale-110 transition-transform" />
            <p className="text-xs font-black text-white uppercase">Agendar Avulso</p>
            <p className="text-[10px] text-zinc-400 mt-0.5">Marcar novo horário</p>
          </button>

          <button
            type="button"
            onClick={() => onNavigate("appointments")}
            className="p-4 rounded-2xl bg-zinc-900 border border-white/10 hover:border-gold/40 hover:bg-zinc-800/80 transition-all text-left group"
          >
            <Calendar size={18} className="text-gold mb-2 group-hover:scale-110 transition-transform" />
            <p className="text-xs font-black text-white uppercase">Meus Agendamentos</p>
            <p className="text-[10px] text-zinc-400 mt-0.5">{completed} atendimentos</p>
          </button>

          <button
            type="button"
            onClick={() => onNavigate("finances")}
            className="p-4 rounded-2xl bg-zinc-900 border border-white/10 hover:border-gold/40 hover:bg-zinc-800/80 transition-all text-left group"
          >
            <Coins size={18} className="text-emerald-400 mb-2 group-hover:scale-110 transition-transform" />
            <p className="text-xs font-black text-white uppercase">Créditos</p>
            <p className="text-[10px] text-emerald-400 mt-0.5">R$ {credits.toFixed(2)}</p>
          </button>

          <button
            type="button"
            onClick={() => onNavigate("finances")}
            className="p-4 rounded-2xl bg-zinc-900 border border-white/10 hover:border-gold/40 hover:bg-zinc-800/80 transition-all text-left group"
          >
            <Wallet size={18} className="text-gold mb-2 group-hover:scale-110 transition-transform" />
            <p className="text-xs font-black text-white uppercase">Cashback</p>
            <p className="text-[10px] text-gold mt-0.5">R$ {cashback.toFixed(2)}</p>
          </button>
        </div>
      </div>

      {/* MODAL DE ASSINATURA */}
      {subscribeModalOpen && (
        <SubscribePlanModal
          open={subscribeModalOpen}
          onClose={() => {
            setSubscribeModalOpen(false);
            if (onRefresh) onRefresh();
          }}
          plan={selectedPlanForSubscribe}
          tenantId={shop?.id}
          slug={slug}
          defaultName={customerData?.name || client?.name || ""}
          defaultPhone={customerData?.phone || client?.phone || ""}
        />
      )}
    </div>
  );
}
