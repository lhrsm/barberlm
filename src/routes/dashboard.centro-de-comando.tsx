import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/layout/AppLayout";
import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useTenant } from "@/hooks/use-tenant";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, RefreshCw, Settings, Calendar as CalendarIcon, CheckCircle2, Clock } from "lucide-react";
import { format, startOfDay, endOfDay } from "date-fns";
import { AppointmentModal } from "@/components/calendar/AppointmentModal";
import { WalkinModal } from "@/components/calendar/WalkinModal";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/dashboard/centro-de-comando")({
  component: CentroDeComando,
});

function CentroDeComando() {
  const { user } = useAuth();
  const { tenantId } = useTenant();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);
  const [isWalkinOpen, setIsWalkinOpen] = useState(false);
  const [isAppointmentOpen, setIsAppointmentOpen] = useState(false);

  const fetchData = async () => {
    if (!tenantId) return;
    setLoading(true);
    
    // Simulação da busca de dados (futuramente consolidar em RPC/Query unificada)
    const todayStart = startOfDay(new Date()).toISOString();
    const todayEnd = endOfDay(new Date()).toISOString();

    const { count: appointments } = await supabase
      .from("appointments")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .gte("start_time", todayStart)
      .lte("start_time", todayEnd);

    setStats({
      appointments: appointments || 0,
      inProgress: 0,
      waiting: 0,
      billing: 0,
      pending: 0
    });
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [tenantId]);

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="animate-spin text-gold" size={48} />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-4 md:p-8 space-y-8 max-w-[1600px] mx-auto">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black uppercase italic tracking-tighter text-white">CENTRO DE COMANDO</h1>
            <p className="text-slate-400 font-medium">Operação da sua barbearia em tempo real.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={fetchData}><RefreshCw size={16} /></Button>
            <Button variant="ghost"><Settings size={16} /></Button>
          </div>
        </header>

        {/* Resumo Operacional */}
        <section className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="bg-zinc-900/50 border border-white/10 p-4 rounded-xl">
             <div className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Atendimentos</div>
             <div className="text-2xl font-black text-white">{stats.appointments}</div>
          </div>
          <div className="bg-zinc-900/50 border border-white/10 p-4 rounded-xl">
             <div className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Em atendimento</div>
             <div className="text-2xl font-black text-white">0</div>
          </div>
          <div className="bg-zinc-900/50 border border-white/10 p-4 rounded-xl">
             <div className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Aguardando</div>
             <div className="text-2xl font-black text-white">0</div>
          </div>
          <div className="bg-zinc-900/50 border border-white/10 p-4 rounded-xl">
             <div className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Faturamento</div>
             <div className="text-xl font-black text-white">R$ 0,00</div>
          </div>
          <div className="bg-zinc-900/50 border border-white/10 p-4 rounded-xl">
             <div className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Pendente</div>
             <div className="text-xl font-black text-white">R$ 0,00</div>
          </div>
        </section>

        {/* Agenda e Ações */}
        <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-zinc-950 border border-white/10 p-6 rounded-2xl">
                <h3 className="text-lg font-black uppercase tracking-tight mb-4 text-white">AGENDA EM TEMPO REAL</h3>
                <div className="space-y-4">
                    <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/5">
                        <div className="flex items-center gap-3">
                            <Clock size={16} className="text-gold" />
                            <span className="text-sm font-bold">Nenhum atendimento no momento</span>
                        </div>
                    </div>
                </div>
            </div>
            
            <div className="space-y-8">
                <div className="bg-zinc-950 border border-white/10 p-6 rounded-2xl">
                    <h3 className="text-lg font-black uppercase tracking-tight mb-4 text-white">AÇÕES RÁPIDAS</h3>
                    <div className="grid grid-cols-2 gap-3">
                        <Button className="bg-gold text-black font-black uppercase tracking-widest text-[10px]" onClick={() => setIsAppointmentOpen(true)}>+ Novo Agendamento</Button>
                        <Button className="bg-emerald-600 text-white font-black uppercase tracking-widest text-[10px]" onClick={() => setIsWalkinOpen(true)}>+ Walk-in</Button>
                    </div>
                </div>
            </div>
        </div>
      </div>
      
      <AppointmentModal open={isAppointmentOpen} onOpenChange={setIsAppointmentOpen} onSuccess={fetchData} />
      <WalkinModal open={isWalkinOpen} onOpenChange={setIsWalkinOpen} onSuccess={fetchData} />
    </AppLayout>
  );
}
