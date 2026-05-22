import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { 
  MessageSquare, 
  Clock, 
  ChevronRight, 
  AlertCircle,
  Loader2
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useTenant } from "@/hooks/use-tenant";

interface TicketListProps {
  onSelectTicket: (ticket: any) => void;
}

export function TicketList({ onSelectTicket }: TicketListProps) {
  const { tenantId } = useTenant();

  const { data: tickets, isLoading } = useQuery({
    queryKey: ["tenant-tickets", tenantId || ""],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("support_tickets")
        .select("*")
        .eq("tenant_id", tenantId as string)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'open': return <Badge className="bg-blue-500 hover:bg-blue-600">Aberto</Badge>;
      case 'in_progress': return <Badge className="bg-amber-500 hover:bg-amber-600">Em andamento</Badge>;
      case 'responded': return <Badge className="bg-purple-500 hover:bg-purple-600">Respondido</Badge>;
      case 'resolved': return <Badge className="bg-green-500 hover:bg-green-600">Resolvido</Badge>;
      case 'closed': return <Badge variant="secondary">Fechado</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'low': return <Badge variant="outline" className="text-gray-400 border-gray-400">Baixa</Badge>;
      case 'medium': return <Badge variant="outline" className="text-blue-400 border-blue-400">Média</Badge>;
      case 'high': return <Badge variant="outline" className="text-amber-400 border-amber-400">Alta</Badge>;
      case 'urgent': return <Badge variant="outline" className="text-rose-500 border-rose-500 animate-pulse">Urgente</Badge>;
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
    <div className="grid gap-3">
      {tickets.map((ticket) => (
        <button
          key={ticket.id}
          onClick={() => onSelectTicket(ticket)}
          className="w-full text-left p-4 rounded-2xl border bg-card hover:bg-accent/50 transition-all group flex items-center justify-between"
        >
          <div className="flex items-center gap-4">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
              <MessageSquare size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="font-bold text-sm md:text-base">{ticket.subject}</span>
                {getStatusBadge(ticket.status)}
                {getPriorityBadge(ticket.priority)}
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Clock size={12} /> {ticket.created_at ? format(new Date(ticket.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) : "Data não disponível"}
                </span>
                <span>•</span>
                <span>{ticket.category}</span>
              </div>
            </div>
          </div>
          <ChevronRight className="text-muted-foreground group-hover:text-primary transition-colors" />
        </button>
      ))}
    </div>
  );
}
