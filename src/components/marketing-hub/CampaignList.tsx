import { SectionCard, SkeletonBlock, EmptyState } from "@/components/intelligence/ui";
import { Megaphone, Users, Calendar, BarChart3, MoreHorizontal, Send, Clock, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export function CampaignList({ model, loading }: any) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-black text-white">Minhas Campanhas</h3>
        <Button size="sm" className="bg-gold text-black font-black">
          Nova Campanha
        </Button>
      </div>

      <SectionCard title="Histórico de Disparos" subtitle="Gerencie e acompanhe o desempenho das suas campanhas" icon={Megaphone}>
        {loading ? (
          <SkeletonBlock rows={5} />
        ) : model.campaigns.length === 0 ? (
          <EmptyState text="Você ainda não criou nenhuma campanha." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/[0.06] text-left text-[10px] font-black uppercase tracking-widest text-white/40">
                  <th className="pb-3 pl-4">Campanha</th>
                  <th className="pb-3">Status</th>
                  <th className="pb-3">Data</th>
                  <th className="pb-3 text-center">Impacto</th>
                  <th className="pb-3 text-center">Conversão</th>
                  <th className="pb-3 pr-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {model.campaigns.map((c: any) => (
                  <tr key={c.id} className="group transition-colors hover:bg-white/[0.02]">
                    <td className="py-4 pl-4">
                      <div>
                        <p className="text-sm font-bold text-white">{c.name}</p>
                        <p className="text-[10px] text-white/40 truncate max-w-[200px]">{c.type || 'WhatsApp Blast'}</p>
                      </div>
                    </td>
                    <td className="py-4">
                      <div className={cn(
                        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider",
                        c.status === "ativa" ? "bg-emerald-500/10 text-emerald-400" : 
                        c.status === "agendada" ? "bg-blue-500/10 text-blue-400" :
                        "bg-white/5 text-white/40"
                      )}>
                        {c.status === "ativa" && <CheckCircle2 size={10} />}
                        {c.status === "agendada" && <Clock size={10} />}
                        {c.status}
                      </div>
                    </td>
                    <td className="py-4 text-xs text-white/60">
                      {new Date(c.date).toLocaleDateString("pt-BR")}
                    </td>
                    <td className="py-4 text-center">
                      <div className="inline-flex items-center gap-1 text-xs font-bold text-white">
                        <Users size={12} className="text-white/20" />
                        {c.customers}
                      </div>
                    </td>
                    <td className="py-4 text-center">
                      <div className="inline-flex items-center gap-1 text-xs font-bold text-emerald-400">
                        {c.conversion || '0.0%'}
                      </div>
                    </td>
                    <td className="py-4 pr-4 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <MoreHorizontal size={14} className="text-white/40" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-40 border-white/[0.08] bg-[#0b0f17] text-white">
                          <DropdownMenuItem className="gap-2 focus:bg-white/5 focus:text-gold">
                            <BarChart3 size={14} /> Detalhes
                          </DropdownMenuItem>
                          <DropdownMenuItem className="gap-2 focus:bg-white/5 focus:text-gold">
                            <Send size={14} /> Reenviar
                          </DropdownMenuItem>
                          <DropdownMenuItem className="gap-2 text-rose-400 focus:bg-rose-500/10 focus:text-rose-400">
                            Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  );
}
