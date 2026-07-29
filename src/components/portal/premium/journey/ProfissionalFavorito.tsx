import * as React from "react";
import { motion } from "framer-motion";
import { User as UserIcon, Scissors, Star } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

type Props = {
  appointments: any[];
  barbers: any[];
};

const dispatch = () => {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("OPEN_BOOKING_MODAL"));
};

export function ProfissionalFavorito({ appointments, barbers }: Props) {
  const completed = appointments.filter((a) => a.status === "completed");
  if (completed.length < 2) return null;

  const counts = new Map<string, { id: string; name: string; n: number; last: Date }>();
  completed.forEach((a) => {
    const id = a.barber_id;
    const name = a.barbers?.name;
    if (!id || !name) return;
    const cur = counts.get(id) || { id, name, n: 0, last: new Date(a.start_time) };
    cur.n += 1;
    const d = new Date(a.start_time);
    if (d > cur.last) cur.last = d;
    counts.set(id, cur);
  });
  const fav = Array.from(counts.values()).sort((a, b) => b.n - a.n)[0];
  if (!fav || fav.n < 2) return null;

  const info = barbers.find((b) => b.id === fav.id);
  const avatar = info?.avatar_url || info?.photo_url;
  const specialty = info?.specialty || info?.role || "Profissional";

  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.4 }}
      className="relative overflow-hidden rounded-3xl border border-gold/25 bg-gradient-to-br from-white/[0.04] to-transparent p-6 backdrop-blur-xl"
    >
      <div className="pointer-events-none absolute -top-20 -right-20 h-48 w-48 rounded-full bg-gold/15 blur-3xl" />
      <div className="relative flex flex-wrap items-center gap-5">
        <div className="relative">
          {avatar ? (
            <img src={avatar} alt={fav.name} className="h-20 w-20 rounded-2xl object-cover border-2 border-gold/60" />
          ) : (
            <div className="h-20 w-20 rounded-2xl grid place-items-center border-2 border-gold/60 bg-white/5 text-gold">
              <UserIcon className="h-9 w-9" />
            </div>
          )}
          <div className="absolute -top-2 -right-2 h-7 w-7 rounded-full bg-gradient-to-br from-gold to-[#F5D061] grid place-items-center ring-2 ring-black">
            <Star className="h-3.5 w-3.5 text-black" />
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] uppercase tracking-[0.3em] font-black text-gold">Profissional favorito</p>
          <h3 className="text-xl md:text-2xl font-black text-white mt-1 truncate">{fav.name}</h3>
          <p className="text-xs text-gray-400 mt-0.5">{specialty}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="text-[11px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full border border-gold/40 bg-gold/10 text-gold">
              {fav.n} atendimentos
            </span>
            <span className="text-[11px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full border border-white/15 bg-white/5 text-gray-300">
              Último em {format(fav.last, "dd MMM", { locale: ptBR })}
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={dispatch}
          className={cn(
            "inline-flex items-center gap-2 rounded-2xl px-5 py-3 text-sm font-black uppercase tracking-widest",
            "bg-gold text-black hover:brightness-110 transition-all",
            "shadow-[0_10px_30px_-10px_rgba(212,175,55,0.6)]",
          )}
        >
          <Scissors className="h-4 w-4" /> Agendar
        </button>
      </div>
    </motion.section>
  );
}
