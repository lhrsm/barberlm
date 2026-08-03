import { SectionCard, SkeletonBlock, EmptyState } from "@/components/intelligence/ui";
import { Users, Filter, Plus, Save, Trash2, Search, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { cn } from "@/lib/utils";

export function AudienceBuilder({ loading }: { loading: boolean }) {
  const [searchTerm, setSearchTerm] = useState("");
  
  // Mock audiences - will be replaced by real data from marketing_audiences table
  const audiences = [
    { id: "1", name: "VIPs (Fiel)", description: "Clientes com mais de 10 visitas nos últimos 3 meses", count: 42, dynamic: true },
    { id: "2", name: "Inativos (30d+)", description: "Não visitam a barbearia há mais de 30 dias", count: 128, dynamic: true },
    { id: "3", name: "Aniversariantes do Mês", description: "Fazem aniversário no mês corrente", count: 15, dynamic: true },
    { id: "4", name: "Novos Clientes", description: "Primeira visita nos últimos 15 dias", count: 8, dynamic: false },
  ];

  const filteredAudiences = audiences.filter(a => 
    a.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    a.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-black text-white">Gestão de Públicos</h3>
          <p className="text-xs text-white/40">Segmentações inteligentes para campanhas direcionadas</p>
        </div>
        <Button className="bg-gold text-black font-black gap-2">
          <Plus size={16} /> Criar Público
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20" size={16} />
        <Input 
          placeholder="Buscar públicos..." 
          className="h-11 border-white/[0.06] bg-white/[0.02] pl-10 text-sm focus:border-gold/50 focus:ring-0"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {loading ? (
          Array(3).fill(0).map((_, i) => <SkeletonBlock key={i} rows={3} />)
        ) : filteredAudiences.length === 0 ? (
          <div className="col-span-full">
            <EmptyState text="Nenhum público encontrado." />
          </div>
        ) : (
          filteredAudiences.map((audience) => (
            <div 
              key={audience.id} 
              className="group relative overflow-hidden rounded-2xl border border-white/[0.07] bg-[#0b0f17] p-5 transition-all duration-300 hover:border-gold/30 hover:bg-white/[0.02]"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="h-10 w-10 rounded-xl bg-gold/10 flex items-center justify-center">
                  <Users size={18} className="text-gold" />
                </div>
                <Badge variant="outline" className={cn(
                  "text-[9px] font-black uppercase tracking-widest",
                  audience.dynamic ? "border-blue-500/30 text-blue-400" : "border-white/10 text-white/30"
                )}>
                  {audience.dynamic ? "Dinâmico" : "Estático"}
                </Badge>
              </div>
              
              <h4 className="font-bold text-white group-hover:text-gold transition-colors">{audience.name}</h4>
              <p className="mt-1 text-xs text-white/40 line-clamp-2 min-h-[32px]">{audience.description}</p>
              
              <div className="mt-4 flex items-center justify-between border-t border-white/[0.05] pt-4">
                <div className="flex flex-col">
                  <p className="text-[10px] font-black uppercase tracking-widest text-white/20">Alcance</p>
                  <p className="text-lg font-black text-white">{audience.count}</p>
                </div>
                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0 hover:bg-white/5 text-white/40 hover:text-white">
                    <Filter size={14} />
                  </Button>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0 hover:bg-rose-500/10 text-white/40 hover:text-rose-400">
                    <Trash2 size={14} />
                  </Button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <SectionCard title="Segmentação Rápida" subtitle="Crie filtros baseados no comportamento de consumo" icon={Filter}>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Mais de 30 dias sem vir", icon: Clock },
            { label: "Gastaram +R$ 500 no mês", icon: ShoppingBag },
            { label: "Nunca fizeram agendamento", icon: UserMinus },
            { label: "Aproveitaram cupom anterior", icon: Ticket },
          ].map((preset) => (
            <button 
              key={preset.label}
              className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 text-left transition-all hover:border-gold/25 hover:bg-white/[0.04]"
            >
              <div className="h-8 w-8 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
                <preset.icon size={14} className="text-white/40" />
              </div>
              <span className="text-xs font-bold text-white/80">{preset.label}</span>
            </button>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}

// Inline missing icons
function Clock(props: any) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
  );
}
function ShoppingBag(props: any) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
  );
}
function UserMinus(props: any) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="22" y1="11" x2="16" y2="11"/></svg>
  );
}
function Ticket(props: any) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"/><path d="M13 5v2"/><path d="M13 17v2"/><path d="M13 11v2"/></svg>
  );
}
