import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { 
  MessageSquare, 
  Clock, 
  ChevronRight, 
  AlertCircle,
  Loader2,
  AlertTriangle,
  Info
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useTenant } from "@/hooks/use-tenant";
import { cn } from "@/lib/utils";

interface TicketListProps {
  onSelectTicket: (ticket: any) => void;
}

export function TicketList({ onSelectTicket }: TicketListProps) {
  const { tenantId } = useTenant();
  const queryClient = useQueryClient();

  const { data: tickets, isLoading } = useQuery({
    queryKey: ["tenant-tickets", tenantId || ""],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("support_tickets")
        .select("*")
        .eq("barbershop_id", tenantId as string)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId
  });

  // Supabase Realtime for automatic updates
  useEffect(() => {
    if (!tenantId) return;

    const channel = supabase
      .channel('tenant-tickets-realtime')
      .on('postgres_changes', { 
        event: '*', 
        table: 'support_tickets',
        schema: 'public',
        filter: `barbershop_id=eq.${tenantId as string}`
      }, () => {
        console.log("Realtime update received for tickets");
        queryClient.invalidateQueries({ queryKey: ["tenant-tickets", tenantId || ""] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tenantId, queryClient]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'open': 
        return <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20">Aberto</Badge>;
      case 'in_progress': 
        return <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/20">Em andamento</Badge>;
      case 'responded': 
        return <Badge className="bg-purple-500/10 text-purple-500 border-purple-500/20">Respondido</Badge>;
      case 'resolved': 
        return <Badge className="bg-green-500/10 text-green-500 border-green-500/20">Resolvido</Badge>;
      case 'closed': 
        return <Badge variant="secondary" className="opacity-70">Fechado</Badge>;
      default: 
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getPriorityIcon = (priority: string | null) => {
    switch (priority) {
      case 'low': return <Info size={14} className="text-gray-400" />;
      case 'medium': return <Info size={14} className="text-blue-400" />;
      case 'high': return <AlertTriangle size={14} className="text-amber-500" />;
      case 'urgent': return <AlertCircle size={14} className="text-rose-500 animate-pulse" />;
      default: return null;
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 space-y-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-muted-foreground text-sm">Carregando seus chamados...</p>
      </div>
    );
  }

  if (!tickets || tickets.length === 0) {
    return (
      <div className="text-center p-12 border-2 border-dashed rounded-2xl bg-muted/30">
        <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-20" />
        <h3 className="text-lg font-bold">Nenhum chamado aberto</h3>
        <p className="text-muted-foreground text-sm max-w-xs mx-auto mt-1">
          Se precisar de ajuda, clique no botão "Novo Chamado" para falar com nosso suporte.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      {tickets.map((ticket) => (
        <button
          key={ticket.id}
          onClick={() => onSelectTicket(ticket)}
          className="group relative flex flex-col md:flex-row md:items-center justify-between p-5 rounded-2xl border bg-card hover:bg-accent/50 transition-all border-white/5 hover:border-primary/20 shadow-lg hover:shadow-primary/5 text-left"
        >
          {/* Status color indicator stripe */}
          <div className={cn(
            "absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl",
            ticket.status === 'open' && "bg-blue-500",
            ticket.status === 'in_progress' && "bg-amber-500",
            ticket.status === 'responded' && "bg-purple-500",
            ticket.status === 'resolved' && "bg-green-500",
            ticket.status === 'closed' && "bg-gray-500"
          )} />

          <div className="flex flex-col gap-3 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-bold text-lg text-foreground group-hover:text-primary transition-colors">
                {ticket.title}
              </span>
              {getStatusBadge(ticket.status || 'open')}
              {getPriorityIcon(ticket.priority)}
            </div>

            <p className="text-sm text-muted-foreground line-clamp-1 max-w-2xl">
              {ticket.description}
            </p>

            <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5 font-medium">
                <Clock size={14} className="text-primary/70" /> 
                {(() => {
                  try {
                    return ticket.created_at ? format(new Date(ticket.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR }) : "Data não disponível";
                  } catch (e) {
                    return "Data inválida";
                  }
                })()}
              </span>
              <span className="h-1 w-1 rounded-full bg-border hidden md:block" />
              <Badge variant="outline" className="text-[10px] uppercase tracking-wider bg-accent/30 border-white/10">
                {ticket.category}
              </Badge>
            </div>
          </div>

          <div className="flex items-center gap-4 mt-4 md:mt-0">
            <div className="hidden md:flex flex-col items-end gap-1">
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground opacity-50">Protocolo</span>
              <span className="text-xs font-mono bg-accent px-2 py-0.5 rounded border border-white/5">
                #{ticket.id.split('-')[0].toUpperCase()}
              </span>
            </div>
            <div className="h-10 w-10 rounded-full bg-primary/5 flex items-center justify-center text-primary/40 group-hover:text-primary group-hover:bg-primary/10 transition-all border border-transparent group-hover:border-primary/20">
              <ChevronRight size={20} />
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}
