import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Star, Check, X as XIcon, EyeOff, MessageSquare, Inbox, Scissors,
  User as UserIcon, Calendar as CalendarIcon, Quote, Trash2, Search,
  ShieldCheck, ShieldAlert, Reply, TrendingUp, Eye, Send,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

import { DefaultRouteError, DefaultRouteNotFound } from "@/components/route-boundaries";

export const Route = createFileRoute("/reviews")({
  component: ReviewsAdminPage,
  errorComponent: DefaultRouteError,
  notFoundComponent: DefaultRouteNotFound,
});

type FilterKey = "pending" | "approved" | "rejected" | "all";

function StarsDisplay({ value, size = "sm" }: { value: number | null; size?: "sm" | "md" }) {
  if (value == null) return <span className="text-gray-500 text-xs">—</span>;
  const px = size === "md" ? "h-4 w-4" : "h-3.5 w-3.5";
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} className={cn(px, n <= value ? "text-[#D4AF37] fill-[#D4AF37]" : "text-gray-600")} />
      ))}
      <span className="ml-1.5 text-xs text-gray-200 font-bold tabular-nums">{value}</span>
    </div>
  );
}

const STATUS_META: Record<string, { label: string; cls: string; dot: string }> = {
  pending:  { label: "Pendente",  cls: "bg-amber-500/10 text-amber-400 border-amber-500/30",   dot: "bg-amber-400" },
  approved: { label: "Aprovado",  cls: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30", dot: "bg-emerald-400" },
  rejected: { label: "Rejeitado", cls: "bg-red-500/10 text-red-400 border-red-500/30",         dot: "bg-red-400" },
};

function StatusBadge({ status }: { status: string }) {
  const meta = STATUS_META[status] || STATUS_META.pending;
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider shrink-0", meta.cls)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", meta.dot)} />
      {meta.label}
    </span>
  );
}

const EMPTY_COPY: Record<FilterKey, string> = {
  pending: "Nenhuma avaliação pendente.",
  approved: "Nenhum depoimento aprovado.",
  rejected: "Nenhuma avaliação rejeitada.",
  all: "Nenhuma avaliação recebida ainda.",
};

function KpiCard({ label, value, icon: Icon, tone = "gold" }: { label: string; value: string | number; icon: any; tone?: "gold" | "emerald" | "amber" | "sky" }) {
  const tones: Record<string, string> = {
    gold: "from-[#D4AF37]/20 to-[#D4AF37]/5 text-[#D4AF37] border-[#D4AF37]/25",
    emerald: "from-emerald-500/20 to-emerald-500/5 text-emerald-400 border-emerald-500/25",
    amber: "from-amber-500/20 to-amber-500/5 text-amber-400 border-amber-500/25",
    sky: "from-sky-500/20 to-sky-500/5 text-sky-400 border-sky-500/25",
  };
  return (
    <div className={cn("rounded-2xl border bg-gradient-to-br p-4 shadow-[0_8px_24px_-16px_rgba(0,0,0,0.6)]", tones[tone])}>
      <div className="flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-widest font-bold text-white/60">{label}</p>
        <Icon className="h-4 w-4 opacity-70" />
      </div>
      <p className="mt-2 text-2xl font-black text-white tabular-nums">{value}</p>
    </div>
  );
}

