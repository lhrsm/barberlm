import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Star, Check, X as XIcon, EyeOff, MessageSquare, Inbox, Scissors, User as UserIcon, Calendar as CalendarIcon, Quote, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

export const Route = createFileRoute("/reviews")({
  component: ReviewsAdminPage,
});

type FilterKey = "pending" | "approved" | "rejected" | "all";

function StarsDisplay({ value }: { value: number | null }) {
  if (value == null) return <span className="text-gray-500 text-xs">—</span>;
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={cn(
            "h-3.5 w-3.5",
            n <= value ? "text-[#D4AF37] fill-[#D4AF37]" : "text-gray-600"
          )}
        />
      ))}
      <span className="ml-1.5 text-xs text-gray-200 font-bold tabular-nums">{value}</span>
    </div>
  );
}

const STATUS_META: Record<string, { label: string; cls: string; dot: string }> = {
  pending: {
    label: "Pendente",
    cls: "bg-amber-500/10 text-amber-400 border-amber-500/30",
    dot: "bg-amber-400",
  },
  approved: {
    label: "Aprovado",
    cls: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
    dot: "bg-emerald-400",
  },
  rejected: {
    label: "Rejeitado",
    cls: "bg-red-500/10 text-red-400 border-red-500/30",
    dot: "bg-red-400",
  },
};

function StatusBadge({ status }: { status: string }) {
  const meta = STATUS_META[status] || STATUS_META.pending;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider shrink-0",
        meta.cls
      )}
    >
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

function ReviewsAdminPage() {
  const [reviews, setReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterKey>("pending");

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

  const moderate = async (id: string, action: "approve" | "reject" | "hide") => {
    const { data: user } = await supabase.auth.getUser();
    const update: any = action === "approve"
      ? { testimonial_status: "approved", show_on_frontend: true, approved_at: new Date().toISOString(), approved_by: user.user?.id }
      : action === "reject"
        ? { testimonial_status: "rejected", show_on_frontend: false }
        : { show_on_frontend: false };
    const { error } = await supabase.from("appointment_reviews").update(update).eq("id", id);
    if (error) toast.error("Erro: " + error.message);
    else {
      toast.success(action === "approve" ? "Aprovado!" : action === "reject" ? "Rejeitado" : "Ocultado");
      fetchReviews();
    }
  };

  const filtered = reviews.filter(r =>
    filter === "all" ? true :
    filter === "pending" ? r.testimonial_status === "pending" :
    filter === "approved" ? r.testimonial_status === "approved" :
    r.testimonial_status === "rejected"
  );

  const counts = {
    pending: reviews.filter(r => r.testimonial_status === "pending").length,
    approved: reviews.filter(r => r.testimonial_status === "approved").length,
    rejected: reviews.filter(r => r.testimonial_status === "rejected").length,
    all: reviews.length,
  };

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
              Modere as avaliações dos seus clientes antes de exibi-las no site.
            </p>
          </div>
        </header>

        {/* Premium segmented tabs */}
        <div className="-mx-4 px-4 md:mx-0 md:px-0 overflow-x-auto scrollbar-none">
          <div className="inline-flex items-center gap-1.5 rounded-2xl border border-[#D4AF37]/15 bg-[#0b0d12]/80 p-1.5 shadow-[0_4px_24px_-12px_rgba(212,175,55,0.25)] min-w-max">
            {TABS.map((t) => {
              const active = filter === t.key;
              const count = counts[t.key];
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
                  <span
                    className={cn(
                      "inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-black tabular-nums",
                      active
                        ? "bg-black/20 text-black"
                        : "bg-[#D4AF37]/10 text-[#D4AF37] group-hover:bg-[#D4AF37]/20"
                    )}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
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
            const canApprove = r.testimonial_status !== "approved" && r.testimonial_text;
            const canReject = r.testimonial_status !== "rejected" && r.testimonial_text;

            return (
              <article
                key={r.id}
                className="rounded-[20px] border border-[#D4AF37]/15 bg-gradient-to-b from-[#0d1017] to-[#0a0c11] p-5 sm:p-6 shadow-[0_8px_32px_-16px_rgba(0,0,0,0.6)] hover:border-[#D4AF37]/30 transition-colors"
              >
                {/* Top: customer + status */}
                <header className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#D4AF37]/10 border border-[#D4AF37]/20 text-[#D4AF37] font-black text-sm">
                      {(r.customers?.name || "C").charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-base font-black text-foreground truncate">
                        {r.customers?.name || "Cliente"}
                      </h3>
                      <p className="text-[11px] text-gray-500 uppercase tracking-wider font-semibold mt-0.5">
                        Avaliação recebida
                      </p>
                    </div>
                  </div>
                  <StatusBadge status={r.testimonial_status} />
                </header>

                {/* Meta: serviço • barbeiro • data */}
                <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-gray-400">
                  {r.appointments?.services?.name && (
                    <span className="inline-flex items-center gap-1.5">
                      <Scissors className="h-3.5 w-3.5 text-[#D4AF37]/70" />
                      <span className="font-semibold text-gray-300">{r.appointments.services.name}</span>
                    </span>
                  )}
                  {r.barbers?.name && (
                    <span className="inline-flex items-center gap-1.5">
                      <UserIcon className="h-3.5 w-3.5 text-[#D4AF37]/70" />
                      <span className="font-semibold text-gray-300">{r.barbers.name}</span>
                    </span>
                  )}
                  {dateStr && (
                    <span className="inline-flex items-center gap-1.5">
                      <CalendarIcon className="h-3.5 w-3.5 text-[#D4AF37]/70" />
                      <span className="font-semibold text-gray-300">{dateStr}</span>
                    </span>
                  )}
                </div>

                {/* Ratings */}
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                  <div className="rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2.5">
                    <p className="text-[10px] uppercase tracking-wider text-gray-500 font-bold mb-1">Barbearia</p>
                    <StarsDisplay value={r.barbershop_rating} />
                  </div>
                  <div className="rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2.5">
                    <p className="text-[10px] uppercase tracking-wider text-gray-500 font-bold mb-1">Barbeiro</p>
                    <StarsDisplay value={r.barber_rating} />
                  </div>
                </div>

                {/* Testimonial */}
                {r.testimonial_text && (
                  <blockquote className="mt-4 relative rounded-xl border border-[#D4AF37]/15 border-l-[3px] border-l-[#D4AF37] bg-[#D4AF37]/[0.04] p-4 pl-5">
                    <Quote className="absolute top-3 right-3 h-5 w-5 text-[#D4AF37]/30" />
                    <p className="text-sm text-gray-200 italic leading-relaxed pr-6 break-words">
                      "{r.testimonial_text}"
                    </p>
                  </blockquote>
                )}

                {/* Actions */}
                {(canApprove || canReject || r.show_on_frontend) && (
                  <div className="mt-5 flex flex-col sm:flex-row sm:flex-wrap gap-2">
                    {canApprove && (
                      <Button
                        onClick={() => moderate(r.id, "approve")}
                        className="h-11 rounded-[14px] w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 font-bold"
                      >
                        <Check className="h-4 w-4 mr-1.5" /> Aprovar para o site
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
                    {r.show_on_frontend && (
                      <Button
                        variant="ghost"
                        onClick={() => moderate(r.id, "hide")}
                        className="h-11 rounded-[14px] w-full sm:w-auto text-gray-400 hover:text-gray-200 font-bold"
                      >
                        <EyeOff className="h-4 w-4 mr-1.5" /> Ocultar
                      </Button>
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </div>
    </AppLayout>
  );
}
