import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { formatBRL, type TimelineEvent } from "./metrics";
import {
  Calendar,
  Package,
  Wallet,
  CreditCard,
  Star,
  MessageSquare,
  Crown,
  UserPlus,
} from "lucide-react";

const TONE: Record<TimelineEvent["tone"], { dot: string; text: string }> = {
  gold: { dot: "bg-gold/20 border-gold/60 text-gold", text: "text-gold" },
  emerald: { dot: "bg-emerald-500/15 border-emerald-500/50 text-emerald-400", text: "text-emerald-400" },
  blue: { dot: "bg-blue-500/15 border-blue-500/50 text-blue-400", text: "text-blue-400" },
  red: { dot: "bg-red-500/15 border-red-500/50 text-red-400", text: "text-red-400" },
  slate: { dot: "bg-slate-500/15 border-slate-500/50 text-slate-300", text: "text-slate-300" },
  purple: { dot: "bg-purple-500/15 border-purple-500/50 text-purple-300", text: "text-purple-300" },
};

const ICON: Record<string, any> = {
  atendimento: Calendar,
  produto: Package,
  cashback: Wallet,
  credito: CreditCard,
  avaliacao: Star,
  automacao: MessageSquare,
  assinatura: Crown,
  cadastro: UserPlus,
};

export function CustomerTimeline({ events, limit = 60 }: { events: TimelineEvent[]; limit?: number }) {
  if (events.length === 0)
    return <p className="text-slate-500 text-sm text-center py-8">Nenhum evento registrado ainda.</p>;

  return (
    <ol className="relative pl-6 space-y-3" aria-label="Linha do tempo do cliente">
      <span aria-hidden className="absolute left-[11px] top-1 bottom-1 w-px bg-white/10" />
      {events.slice(0, limit).map((e) => {
        const tone = TONE[e.tone];
        const Icon = ICON[e.kind] || Calendar;
        return (
          <li key={e.id} className="relative animate-in fade-in duration-300">
            <span
              className={cn(
                "absolute -left-6 top-2 h-6 w-6 rounded-full border flex items-center justify-center",
                tone.dot,
              )}
              aria-hidden
            >
              <Icon size={12} />
            </span>
            <div className="rounded-xl border border-[#1f2937] bg-[#111827] px-3 py-2.5 transition-colors hover:border-gold/30">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-bold text-white leading-tight">{e.title}</p>
                {e.amount ? <span className={cn("text-xs font-black shrink-0", tone.text)}>{formatBRL(e.amount)}</span> : null}
              </div>
              {e.description && <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-2">{e.description}</p>}
              <p className="text-[10px] text-slate-500 mt-1">
                {format(e.date, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
