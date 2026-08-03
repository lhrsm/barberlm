import { SectionCard, SkeletonBlock, EmptyState } from "@/components/intelligence/ui";
import { CalendarDays, ChevronLeft, ChevronRight, Megaphone, Zap, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { cn } from "@/lib/utils";

export function CampaignCalendar({ model, loading }: any) {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const daysInMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1).getDay();

  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const padding = Array.from({ length: firstDayOfMonth }, (_, i) => null);

  const monthName = currentMonth.toLocaleString("pt-BR", { month: "long" });
  const year = currentMonth.getFullYear();

  const getCampaignsForDay = (day: number) => {
    return model.campaigns.filter((c: any) => {
      const d = new Date(c.date);
      return d.getDate() === day && d.getMonth() === currentMonth.getMonth() && d.getFullYear() === currentMonth.getFullYear();
    });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-black text-white capitalize">{monthName} {year}</h3>
          <p className="text-xs text-white/40">Planejamento de comunicações e campanhas</p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-9 w-9 p-0 hover:bg-white/5"
            onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))}
          >
            <ChevronLeft size={16} className="text-white/60" />
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-9 w-9 p-0 hover:bg-white/5"
            onClick={() => setCurrentMonth(new Date())}
          >
            <span className="text-[10px] font-black uppercase tracking-widest text-white/40">Hoje</span>
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-9 w-9 p-0 hover:bg-white/5"
            onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))}
          >
            <ChevronRight size={16} className="text-white/60" />
          </Button>
        </div>
      </div>

      <div className="rounded-3xl border border-white/[0.07] bg-[#0b0f17] p-4">
        <div className="grid grid-cols-7 mb-4">
          {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((d) => (
            <div key={d} className="text-center text-[10px] font-black uppercase tracking-widest text-white/20 pb-2">
              {d}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-px bg-white/[0.03] overflow-hidden rounded-2xl border border-white/[0.03]">
          {padding.map((_, i) => (
            <div key={`pad-${i}`} className="min-h-[100px] bg-[#0b0f17]" />
          ))}
          {days.map((day) => {
            const dayCampaigns = getCampaignsForDay(day);
            const isToday = day === new Date().getDate() && currentMonth.getMonth() === new Date().getMonth();
            
            return (
              <div key={day} className="min-h-[100px] bg-[#0b0f17] p-2 hover:bg-white/[0.02] transition-colors relative group">
                <span className={cn(
                  "text-[10px] font-black",
                  isToday ? "h-5 w-5 rounded-full bg-gold text-black flex items-center justify-center" : "text-white/40"
                )}>
                  {day}
                </span>
                
                <div className="mt-1 space-y-1">
                  {dayCampaigns.map((c: any) => (
                    <div 
                      key={c.id} 
                      className={cn(
                        "truncate rounded px-1.5 py-0.5 text-[9px] font-bold border",
                        c.status === "ativa" ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" :
                        c.status === "agendada" ? "bg-blue-500/10 border-blue-500/20 text-blue-400" :
                        "bg-white/5 border-white/10 text-white/60"
                      )}
                    >
                      {c.name}
                    </div>
                  ))}
                </div>

                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="absolute bottom-1 right-1 h-6 w-6 p-0 opacity-0 group-hover:opacity-100 hover:bg-gold/10 hover:text-gold transition-all"
                >
                  <Plus size={12} />
                </Button>
              </div>
            );
          })}
        </div>
      </div>

      <SectionCard title="Legenda" subtitle="Identificação por status" icon={CalendarDays}>
        <div className="flex flex-wrap gap-4">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-emerald-400" />
            <span className="text-[10px] font-black uppercase tracking-widest text-white/40">Enviada / Ativa</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-blue-400" />
            <span className="text-[10px] font-black uppercase tracking-widest text-white/40">Agendada</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-white/20" />
            <span className="text-[10px] font-black uppercase tracking-widest text-white/40">Encerrada / Rascunho</span>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}

function Plus(props: any) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
  );
}
