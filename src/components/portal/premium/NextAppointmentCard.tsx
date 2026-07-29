import * as React from "react";
import { motion } from "framer-motion";
import {
  Calendar as CalendarIcon,
  Clock,
  MapPin,
  RefreshCw,
  XCircle,
  Plus,
  Scissors,
  User as UserIcon,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

type Props = {
  appointments: any[];
  shop: any;
  onReschedule?: (appt: any) => void;
  onCancel?: (appt: any) => void;
  onNewAppointment?: () => void;
};

function buildIcs(appt: any, shop: any) {
  const dt = (d: Date) =>
    d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  const start = new Date(appt.start_time);
  const end = new Date(appt.end_time || +start + 30 * 60000);
  const title = `${appt.services?.name || "Atendimento"} - ${shop?.business_name || ""}`;
  const desc = `Profissional: ${appt.barbers?.name || ""}`;
  const loc = shop?.business_address || shop?.address || "";
  return `BEGIN:VCALENDAR\nVERSION:2.0\nBEGIN:VEVENT\nUID:${appt.id}@barbex\nDTSTAMP:${dt(new Date())}\nDTSTART:${dt(start)}\nDTEND:${dt(end)}\nSUMMARY:${title}\nDESCRIPTION:${desc}\nLOCATION:${loc}\nEND:VEVENT\nEND:VCALENDAR`;
}

export function NextAppointmentCard({
  appointments,
  shop,
  onReschedule,
  onCancel,
  onNewAppointment,
}: Props) {
  const upcoming = appointments
    .filter(
      (a) => ["scheduled", "confirmed"].includes(a.status) && new Date(a.start_time) >= new Date(),
    )
    .sort((a, b) => +new Date(a.start_time) - +new Date(b.start_time));

  if (upcoming.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-dashed border-white/15 bg-white/[0.02] p-8 text-center"
      >
        <div className="h-14 w-14 mx-auto rounded-2xl bg-white/5 grid place-items-center mb-3">
          <CalendarIcon className="h-6 w-6 text-white/60" />
        </div>
        <p className="text-white font-bold">Nenhum atendimento agendado</p>
        <p className="text-sm text-gray-400 mt-1">
          Que tal marcar seu próximo corte agora mesmo?
        </p>
        {onNewAppointment && (
          <button
            onClick={onNewAppointment}
            className="mt-4 inline-flex items-center gap-2 h-11 px-6 rounded-xl bg-gradient-to-r from-gold to-[#F5D061] text-black font-black uppercase text-xs tracking-widest shadow-[0_8px_24px_rgba(212,175,55,0.35)] hover:brightness-110 hover:-translate-y-0.5 transition-all"
          >
            <Plus className="h-4 w-4" /> Novo Agendamento
          </button>
        )}
      </motion.div>
    );
  }


  const openMap = () => {
    const q = encodeURIComponent(shop?.business_address || shop?.business_name || "");
    if (q) window.open(`https://www.google.com/maps/search/?api=1&query=${q}`, "_blank");
  };

  const download = (appt: any) => {
    const blob = new Blob([buildIcs(appt, shop)], { type: "text/calendar" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "agendamento.ics";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-3">
      {upcoming.map((next, idx) => {
        const start = new Date(next.start_time);
        const covered = !!next.covered_by_subscription;
        const isFirst = idx === 0;
        return (
          <motion.div
            key={next.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.05 }}
            className={cn(
              "relative overflow-hidden rounded-2xl border p-5 md:p-6",
              "bg-gradient-to-br from-[#0F0F14] via-[#0A0A0A] to-black",
              isFirst
                ? "border-gold/30 shadow-[0_12px_40px_-15px_rgba(212,175,55,0.35)]"
                : "border-white/10",
            )}
          >
            {isFirst && (
              <div className="pointer-events-none absolute -top-20 -right-20 h-56 w-56 rounded-full bg-gold/15 blur-3xl" />
            )}
            <div className="relative flex flex-col md:flex-row md:items-center gap-5">
              <div className="flex items-center gap-4 flex-1 min-w-0">
                <div className="h-14 w-14 shrink-0 rounded-2xl bg-gradient-to-br from-gold to-[#B8860B] grid place-items-center shadow-lg">
                  <Scissors className="h-6 w-6 text-black" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-[0.3em] font-black text-gold">
                    {isFirst ? "Próximo Atendimento" : `Agendamento ${idx + 1}`}
                  </p>
                  <h3 className="text-lg md:text-xl font-black text-white truncate">
                    {next.services?.name || "Serviço"}
                  </h3>
                  <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-gray-400">
                    <span className="inline-flex items-center gap-1">
                      <UserIcon className="h-3 w-3" /> {next.barbers?.name || "Profissional"}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <CalendarIcon className="h-3 w-3" />{" "}
                      {format(start, "dd 'de' MMM", { locale: ptBR })}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3 w-3" /> {format(start, "HH:mm")}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col items-end gap-2">
                <div className="text-right">
                  <p className="text-[10px] uppercase tracking-widest text-gray-500 font-bold">Valor</p>
                  <p
                    className={cn(
                      "text-lg font-black",
                      covered ? "text-emerald-400" : "text-white",
                    )}
                  >
                    {covered ? "Incluso no Plano" : `R$ ${Number(next.service_price ?? next.total_price ?? next.services?.price ?? 0).toFixed(2)}`}
                  </p>
                </div>
              </div>
            </div>

            <div className="relative mt-5 pt-4 border-t border-white/5 grid grid-cols-2 md:grid-cols-4 gap-2">
              {onReschedule && (
                <button
                  onClick={() => onReschedule(next)}
                  className="h-10 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/25 text-white text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2"
                >
                  <RefreshCw className="h-3.5 w-3.5" /> Reagendar
                </button>
              )}
              {onCancel && (
                <button
                  onClick={() => onCancel(next)}
                  className="h-10 rounded-xl bg-white/5 border border-white/10 hover:bg-red-500/10 hover:border-red-500/30 hover:text-red-300 text-white text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2"
                >
                  <XCircle className="h-3.5 w-3.5" /> Cancelar
                </button>
              )}
              <button
                onClick={() => download(next)}
                className="h-10 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/25 text-white text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2"
              >
                <CalendarIcon className="h-3.5 w-3.5" /> Calendário
              </button>
              <button
                onClick={openMap}
                className="h-10 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/25 text-white text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2"
              >
                <MapPin className="h-3.5 w-3.5" /> Localização
              </button>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

