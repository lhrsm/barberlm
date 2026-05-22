import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { 
  Send, 
  User, 
  ShieldCheck, 
  Paperclip, 
  Download, 
  Loader2,
  CheckCircle2,
  X,
  History,
  MessageSquare,
  AlertCircle
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface SuperAdminTicketDetailsProps {
  ticket: any;
  onClose: () => void;
}

export function SuperAdminTicketDetails({ ticket, onClose }: SuperAdminTicketDetailsProps) {
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState(ticket.status);
  const queryClient = useQueryClient();

  const { data: messages, isLoading } = useQuery({
    queryKey: ["ticket-messages", ticket.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ticket_messages")
        .select("*")
        .eq("ticket_id", ticket.id)
        .order("created_at", { ascending: true });
      
      if (error) throw error;
      return data;
    }
  });

  // Real-time messages
  useEffect(() => {
    const channel = supabase
      .channel(`admin-ticket-messages-${ticket.id}`)
      .on('postgres_changes', { 
        event: 'INSERT', 
        table: 'ticket_messages',
        schema: 'public',
        filter: `ticket_id=eq.${ticket.id}`
      }, () => {
        queryClient.invalidateQueries({ queryKey: ["ticket-messages", ticket.id] });
      })
      .on('postgres_changes', { 
        event: 'UPDATE', 
        table: 'support_tickets',
        schema: 'public',
        filter: `id=eq.${ticket.id}`
      }, (payload) => {
        setStatus(payload.new.status);
        queryClient.invalidateQueries({ queryKey: ["admin-all-tickets"] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [ticket.id, queryClient]);

  const updateStatusMutation = useMutation({
    mutationFn: async (newStatus: string) => {
      const { error } = await supabase
        .from("support_tickets")
        .update({ status: newStatus })
        .eq("id", ticket.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Status atualizado");
      queryClient.invalidateQueries({ queryKey: ["admin-all-tickets"] });
    }
  });

  const sendMessageMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");

      const payload = {
        ticket_id: ticket.id,
        sender_id: user.id,
        sender_type: 'super_admin',
        message: message,
      };

      const { error } = await supabase
        .from("ticket_messages")
        .insert(payload);
      
      if (error) throw error;

      // Update ticket status to responded
      if (ticket.status === 'open' || ticket.status === 'in_progress') {
        await supabase
          .from("support_tickets")
          .update({ status: 'responded' })
          .eq("id", ticket.id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ticket-messages", ticket.id] });
      setMessage("");
      toast.success("Resposta enviada");
    },
    onError: (error: any) => {
      toast.error("Erro ao enviar: " + error.message);
    }
  });

  const getStatusBadge = (s: string) => {
    switch (s) {
      case 'open': return <Badge className="bg-blue-500 hover:bg-blue-600">Aberto</Badge>;
      case 'in_progress': return <Badge className="bg-amber-500 hover:bg-amber-600">Em andamento</Badge>;
      case 'responded': return <Badge className="bg-purple-500 hover:bg-purple-600">Respondido</Badge>;
      case 'resolved': return <Badge className="bg-green-500 hover:bg-green-600">Resolvido</Badge>;
      case 'closed': return <Badge variant="secondary">Fechado</Badge>;
      default: return <Badge variant="outline">{s}</Badge>;
    }
  };

  return (
    <Card className="h-full flex flex-col border-none shadow-none bg-background">
      <CardHeader className="border-b px-6 py-4 flex flex-row items-center justify-between shrink-0">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <CardTitle className="text-xl">{ticket.title}</CardTitle>
            {getStatusBadge(status)}
          </div>
          <CardDescription className="flex items-center gap-2">
            <Badge variant="outline" className="text-[10px] uppercase font-bold">
              ID: #{ticket.id.split('-')[0]}
            </Badge>
            <span className="text-muted-foreground">•</span>
            <span className="text-sm font-medium text-primary">{ticket.barbershops?.name || 'Barbearia'}</span>
          </CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <Select 
            value={status} 
            onValueChange={(val) => {
              setStatus(val);
              updateStatusMutation.mutate(val);
            }}
          >
            <SelectTrigger className="w-[180px] h-9 bg-card border-border">
              <SelectValue placeholder="Alterar Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="open">Aberto</SelectItem>
              <SelectItem value="in_progress">Em andamento</SelectItem>
              <SelectItem value="responded">Respondido</SelectItem>
              <SelectItem value="resolved">Resolvido</SelectItem>
              <SelectItem value="closed">Fechado</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="ghost" size="icon" onClick={onClose} className="hover:bg-accent">
            <X size={20} />
          </Button>
        </div>
      </CardHeader>

      <div className="flex-1 overflow-hidden flex flex-col">
        <ScrollArea className="flex-1 p-6">
          <div className="space-y-6">
            {/* Ticket Info Card */}
            <div className="bg-accent/30 rounded-xl p-4 border border-border/50">
              <div className="flex items-center gap-2 mb-3">
                <AlertCircle size={16} className="text-primary" />
                <h3 className="font-semibold text-sm uppercase tracking-wider">Detalhes do Chamado</h3>
              </div>
              <div className="grid grid-cols-2 gap-4 text-xs mb-4">
                <div>
                  <span className="text-muted-foreground block mb-1">Categoria</span>
                  <Badge variant="secondary">{ticket.category}</Badge>
                </div>
                <div>
                  <span className="text-muted-foreground block mb-1">Prioridade</span>
                  <Badge variant={ticket.priority === 'high' ? 'destructive' : 'outline'}>
                    {ticket.priority === 'high' ? 'Alta' : ticket.priority === 'medium' ? 'Média' : 'Baixa'}
                  </Badge>
                </div>
              </div>
              <div className="space-y-1">
                <span className="text-muted-foreground text-xs block">Descrição Inicial:</span>
                <p className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">{ticket.description}</p>
              </div>
            </div>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground font-medium flex items-center gap-1.5">
                  <MessageSquare size={12} /> Conversa em tempo real
                </span>
              </div>
            </div>

            {/* Messages */}
            <div className="space-y-4">
              {isLoading ? (
                <div className="flex justify-center p-8">
                  <Loader2 className="animate-spin text-primary" />
                </div>
              ) : messages?.length === 0 ? (
                <div className="text-center p-8 bg-accent/20 rounded-lg border border-dashed border-border">
                  <p className="text-sm text-muted-foreground italic">Nenhuma mensagem enviada ainda.</p>
                </div>
              ) : (
                messages?.map((msg) => (
                  <div key={msg.id} className={cn("flex", msg.sender_type === 'super_admin' ? "justify-end" : "justify-start")}>
                    <div className={cn(
                      "max-w-[85%] rounded-2xl px-4 py-3 shadow-md transition-all",
                      msg.sender_type === 'super_admin' 
                        ? "bg-primary text-primary-foreground rounded-tr-none" 
                        : "bg-card border border-border text-foreground rounded-tl-none"
                    )}>
                      <div className="flex items-center gap-2 mb-1.5">
                        {msg.sender_type === 'super_admin' ? <ShieldCheck size={12} /> : <User size={12} className="text-primary" />}
                        <span className="text-[10px] font-bold uppercase tracking-widest opacity-80">
                          {msg.sender_type === 'super_admin' ? "Você (Super Admin)" : "Barbearia"}
                        </span>
                      </div>
                      <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.message}</p>
                      <span className="text-[10px] opacity-60 mt-2 block text-right">
                        {format(new Date(msg.created_at), "HH:mm")}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </ScrollArea>

        <CardFooter className="border-t p-4 bg-accent/10">
          <div className="w-full space-y-3">
            <div className="flex gap-2 items-end">
              <div className="flex-1 relative">
                <textarea 
                  placeholder="Digite sua resposta..." 
                  className="w-full min-h-[100px] bg-background border border-border rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all resize-none"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      sendMessageMutation.mutate();
                    }
                  }}
                  disabled={status === 'closed' || status === 'resolved'}
                />
              </div>
              <Button 
                className="h-[40px] px-6 gap-2 font-semibold shadow-lg shadow-primary/20 hover:scale-105 transition-transform"
                onClick={() => sendMessageMutation.mutate()} 
                disabled={!message.trim() || sendMessageMutation.isPending || status === 'closed'}
              >
                {sendMessageMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : (
                  <>
                    Responder <Send className="h-4 w-4" />
                  </>
                )}
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground text-center">
              Pressione Enter para enviar. Shift + Enter para nova linha.
            </p>
          </div>
        </CardFooter>
      </div>
    </Card>
  );
}
