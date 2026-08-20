import * as React from "react";
import { motion } from "framer-motion";
import { History, Scissors, Calendar, User as UserIcon, Clock, Filter, Search, X, Sparkles, CheckCircle2, Star } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { resolveReviewState } from "@/lib/review.utils";

type Props = {
  appointments: any[];
  onViewDetails: (id: string) => void;
  onReview: (app: any) => void;
  onSkipReview?: (app: any) => void;
};

export function AppointmentsTab({ appointments, onViewDetails, onReview, onSkipReview }: Props) {
  const [searchTerm, setSearchTerm] = React.useState("");

  const filtered = appointments.filter(app =>
    app.services?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    app.barbers?.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-white">Seus Agendamentos</h2>
          <p className="text-sm text-gray-400">Gerencie seu histórico e agendamentos futuros.</p>
        </div>
        <div className="relative w-full md:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
          <Input
            placeholder="Buscar por serviço ou profissional..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-white/5 border-white/10 text-white rounded-xl focus:border-gold/50 transition-all"
          />
          {searchTerm && (
            <button onClick={() => setSearchTerm("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white">
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      <div className="grid gap-3">
        {filtered.length === 0 ? (
          <Card className="bg-white/5 border-white/10 border-dashed py-12">
            <div className="text-center">
              <Calendar size={48} className="mx-auto mb-4 text-white/20" />
              <p className="text-white font-bold">Nenhum agendamento encontrado</p>
              <p className="text-sm text-gray-400 mt-1">Sua agenda está livre. Que tal marcar um horário?</p>
            </div>
          </Card>
        ) : (
          filtered.map((app, i) => {
            const isCompleted = app.status === "completed";
            const isCancelled = app.status === "cancelled";
            const isSubCovered = app.payment_method === 'subscription' || app.payment_status === 'covered_by_subscription';
            const reviewMeta = resolveReviewState(app);

            return (
              <motion.div
                key={app.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                onClick={() => onViewDetails(app.id)}
                className="group relative overflow-hidden flex flex-col sm:flex-row sm:items-center justify-between p-5 bg-gradient-to-br from-white/[0.04] to-transparent border border-white/10 rounded-[1.5rem] gap-5 cursor-pointer hover:border-gold/30 hover:bg-white/[0.06] transition-all"
              >
                <div className="flex items-center gap-5">
                  <div className={cn(
                    "h-14 w-14 rounded-2xl flex items-center justify-center shrink-0 shadow-lg transition-transform group-hover:scale-110",
                    isCancelled ? "bg-red-500/10 text-red-400" : isCompleted ? "bg-emerald-500/10 text-emerald-400" : "bg-gold/10 text-gold"
                  )}>
                    <Scissors size={24} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-black text-white text-lg">{app.services?.name}</h3>
                      {isSubCovered && (
                        <Badge className="bg-gold/10 text-gold border-gold/30 text-[9px] uppercase font-black tracking-widest px-2 py-0.5">
                          Incluso no Plano
                        </Badge>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-1.5">
                      <span className="flex items-center gap-1.5 text-xs text-gray-400 font-medium">
                        <Calendar size={14} className="text-gold/60" />
                        {format(parseISO(app.start_time), "dd 'de' MMM", { locale: ptBR })}
                      </span>
                      <span className="flex items-center gap-1.5 text-xs text-gray-400 font-medium">
                        <Clock size={14} className="text-gold/60" />
                        {format(parseISO(app.start_time), "HH:mm")}
                      </span>
                      <span className="flex items-center gap-1.5 text-xs text-gray-400 font-medium">
                        <UserIcon size={14} className="text-gold/60" />
                        {app.barbers?.name}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col sm:items-end justify-between sm:justify-center gap-3">
                  <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                    {isCancelled ? (
                      <Badge variant="destructive" className="font-black uppercase text-[10px] tracking-widest px-3">Cancelado</Badge>
                    ) : isCompleted ? (
                      <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 font-black uppercase text-[10px] tracking-widest px-3">Concluído</Badge>
                    ) : (
                      <Badge className="bg-blue-500/15 text-blue-400 border-blue-500/30 font-black uppercase text-[10px] tracking-widest px-3">Agendado</Badge>
                    )}

                    {app.payment_status === 'paid' && !isSubCovered && (
                      <Badge className="bg-emerald-500 text-black font-black uppercase text-[10px] tracking-widest px-3 border-none">Pago</Badge>
                    )}
                  </div>

                  {/* Fluxo de Avaliação Opcional e Estados Pós-Conclusão */}
                  {reviewMeta.state === "PENDING_DECISION" && (
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:justify-end">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onReview(app);
                        }}
                        className="inline-flex items-center justify-center gap-2 h-10 sm:h-9 px-4 rounded-xl bg-gold text-black text-[11px] font-black uppercase tracking-widest hover:brightness-110 active:scale-95 transition-all shadow-[0_8px_20px_rgba(212,175,55,0.3)] min-h-[44px] sm:min-h-[36px]"
                      >
                        <Star size={13} className="fill-black" />
                        Avaliar Agora
                      </button>

                      {onSkipReview && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSkipReview(app);
                          }}
                          className="inline-flex items-center justify-center gap-1.5 h-10 sm:h-9 px-3 rounded-xl border border-white/10 text-zinc-400 hover:text-white hover:border-white/20 bg-transparent text-[10px] font-bold uppercase tracking-wider active:scale-95 transition-all min-h-[44px] sm:min-h-[36px]"
                        >
                          Não quero avaliar
                        </button>
                      )}
                    </div>
                  )}

                  {reviewMeta.state === "REVIEW_SKIPPED" && (
                    <Badge className="bg-zinc-800/80 text-zinc-400 border-zinc-700/50 font-bold uppercase text-[10px] tracking-wider px-3 py-1 self-start sm:self-auto">
                      Sem avaliação
                    </Badge>
                  )}

                  {reviewMeta.state === "REVIEW_SUBMITTED" && (
                    <div className="flex items-center gap-1.5 self-start sm:self-auto">
                      {reviewMeta.moderationStatus === "approved" ? (
                        <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 font-black uppercase text-[10px] tracking-widest px-3 py-1 flex items-center gap-1.5">
                          <CheckCircle2 size={12} /> ✓ Avaliado
                        </Badge>
                      ) : reviewMeta.moderationStatus === "rejected" ? (
                        <Badge className="bg-amber-500/10 text-amber-300/80 border-amber-500/20 font-bold uppercase text-[10px] tracking-wider px-3 py-1 flex items-center gap-1.5">
                          Avaliação enviada
                        </Badge>
                      ) : (
                        <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30 font-black uppercase text-[10px] tracking-wider px-3 py-1 flex items-center gap-1.5">
                          <Sparkles size={12} /> Avaliação enviada • Em moderação
                        </Badge>
                      )}
                    </div>
                  )}

                  {reviewMeta.state === "UNKNOWN" && (
                    <div
                      className="inline-flex items-center gap-1.5 h-8 px-3 rounded-xl bg-white/5 border border-white/10 text-[10px] font-bold text-zinc-500 uppercase tracking-wider self-start sm:self-auto"
                      title="Status de avaliação temporariamente indisponível"
                    >
                      <span>Avaliação Indisponível</span>
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })
        )}
      </div>
    </div>
  );
}
