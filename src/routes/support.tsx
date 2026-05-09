import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { 
  MessageSquare, 
  Plus, 
  Send, 
  User, 
  ShieldCheck,
  Clock,
  CheckCircle2,
  ChevronLeft
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useState } from "react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/support")({
  component: TenantSupport,
});

function TenantSupport() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedTicket, setSelectedTicket] = useState<any>(null);
  const [newTicket, setNewTicket] = useState({ subject: "", description: "" });
  const [reply, setReply] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const { data: tickets, isLoading } = useQuery({
    queryKey: ["tenant-tickets", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("support_tickets")
        .select("*")
        .eq("tenant_id", user.id)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !!user
  });

  const { data: messages } = useQuery({
    queryKey: ["tenant-ticket-messages", selectedTicket?.id],
    queryFn: async () => {
      if (!selectedTicket) return [];
      const { data, error } = await supabase
        .from("support_messages")
        .select("*")
        .eq("ticket_id", selectedTicket.id)
        .order("created_at", { ascending: true });
      
      if (error) throw error;
      return data;
    },
    enabled: !!selectedTicket
  });

  const createTicketMutation = useMutation({
    mutationFn: async () => {
      if (!user) return;
      const { data, error } = await supabase
        .from("support_tickets")
        .insert({
          tenant_id: user.id,
          subject: newTicket.subject,
          description: newTicket.description,
          status: 'open'
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["tenant-tickets"] });
      setNewTicket({ subject: "", description: "" });
      setIsDialogOpen(false);
      setSelectedTicket(data);
      toast.success("Chamado aberto com sucesso!");
    }
  });

  const sendReplyMutation = useMutation({
    mutationFn: async () => {
      if (!user || !selectedTicket) return;
      const { error } = await supabase
        .from("support_messages")
        .insert({
          ticket_id: selectedTicket.id,
          sender_id: user.id,
          message: reply,
          is_admin_reply: false
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tenant-ticket-messages", selectedTicket?.id] });
      setReply("");
    }
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Suporte</h2>
          <p className="text-muted-foreground">Tire suas dúvidas ou relate problemas com a plataforma.</p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" /> Novo Chamado
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Abrir Novo Chamado</DialogTitle>
              <DialogDescription>
                Descreva o que está acontecendo e nossa equipe responderá o mais breve possível.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Assunto</label>
                <Input 
                  placeholder="Ex: Problema com pagamento, Dúvida sobre agenda..." 
                  value={newTicket.subject}
                  onChange={(e) => setNewTicket({...newTicket, subject: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Descrição</label>
                <Textarea 
                  placeholder="Conte-nos mais detalhes..." 
                  rows={4}
                  value={newTicket.description}
                  onChange={(e) => setNewTicket({...newTicket, description: e.target.value})}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
              <Button 
                onClick={() => createTicketMutation.mutate()}
                disabled={!newTicket.subject || createTicketMutation.isPending}
              >
                Abrir Chamado
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-6 md:grid-cols-12 h-[calc(100vh-14rem)]">
        <Card className="md:col-span-4 overflow-hidden flex flex-col">
          <CardHeader className="p-4 border-b bg-muted/20">
            <CardTitle className="text-lg">Meus Chamados</CardTitle>
          </CardHeader>
          <CardContent className="p-0 overflow-auto flex-1">
            {isLoading ? (
              <div className="p-4 text-center text-sm animate-pulse">Carregando...</div>
            ) : tickets?.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground italic">
                Você ainda não tem chamados abertos.
              </div>
            ) : (
              <div className="divide-y">
                {tickets?.map((ticket) => (
                  <button
                    key={ticket.id}
                    onClick={() => setSelectedTicket(ticket)}
                    className={`w-full text-left p-4 hover:bg-muted/50 transition-colors flex flex-col gap-1 ${selectedTicket?.id === ticket.id ? "bg-primary/5" : ""}`}
                  >
                    <div className="flex justify-between items-start">
                      <span className="font-bold text-sm truncate pr-2">{ticket.subject}</span>
                      <Badge variant={
                        ticket.status === 'open' ? 'destructive' : 
                        ticket.status === 'in_progress' ? 'default' : 
                        'outline'
                      } className="text-[10px] h-4 px-1">
                        {ticket.status === 'open' ? 'Aberto' : ticket.status === 'in_progress' ? 'Em atendimento' : 'Resolvido'}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                      <Clock size={10} />
                      <span>{format(new Date(ticket.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="md:col-span-8 h-full">
          {selectedTicket ? (
            <Card className="h-full flex flex-col">
              <CardHeader className="border-b p-4 flex flex-row items-center justify-between">
                <div className="flex items-center gap-3">
                  <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setSelectedTicket(null)}>
                    <ChevronLeft size={18} />
                  </Button>
                  <div>
                    <CardTitle className="text-lg">{selectedTicket.subject}</CardTitle>
                    <Badge variant="outline" className="mt-1 text-[10px] h-4">
                      Ticket #{selectedTicket.id.slice(0, 8)}
                    </Badge>
                  </div>
                </div>
                {selectedTicket.status === 'resolved' && (
                  <Badge className="bg-green-500 hover:bg-green-600">
                    <CheckCircle2 size={12} className="mr-1" /> Resolvido
                  </Badge>
                )}
              </CardHeader>
              <CardContent className="flex-1 overflow-auto p-6 space-y-6 bg-muted/10">
                <div className="bg-card rounded-lg p-4 border shadow-sm text-sm">
                  <p className="font-bold mb-2">Mensagem Inicial:</p>
                  <p className="text-muted-foreground whitespace-pre-wrap">{selectedTicket.description}</p>
                </div>

                <div className="space-y-4">
                  {messages?.map((msg) => (
                    <div key={msg.id} className={`flex ${msg.is_admin_reply ? "justify-start" : "justify-end"}`}>
                      <div className={`max-w-[85%] rounded-2xl px-4 py-3 shadow-sm ${
                        msg.is_admin_reply 
                          ? "bg-muted rounded-tl-none border" 
                          : "bg-primary text-primary-foreground rounded-tr-none"
                      }`}>
                        <div className="flex items-center gap-2 mb-1 opacity-70">
                          {msg.is_admin_reply ? <ShieldCheck size={12} /> : <User size={12} />}
                          <span className="text-[10px] font-bold uppercase tracking-wider">
                            {msg.is_admin_reply ? "Suporte SaaS" : "Você"}
                          </span>
                        </div>
                        <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                        <span className="text-[10px] opacity-60 mt-1 block text-right">
                          {format(new Date(msg.created_at), "HH:mm")}
                        </span>
                      </div>
                    </div>
                  ))}
                  {messages?.length === 0 && !selectedTicket.is_admin_reply && (
                    <div className="text-center py-4">
                      <p className="text-xs text-muted-foreground italic">Aguardando primeira resposta do suporte...</p>
                    </div>
                  )}
                </div>
              </CardContent>
              <CardFooter className="border-t p-4">
                <div className="flex w-full gap-2">
                  <Input 
                    placeholder="Sua mensagem..." 
                    className="flex-1"
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && sendReplyMutation.mutate()}
                    disabled={selectedTicket.status === 'resolved' || sendReplyMutation.isPending}
                  />
                  <Button 
                    onClick={() => sendReplyMutation.mutate()} 
                    disabled={!reply.trim() || sendReplyMutation.isPending || selectedTicket.status === 'resolved'}
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </CardFooter>
            </Card>
          ) : (
            <div className="h-full flex items-center justify-center border-2 border-dashed rounded-lg bg-muted/10">
              <div className="text-center space-y-2">
                <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto opacity-20" />
                <p className="text-muted-foreground font-medium">Selecione um chamado para visualizar</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
