import { motion } from "framer-motion";
import { 
  LayoutDashboard, 
  Calendar, 
  CreditCard, 
  Users, 
  Smartphone, 
  ShoppingBag,
  TrendingUp,
  Activity,
  ChevronRight,
  ShieldCheck,
  Zap
} from "lucide-react";
import { cn } from "@/lib/utils";

interface SystemMockupProps {
  className?: string;
}

export function SystemMockup({ className }: SystemMockupProps) {
  return (
    <div className={cn("relative w-full max-w-6xl mx-auto py-20", className)}>
      {/* Background Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-gold/5 blur-[120px] rounded-full pointer-events-none" />

      <div className="relative aspect-[16/9] w-full">
        {/* Main Notebook Mockup (Dashboard) */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 1, ease: "easeOut" }}
          className="absolute inset-0 z-20 rounded-[2rem] border border-[#F59E0B]/15 bg-[#050b18]/95 backdrop-blur-xl shadow-[0_50px_100px_-20px_rgba(0,0,0,0.8)] overflow-hidden group"
        >
          <div className="absolute inset-0 opacity-40 pointer-events-none"
               style={{
                 background: "radial-gradient(circle at 15% 20%, rgba(245,158,11,0.25), transparent 45%), radial-gradient(circle at 85% 80%, rgba(217,119,6,0.18), transparent 50%)"
               }}
          />

          
          <div className="h-full w-full bg-[#050b18]/40 p-6 md:p-10 flex flex-col gap-8 relative z-10">
            <div className="flex justify-between items-center">
              <div className="space-y-1">
                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-[#F59E0B]">Visão Geral do Negócio</div>
                <h3 className="text-2xl font-black italic uppercase text-white">Dashboard Executivo</h3>
              </div>
              <div className="flex gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500/40 border border-red-500/50" />
                <div className="w-3 h-3 rounded-full bg-yellow-500/40 border border-yellow-500/50" />
                <div className="w-3 h-3 rounded-full bg-green-500/40 border border-green-500/50" />
              </div>
            </div>

            {/* Mockup Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: "Receita Mensal", value: "R$ 42.850", icon: TrendingUp, color: "text-green-400" },
                { label: "Novos Clientes", value: "+124", icon: Users, color: "text-blue-400" },
                { label: "Agendamentos", value: "1.240", icon: Calendar, color: "text-[#F59E0B]" },
                { label: "Taxa de Retenção", value: "88%", icon: Activity, color: "text-purple-400" },
              ].map((stat, i) => (
                <div key={i} className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 space-y-2 backdrop-blur-sm">
                  <div className="flex justify-between items-start">
                    <stat.icon size={16} className={stat.color} />
                    <span className="text-[10px] font-bold text-green-500">+12%</span>
                  </div>
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{stat.label}</div>
                    <div className="text-lg font-black text-white">{stat.value}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Mockup Agenda Preview */}
            <div className="flex-1 rounded-2xl bg-white/[0.02] border border-white/5 p-6 flex flex-col gap-4 overflow-hidden backdrop-blur-sm">
              <div className="flex justify-between items-center">
                <div className="text-xs font-black uppercase tracking-widest text-white">Próximos Atendimentos</div>
                <ChevronRight size={16} className="text-slate-500" />
              </div>
              <div className="space-y-3">
                {[
                  { name: "Carlos Eduardo", service: "Corte & Barba", time: "14:30", price: "R$ 85,00" },
                  { name: "Felipe Mendes", service: "Pigmentação", time: "15:15", price: "R$ 120,00" },
                  { name: "Roberto Silva", service: "Corte Social", time: "16:00", price: "R$ 55,00" },
                ].map((row, i) => (
                  <div key={i} className="flex justify-between items-center py-3 border-b border-white/5 last:border-0">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-[#F59E0B]/10 flex items-center justify-center text-[10px] font-black text-[#F59E0B]">
                        {row.name.charAt(0)}
                      </div>
                      <div>
                        <div className="text-xs font-bold text-white">{row.name}</div>
                        <div className="text-[10px] text-slate-500 uppercase font-bold">{row.service}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-black text-[#F59E0B] italic">{row.time}</div>
                      <div className="text-[10px] text-slate-500 font-bold">{row.price}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </motion.div>

        {/* Tablet Mockup (CRM/Marketing) */}
        <motion.div
          initial={{ opacity: 0, x: 50, rotate: 5 }}
          whileInView={{ opacity: 1, x: 0, rotate: 5 }}
          viewport={{ once: true }}
          transition={{ duration: 1, delay: 0.2 }}
          className="absolute -right-12 top-1/2 -translate-y-1/2 z-30 w-1/3 aspect-[3/4] rounded-[2rem] border border-[#F59E0B]/15 bg-[#050b18] shadow-[0_30px_60px_-15px_rgba(0,0,0,0.8)] overflow-hidden hidden lg:block"
        >
          <div className="h-full w-full bg-[#050b18]/60 p-6 flex flex-col gap-6 relative">
            <div className="absolute inset-0 opacity-20 pointer-events-none"
                 style={{ background: "radial-gradient(circle at 50% 50%, rgba(245,158,11,0.15), transparent 70%)" }}
            />
            <div className="flex items-center gap-2 relative z-10">
              <Users size={16} className="text-[#F59E0B]" />
              <div className="text-[10px] font-black uppercase tracking-widest text-white italic">Gestão CRM</div>
            </div>
            <div className="space-y-4 relative z-10">
              <div className="p-4 rounded-xl bg-white/[0.03] border border-white/5">
                <div className="text-[9px] font-bold text-slate-500 uppercase mb-2">Segmento VIP</div>
                <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                  <div className="h-full w-3/4 bg-gradient-to-r from-[#F59E0B] to-[#D97706] shadow-[0_0_10px_rgba(245,158,11,0.5)]" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="aspect-square rounded-xl bg-white/[0.03] border border-white/5 flex flex-col items-center justify-center gap-2">
                  <ShieldCheck size={20} className="text-green-500" />
                  <span className="text-[8px] font-black uppercase text-slate-400">Verificado</span>
                </div>
                <div className="aspect-square rounded-xl bg-white/[0.03] border border-white/5 flex flex-col items-center justify-center gap-2">
                  <Zap size={20} className="text-[#F59E0B]" />
                  <span className="text-[8px] font-black uppercase text-slate-400">Automação</span>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: -50, rotate: -10 }}
          whileInView={{ opacity: 1, x: 0, rotate: -10 }}
          viewport={{ once: true }}
          transition={{ duration: 1, delay: 0.4 }}
          className="absolute -left-12 bottom-0 z-40 w-1/5 aspect-[9/19] rounded-[2.5rem] border-8 border-zinc-900 bg-[#050b18] shadow-[0_30px_60px_-15px_rgba(0,0,0,0.8)] overflow-hidden hidden lg:block"
        >
          <div className="h-full w-full bg-[#050b18]/90 p-4 flex flex-col gap-6 relative">
            <div className="absolute inset-0 opacity-30 pointer-events-none"
                 style={{ background: "radial-gradient(circle at 50% 50%, rgba(245,158,11,0.2), transparent 70%)" }}
            />
            <div className="w-16 h-4 bg-zinc-800 rounded-full mx-auto mb-4 relative z-10" /> 
            <div className="flex flex-col items-center gap-4 text-center relative z-10">
              <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-[#F59E0B] to-[#D97706] p-0.5">
                <div className="w-full h-full rounded-full bg-[#050b18] flex items-center justify-center">
                   <Smartphone className="text-[#F59E0B]" size={24} />
                </div>
              </div>
              <div>
                <div className="text-xs font-black text-white uppercase italic">Agende Agora</div>
                <div className="text-[8px] text-slate-500 font-bold uppercase tracking-widest">Portal do Cliente</div>
              </div>
            </div>
            <div className="space-y-2 relative z-10">
              <div className="h-10 w-full rounded-lg bg-[#F59E0B] text-black flex items-center justify-center text-[10px] font-black uppercase shadow-[0_10px_20px_-5px_rgba(245,158,11,0.3)]">Marcar Horário</div>
              <div className="h-10 w-full rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-[10px] font-black uppercase text-white backdrop-blur-sm">Ver Serviços</div>
            </div>
            <div className="mt-auto grid grid-cols-4 gap-2 relative z-10">
               {[LayoutDashboard, Calendar, ShoppingBag, Users].map((Icon, i) => (
                 <div key={i} className="flex items-center justify-center text-slate-600">
                   <Icon size={14} />
                 </div>
               ))}
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
