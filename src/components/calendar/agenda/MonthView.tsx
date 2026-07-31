import * as React from "react";
import {
  addDays,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { AppointmentCard, type AgendaActions } from "./AppointmentCard";

interface Props extends AgendaActions {
  month: Date;
  appointments: any[];
  selectedDate: Date;
  onSelectDate: (d: Date) => void;
}

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export function MonthView({ month, appointments, selectedDate, onSelectDate, ...actions }: Props) {
  const days = React.useMemo(() => {
    const start = startOfWeek(startOfMonth(month), { weekStartsOn: 0 });
    const end = endOfWeek(endOfMonth(month), { weekStartsOn: 0 });
    const out: Date[] = [];
    for (let d = start; d <= end; d = addDays(d, 1)) out.push(d);
    return out;
  }, [month]);

  const byDay = React.useMemo(() => {
    const map = new Map<string, any[]>();
    appointments.forEach((a) => {
      if (!a.start_time) return;
      const k = format(parseISO(a.start_time), "yyyy-MM-dd");
      map.set(k, [...(map.get(k) || []), a]);
    });
    map.forEach((list) => list.sort((x, y) => (x.start_time > y.start_time ? 1 : -1)));
    return map;
  }, [appointments]);

  return (
    <div className="overflow-hidden rounded-3xl border border-white/5 bg-[#0B1220]">
      <div className="grid grid-cols-7 border-b border-white/5">
        {WEEKDAYS.map((w) => (
          <div
            key={w}
            className="py-2.5 text-center text-[10px] font-black uppercase tracking-widest text-slate-500"
          >
            {w}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day) => {
          const key = format(day, "yyyy-MM-dd");
          const list = byDay.get(key) || [];
          const inMonth = isSameMonth(day, month);
          const selected = isSameDay(day, selectedDate);
          const today = isSameDay(day, new Date());
          return (
            <button
              key={key}
              type="button"
              onClick={() => onSelectDate(day)}
              aria-label={format(day, "dd 'de' MMMM", { locale: ptBR })}
              aria-current={selected ? "date" : undefined}
              className={cn(
                "min-h-[104px] border-b border-r border-white/5 p-1.5 text-left align-top transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#F5C542]/70",
                inMonth ? "bg-transparent hover:bg-white/[0.03]" : "bg-black/30 opacity-45",
                selected && "bg-[#F5C542]/[0.07] ring-1 ring-inset ring-[#F5C542]/35",
              )}
            >
              <div className="mb-1 flex items-center justify-between px-0.5">
                <span
                  className={cn(
                    "grid h-6 min-w-6 place-items-center rounded-lg px-1 text-[11px] font-bold",
                    today ? "bg-[#F5C542] text-black" : "text-slate-300",
                  )}
                >
                  {format(day, "d")}
                </span>
                {list.length > 0 && (
                  <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500">
                    {list.length}
                  </span>
                )}
              </div>
              <div className="space-y-1">
                {list.slice(0, 3).map((a) => (
                  <AppointmentCard key={a.id} app={a} variant="micro" {...actions} />
                ))}
                {list.length > 3 && (
                  <span className="block px-1 text-[9px] font-bold uppercase tracking-wider text-[#F5C542]">
                    +{list.length - 3} mais
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
