import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Ticket,
  Copy,
  Check,
  Percent,
  Calendar,
  Sparkles,
  Tag
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface Coupon {
  id: string;
  code: string;
  type: 'fixed' | 'percentage';
  value: number;
  minimum_amount?: number | null;
  max_discount?: number | null;
  usage_limit?: number | null;
  used_count?: number;
  starts_at?: string;
  expires_at?: string | null;
  active: boolean;
  applies_to?: string;
  description?: string;
}

interface CouponsTabProps {
  coupons: Coupon[];
  couponsStatus?: 'success' | 'error' | 'unknown';
  shopSlug?: string;
  shopName?: string;
}

export function CouponsTab({ coupons = [], couponsStatus = 'success', shopSlug, shopName }: CouponsTabProps) {
  const [activeFilter, setActiveFilter] = useState<'available' | 'expired'>('available');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const now = new Date();

  // Classificação dos cupons
  const availableCoupons = coupons.filter(c => {
    if (!c.active) return false;
    if (c.expires_at && new Date(c.expires_at) < now) return false;
    if (c.usage_limit && (c.used_count || 0) >= c.usage_limit) return false;
    return true;
  });

  const expiredCoupons = coupons.filter(c => {
    if (!c.active) return true;
    if (c.expires_at && new Date(c.expires_at) < now) return true;
    return false;
  });

  // Identificar melhor oferta
  const bestPercentage = availableCoupons.filter(c => c.type === 'percentage').sort((a, b) => b.value - a.value)[0];
  const bestFixed = availableCoupons.filter(c => c.type === 'fixed').sort((a, b) => b.value - a.value)[0];
  const bestDiscountLabel = bestPercentage
    ? `${bestPercentage.value}% OFF`
    : bestFixed
    ? `R$ ${Number(bestFixed.value).toFixed(0)} OFF`
    : "—";

  const handleCopyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);
      toast.success(`Cupom ${code} copiado!`, {
        description: "Informe o código no momento do seu agendamento."
      });
      setTimeout(() => setCopiedCode(null), 3000);
    } catch (err) {
      toast.error("Não foi possível copiar o código.");
    }
  };

  const currentList = activeFilter === 'available' ? availableCoupons : expiredCoupons;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header com Resumo */}
      <div>
        <h2 className="text-2xl font-black text-white uppercase italic tracking-tight flex items-center gap-3">
          <Ticket className="text-gold h-7 w-7" />
          Cupons & Vouchers da Barbearia
        </h2>
        <p className="text-sm text-zinc-400 mt-1">
          Confira os códigos promocionais e condições disponíveis na <span className="text-white font-bold">{shopName || 'Barbearia'}</span>.
        </p>
      </div>

      {/* KPI Cards de Resumo */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-gold/10 via-zinc-900/60 to-black border-gold/20 rounded-2xl overflow-hidden shadow-lg">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-gold/80">Cupons Disponíveis</p>
              <h3 className="text-3xl font-black text-white mt-1">{availableCoupons.length}</h3>
              <p className="text-[11px] text-zinc-400 font-medium mt-0.5">Válidos para uso</p>
            </div>
            <div className="h-12 w-12 rounded-2xl bg-gold/10 border border-gold/20 flex items-center justify-center text-gold">
              <Sparkles size={24} />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-emerald-500/10 via-zinc-900/60 to-black border-emerald-500/20 rounded-2xl overflow-hidden shadow-lg">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-emerald-400/80">Melhor Oferta</p>
              <h3 className="text-2xl md:text-3xl font-black text-white mt-1">
                {bestDiscountLabel}
              </h3>
              <p className="text-[11px] text-zinc-400 font-medium mt-0.5">Maior benefício ativo</p>
            </div>
            <div className="h-12 w-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Percent size={24} />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-zinc-800/40 via-zinc-900/60 to-black border-white/5 rounded-2xl overflow-hidden shadow-lg">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Total de Campanhas</p>
              <h3 className="text-3xl font-black text-white mt-1">{coupons.length}</h3>
              <p className="text-[11px] text-zinc-500 font-medium mt-0.5">Criadas pelo estabelecimento</p>
            </div>
            <div className="h-12 w-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-zinc-400">
              <Ticket size={24} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Seletor de Abas / Filtros */}
      <div className="flex items-center gap-2 bg-[#05070D] p-1.5 rounded-2xl border border-white/5 w-full sm:w-fit">
        {[
          { id: 'available', label: 'Disponíveis', count: availableCoupons.length },
          { id: 'expired', label: 'Expirados / Encerrados', count: expiredCoupons.length },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveFilter(tab.id as any)}
            className={cn(
              "px-5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2",
              activeFilter === tab.id
                ? "bg-gold text-black shadow-lg"
                : "text-zinc-400 hover:text-white hover:bg-white/5"
            )}
          >
            <span>{tab.label}</span>
            <span className={cn(
              "text-[10px] px-1.5 py-0.2 rounded-md font-bold",
              activeFilter === tab.id ? "bg-black/20 text-black" : "bg-white/10 text-zinc-400"
            )}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Grid de Cupons */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <AnimatePresence mode="popLayout">
          {currentList.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="col-span-full"
            >
              <Card className="bg-white/[0.02] border-white/5 border-dashed rounded-3xl py-16 text-center">
                <div className="max-w-md mx-auto space-y-3">
                  <div className="h-16 w-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto text-zinc-600">
                    <Ticket size={32} />
                  </div>
                  <h4 className="text-lg font-black text-white uppercase italic tracking-tight">
                    {couponsStatus === 'error'
                      ? "Não foi possível carregar os cupons"
                      : activeFilter === 'available'
                      ? "Nenhum cupom ativo no momento"
                      : "Nenhum cupom expirado"}
                  </h4>
                  <p className="text-xs text-zinc-500 leading-relaxed">
                    {couponsStatus === 'error'
                      ? "Houve uma oscilação temporária ao consultar os cupons da barbearia. Tente recarregar em instantes."
                      : activeFilter === 'available'
                      ? "Fique atento às notificações da barbearia para aproveitar novos códigos promocionais."
                      : "Histórico limpo sem cupons encerrados."}
                  </p>
                </div>
              </Card>
            </motion.div>
          ) : (
            currentList.map((coupon, idx) => {
              const isAvailable = activeFilter === 'available';
              const isCopied = copiedCode === coupon.code;
              const formattedDiscount = coupon.type === 'percentage'
                ? `${coupon.value}% OFF`
                : `R$ ${Number(coupon.value).toFixed(0)} OFF`;

              return (
                <motion.div
                  key={coupon.id || idx}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: idx * 0.05 }}
                >
                  <Card className={cn(
                    "relative overflow-hidden rounded-3xl border transition-all duration-300 group",
                    isAvailable
                      ? "bg-gradient-to-br from-[#0e131f] via-[#090d14] to-black border-gold/30 hover:border-gold/60 shadow-lg hover:shadow-gold/10"
                      : "bg-zinc-950/40 border-white/5 opacity-60 grayscale-[40%]"
                  )}>
                    {/* Borda decorativa estilo ingresso */}
                    <div className="absolute -left-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-[#05070d] border-r border-white/10" />
                    <div className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-[#05070d] border-l border-white/10" />

                    <CardContent className="p-6 md:p-7 space-y-5">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className={cn(
                              "text-2xl md:text-3xl font-black uppercase italic tracking-tighter",
                              isAvailable ? "text-gold" : "text-zinc-400"
                            )}>
                              {formattedDiscount}
                            </span>
                            {isAvailable && (
                              <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-[9px] font-black uppercase tracking-widest">
                                Válido
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-zinc-400 font-medium mt-1">
                            {coupon.description || `Desconto para atendimentos na ${shopName || 'barbearia'}.`}
                          </p>
                        </div>
                      </div>

                      {/* Código do Cupom */}
                      <div className="flex items-center justify-between p-3.5 rounded-2xl bg-black/60 border border-white/10 group-hover:border-gold/30 transition-colors">
                        <div className="flex items-center gap-2">
                          <Tag size={16} className="text-gold" />
                          <span className="font-mono text-sm md:text-base font-black tracking-widest text-white uppercase">
                            {coupon.code}
                          </span>
                        </div>
                        {isAvailable && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleCopyCode(coupon.code)}
                            className="h-8 px-3 text-xs font-black uppercase tracking-wider text-gold hover:text-black hover:bg-gold transition-all rounded-xl gap-1.5"
                          >
                            {isCopied ? <Check size={14} /> : <Copy size={14} />}
                            <span>{isCopied ? "Copiado!" : "Copiar"}</span>
                          </Button>
                        )}
                      </div>

                      {/* Regras e Validade */}
                      <div className="flex flex-wrap items-center justify-between text-[11px] text-zinc-400 pt-1 border-t border-white/5 gap-2">
                        <div className="flex items-center gap-1.5">
                          <Calendar size={13} className="text-zinc-500" />
                          <span>
                            {coupon.expires_at
                              ? `Válido até ${format(parseISO(coupon.expires_at), "dd/MM/yyyy", { locale: ptBR })}`
                              : "Sem expiração"}
                          </span>
                        </div>

                        {Number(coupon.minimum_amount || 0) > 0 && (
                          <span className="text-zinc-500 font-medium">
                            Mínimo: R$ {Number(coupon.minimum_amount).toFixed(2)}
                          </span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
