import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/layout/AppLayout";
import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useTenant } from "@/hooks/use-tenant";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

export const Route = createFileRoute("/dashboard/centro-de-comando")({
  component: CentroDeComando,
});

function CentroDeComando() {
  const { user, profile } = useAuth();
  const { tenantId } = useTenant();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Placeholder para carregar dados operacionais
    const loadData = async () => {
      setLoading(false);
    };
    loadData();
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
      <div className="p-4 md:p-8 space-y-8">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black uppercase italic tracking-tighter text-white">CENTRO DE COMANDO</h1>
            <p className="text-slate-400 font-medium">Operação da sua barbearia em tempo real.</p>
          </div>
          <div className="flex gap-2">
            <button className="px-4 py-2 bg-zinc-900 border border-white/10 rounded-lg text-xs font-black uppercase tracking-widest text-white hover:bg-zinc-800 transition">Atualizar</button>
            <button className="px-4 py-2 bg-zinc-900 border border-white/10 rounded-lg text-xs font-black uppercase tracking-widest text-white hover:bg-zinc-800 transition">Configurar</button>
          </div>
        </header>

        <section className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="bg-zinc-900/50 border border-white/10 p-4 rounded-xl">
             <div className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Atendimentos</div>
             <div className="text-2xl font-black text-white">12</div>
             <div className="text-gold text-[10px] font-bold">8 concluídos</div>
          </div>
          <div className="bg-zinc-900/50 border border-white/10 p-4 rounded-xl">
             <div className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Em atendimento</div>
             <div className="text-2xl font-black text-white">3</div>
             <div className="text-gold text-[10px] font-bold">Agora</div>
          </div>
          <div className="bg-zinc-900/50 border border-white/10 p-4 rounded-xl">
             <div className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Aguardando</div>
             <div className="text-2xl font-black text-white">2</div>
             <div className="text-gold text-[10px] font-bold">Próximos</div>
          </div>
          <div className="bg-zinc-900/50 border border-white/10 p-4 rounded-xl">
             <div className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Faturamento</div>
             <div className="text-xl font-black text-white">R$ 1.280,00</div>
             <div className="text-gold text-[10px] font-bold">Realizado hoje</div>
          </div>
          <div className="bg-zinc-900/50 border border-white/10 p-4 rounded-xl">
             <div className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Pendente</div>
             <div className="text-xl font-black text-white">R$ 180,00</div>
             <div className="text-gold text-[10px] font-bold">A receber</div>
          </div>
        </section>
        
        <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-zinc-950 border border-white/10 p-6 rounded-2xl">
                <h3 className="text-lg font-black uppercase tracking-tight mb-4 text-white">AGENDA EM TEMPO REAL</h3>
                <div className="text-slate-500 text-sm italic">Em desenvolvimento...</div>
            </div>
            <div className="space-y-8">
                <div className="bg-zinc-950 border border-white/10 p-6 rounded-2xl">
                    <h3 className="text-lg font-black uppercase tracking-tight mb-4 text-white">AGORA</h3>
                    <div className="text-slate-500 text-sm italic">Em desenvolvimento...</div>
                </div>
                <div className="bg-zinc-950 border border-white/10 p-6 rounded-2xl">
                    <h3 className="text-lg font-black uppercase tracking-tight mb-4 text-white">PRÓXIMOS</h3>
                    <div className="text-slate-500 text-sm italic">Em desenvolvimento...</div>
                </div>
            </div>
        </div>
      </div>
    </AppLayout>
  );
}
