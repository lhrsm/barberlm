import * as React from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Crown, Check, Sparkles, Zap, Star, X } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  shopId?: string;
  onSubscribe: () => void;
};

const BENEFITS = [
  "Atendimento prioritário",
  "Serviços inclusos no plano",
  "Cashback exclusivo",
  "Fidelidade Premium acelerada",
  "Programa de indicação",
  "Cartão Digital Premium",
  "Descontos em produtos",
];

export function ClubBarbexUpgrade({ shopId, onSubscribe }: Props) {
  const [openCompare, setOpenCompare] = React.useState(false);
  const [plans, setPlans] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (!openCompare || !shopId || plans.length) return;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("subscription_plans")
        .select("id, name, description, monthly_price, max_uses_per_month, benefits, included_benefits, display_order")
        .eq("tenant_id", shopId)
        .eq("active", true)
        .order("display_order", { ascending: true });
      setPlans(data || []);
      setLoading(false);
    })();
  }, [openCompare, shopId, plans.length]);

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative overflow-hidden rounded-3xl border border-gold/40 bg-gradient-to-br from-[#12100A] via-[#0A0A0A] to-black p-6 md:p-10 shadow-[0_30px_80px_-20px_rgba(212,175,55,0.45)]"
      >
        <div className="pointer-events-none absolute -top-32 -right-32 h-80 w-80 rounded-full bg-gold/25 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-32 h-80 w-80 rounded-full bg-[#F59E0B]/20 blur-3xl" />
        <div className="pointer-events-none absolute inset-0 opacity-[0.04] bg-[radial-gradient(circle_at_1px_1px,#D4AF37_1px,transparent_0)] [background-size:24px_24px]" />

        <div className="relative grid lg:grid-cols-[1.3fr_1fr] gap-8 items-center">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-gold/15 border border-gold/30 mb-4">
              <Crown className="h-3.5 w-3.5 text-gold" />
              <span className="text-[10px] uppercase tracking-[0.3em] font-black text-gold">Exclusivo Assinantes</span>
            </div>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-black text-white leading-[1.05]">
              Clube Barbex <span className="bg-gradient-to-r from-gold to-[#F5D061] bg-clip-text text-transparent">Premium</span>
            </h2>
            <p className="text-sm md:text-base text-gray-300 mt-3 max-w-lg leading-relaxed">
              Economize todos os meses e desbloqueie benefícios exclusivos utilizando um dos nossos planos.
            </p>

            <ul className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {BENEFITS.map((b, i) => (
                <motion.li
                  key={b}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 + i * 0.04 }}
                  className="flex items-center gap-2.5 text-sm text-gray-200"
                >
                  <span className="h-5 w-5 rounded-full bg-gold/20 border border-gold/40 grid place-items-center shrink-0">
                    <Check className="h-3 w-3 text-gold" strokeWidth={3} />
                  </span>
                  {b}
                </motion.li>
              ))}
            </ul>

            <div className="mt-7 flex flex-col sm:flex-row gap-3">
              <button
                onClick={onSubscribe}
                className="group relative inline-flex items-center justify-center gap-2 h-12 px-8 rounded-xl bg-gradient-to-r from-gold via-[#F5D061] to-gold text-black font-black uppercase tracking-widest text-xs shadow-[0_10px_30px_rgba(212,175,55,0.5)] hover:shadow-[0_15px_45px_rgba(212,175,55,0.7)] hover:-translate-y-0.5 transition-all"
              >
                <Sparkles className="h-4 w-4" />
                Assinar Agora
              </button>
              <button
                onClick={() => setOpenCompare(true)}
                className="inline-flex items-center justify-center gap-2 h-12 px-6 rounded-xl border border-white/15 bg-white/5 text-white font-bold uppercase tracking-widest text-xs hover:bg-white/10 hover:border-gold/40 transition-all"
              >
                Comparar Planos
              </button>
            </div>
          </div>

          <div className="hidden lg:flex items-center justify-center relative">
            <div className="relative w-64 h-80 rounded-3xl bg-gradient-to-br from-[#1A1A1A] to-black border border-gold/30 shadow-[0_20px_60px_rgba(0,0,0,0.5)] p-6 flex flex-col justify-between overflow-hidden">
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-gold/10 via-transparent to-transparent" />
              <div className="relative">
                <div className="flex items-center justify-between">
                  <Crown className="h-8 w-8 text-gold" />
                  <span className="text-[9px] uppercase tracking-widest text-gray-400">Membro Premium</span>
                </div>
                <p className="mt-4 text-xs text-gray-400">Cartão Digital</p>
                <p className="text-2xl font-black text-white leading-tight">Clube Barbex</p>
              </div>
              <div className="relative">
                <p className="text-[10px] text-gray-500 uppercase tracking-widest">Você</p>
                <p className="text-sm font-bold text-gold">Ainda não é membro</p>
                <div className="mt-3 h-1 rounded-full bg-white/5 overflow-hidden">
                  <div className="h-full w-2/3 bg-gradient-to-r from-gold to-[#F5D061]" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      <Dialog open={openCompare} onOpenChange={setOpenCompare}>
        <DialogContent className="max-w-5xl bg-[#0A0A0A] border border-gold/30 text-white p-0 max-h-[90vh] overflow-y-auto">
          <DialogHeader className="p-6 border-b border-white/10 sticky top-0 bg-[#0A0A0A]/95 backdrop-blur z-10">
            <DialogTitle className="text-2xl font-black flex items-center gap-2">
              <Crown className="h-6 w-6 text-gold" /> Compare os Planos
            </DialogTitle>
            <p className="text-sm text-gray-400 mt-1">Escolha o plano ideal e comece a economizar hoje.</p>
          </DialogHeader>
          <div className="p-6">
            {loading ? (
              <div className="grid gap-4 md:grid-cols-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-80 rounded-2xl bg-white/5 border border-white/10 animate-pulse" />
                ))}
              </div>
            ) : plans.length === 0 ? (
              <div className="text-center py-12">
                <X className="h-10 w-10 text-gray-500 mx-auto mb-3" />
                <p className="text-gray-400">Nenhum plano configurado no momento.</p>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {plans.map((p, i) => {
                  const highlight = i === 1 || plans.length === 1;
                  const benefits: string[] = Array.isArray(p.benefits)
                    ? p.benefits
                    : Array.isArray(p.included_benefits)
                    ? p.included_benefits
                    : [];
                  return (
                    <motion.div
                      key={p.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.08 }}
                      className={cn(
                        "relative rounded-2xl border p-5 flex flex-col",
                        highlight
                          ? "border-gold/60 bg-gradient-to-br from-gold/10 to-transparent shadow-[0_15px_45px_-20px_rgba(212,175,55,0.5)]"
                          : "border-white/10 bg-white/[0.03]",
                      )}
                    >
                      {highlight && (
                        <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-gradient-to-r from-gold to-[#F5D061] text-black text-[10px] font-black uppercase tracking-widest flex items-center gap-1">
                          <Star className="h-3 w-3" fill="currentColor" /> Mais Popular
                        </span>
                      )}
                      <h3 className="text-lg font-black text-white">{p.name}</h3>
                      {p.description && (
                        <p className="text-xs text-gray-400 mt-1 line-clamp-2">{p.description}</p>
                      )}
                      <div className="mt-4 flex items-baseline gap-1">
                        <span className="text-3xl font-black text-gold">
                          R$ {Number(p.monthly_price || 0).toFixed(2)}
                        </span>
                        <span className="text-xs text-gray-500">/mês</span>
                      </div>
                      {p.max_uses_per_month && (
                        <p className="text-[11px] text-gray-400 mt-1">
                          Até {p.max_uses_per_month} usos por mês
                        </p>
                      )}
                      <ul className="mt-4 space-y-2 flex-1">
                        {(benefits.length ? benefits : ["Atendimento prioritário", "Cashback exclusivo", "Cartão digital premium"]).slice(0, 6).map((b: string) => (
                          <li key={b} className="flex items-start gap-2 text-xs text-gray-300">
                            <Check className="h-3.5 w-3.5 text-gold shrink-0 mt-0.5" strokeWidth={3} />
                            <span>{b}</span>
                          </li>
                        ))}
                      </ul>
                      <button
                        onClick={() => {
                          setOpenCompare(false);
                          onSubscribe();
                        }}
                        className={cn(
                          "mt-5 h-11 rounded-xl font-black uppercase tracking-widest text-xs transition-all",
                          highlight
                            ? "bg-gradient-to-r from-gold to-[#F5D061] text-black shadow-[0_8px_24px_rgba(212,175,55,0.4)] hover:shadow-[0_12px_32px_rgba(212,175,55,0.6)]"
                            : "bg-white/10 text-white hover:bg-white/15 border border-white/10",
                        )}
                      >
                        <Zap className="inline h-3.5 w-3.5 mr-1" /> Assinar
                      </button>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
