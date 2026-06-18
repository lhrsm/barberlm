import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { format, parseISO, isAfter, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { QRCodeSVG } from "qrcode.react";
import {
  Crown,
  CalendarClock,
  QrCode,
  Share2,
  Gift,
  Sparkles,
  CheckCircle2,
  History,
  Scissors,
  Clock,
  Trophy,
  Star,
  Edit2,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

type Props = {
  client: any;
  shop: any;
  slug: string;
  customerData: any;
  mySubscription: any;
  appointments: any[];
  subPlanServices: any[];
  benefitBalances: any[];
  subRewards: any[];
  subRewardsHistory: any[];
  subUsageLogs: any[];
  myReferrals: any[];
  onOpenCard: () => void;
  onReschedule: (app: any) => void;
  onCancel: (app: any) => void;
};

const MILESTONES = [3, 6, 12, 24];

export function SubscriberPanel({
  client,
  shop,
  slug,
  mySubscription,
  appointments,
  subPlanServices,
  benefitBalances,
  subRewards,
  subRewardsHistory,
  subUsageLogs,
  myReferrals,
  onOpenCard,
  onReschedule,
  onCancel,
}: Props) {
  const startedAt = mySubscription.started_at
    ? new Date(mySubscription.started_at)
    : new Date(mySubscription.created_at);
  const renewalAt = mySubscription.next_billing_date
    ? new Date(mySubscription.next_billing_date)
    : mySubscription.current_period_end
    ? new Date(mySubscription.current_period_end)
    : null;
  const totalPausedDays = Number(mySubscription.total_paused_days || 0);
  const effectiveMs = Date.now() - startedAt.getTime() - totalPausedDays * 86400000;
  const monthsVip = Math.max(0, Math.floor(effectiveMs / (1000 * 60 * 60 * 24 * 30.4375)));
  const isPaused = mySubscription.status === "paused";

  // utilization — fallback: sum per-service limits from subPlanServices when plan-level limit not set
  const planUsageLimit = Number(mySubscription.plan?.usage_limit ?? 0);
  const servicesSumLimit = (subPlanServices || []).reduce(
    (acc: number, s: any) => acc + Number(s?.usage_limit ?? 0),
    0,
  );
  const benefitsSumLimit = (benefitBalances || []).reduce(
    (acc: number, b: any) => acc + Number(b?.limit ?? b?.total ?? 0),
    0,
  );
  const usageMax = planUsageLimit > 0 ? planUsageLimit : servicesSumLimit > 0 ? servicesSumLimit : benefitsSumLimit;
  const usageUsed = Number(mySubscription.usage_count ?? subUsageLogs.length ?? 0);
  const usageRemaining = Math.max(0, usageMax - usageUsed);
  const usagePct = usageMax > 0 ? Math.min(100, (usageUsed / usageMax) * 100) : 0;

  // next appointment
  const nextApp = [...appointments]
    .filter((a) => a.status !== "cancelled" && a.start_time && isAfter(parseISO(a.start_time), new Date()))
    .sort((a, b) => parseISO(a.start_time).getTime() - parseISO(b.start_time).getTime())[0];

  // referral
  const referralCode = mySubscription.referral_code as string | undefined;
  const referralLink =
    typeof window !== "undefined" && referralCode
      ? `${window.location.origin}/${slug}/portal?ref=${referralCode}`
      : "";
  const referralsConfirmed = myReferrals.filter((r) => r.status === "confirmed").length;
  const nextReferralReward = Math.max(0, 3 - (referralsConfirmed % 3));

  const shareWhatsapp = () => {
    if (!referralLink) return;
    const msg = encodeURIComponent(
      `Conheça a ${shop?.business_name || "barbearia"}! Use meu código *${referralCode}* e ganhe vantagens: ${referralLink}`,
    );
    window.open(`https://wa.me/?text=${msg}`, "_blank");
  };

  const shareCard = async () => {
    const url = mySubscription.card_token
      ? `${window.location.origin}/subscription-card/validate/${mySubscription.card_token}`
      : window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: "Meu Cartão Premium", url });
      } else {
        await navigator.clipboard.writeText(url);
        toast.success("Link copiado");
      }
    } catch {}
  };

  return (
    <div className="space-y-6">
      {/* HEADER PREMIUM */}
      <div className="relative overflow-hidden rounded-2xl border border-[#D4AF37]/40 bg-gradient-to-br from-[#1a1408] via-black to-black p-6 shadow-[0_8px_40px_rgba(212,175,55,0.18)]">
        <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-[#D4AF37]/10 blur-3xl pointer-events-none" />
        <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-[#D4AF37] to-[#8B6914] flex items-center justify-center shadow-[0_0_30px_rgba(212,175,55,0.4)]">
              <Crown className="h-7 w-7 text-black" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.35em] text-[#D4AF37]">Área Premium</p>
              <h1 className="text-2xl md:text-3xl font-black text-white mt-0.5">{client?.name}</h1>
              <p className="text-xs text-gray-400 mt-1">
                Plano <span className="text-[#D4AF37] font-bold">{mySubscription.plan?.name || "Premium"}</span>
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
              <p className="text-[9px] uppercase tracking-widest text-gray-500 font-bold">Adesão</p>
              <p className="text-white font-bold mt-0.5">{format(startedAt, "dd/MM/yyyy", { locale: ptBR })}</p>
            </div>
            <div className="rounded-xl border border-[#D4AF37]/30 bg-[#D4AF37]/5 px-3 py-2">
              <p className="text-[9px] uppercase tracking-widest text-[#D4AF37]/80 font-bold">Próx. Renovação</p>
              <p className="text-white font-bold mt-0.5">
                {renewalAt ? format(renewalAt, "dd/MM/yyyy", { locale: ptBR }) : "—"}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* CARD PRINCIPAL DO PLANO */}
        <Card className="bg-gradient-to-br from-[#D4AF37]/10 via-black/60 to-black border-[#D4AF37]/40 shadow-[0_8px_30px_rgba(212,175,55,0.18)] lg:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardDescription className="uppercase text-[10px] font-black tracking-[0.3em] text-[#D4AF37]">
                  Plano Ativo
                </CardDescription>
                <CardTitle className="text-2xl font-black text-white mt-1">
                  {mySubscription.plan?.name || "Premium"}
                </CardTitle>
              </div>
              <Badge
                className={cn(
                  "font-black uppercase text-[10px]",
                  isPaused ? "bg-blue-400 text-black" : "bg-[#D4AF37] text-black",
                )}
              >
                {isPaused ? "Pausada" : "Ativa"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="rounded-xl border border-white/10 bg-black/40 p-3">
                <p className="text-[9px] uppercase tracking-widest text-gray-500 font-bold">Utilizações restantes</p>
                <p className="text-2xl font-black text-[#D4AF37] mt-1">
                  {usageMax > 0 ? usageRemaining : "∞"}
                </p>
              </div>
              <div className="rounded-xl border border-white/10 bg-black/40 p-3">
                <p className="text-[9px] uppercase tracking-widest text-gray-500 font-bold">Utilizações consumidas</p>
                <p className="text-2xl font-black text-white mt-1">{usageUsed}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-black/40 p-3">
                <p className="text-[9px] uppercase tracking-widest text-gray-500 font-bold">Tempo VIP</p>
                <p className="text-2xl font-black text-white mt-1">
                  {monthsVip} <span className="text-xs text-gray-400">{monthsVip === 1 ? "mês" : "meses"}</span>
                </p>
              </div>
              <div className="rounded-xl border border-white/10 bg-black/40 p-3">
                <p className="text-[9px] uppercase tracking-widest text-gray-500 font-bold">Renovação</p>
                <p className="text-sm font-bold text-white mt-1">
                  {renewalAt
                    ? `${differenceInDays(renewalAt, new Date())} dias`
                    : "—"}
                </p>
              </div>
            </div>
            {usageMax > 0 && (
              <div>
                <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">
                  <span>Progresso do ciclo</span>
                  <span className="text-[#D4AF37]">{usageUsed}/{usageMax}</span>
                </div>
                <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-[#D4AF37] to-[#F5D061] transition-all duration-700"
                    style={{ width: `${usagePct}%` }}
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* PRÓXIMO ATENDIMENTO */}
        <Card className="bg-white/5 border-white/10">
          <CardHeader className="pb-3">
            <CardTitle className="text-white text-base flex items-center gap-2">
              <CalendarClock className="h-4 w-4 text-[#D4AF37]" /> Próximo Atendimento
            </CardTitle>
          </CardHeader>
          <CardContent>
            {nextApp ? (
              <div className="space-y-3">
                <div className="rounded-xl border border-[#D4AF37]/20 bg-black/40 p-4 space-y-2">
                  <p className="text-xl font-black text-white">
                    {format(parseISO(nextApp.start_time), "dd 'de' MMMM", { locale: ptBR })}
                  </p>
                  <p className="text-sm text-[#D4AF37] font-bold">
                    {format(parseISO(nextApp.start_time), "HH:mm", { locale: ptBR })} — {nextApp.services?.name}
                  </p>
                  <p className="text-xs text-gray-400">Profissional: {nextApp.barbers?.name}</p>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 border-[#D4AF37]/40 text-[#D4AF37] hover:bg-[#D4AF37]/10"
                    onClick={() => onReschedule(nextApp)}
                  >
                    <Edit2 className="h-3 w-3 mr-1" /> Reagendar
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 border-red-500/40 text-red-300 hover:bg-red-500/10"
                    onClick={() => onCancel(nextApp)}
                  >
                    <XCircle className="h-3 w-3 mr-1" /> Cancelar
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-500 text-center py-6">Nenhum agendamento futuro.</p>
            )}
          </CardContent>
        </Card>

        {/* BENEFÍCIOS DISPONÍVEIS */}
        <Card className="bg-white/5 border-white/10">
          <CardHeader className="pb-3">
            <CardTitle className="text-white text-base flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-[#D4AF37]" /> Benefícios do Plano
            </CardTitle>
          </CardHeader>
          <CardContent>
            {benefitBalances.length > 0 ? (
              <ul className="space-y-2">
                {benefitBalances.map((b: any, i: number) => (
                  <li key={i} className="flex items-center justify-between p-3 bg-black/30 rounded-lg border border-white/10">
                    <span className="text-sm text-white font-bold">{b.category_name || b.name || "Benefício"}</span>
                    <Badge className="bg-[#D4AF37]/15 text-[#D4AF37] border-[#D4AF37]/40">
                      {b.remaining ?? b.balance ?? 0}/{b.limit ?? b.total ?? "∞"}
                    </Badge>
                  </li>
                ))}
              </ul>
            ) : subPlanServices.length > 0 ? (
              <ul className="space-y-2">
                {subPlanServices.map((s: any) => (
                  <li key={s.id} className="flex items-center justify-between p-3 bg-black/30 rounded-lg border border-white/10">
                    <span className="text-sm text-white">
                      <CheckCircle2 className="h-3 w-3 text-[#D4AF37] inline mr-2" />
                      {s.services?.name || "Serviço"}
                    </span>
                    {s.usage_limit ? (
                      <Badge variant="outline" className="text-[10px] text-gray-300">
                        {s.usage_limit}x / ciclo
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] text-[#D4AF37] border-[#D4AF37]/40">
                        Ilimitado
                      </Badge>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-500 text-center py-6">Nenhum benefício configurado.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* CARTÃO DIGITAL PREMIUM */}
      {mySubscription.card_token && (
        <Card className="bg-gradient-to-br from-black via-[#1a1408] to-black border-[#D4AF37]/40 shadow-[0_8px_30px_rgba(212,175,55,0.18)]">
          <CardContent className="p-6 flex flex-col md:flex-row md:items-center gap-6">
            <div className="bg-white p-3 rounded-xl shrink-0 mx-auto md:mx-0">
              <QRCodeSVG
                value={`${typeof window !== "undefined" ? window.location.origin : ""}/subscription-card/validate/${mySubscription.card_token}`}
                size={120}
              />
            </div>
            <div className="flex-1 text-center md:text-left">
              <p className="text-[10px] uppercase tracking-[0.35em] text-[#D4AF37] font-black">Cartão Digital Premium</p>
              <h3 className="text-xl font-black text-white mt-1">{client?.name}</h3>
              <p className="text-xs text-gray-400">
                Assinante #{String(mySubscription.id).slice(0, 8).toUpperCase()}
              </p>
              <div className="flex flex-wrap justify-center md:justify-start gap-2 mt-3">
                <Button
                  size="sm"
                  onClick={onOpenCard}
                  className="bg-[#D4AF37] hover:bg-[#F5D061] text-black font-bold gap-2"
                >
                  <QrCode className="h-4 w-4" /> Ver Cartão
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={shareCard}
                  className="border-[#D4AF37]/40 text-[#D4AF37] hover:bg-[#D4AF37]/10 gap-2"
                >
                  <Share2 className="h-4 w-4" /> Compartilhar
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* CLUBE PREMIUM TIMELINE */}
      <Card className="bg-white/5 border-white/10">
        <CardHeader className="pb-3">
          <CardTitle className="text-white text-base flex items-center gap-2">
            <Trophy className="h-4 w-4 text-[#D4AF37]" /> Clube Premium
          </CardTitle>
          <CardDescription className="text-gray-400 text-xs">Recompensas por tempo de assinatura</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <div className="absolute left-0 right-0 top-5 h-0.5 bg-white/10" />
            <div
              className="absolute left-0 top-5 h-0.5 bg-gradient-to-r from-[#D4AF37] to-[#F5D061] transition-all duration-700"
              style={{ width: `${Math.min(100, (monthsVip / 24) * 100)}%` }}
            />
            <div className="relative grid grid-cols-4 gap-2">
              {MILESTONES.map((m) => {
                const reached = monthsVip >= m;
                const reward = subRewards.find((r: any) => r.months_required === m);
                return (
                  <div key={m} className="flex flex-col items-center text-center">
                    <div
                      className={cn(
                        "h-10 w-10 rounded-full flex items-center justify-center border-2 z-10 transition-all",
                        reached
                          ? "bg-gradient-to-br from-[#D4AF37] to-[#8B6914] border-[#D4AF37] shadow-[0_0_20px_rgba(212,175,55,0.5)]"
                          : "bg-black border-white/20",
                      )}
                    >
                      <Star className={cn("h-4 w-4", reached ? "text-black" : "text-gray-600")} />
                    </div>
                    <p className={cn("text-xs font-black mt-2", reached ? "text-[#D4AF37]" : "text-gray-500")}>
                      {m}m
                    </p>
                    <p className="text-[9px] text-gray-500 mt-0.5 line-clamp-2">
                      {reward?.description || reward?.reward_type || "Recompensa"}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
          {subRewardsHistory.length > 0 && (
            <div className="mt-4 pt-4 border-t border-white/10">
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">
                Conquistadas ({subRewardsHistory.length})
              </p>
              <div className="flex flex-wrap gap-1.5">
                {subRewardsHistory.slice(0, 8).map((h: any) => (
                  <Badge key={h.id} variant="outline" className="bg-[#D4AF37]/10 text-[#D4AF37] border-[#D4AF37]/40 text-[10px]">
                    {h.notes || "Recompensa"}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* PROGRAMA DE INDICAÇÃO */}
      {referralCode && (
        <Card className="bg-gradient-to-br from-fuchsia-950/40 via-black/60 to-black border-fuchsia-500/30 shadow-[0_8px_30px_rgba(217,70,239,0.15)]">
          <CardHeader className="pb-3">
            <CardTitle className="text-fuchsia-200 text-base flex items-center gap-2">
              <Gift className="h-4 w-4" /> Programa de Indicação
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-lg border border-fuchsia-500/20 bg-black/40 p-3 text-center">
                <p className="text-[9px] uppercase tracking-widest text-fuchsia-300/70 font-bold">Código</p>
                <p className="text-base font-black text-fuchsia-100 mt-1 tracking-widest">{referralCode}</p>
              </div>
              <div className="rounded-lg border border-fuchsia-500/20 bg-black/40 p-3 text-center">
                <p className="text-[9px] uppercase tracking-widest text-fuchsia-300/70 font-bold">Indicações</p>
                <p className="text-2xl font-black text-fuchsia-100 mt-1">{referralsConfirmed}</p>
              </div>
              <div className="rounded-lg border border-fuchsia-500/20 bg-black/40 p-3 text-center">
                <p className="text-[9px] uppercase tracking-widest text-fuchsia-300/70 font-bold">Próx. recompensa</p>
                <p className="text-base font-black text-fuchsia-100 mt-1">
                  {nextReferralReward} {nextReferralReward === 1 ? "indicação" : "indicações"}
                </p>
              </div>
            </div>
            <Button
              onClick={shareWhatsapp}
              className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-black gap-2"
            >
              <Share2 className="h-4 w-4" /> Compartilhar no WhatsApp
            </Button>
          </CardContent>
        </Card>
      )}

      {/* HISTÓRICO DE UTILIZAÇÃO */}
      <Card className="bg-white/5 border-white/10">
        <CardHeader className="pb-3">
          <CardTitle className="text-white text-base flex items-center gap-2">
            <History className="h-4 w-4 text-[#D4AF37]" /> Histórico de Utilização
          </CardTitle>
        </CardHeader>
        <CardContent>
          {subUsageLogs.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-6">Nenhuma utilização registrada ainda.</p>
          ) : (
            <ul className="space-y-2">
              {subUsageLogs.slice(0, 10).map((log: any) => (
                <li
                  key={log.id}
                  className="flex items-center justify-between p-3 bg-black/30 rounded-lg border border-white/10"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-lg bg-[#D4AF37]/10 flex items-center justify-center">
                      <Scissors className="h-4 w-4 text-[#D4AF37]" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-white">{log.services?.name || "Serviço"}</p>
                      <p className="text-[10px] text-gray-500 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {log.used_at ? format(parseISO(log.used_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) : "—"}
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-[10px] text-[#D4AF37] border-[#D4AF37]/30">
                    Premium
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