function ReviewsAdminPage() {
  const [reviews, setReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterKey>("pending");
  const [search, setSearch] = useState("");
  const [replyOpen, setReplyOpen] = useState<Record<string, boolean>>({});
  const [replyDraft, setReplyDraft] = useState<Record<string, string>>({});
  const [savingReply, setSavingReply] = useState<Record<string, boolean>>({});

  const fetchReviews = async () => {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) { setLoading(false); return; }
    const { data, error } = await supabase
      .from("appointment_reviews")
      .select("*, customers(name, phone), barbers(name), appointments(start_time, services(name))")
      .eq("tenant_id", user.user.id)
      .order("created_at", { ascending: false });
    if (error) toast.error("Erro ao carregar: " + error.message);
    setReviews(data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchReviews();
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session?.user) fetchReviews();
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const moderate = async (id: string, action: "approve" | "reject" | "hide" | "show") => {
    const { data: user } = await supabase.auth.getUser();
    const now = new Date().toISOString();
    const target = reviews.find((r) => r.id === id);
    const hasText = !!target?.testimonial_text;
    const update: any =
      action === "approve" ? { testimonial_status: "approved", show_on_frontend: hasText, approved_at: now, approved_by: user.user?.id, rejected_at: null, rejected_by: null }
      : action === "reject" ? { testimonial_status: "rejected", show_on_frontend: false, rejected_at: now, rejected_by: user.user?.id }
      : action === "hide"   ? { show_on_frontend: false }
      : { show_on_frontend: true };
    const { error } = await supabase.from("appointment_reviews").update(update).eq("id", id);
    if (error) toast.error("Erro: " + error.message);
    else {
      toast.success(
        action === "approve" ? (hasText ? "Aprovado e publicado!" : "Aprovado (sem comentário — não aparece no site)") :
        action === "reject" ? "Rejeitado" :
        action === "hide" ? "Ocultado do site" : "Exibido no site"
      );
      fetchReviews();
    }
  };


  const saveReply = async (id: string) => {
    const text = (replyDraft[id] || "").trim();
    if (!text) { toast.error("Escreva uma resposta."); return; }
    setSavingReply((s) => ({ ...s, [id]: true }));
    const { data: user } = await supabase.auth.getUser();
    const { error } = await supabase.from("appointment_reviews").update({
      reply: text,
      reply_at: new Date().toISOString(),
      reply_by: user.user?.id,
    }).eq("id", id);
    setSavingReply((s) => ({ ...s, [id]: false }));
    if (error) toast.error("Erro ao responder: " + error.message);
    else {
      toast.success("Resposta enviada");
      setReplyOpen((s) => ({ ...s, [id]: false }));
      fetchReviews();
    }
  };

  const removeReview = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir esta avaliação? Esta ação não pode ser desfeita.")) return;
    const { error } = await supabase.from("appointment_reviews").delete().eq("id", id);
    if (error) toast.error("Erro ao excluir: " + error.message);
    else {
      toast.success("Avaliação excluída");
      setReviews((prev) => prev.filter((r) => r.id !== id));
    }
  };

  const removeEmpty = async () => {
    const empties = reviews.filter((r) => !r.testimonial_text && !r.submitted_at);
    if (empties.length === 0) { toast.info("Nenhuma avaliação vazia para excluir."); return; }
    if (!confirm(`Excluir ${empties.length} avaliação(ões) sem resposta? Esta ação não pode ser desfeita.`)) return;
    const ids = empties.map((r) => r.id);
    const { error } = await supabase.from("appointment_reviews").delete().in("id", ids);
    if (error) toast.error("Erro: " + error.message);
    else {
      toast.success(`${ids.length} avaliação(ões) excluída(s)`);
      setReviews((prev) => prev.filter((r) => !ids.includes(r.id)));
    }
  };

  const submitted = useMemo(() => reviews.filter((r) => r.submitted_at || r.testimonial_text || r.barbershop_rating), [reviews]);

  const kpis = useMemo(() => {
    const all = submitted;
    const total = all.length;
    const pending = all.filter((r) => r.testimonial_status === "pending").length;
    const approved = all.filter((r) => r.testimonial_status === "approved").length;
    const ratings = all.flatMap((r) => [r.barbershop_rating, r.service_rating, r.barber_rating].filter((x) => typeof x === "number"));
    const avg = ratings.length ? (ratings.reduce((a, b) => a + b, 0) / ratings.length) : 0;
    const publicCount = all.filter((r) => r.testimonial_status === "approved" && r.show_on_frontend && r.allow_public_display && r.testimonial_text).length;
    return { total, pending, approved, avg, publicCount };
  }, [submitted]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return submitted.filter((r) => {
      if (filter !== "all" && r.testimonial_status !== filter) return false;
      if (!term) return true;
      const hay = [
        r.customers?.name, r.barbers?.name, r.appointments?.services?.name, r.testimonial_text,
      ].filter(Boolean).join(" ").toLowerCase();
      return hay.includes(term);
    });
  }, [submitted, filter, search]);

  const counts = useMemo(() => ({
    pending: submitted.filter((r) => r.testimonial_status === "pending").length,
    approved: submitted.filter((r) => r.testimonial_status === "approved").length,
    rejected: submitted.filter((r) => r.testimonial_status === "rejected").length,
    all: submitted.length,
  }), [submitted]);

  const TABS: { key: FilterKey; label: string }[] = [
    { key: "pending", label: "Pendentes" },
    { key: "approved", label: "Aprovados" },
    { key: "rejected", label: "Rejeitados" },
    { key: "all", label: "Todos" },
  ];

  return (
    <AppLayout>
      <div className="space-y-6 p-4 md:p-6 max-w-6xl mx-auto">
        {/* Header */}
        <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 sm:flex sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-black text-foreground flex items-center gap-2 sm:gap-3 truncate">
              <MessageSquare className="h-6 w-6 sm:h-8 sm:w-8 text-[#D4AF37] shrink-0" />
              <span className="truncate">Avaliações</span>
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Modere avaliações, responda clientes e escolha o que aparece no seu site.
            </p>
          </div>
          <button
            onClick={removeEmpty}
            className="inline-flex items-center gap-1.5 rounded-full border border-red-500/30 bg-red-500/5 px-3 py-1.5 text-xs font-bold text-red-400 hover:bg-red-500/10 hover:border-red-500/50 hover:text-red-300 transition-colors shrink-0"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Limpar vazias</span>
            <span className="sm:hidden">Limpar</span>
          </button>
        </header>

        {/* KPIs */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard label="Total" value={kpis.total} icon={MessageSquare} tone="sky" />
          <KpiCard label="Nota média" value={kpis.avg ? kpis.avg.toFixed(1) : "—"} icon={TrendingUp} tone="gold" />
          <KpiCard label="Pendentes" value={kpis.pending} icon={ShieldAlert} tone="amber" />
          <KpiCard label="No site" value={kpis.publicCount} icon={Eye} tone="emerald" />
        </section>

        {/* Toolbar: tabs + search */}
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="-mx-4 px-4 md:mx-0 md:px-0 overflow-x-auto scrollbar-none">
            <div className="inline-flex items-center gap-1.5 rounded-2xl border border-[#D4AF37]/15 bg-[#0b0d12]/80 p-1.5 shadow-[0_4px_24px_-12px_rgba(212,175,55,0.25)] min-w-max">
              {TABS.map((t) => {
                const active = filter === t.key;
                return (
                  <button
                    key={t.key}
                    onClick={() => setFilter(t.key)}
                    className={cn(
                      "group inline-flex items-center gap-2 rounded-xl px-3.5 sm:px-4 py-2 text-xs sm:text-sm font-bold transition-all whitespace-nowrap shrink-0",
                      active
                        ? "bg-gradient-to-b from-[#D4AF37] to-[#b8941f] text-black shadow-[0_6px_18px_-6px_rgba(212,175,55,0.6)]"
                        : "text-gray-400 hover:text-[#D4AF37] hover:bg-[#D4AF37]/5 border border-transparent hover:border-[#D4AF37]/20"
                    )}
                  >
                    <span>{t.label}</span>
                    <span className={cn(
                      "inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-black tabular-nums",
                      active ? "bg-black/20 text-black" : "bg-[#D4AF37]/10 text-[#D4AF37] group-hover:bg-[#D4AF37]/20"
                    )}>
                      {counts[t.key]}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="relative w-full md:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por cliente, barbeiro, serviço..."
              className="pl-9 bg-[#0b0d12]/80 border-[#D4AF37]/20 text-white placeholder:text-gray-500"
            />
          </div>
        </div>

        {/* List */}
        <div className="space-y-4">
          {loading && (
            <div className="rounded-2xl border border-[#D4AF37]/10 bg-[#0b0d12]/60 p-10 text-center text-muted-foreground text-sm">
              Carregando avaliações...
            </div>
          )}

          {!loading && filtered.length === 0 && (
            <div className="rounded-2xl border border-dashed border-[#D4AF37]/20 bg-[#0b0d12]/40 p-12 text-center">
              <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-[#D4AF37]/10">
                <Inbox className="h-7 w-7 text-[#D4AF37]" />
              </div>
              <p className="text-gray-300 font-semibold text-sm">{EMPTY_COPY[filter]}</p>
              <p className="text-gray-500 text-xs mt-1">Quando houver atividade, ela aparecerá aqui.</p>
            </div>
          )}

          {!loading && filtered.map((r) => {
            const dateStr = r.appointments?.start_time
              ? format(parseISO(r.appointments.start_time), "dd/MM/yyyy", { locale: ptBR })
              : null;
            const hasText = !!r.testimonial_text;
            const canApprove = r.testimonial_status !== "approved" && hasText;
            const canReject = r.testimonial_status !== "rejected" && hasText;
            const canPublish = r.testimonial_status === "approved" && hasText;
            const isOpen = !!replyOpen[r.id];

            return (
              <article
                key={r.id}
                className="rounded-[20px] border border-[#D4AF37]/15 bg-gradient-to-b from-[#0d1017] to-[#0a0c11] p-5 sm:p-6 shadow-[0_8px_32px_-16px_rgba(0,0,0,0.6)] hover:border-[#D4AF37]/30 transition-colors"
              >
                <header className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#D4AF37]/10 border border-[#D4AF37]/20 text-[#D4AF37] font-black text-sm">
                      {(r.customers?.name || "C").charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-base font-black text-foreground truncate">{r.customers?.name || "Cliente"}</h3>
                      <p className="text-[11px] text-gray-500 uppercase tracking-wider font-semibold mt-0.5">
                        {r.submitted_at ? format(parseISO(r.submitted_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) : "Avaliação recebida"}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    <StatusBadge status={r.testimonial_status} />
                    {hasText && (
                      r.allow_public_display ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-emerald-400/90">
                          <ShieldCheck className="h-3 w-3" /> Autoriza exibição
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-gray-500">
                          <ShieldAlert className="h-3 w-3" /> Sem autorização pública
                        </span>
                      )
                    )}
                  </div>
                </header>

                {/* Meta */}
                <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-gray-400">
                  {r.appointments?.services?.name && (
                    <span className="inline-flex items-center gap-1.5"><Scissors className="h-3.5 w-3.5 text-[#D4AF37]/70" /><span className="font-semibold text-gray-300">{r.appointments.services.name}</span></span>
                  )}
                  {r.barbers?.name && (
                    <span className="inline-flex items-center gap-1.5"><UserIcon className="h-3.5 w-3.5 text-[#D4AF37]/70" /><span className="font-semibold text-gray-300">{r.barbers.name}</span></span>
                  )}
                  {dateStr && (
                    <span className="inline-flex items-center gap-1.5"><CalendarIcon className="h-3.5 w-3.5 text-[#D4AF37]/70" /><span className="font-semibold text-gray-300">{dateStr}</span></span>
                  )}
                </div>

                {/* Ratings */}
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
                  <div className="rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2.5">
                    <p className="text-[10px] uppercase tracking-wider text-gray-500 font-bold mb-1">Barbearia</p>
                    <StarsDisplay value={r.barbershop_rating} />
                  </div>
                  <div className="rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2.5">
                    <p className="text-[10px] uppercase tracking-wider text-gray-500 font-bold mb-1">Serviço</p>
                    <StarsDisplay value={r.service_rating} />
                  </div>
                  <div className="rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2.5">
                    <p className="text-[10px] uppercase tracking-wider text-gray-500 font-bold mb-1">Barbeiro</p>
                    <StarsDisplay value={r.barber_rating} />
                  </div>
                </div>

                {/* Testimonial */}
                {hasText && (
                  <blockquote className="mt-4 relative rounded-xl border border-[#D4AF37]/15 border-l-[3px] border-l-[#D4AF37] bg-[#D4AF37]/[0.04] p-4 pl-5">
                    <Quote className="absolute top-3 right-3 h-5 w-5 text-[#D4AF37]/30" />
                    <p className="text-sm text-gray-200 italic leading-relaxed pr-6 break-words">"{r.testimonial_text}"</p>
                  </blockquote>
                )}

                {/* Existing reply */}
                {r.reply && (
                  <div className="mt-3 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.04] p-4">
                    <div className="flex items-center justify-between mb-1.5">
                      <p className="text-[10px] uppercase tracking-widest font-black text-emerald-400">Sua resposta</p>
                      {r.reply_at && (
                        <span className="text-[10px] text-gray-500">
                          {format(parseISO(r.reply_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-200 leading-relaxed break-words">{r.reply}</p>
                  </div>
                )}

                {/* Reply editor */}
                {isOpen && (
                  <div className="mt-3 rounded-xl border border-[#D4AF37]/20 bg-[#05070d] p-3 space-y-2">
                    <Textarea
                      value={replyDraft[r.id] ?? r.reply ?? ""}
                      onChange={(e) => setReplyDraft((s) => ({ ...s, [r.id]: e.target.value }))}
                      placeholder="Escreva uma resposta para o cliente..."
                      className="bg-[#0b0d12] border-[#D4AF37]/20 text-white min-h-[80px]"
                      maxLength={500}
                    />
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" onClick={() => setReplyOpen((s) => ({ ...s, [r.id]: false }))} className="text-gray-400">
                        Cancelar
                      </Button>
                      <Button
                        onClick={() => saveReply(r.id)}
                        disabled={savingReply[r.id]}
                        className="bg-[#D4AF37] hover:bg-[#B8962E] text-black font-black"
                      >
                        <Send className="h-4 w-4 mr-1.5" />
                        {savingReply[r.id] ? "Enviando..." : "Enviar resposta"}
                      </Button>
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="mt-5 flex flex-col sm:flex-row sm:flex-wrap gap-2">
                  {canApprove && (
                    <Button
                      onClick={() => moderate(r.id, "approve")}
                      className="h-11 rounded-[14px] w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 font-bold"
                      title={r.allow_public_display ? "Aprovar e publicar no site" : "Aprovar (cliente não autorizou exibição pública, então não aparecerá no site)"}
                    >
                      <Check className="h-4 w-4 mr-1.5" /> Aprovar
                    </Button>
                  )}
                  {canReject && (
                    <Button
                      variant="outline"
                      onClick={() => moderate(r.id, "reject")}
                      className="h-11 rounded-[14px] w-full sm:w-auto border-red-500/40 text-red-400 hover:bg-red-500/10 hover:text-red-300 font-bold"
                    >
                      <XIcon className="h-4 w-4 mr-1.5" /> Rejeitar
                    </Button>
                  )}
                  {canPublish && r.allow_public_display && (
                    r.show_on_frontend ? (
                      <Button
                        variant="ghost"
                        onClick={() => moderate(r.id, "hide")}
                        className="h-11 rounded-[14px] w-full sm:w-auto text-gray-400 hover:text-gray-200 font-bold"
                      >
                        <EyeOff className="h-4 w-4 mr-1.5" /> Ocultar do site
                      </Button>
                    ) : (
                      <Button
                        variant="ghost"
                        onClick={() => moderate(r.id, "show")}
                        className="h-11 rounded-[14px] w-full sm:w-auto text-[#D4AF37] hover:bg-[#D4AF37]/10 font-bold"
                      >
                        <Eye className="h-4 w-4 mr-1.5" /> Exibir no site
                      </Button>
                    )
                  )}
                  {hasText && (
                    <Button
                      variant="ghost"
                      onClick={() => setReplyOpen((s) => ({ ...s, [r.id]: !s[r.id] }))}
                      className="h-11 rounded-[14px] w-full sm:w-auto text-sky-300 hover:bg-sky-500/10 hover:text-sky-200 font-bold"
                    >
                      <Reply className="h-4 w-4 mr-1.5" /> {r.reply ? "Editar resposta" : "Responder"}
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    onClick={() => removeReview(r.id)}
                    className="h-11 rounded-[14px] w-full sm:w-auto sm:ml-auto text-red-400 hover:bg-red-500/10 hover:text-red-300 font-bold"
                  >
                    <Trash2 className="h-4 w-4 mr-1.5" /> Excluir
                  </Button>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </AppLayout>
  );
}
