import { memo } from "react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Clock, PlayCircle, Coffee, Scissors, CreditCard, MapPin, Globe, Hand } from "lucide-react";
import { apptValue, isCancelled, isCompleted, type TodaySummary } from "./metrics";

function originMeta(a: any) {
  if (a?.appointment_type === "walk_in") return { label: "Walk-in", icon: Hand };
  if (a?.created_by || a?.source === "manual") return { label: "Manual", icon: MapPin };
  return { label: "Online", icon: Globe };
}

export const ProfessionalTimeline = memo(function ProfessionalTimeline({ today }: { today: TodaySummary }) {
  const rows = today.todayAppts;

  return (
    <section
      aria-label="Linha do tempo do dia"
      className="rounded-2xl border border-gold/15 bg-[#0b0f17] p-5 md:p-6"
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gold">Timeline</p>
          <h3 className="text-lg font-black text-white">Seu dia, em ordem</h3>
        </div>
        <Badge className="border-0 bg-white/5 text-[10px] font-black uppercase tracking-widest text-white/60">
          {today.occupancyPct}% ocupado
        </Badge>
      </div>

      {rows.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-10 text-center">
          <Coffee className="h-10 w-10 text-gold/30" aria-hidden />
          <p className="text-sm font-medium text-white/50">Nenhum atendimento hoje. Aproveite para descansar.</p>
        </div>
      ) : (
        <ol className="relative space-y-3 border-l border-white/10 pl-5">
          {rows.map((a) => {
            const done = isCompleted(a);
            const cancelled = isCancelled(a);
            const isCurrent = today.current?.id === a.id;
            const isNext = !isCurrent && today.next?.id === a.id;
            const Origin = originMeta(a).icon;

            return (
              <li key={a.id} className="relative">
                <span
                  aria-hidden
                  className={cn(
                    "absolute -left-[26px] top-4 h-3 w-3 rounded-full border-2",
                    cancelled
                      ? "border-red-500/60 bg-red-500/30"
                      : done
                        ? "border-green-500 bg-green-500"
                        : isCurrent
                          ? "border-gold bg-gold animate-pulse"
                          : "border-white/30 bg-[#0b0f17]",
                  )}
                />
                <div
                  className={cn(
                    "flex flex-wrap items-center gap-3 rounded-xl border p-3 transition-all duration-200 hover:border-gold/35",
                    isCurrent
                      ? "border-gold/50 bg-gold/[0.08]"
                      : isNext
                        ? "border-gold/25 bg-white/[0.03]"
                        : "border-white/10 bg-white/[0.02]",
                    cancelled && "opacity-60",
                  )}
                >
                  <span className="w-14 shrink-0 text-base font-black text-white">
                    {format(new Date(a.start_time), "HH:mm")}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-black text-white">{a.customers?.name || "Cliente"}</p>
                    <p className="flex flex-wrap items-center gap-2 text-[11px] font-medium text-white/50">
                      <Scissors size={11} className="text-gold" aria-hidden />
                      <span className="truncate">{a.services?.name || "Serviço"}</span>
                      <span className="text-white/25">•</span>
                      <span className="font-black text-white/80">R$ {apptValue(a).toFixed(2)}</span>
                      {a.payment_method && (
                        <>
                          <span className="text-white/25">•</span>
                          <CreditCard size={11} className="text-gold" aria-hidden />
                          <span className="uppercase">{a.payment_method}</span>
                        </>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className="border-0 bg-white/5 text-[9px] font-black uppercase tracking-wider text-white/55">
                      <Origin size={10} className="mr-1" aria-hidden />
                      {originMeta(a).label}
                    </Badge>
                    <Badge
                      className={cn(
                        "border-0 text-[9px] font-black uppercase tracking-wider",
                        cancelled
                          ? "bg-red-600/20 text-red-400"
                          : done
                            ? "bg-green-600/20 text-green-400"
                            : isCurrent
                              ? "bg-gold text-black"
                              : "bg-blue-600/20 text-blue-300",
                      )}
                    >
                      {cancelled ? (
                        "Cancelado"
                      ) : done ? (
                        <>
                          <CheckCircle2 size={10} className="mr-1" aria-hidden /> Concluído
                        </>
                      ) : isCurrent ? (
                        <>
                          <PlayCircle size={10} className="mr-1" aria-hidden /> Em atendimento
                        </>
                      ) : (
                        <>
                          <Clock size={10} className="mr-1" aria-hidden /> Agendado
                        </>
                      )}
                    </Badge>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
});
