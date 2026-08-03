import { useMemo, useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { format, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Crown,
  Phone,
  Mail,
  Cake,
  Clock,
  Edit,
  MessageCircle,
  CalendarPlus,
  Star,
  Package,
  Wallet,
  CreditCard,
  DollarSign,
  History as HistoryIcon,
  Sparkles,
  Bot,
  StickyNote,
  Repeat,
  Eye,
  BadgeCheck,
  Target,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RTooltip,
  CartesianGrid,
} from "recharts";
import { useCustomerCrm } from "./useCustomerCrm";
import { buildSmartProfile, buildTimeline, computeKpis, formatBRL, initials } from "./metrics";
import { CustomerTimeline } from "./CustomerTimeline";

function openWhatsApp(phone: string | undefined) {
  if (!phone) return;
  window.open(`https://wa.me/55${String(phone).replace(/\D/g, "")}`, "_blank");
}

function Stat({ label, value, accent = "text-white", hint }: any) {
  return (
    <div className="rounded-xl bg-[#111827] border border-[#1f2937] p-3 transition-colors hover:border-gold/30">
      <p className="text-[10px] uppercase text-slate-400 font-bold tracking-wider">{label}</p>
      <p className={cn("text-lg font-black mt-1 leading-tight", accent)}>{value}</p>
      {hint && <p className="text-[10px] text-slate-500 mt-0.5">{hint}</p>}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="text-slate-500 text-sm text-center py-10">{text}</p>;
}

const TAB_CLS =
  "data-[state=active]:bg-gold data-[state=active]:text-black text-slate-300 rounded-lg text-xs font-bold px-3 py-1.5 focus-visible:ring-2 focus-visible:ring-gold";

export function CustomerCrmDialog({
  isOpen,
  onOpenChange,
  customer,
  subscription,
  shopProfile,
  history = [],
  products = [],
  loading,
  onEdit,
  onSaveNotes,
}: any) {
  const crm = useCustomerCrm(customer?.id ?? null, !!isOpen);
  const [notes, setNotes] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);

  useEffect(() => {
    setNotes(customer?.notes || "");
  }, [customer?.id, customer?.notes]);

  const isSub = !!subscription;
  const plan = subscription?.subscription_plans;

  const kpis = useMemo(
    () => (customer ? computeKpis(customer, history, products, crm, isSub) : null),
    [customer, history, products, crm],
  );
  const timeline = useMemo(
    () => (customer ? buildTimeline(customer, history, products, crm, subscription) : []),
    [customer, history, products, crm, subscription],
  );
  const smart = useMemo(
    () => (customer && kpis ? buildSmartProfile(customer, kpis, isSub) : []),
    [customer, kpis, isSub],
  );

  if (!customer || !kpis) return null;

  const maxUses = plan?.max_uses_per_month ?? null;
  const usesThis = subscription?.uses_this_period ?? 0;
  const remaining = maxUses !== null ? Math.max(0, maxUses - usesThis) : null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[92vh] w-[calc(100vw-1.5rem)] flex flex-col bg-[#0b0f17] border-[#1f2937] text-white p-0 overflow-hidden">
        {/* HERO */}
        <div
          className={cn(
            "relative p-5 md:p-6 border-b border-[#1f2937]",
            isSub && "bg-gradient-to-br from-[#1a1408] via-[#0b0f17] to-[#0b0f17]",
          )}
        >
          {isSub && <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-gold via-[#F5C842] to-gold" />}
          <DialogHeader>
            <DialogTitle className="sr-only">Ficha CRM de {customer.name}</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col md:flex-row gap-5">
            <div className="relative shrink-0">
              {customer.avatar_url ? (
                <img
                  src={customer.avatar_url}
                  alt={`Foto de ${customer.name}`}
                  className={cn("h-20 w-20 rounded-full object-cover border-2", isSub ? "border-gold" : "border-slate-700")}
                />
              ) : (
                <div
                  className={cn(
                    "h-20 w-20 rounded-full flex items-center justify-center text-2xl font-black border-2",
                    isSub
                      ? "border-gold bg-gradient-to-br from-gold/25 to-gold/5 text-gold"
                      : "border-slate-700 bg-gradient-to-br from-slate-700 to-slate-900 text-slate-200",
                  )}
                  aria-hidden
                >
                  {initials(customer.name)}
                </div>
              )}
              {isSub && (
                <div className="absolute -bottom-1 -right-1 h-7 w-7 rounded-full bg-gold flex items-center justify-center border-2 border-[#0b0f17]">
                  <Crown size={14} className="text-black" />
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-2xl font-black text-white">{customer.name}</h3>
                {isSub && (
                  <Badge className="bg-gold/15 text-gold border border-gold/40 text-[10px] font-black uppercase">
                    <Crown size={10} className="mr-1" /> Assinante
                  </Badge>
                )}
                {kpis.completed >= 12 && (
                  <Badge className="bg-cyan-400/10 text-cyan-300 border border-cyan-400/40 text-[10px] font-black uppercase">
                    <BadgeCheck size={10} className="mr-1" /> VIP
                  </Badge>
                )}
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-slate-400">
                <span className="flex items-center gap-1"><Phone size={12} /> {customer.phone || "—"}</span>
                {customer.email && <span className="flex items-center gap-1"><Mail size={12} /> {customer.email}</span>}
                {customer.birth_date && (
                  <span className="flex items-center gap-1"><Cake size={12} /> {format(new Date(customer.birth_date), "dd/MM")}</span>
                )}
                <span className="flex items-center gap-1">
                  <Clock size={12} /> Último: {kpis.lastVisit ? format(kpis.lastVisit, "dd/MM/yyyy") : "—"}
                </span>
                <span>
                  Próximo: {kpis.nextVisit ? format(kpis.nextVisit, "dd/MM/yyyy 'às' HH:mm") : "—"}
                </span>
                <span>
                  Cliente há {kpis.daysAsCustomer !== null ? `${kpis.daysAsCustomer} dias` : "—"}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4">
                <Stat label="Total gasto" value={formatBRL(kpis.totalSpent)} accent="text-emerald-400" />
                <Stat label="Ticket médio" value={formatBRL(kpis.avgTicket)} />
                <Stat label="Cashback" value={formatBRL(customer.cashback_balance)} accent="text-gold" />
                <Stat label="Créditos" value={formatBRL(customer.credits)} accent="text-emerald-400" />
              </div>
            </div>

            {/* Quick actions */}
            <div className="flex md:flex-col gap-2 flex-wrap">
              <Button size="sm" onClick={() => openWhatsApp(customer.phone)} className="bg-green-600 hover:bg-green-700 text-white gap-1.5">
                <MessageCircle size={14} /> WhatsApp
              </Button>
              <Button
                size="sm"
                onClick={() => (window.location.href = `/calendar?customer=${customer.id}`)}
                className="bg-gradient-to-r from-gold to-[#F5C842] text-black font-bold hover:brightness-110 gap-1.5"
              >
                <CalendarPlus size={14} /> Agendar
              </Button>
              <Button size="sm" variant="outline" onClick={onEdit} className="border-slate-700 text-slate-200 hover:bg-white/5 gap-1.5">
                <Edit size={14} /> Editar
              </Button>
            </div>
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-4 md:p-6">
            <Tabs defaultValue="resumo">
              <TabsList className="bg-[#111827] border border-[#1f2937] p-1 h-auto flex flex-wrap gap-1 justify-start">
                <TabsTrigger value="resumo" className={TAB_CLS}><Sparkles size={13} className="mr-1.5" />Resumo</TabsTrigger>
                <TabsTrigger value="atendimentos" className={TAB_CLS}><HistoryIcon size={13} className="mr-1.5" />Atendimentos</TabsTrigger>
                <TabsTrigger value="financeiro" className={TAB_CLS}><DollarSign size={13} className="mr-1.5" />Financeiro</TabsTrigger>
                <TabsTrigger value="produtos" className={TAB_CLS}><Package size={13} className="mr-1.5" />Produtos</TabsTrigger>
                <TabsTrigger value="cashback" className={TAB_CLS}><Wallet size={13} className="mr-1.5" />Cashback</TabsTrigger>
                <TabsTrigger value="creditos" className={TAB_CLS}><CreditCard size={13} className="mr-1.5" />Créditos</TabsTrigger>
                <TabsTrigger value="assinatura" className={TAB_CLS}><Crown size={13} className="mr-1.5" />Assinatura</TabsTrigger>
                <TabsTrigger value="avaliacoes" className={TAB_CLS}><Star size={13} className="mr-1.5" />Avaliações</TabsTrigger>
                <TabsTrigger value="automacoes" className={TAB_CLS}><Bot size={13} className="mr-1.5" />Automações</TabsTrigger>
                <TabsTrigger value="observacoes" className={TAB_CLS}><StickyNote size={13} className="mr-1.5" />Observações</TabsTrigger>
                <TabsTrigger value="tarefas" className={TAB_CLS}><Target size={13} className="mr-1.5" />Tarefas</TabsTrigger>
              </TabsList>

              {/* RESUMO */}
              <TabsContent value="resumo" className="mt-4 space-y-5 animate-in fade-in duration-300">
                <div className="rounded-2xl border border-gold/30 bg-gradient-to-br from-gold/10 via-gold/[0.02] to-transparent p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Sparkles className="text-gold" size={16} />
                    <h4 className="font-black text-white uppercase text-xs tracking-wider">Perfil Inteligente do Cliente</h4>
                  </div>
                  {smart.length === 0 ? (
                    <p className="text-slate-400 text-sm">Ainda não há histórico suficiente para gerar o perfil.</p>
                  ) : (
                    <ul className="grid md:grid-cols-2 gap-2">
                      {smart.map((s, i) => (
                        <li key={i} className="text-sm text-slate-200 flex gap-2">
                          <span className="text-gold" aria-hidden>•</span> {s}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                  <Stat label="Score Relacionamento" value={kpis.relationshipScore.label} accent={kpis.relationshipScore.color} />
                  <Stat label="Estágio Funil" value={kpis.funnelStage} accent="text-cyan-400" />
                  <Stat label="Atendimentos" value={kpis.completed} />
                  <Stat label="Cancelamentos" value={kpis.cancelled} accent="text-red-400" />
                  <Stat label="Frequência média" value={kpis.avgFrequencyDays ? `${kpis.avgFrequencyDays} dias` : "—"} />
                  <Stat label="Dias desde o último" value={kpis.daysSinceLast ?? "—"} />
                  <Stat label="Serviço favorito" value={kpis.favoriteService?.key || "—"} accent="text-gold" />
                  <Stat label="Profissional favorito" value={kpis.favoriteBarber?.key || "—"} accent="text-gold" />
                  <Stat label="Produtos" value={formatBRL(kpis.productsTotal)} />
                  <Stat label="Avaliação média" value={kpis.avgRating ? `${kpis.avgRating.toFixed(1)} ★` : "—"} accent="text-yellow-400" />
                  <Stat label="Cashback acumulado" value={formatBRL(kpis.cashbackEarned)} accent="text-gold" />
                  <Stat label="Cashback utilizado" value={formatBRL(kpis.cashbackUsed)} />
                  <Stat label="Créditos concedidos" value={formatBRL(kpis.creditsEarned)} accent="text-emerald-400" />
                  <Stat
                    label="Fidelidade"
                    value={`${customer.loyalty_points || 0}/${shopProfile?.free_service_threshold || 10}`}
                  />
                </div>

                <div>
                  <h4 className="font-black text-white uppercase text-xs tracking-wider mb-3">Linha do tempo</h4>
                  {loading || crm.loading ? (
                    <div className="space-y-2">
                      {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full bg-[#111827]" />)}
                    </div>
                  ) : (
                    <CustomerTimeline events={timeline} />
                  )}
                </div>
              </TabsContent>

              {/* ATENDIMENTOS */}
              <TabsContent value="atendimentos" className="mt-4 animate-in fade-in duration-300">
                {loading ? (
                  <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-20 w-full bg-[#111827]" />)}</div>
                ) : history.length === 0 ? (
                  <Empty text="Nenhum atendimento encontrado" />
                ) : (
                  <div className="space-y-2">
                    {history.map((app: any) => (
                      <div key={app.id} className="p-3 bg-[#111827] border border-[#1f2937] rounded-xl hover:border-gold/30 transition-all">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="font-bold text-white">{app.services?.name || "Serviço"}</p>
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-[11px] text-slate-400">
                              <span className="flex items-center gap-1">
                                <Clock size={11} /> {format(new Date(app.start_time), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                              </span>
                              <span>{app.barbers?.name}</span>
                              {app.total_price != null && <span className="text-gold font-bold">{formatBRL(app.total_price)}</span>}
                              {app.payment_method && (
                                <Badge variant="outline" className="text-[9px] py-0 h-4 uppercase border-slate-700 text-slate-400 bg-[#0b0f17]">
                                  {app.payment_method === "pix" ? "PIX" : app.payment_method === "credits" ? "Créditos" : app.payment_method === "cashback" ? "Cashback" : "Balcão"}
                                </Badge>
                              )}
                              {Number(app.cashback_used) > 0 && <span className="text-gold">Cashback usado {formatBRL(app.cashback_used)}</span>}
                              {Number(app.cashback_earned) > 0 && <span className="text-gold">Cashback ganho {formatBRL(app.cashback_earned)}</span>}
                              {Number(app.credits_used) > 0 && <span className="text-emerald-400">Créditos {formatBRL(app.credits_used)}</span>}
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-1.5 shrink-0">
                            <Badge
                              className={cn(
                                "text-[10px] uppercase font-bold border-none",
                                app.status === "completed"
                                  ? "bg-green-500/10 text-green-400"
                                  : app.status === "scheduled"
                                    ? "bg-blue-500/10 text-blue-400"
                                    : "bg-red-500/10 text-red-400",
                              )}
                            >
                              {app.status === "completed" ? "Concluído" : app.status === "scheduled" ? "Agendado" : "Cancelado"}
                            </Badge>
                            {app.service_ratings?.[0] && (
                              <span className="flex items-center gap-1 text-yellow-500 text-[10px] font-black">
                                <Star size={10} fill="currentColor" /> {app.service_ratings[0].rating}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2 mt-2.5 pt-2.5 border-t border-white/5">
                          <button
                            onClick={() => (window.location.href = `/calendar?date=${format(new Date(app.start_time), "yyyy-MM-dd")}`)}
                            className="text-[10px] font-bold uppercase px-2 py-1 rounded-lg bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-gold flex items-center gap-1"
                          >
                            <Eye size={11} /> Visualizar
                          </button>
                          <button
                            onClick={() => (window.location.href = `/calendar?customer=${customer.id}&service=${app.service_id || ""}`)}
                            className="text-[10px] font-bold uppercase px-2 py-1 rounded-lg bg-gold/10 border border-gold/40 text-gold hover:bg-gold/20 focus-visible:ring-2 focus-visible:ring-gold flex items-center gap-1"
                          >
                            <Repeat size={11} /> Repetir
                          </button>
                          <button
                            onClick={() => openWhatsApp(customer.phone)}
                            className="text-[10px] font-bold uppercase px-2 py-1 rounded-lg bg-green-600/10 border border-green-600/30 text-green-400 hover:bg-green-600/20 focus-visible:ring-2 focus-visible:ring-gold flex items-center gap-1"
                          >
                            <MessageCircle size={11} /> Mensagem
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              {/* FINANCEIRO */}
              <TabsContent value="financeiro" className="mt-4 space-y-4 animate-in fade-in duration-300">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  <Stat label="Receita gerada" value={formatBRL(kpis.totalSpent + kpis.productsTotal)} accent="text-emerald-400" />
                  <Stat label="Serviços" value={formatBRL(kpis.totalSpent)} />
                  <Stat label="Produtos" value={formatBRL(kpis.productsTotal)} accent="text-purple-300" />
                  <Stat label="Ticket médio" value={formatBRL(kpis.avgTicket)} accent="text-gold" />
                </div>
                <div className="rounded-2xl border border-[#1f2937] bg-[#111827] p-4">
                  <p className="text-xs font-black uppercase tracking-wider text-slate-300 mb-3">Evolução mensal</p>
                  {kpis.monthlySpend.length === 0 ? (
                    <Empty text="Sem histórico financeiro" />
                  ) : (
                    <ResponsiveContainer width="100%" height={220}>
                      <AreaChart data={kpis.monthlySpend}>
                        <defs>
                          <linearGradient id="crmSpend" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#D4AF37" stopOpacity={0.5} />
                            <stop offset="100%" stopColor="#D4AF37" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                        <XAxis dataKey="month" stroke="#64748b" fontSize={11} />
                        <YAxis stroke="#64748b" fontSize={11} />
                        <RTooltip
                          contentStyle={{ background: "#0b0f17", border: "1px solid #1f2937", borderRadius: 12, color: "#fff" }}
                          formatter={(v: any) => formatBRL(v)}
                        />
                        <Area type="monotone" dataKey="value" stroke="#D4AF37" fill="url(#crmSpend)" strokeWidth={2} />
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </div>
                {kpis.yearlySpend.length > 0 && (
                  <div className="rounded-2xl border border-[#1f2937] bg-[#111827] p-4">
                    <p className="text-xs font-black uppercase tracking-wider text-slate-300 mb-3">Por ano</p>
                    <ResponsiveContainer width="100%" height={180}>
                      <BarChart data={kpis.yearlySpend}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                        <XAxis dataKey="year" stroke="#64748b" fontSize={11} />
                        <YAxis stroke="#64748b" fontSize={11} />
                        <RTooltip
                          contentStyle={{ background: "#0b0f17", border: "1px solid #1f2937", borderRadius: 12, color: "#fff" }}
                          formatter={(v: any) => formatBRL(v)}
                        />
                        <Bar dataKey="value" fill="#D4AF37" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </TabsContent>

              {/* PRODUTOS */}
              <TabsContent value="produtos" className="mt-4 space-y-4 animate-in fade-in duration-300">
                {kpis.favoriteProducts.length > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {kpis.favoriteProducts.map((p) => (
                      <div key={p.name} className="rounded-xl bg-[#111827] border border-[#1f2937] p-3 hover:border-gold/30 transition-colors">
                        <p className="font-bold text-white text-sm">{p.name}</p>
                        <p className="text-[11px] text-slate-400 mt-1">
                          {p.qty} un. • {formatBRL(p.total)} • última {p.last ? format(p.last, "dd/MM/yyyy") : "—"}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
                {products.length === 0 ? (
                  <Empty text="Nenhum produto adquirido" />
                ) : (
                  <div className="space-y-2">
                    {products.map((p: any) => (
                      <div key={p.id} className="flex items-center justify-between p-3 bg-[#111827] border border-[#1f2937] rounded-xl">
                        <div className="min-w-0">
                          <p className="font-bold text-white text-sm truncate">
                            {Array.isArray(p.items) && p.items.length
                              ? p.items.map((i: any) => i?.name).filter(Boolean).join(", ") || `${p.items.length} item(s)`
                              : "Compra"}
                          </p>
                          <p className="text-[11px] text-slate-400">{format(new Date(p.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}</p>
                        </div>
                        <p className="text-gold font-black shrink-0">{formatBRL(p.total_amount)}</p>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              {/* CASHBACK */}
              <TabsContent value="cashback" className="mt-4 space-y-4 animate-in fade-in duration-300">
                <div className="grid grid-cols-3 gap-2">
                  <Stat label="Saldo atual" value={formatBRL(customer.cashback_balance)} accent="text-gold" />
                  <Stat label="Recebido" value={formatBRL(kpis.cashbackEarned)} accent="text-emerald-400" />
                  <Stat label="Utilizado" value={formatBRL(kpis.cashbackUsed)} />
                </div>
                {crm.cashback.length === 0 ? (
                  <Empty text="Nenhuma movimentação de cashback" />
                ) : (
                  <div className="space-y-2">
                    {crm.cashback.map((t) => (
                      <div key={t.id} className="flex items-center justify-between p-3 bg-[#111827] border border-[#1f2937] rounded-xl">
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-white capitalize">{t.description || t.type}</p>
                          <p className="text-[11px] text-slate-400">{format(new Date(t.created_at), "dd/MM/yyyy HH:mm")}</p>
                        </div>
                        <p className={cn("font-black shrink-0", Number(t.amount) >= 0 ? "text-emerald-400" : "text-red-400")}>
                          {formatBRL(t.amount)}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              {/* CRÉDITOS */}
              <TabsContent value="creditos" className="mt-4 space-y-4 animate-in fade-in duration-300">
                <div className="grid grid-cols-3 gap-2">
                  <Stat label="Saldo" value={formatBRL(customer.credits)} accent="text-emerald-400" />
                  <Stat label="Concedidos" value={formatBRL(kpis.creditsEarned)} />
                  <Stat label="Utilizados" value={formatBRL(kpis.creditsUsed)} />
                </div>
                {crm.credits.length === 0 && crm.creditTx.length === 0 ? (
                  <Empty text="Nenhum crédito registrado" />
                ) : (
                  <div className="space-y-2">
                    {crm.credits.map((c) => (
                      <div key={c.id} className="p-3 bg-[#111827] border border-[#1f2937] rounded-xl">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-bold text-white">{c.description || c.credit_type || "Crédito"}</p>
                          <p className="text-emerald-400 font-black">{formatBRL(c.available_amount ?? c.amount)}</p>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          {format(new Date(c.created_at), "dd/MM/yyyy")} • {c.status}
                          {c.expires_at ? ` • expira ${format(new Date(c.expires_at), "dd/MM/yyyy")}` : ""}
                        </p>
                      </div>
                    ))}
                    {crm.creditTx.map((t) => (
                      <div key={t.id} className="flex items-center justify-between p-3 bg-[#111827] border border-[#1f2937] rounded-xl">
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-white capitalize">{t.description || t.type}</p>
                          <p className="text-[11px] text-slate-400">{format(new Date(t.created_at), "dd/MM/yyyy HH:mm")}</p>
                        </div>
                        <p className={cn("font-black shrink-0", Number(t.amount) >= 0 ? "text-emerald-400" : "text-red-400")}>
                          {formatBRL(t.amount)}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              {/* ASSINATURA */}
              <TabsContent value="assinatura" className="mt-4 space-y-4 animate-in fade-in duration-300">
                {!isSub ? (
                  <div className="rounded-2xl border border-dashed border-gold/40 bg-gold/[0.03] p-6 text-center">
                    <Crown className="mx-auto text-gold mb-2" size={26} />
                    <p className="text-white font-bold">Este cliente ainda não é assinante.</p>
                    <Button onClick={() => openWhatsApp(customer.phone)} className="mt-3 bg-gradient-to-r from-gold to-[#F5C842] text-black font-bold hover:brightness-110">
                      Oferecer Assinatura
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      <Stat label="Plano" value={plan?.name || "—"} accent="text-gold" />
                      <Stat label="Status" value="Ativa" accent="text-emerald-400" />
                      <Stat label="Mensalidade" value={formatBRL(plan?.monthly_price)} accent="text-gold" />
                      <Stat
                        label="Renovação"
                        value={subscription.next_billing_at ? format(new Date(subscription.next_billing_at), "dd/MM/yyyy") : "—"}
                        hint={
                          subscription.next_billing_at
                            ? `${differenceInDays(new Date(subscription.next_billing_at), new Date())} dias`
                            : undefined
                        }
                      />
                      <Stat label="Adesão" value={subscription.started_at ? format(new Date(subscription.started_at), "dd/MM/yyyy") : "—"} />
                      <Stat label="Consumidos" value={usesThis} />
                      <Stat label="Restantes" value={maxUses !== null ? remaining : "Ilimitado"} accent="text-gold" />
                      <Stat
                        label="Economia estimada"
                        value={formatBRL(crm.usage.reduce((a, u) => a + Number(u.covered_amount || 0), 0))}
                        accent="text-emerald-400"
                      />
                    </div>
                    {crm.usage.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs font-black uppercase tracking-wider text-slate-300">Benefícios utilizados</p>
                        {crm.usage.map((u) => (
                          <div key={u.id} className="flex items-center justify-between p-3 bg-[#111827] border border-[#1f2937] rounded-xl">
                            <div>
                              <p className="text-sm font-bold text-white">{u.benefit_key || u.benefit_type || "Benefício"}</p>
                              <p className="text-[11px] text-slate-400">{u.used_at ? format(new Date(u.used_at), "dd/MM/yyyy HH:mm") : "—"}</p>
                            </div>
                            <p className="text-emerald-400 font-black">{formatBRL(u.covered_amount)}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </TabsContent>

              {/* AVALIAÇÕES */}
              <TabsContent value="avaliacoes" className="mt-4 animate-in fade-in duration-300">
                {crm.loading ? (
                  <Skeleton className="h-24 w-full bg-[#111827]" />
                ) : crm.reviews.length === 0 ? (
                  <Empty text="Nenhuma avaliação enviada por este cliente" />
                ) : (
                  <div className="space-y-2">
                    {crm.reviews.map((r) => (
                      <div key={r.id} className="p-3 bg-[#111827] border border-[#1f2937] rounded-xl">
                        <div className="flex items-center justify-between gap-3">
                          <span className="flex items-center gap-1 text-yellow-500 font-black text-sm">
                            <Star size={13} fill="currentColor" /> {r.barbershop_rating ?? r.service_rating ?? "—"}
                          </span>
                          <Badge className="bg-white/5 text-slate-300 border border-white/10 text-[9px] uppercase font-bold">
                            {r.testimonial_status || "recebida"}
                          </Badge>
                        </div>
                        {r.testimonial_text && <p className="text-sm text-slate-200 italic mt-2">"{r.testimonial_text}"</p>}
                        {r.reply && (
                          <p className="text-xs text-gold mt-2 border-l-2 border-gold/40 pl-2">Resposta: {r.reply}</p>
                        )}
                        <p className="text-[10px] text-slate-500 mt-2">
                          {format(new Date(r.submitted_at || r.created_at), "dd/MM/yyyy HH:mm")}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              {/* AUTOMAÇÕES */}
              <TabsContent value="automacoes" className="mt-4 animate-in fade-in duration-300">
                {crm.loading ? (
                  <Skeleton className="h-24 w-full bg-[#111827]" />
                ) : crm.automations.length === 0 ? (
                  <Empty text="Nenhuma mensagem automática registrada" />
                ) : (
                  <div className="space-y-2">
                    {crm.automations.map((a) => (
                      <div key={a.id} className="flex items-center justify-between gap-3 p-3 bg-[#111827] border border-[#1f2937] rounded-xl">
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-white capitalize truncate">
                            {(a.message_type || a.action || "mensagem").replace(/_/g, " ")}
                          </p>
                          <p className="text-[11px] text-slate-400">
                            {format(new Date(a.sent_at || a.created_at), "dd/MM/yyyy HH:mm")} • {a.provider || "whatsapp"} •{" "}
                            {a.direction === "inbound" ? "Resposta do cliente" : "Enviada"}
                          </p>
                          {a.error_message && <p className="text-[11px] text-red-400 mt-0.5">{a.error_message}</p>}
                        </div>
                        <Badge
                          className={cn(
                            "text-[9px] uppercase font-bold border-none shrink-0",
                            a.status === "sent" || a.status === "success" || a.status === "delivered"
                              ? "bg-green-500/10 text-green-400"
                              : a.status === "error" || a.status === "failed"
                                ? "bg-red-500/10 text-red-400"
                                : "bg-slate-500/10 text-slate-300",
                          )}
                        >
                          {a.status || "—"}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              {/* OBSERVAÇÕES */}
              <TabsContent value="observacoes" className="mt-4 space-y-3 animate-in fade-in duration-300">
                <p className="text-xs text-slate-400">
                  Anotações internas — visíveis apenas para a equipe da barbearia.
                </p>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={7}
                  aria-label="Observações internas do cliente"
                  placeholder="Preferências, alergias, histórico de conversas, combinados..."
                  className="bg-[#111827] border-[#1f2937] text-white focus-visible:ring-gold"
                />
                <Button
                  disabled={savingNotes || !onSaveNotes}
                  onClick={async () => {
                    if (!onSaveNotes) return;
                    setSavingNotes(true);
                    await onSaveNotes(notes);
                    setSavingNotes(false);
                  }}
                  className="bg-gradient-to-r from-gold to-[#F5C842] text-black font-bold hover:brightness-110"
                >
                  {savingNotes ? "Salvando..." : "Salvar observações"}
                </Button>
              </TabsContent>
            </Tabs>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
