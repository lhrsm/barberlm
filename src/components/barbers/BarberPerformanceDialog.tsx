import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { BarChart3, Star, Wallet, CalendarCheck, TrendingUp, Coins, XCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const PERIODS = [
  { key: "7", label: "7 dias" },
  { key: "30", label: "30 dias" },
  { key: "90", label: "90 dias" },
] as const;

function brl(v: number) {
  return `R$ ${Number(v || 0).toFixed(2)}`;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  barber: any;
  tenantId?: string;
}

export function BarberPerformanceDialog({ open, onOpenChange, barber, tenantId }: Props) {
  const [period, setPeriod] = useState<string>("30");
  const [loading, setLoading] = useState(false);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [commissions, setCommissions] = useState<any[]>([]);
  const [tips, setTips] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [servicesMap, setServicesMap] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open || !barber?.id) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      const since = new Date();
      since.setDate(since.getDate() - Number(period));
      const sinceIso = since.toISOString();

      const [apptRes, commRes, tipsRes, revRes, svcRes] = await Promise.all([
        supabase
          .from("appointments")
          .select("id, status, start_time, total_price, final_amount, service_id, appointment_type, tip_amount")
          .eq("barber_id", barber.id)
          .gte("start_time", sinceIso),
        supabase
          .from("commission_entries")
          .select("commission_amount, status, earned_at")
          .eq("barber_id", barber.id)
          .gte("earned_at", sinceIso),
        supabase
          .from("barber_tips")
          .select("amount, status, created_at")
          .eq("barber_id", barber.id)
          .gte("created_at", sinceIso),
        supabase
          .from("appointment_reviews")
          .select("barber_rating, service_rating, created_at")
          .eq("barber_id", barber.id)
          .gte("created_at", sinceIso),
        supabase.from("services").select("id, name"),
      ]);

      if (cancelled) return;
      setAppointments(apptRes.data || []);
      setCommissions(commRes.data || []);
      setTips(tipsRes.data || []);
      setReviews(revRes.data || []);
      setServicesMap(Object.fromEntries((svcRes.data || []).map((s: any) => [s.id, s.name])));
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [open, barber?.id, period, tenantId]);

  const stats = useMemo(() => {
    const completed = appointments.filter((a) => a.status === "completed");
    const cancelled = appointments.filter((a) => a.status === "cancelled" || a.status === "no_show");
    const revenue = completed.reduce((s, a) => s + Number(a.final_amount ?? a.total_price ?? 0), 0);
    const commissionTotal = commissions.reduce((s, c) => s + Number(c.commission_amount || 0), 0);
    const commissionPending = commissions
      .filter((c) => c.status === "pending")
      .reduce((s, c) => s + Number(c.commission_amount || 0), 0);
    const tipsTotal = tips
      .filter((t) => t.status !== "cancelled")
      .reduce((s, t) => s + Number(t.amount || 0), 0);
    const ratings = reviews.map((r) => Number(r.barber_rating || 0)).filter((n) => n > 0);
    const avgRating = ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0;
    const ticket = completed.length ? revenue / completed.length : 0;
    const walkins = appointments.filter((a) => a.appointment_type === "walk_in").length;

    const byService: Record<string, { count: number; total: number }> = {};
    completed.forEach((a) => {
      const key = a.service_id || "outros";
      byService[key] = byService[key] || { count: 0, total: 0 };
      byService[key].count += 1;
      byService[key].total += Number(a.final_amount ?? a.total_price ?? 0);
    });
    const topServices = Object.entries(byService)
      .map(([id, v]) => ({ name: servicesMap[id] || "Outros", ...v }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);

    return {
      total: appointments.length,
      completedCount: completed.length,
      cancelledCount: cancelled.length,
      revenue,
      commissionTotal,
      commissionPending,
      tipsTotal,
      avgRating,
      ratingsCount: ratings.length,
      ticket,
      walkins,
      topServices,
      completionRate: appointments.length ? (completed.length / appointments.length) * 100 : 0,
    };
  }, [appointments, commissions, tips, reviews, servicesMap]);

  const maxService = stats.topServices[0]?.total || 1;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[88vh] overflow-y-auto bg-[#0b0f17] border-[#D4AF37]/30">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white">
            <BarChart3 className="text-[#D4AF37]" size={20} />
            Desempenho — {barber?.name}
          </DialogTitle>
        </DialogHeader>

        <div className="flex items-center gap-2">
          {PERIODS.map((p) => (
            <Button
              key={p.key}
              size="sm"
              variant="outline"
              onClick={() => setPeriod(p.key)}
              className={cn(
                "h-8 text-xs border-[#D4AF37]/30",
                period === p.key
                  ? "bg-gradient-to-r from-[#D4AF37] to-[#F0D67B] text-black font-black border-[#D4AF37]"
                  : "text-[#D4AF37] hover:bg-[#D4AF37]/10",
              )}
            >
              {p.label}
            </Button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-[#D4AF37]">
            <Loader2 className="animate-spin" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Metric icon={CalendarCheck} label="Atendimentos" value={String(stats.completedCount)} hint={`${stats.total} agendados`} />
              <Metric icon={TrendingUp} label="Faturamento" value={brl(stats.revenue)} hint={`Ticket ${brl(stats.ticket)}`} />
              <Metric icon={Wallet} label="Comissões" value={brl(stats.commissionTotal)} hint={`${brl(stats.commissionPending)} pendente`} />
              <Metric icon={Coins} label="Gorjetas" value={brl(stats.tipsTotal)} hint="PIX digital" />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Metric
                icon={Star}
                label="Avaliação média"
                value={stats.avgRating ? stats.avgRating.toFixed(1) : "—"}
                hint={`${stats.ratingsCount} avaliações`}
              />
              <Metric icon={XCircle} label="Cancelados" value={String(stats.cancelledCount)} hint="inclui no-show" />
              <Metric icon={CalendarCheck} label="Presenciais" value={String(stats.walkins)} hint="walk-in" />
              <Metric icon={TrendingUp} label="Taxa de conclusão" value={`${stats.completionRate.toFixed(0)}%`} hint="do período" />
            </div>

            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-[#D4AF37] mb-3">
                Serviços mais rentáveis
              </p>
              {stats.topServices.length === 0 ? (
                <p className="text-sm text-white/50">Nenhum atendimento concluído no período.</p>
              ) : (
                <div className="space-y-3">
                  {stats.topServices.map((s) => (
                    <div key={s.name} className="space-y-1">
                      <div className="flex items-center justify-between text-xs text-white/80">
                        <span className="truncate">{s.name}</span>
                        <span className="font-bold text-white">
                          {brl(s.total)} <Badge className="ml-2 bg-white/10 text-white/70 border-0 text-[10px]">{s.count}x</Badge>
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-[#D4AF37] to-[#F0D67B]"
                          style={{ width: `${Math.max(6, (s.total / maxService) * 100)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Metric({ icon: Icon, label, value, hint }: { icon: any; label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
      <div className="flex items-center gap-2 text-[#D4AF37]">
        <Icon size={14} />
        <span className="text-[10px] font-black uppercase tracking-widest">{label}</span>
      </div>
      <p className="text-lg font-black text-white mt-1 truncate">{value}</p>
      {hint && <p className="text-[10px] text-white/40 truncate">{hint}</p>}
    </div>
  );
}
