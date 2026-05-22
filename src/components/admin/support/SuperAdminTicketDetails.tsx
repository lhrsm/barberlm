import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { 
  Send, 
  User, 
  ShieldCheck, 
  Loader2,
  X,
  MessageSquare,
  AlertCircle,
  Calendar,
  Tag,
  Flag,
  BarChart3,
  Building2
} from "lucide-react";
import { Button } from "@/components/ui/button";
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
  const scrollRef = useRef<HTMLDivElement>(null);

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

  // Auto scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      const scrollAreaInner = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollAreaInner) {
        scrollAreaInner.scrollTop = scrollAreaInner.scrollHeight;
      }
    }
  }, [messages]);

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

      // Notify barbershop admin
      const { data: barbershop } = await supabase
        .from("barbershops")
        .select("owner_id, name")
        .eq("id", ticket.barbershop_id)
        .single();

      if (barbershop?.owner_id) {
        await supabase.from("notifications").insert({
          user_id: barbershop.owner_id,
          title: "Status de Chamado Atualizado",
          message: `O status do seu chamado "${ticket.title}" foi alterado para ${newStatus}.`,
          type: "support_update",
          link: "/support"
        });
      }
    },
    onSuccess: () => {
      toast.success("Status atualizado com sucesso");
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

      // Notify barbershop admin
      const { data: barbershop } = await supabase
        .from("barbershops")
        .select("owner_id")
        .eq("id", ticket.barbershop_id)
        .single();

      if (barbershop?.owner_id) {
        await supabase.from("notifications").insert({
          user_id: barbershop.owner_id,
          title: "Nova Mensagem do Suporte",
          message: `Você recebeu uma nova resposta no chamado: ${ticket.title}`,
          type: "support_reply",
          link: "/support"
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ticket-messages", ticket.id] });
      setMessage("");
      toast.success("Resposta enviada com sucesso");
    },
    onError: (error: any) => {
      toast.error("Erro ao enviar: " + error.message);
    }
  });

  const getStatusLabel = (s: string) => {
    switch (s) {
      case 'open': return 'Aberto';
      case 'in_progress': return 'Em andamento';
      case 'responded': return 'Respondido';
      case 'resolved': return 'Resolvido';
      case 'closed': return 'Fechado';
      default: return s;
    }
  };

  const getStatusBadge = (s: string) => {
    switch (s) {
      case 'open': return <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20 px-3 py-1">Aberto</Badge>;
      case 'in_progress': return <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/20 px-3 py-1">Em andamento</Badge>;
      case 'responded': return <Badge className="bg-purple-500/10 text-purple-500 border-purple-500/20 px-3 py-1">Respondido</Badge>;
      case 'resolved': return <Badge className="bg-green-500/10 text-green-500 border-green-500/20 px-3 py-1">Resolvido</Badge>;
      case 'closed': return <Badge variant="secondary" className="px-3 py-1">Fechado</Badge>;
      default: return <Badge variant="outline" className="px-3 py-1">{s}</Badge>;
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#0A0A0A] text-white overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-white/10 flex items-center justify-between bg-black/40 backdrop-blur-md z-10">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-black tracking-tight">{ticket.title}</h2>
            {getStatusBadge(status)}
          </div>
          <div className="flex items-center gap-4 text-xs text-muted-foreground font-medium">
            <span className="flex items-center gap-1.5"><Building2 size={14} className="text-primary" /> {ticket.barbershops?.name}</span>
            <span className="flex items-center gap-1.5"><Calendar size={14} className="text-primary" /> {format(new Date(ticket.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}</span>
            <span className="flex items-center gap-1.5"><Tag size={14} className="text-primary" /> #{ticket.id.split('-')[0].toUpperCase()}</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex flex-col gap-1">
             <span className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Alterar Status</span>
             <Select 
              value={status} 
              onValueChange={(val) => {
                setStatus(val);
                updateStatusMutation.mutate(val);
              }}
            >
              <SelectTrigger className="w-[160px] h-10 bg-white/5 border-white/10 hover:bg-white/10 transition-all rounded-xl focus:ring-primary/40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent className="bg-[#121212] border-white/10 text-white">
                <SelectItem value="open">Aberto</SelectItem>
                <SelectItem value="in_progress">Em andamento</SelectItem>
                <SelectItem value="responded">Respondido</SelectItem>
                <SelectItem value="resolved">Resolvido</SelectItem>
                <SelectItem value="closed">Fechado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="h-10 w-10 rounded-full hover:bg-white/10 mt-5">
            <X size={20} />
          </Button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col min-w-0 border-r border-white/5 relative">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(139,92,246,0.03),transparent)] pointer-events-none" />
          
          <ScrollArea className="flex-1 px-6 pt-6" ref={scrollRef}>
            <div className="space-y-8 pb-10">
              {/* Initial Description */}
              <div className="flex justify-center mb-10">
                <div className="bg-white/5 border border-white/10 rounded-2xl p-6 max-w-[90%] w-full shadow-2xl backdrop-blur-sm relative overflow-hidden group">
                  <div className="absolute top-0 left-0 w-1 h-full bg-primary" />
                  <div className="flex items-start gap-4">
                    <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                      <MessageSquare size={24} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-bold uppercase tracking-widest text-primary">Descrição do Problema</span>
                        <Badge variant="outline" className="text-[10px] bg-black/40 border-white/10">{ticket.category}</Badge>
                      </div>
                      <p className="text-base text-gray-200 leading-relaxed whitespace-pre-wrap">{ticket.description}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Chat Messages */}
              {isLoading ? (
                <div className="flex flex-col items-center justify-center h-40 gap-4">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="text-muted-foreground text-sm">Carregando histórico...</p>
                </div>
              ) : messages?.map((msg) => (
                <div 
                  key={msg.id} 
                  className={cn(
                    "flex flex-col gap-1.5 animate-in fade-in slide-in-from-bottom-2 duration-300",
                    msg.sender_type === 'super_admin' ? "items-end" : "items-start"
                  )}
                >
                  <div className="flex items-center gap-2 px-2">
                    {msg.sender_type === 'super_admin' ? (
                      <>
                        <span className="text-[10px] font-black uppercase tracking-tighter text-primary">Admin BarberLM</span>
                        <ShieldCheck size={10} className="text-primary" />
                      </>
                    ) : (
                      <>
                        <User size={10} className="text-muted-foreground" />
                        <span className="text-[10px] font-black uppercase tracking-tighter text-muted-foreground">Administrador da Barbearia</span>
                      </>
                    )}
                  </div>
                  
                  <div 
                    className={cn(
                      "max-w-[80%] px-4 py-3 rounded-2xl shadow-xl transition-all",
                      msg.sender_type === 'super_admin' 
                        ? "bg-primary text-white rounded-tr-none shadow-primary/10 border border-primary/20" 
                        : "bg-white/5 text-gray-200 border border-white/10 rounded-tl-none backdrop-blur-md"
                    )}
                  >
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.message}</p>
                    <div className={cn(
                      "text-[9px] mt-2 font-medium opacity-60 flex items-center gap-1",
                      msg.sender_type === 'super_admin' ? "justify-end" : "justify-start"
                    )}>
                      {format(new Date(msg.created_at), "HH:mm")}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>

          {/* Footer Input */}
          <div className="p-6 border-t border-white/10 bg-black/40 backdrop-blur-xl">
            <div className="relative group">
              <div className="absolute -inset-1 bg-gradient-to-r from-primary/20 to-purple-500/20 rounded-2xl blur opacity-0 group-focus-within:opacity-100 transition-opacity" />
              <div className="relative flex flex-col bg-[#0F0F0F] border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
                <textarea 
                  placeholder="Digite sua resposta premium..." 
                  className="w-full min-h-[100px] bg-transparent p-4 text-sm text-white focus:outline-none resize-none placeholder:text-muted-foreground/50"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      if (message.trim() && !sendMessageMutation.isPending) {
                        sendMessageMutation.mutate();
                      }
                    }
                  }}
                  disabled={status === 'closed'}
                />
                <div className="flex items-center justify-between p-3 border-t border-white/5 bg-white/[0.02]">
                  <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <AlertCircle size={10} /> Shift + Enter para nova linha
                  </span>
                  <Button 
                    size="sm"
                    className="gap-2 px-6 font-bold bg-primary hover:bg-primary/90 text-white rounded-xl shadow-lg shadow-primary/20 transition-all hover:scale-105 active:scale-95"
                    onClick={() => sendMessageMutation.mutate()} 
                    disabled={!message.trim() || sendMessageMutation.isPending || status === 'closed'}
                  >
                    {sendMessageMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : (
                      <>
                        Responder <Send className="h-3.5 w-3.5" />
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar Info */}
        <div className="w-[280px] bg-white/[0.01] p-6 hidden lg:flex flex-col gap-8 shrink-0">
          <section>
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground mb-4">Informações do Ticket</h3>
            <div className="space-y-5">
              <div className="flex items-start gap-3">
                <div className="mt-1 h-2 w-2 rounded-full bg-primary shadow-[0_0_8px_rgba(var(--primary),0.8)]" />
                <div>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase">Prioridade</p>
                  <p className="text-sm font-medium mt-0.5">{ticket.priority === 'high' ? 'Alta Prioridade' : ticket.priority === 'medium' ? 'Média' : 'Baixa'}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="mt-1 h-2 w-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)]" />
                <div>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase">Categoria</p>
                  <p className="text-sm font-medium mt-0.5">{ticket.category}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="mt-1 h-2 w-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.8)]" />
                <div>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase">Status Atual</p>
                  <p className="text-sm font-medium mt-0.5">{getStatusLabel(status)}</p>
                </div>
              </div>
            </div>
          </section>

          <section>
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground mb-4">Barbearia Parceira</h3>
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
               <div className="flex items-center gap-3 mb-3">
                 <div className="h-10 w-10 rounded-xl bg-white/10 flex items-center justify-center font-black text-primary text-xl">
                   {ticket.barbershops?.name?.[0].toUpperCase()}
                 </div>
                 <div className="min-w-0">
                   <p className="text-sm font-bold truncate">{ticket.barbershops?.name}</p>
                   <p className="text-[10px] text-muted-foreground">ID: {ticket.barbershop_id.split('-')[0]}</p>
                 </div>
               </div>
               <Button variant="ghost" className="w-full h-8 text-xs font-bold border border-white/10 hover:bg-white/10 rounded-lg">
                 Ver Perfil <BarChart3 size={12} className="ml-2" />
               </Button>
            </div>
          </section>

          <div className="mt-auto">
            <div className="bg-primary/10 border border-primary/20 rounded-2xl p-4">
              <p className="text-[10px] text-primary font-black uppercase mb-1">Dica de Atendimento</p>
              <p className="text-[11px] text-primary/80 leading-relaxed">
                Sempre responda de forma cordial e profissional. O sucesso da barbearia é o nosso sucesso.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}