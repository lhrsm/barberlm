import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { 
  MessageSquare, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  MoreVertical,
  User,
  Send,
  Building2
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { useState } from "react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export const Route = createFileRoute("/admin/support")({
  component: AdminSupport,
});

function AdminSupport() {
  const [selectedTicket, setSelectedTicket] = useState<any>(null);
  const [reply, setReply] = useState("");
  const queryClient = useQueryClient();

  const { data: tickets, isLoading } = useQuery({
    queryKey: ["admin-tickets"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("support_tickets")
        .select(`
          *,
          tenant:profiles(business_name, logo_url)
        `)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data;
    }
  });

  const { data: messages } = useQuery({
    queryKey: ["admin-ticket-messages", selectedTicket?.id],
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

  const sendReplyMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !selectedTicket) return;

      const { error } = await supabase
        .from("support_messages")
        .insert({
          ticket_id: selectedTicket.id,
          sender_id: user.id,
          message: reply,
          is_admin_reply: true
        });
      
      if (error) throw error;

      // Update ticket status
      await supabase
        .from("support_tickets")
        .update({ status: 'in_progress' })
        .eq("id", selectedTicket.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-ticket-messages", selectedTicket?.id] });
      queryClient.invalidateQueries({ queryKey: ["admin-tickets"] });
      setReply("");
      toast.success("Resposta enviada com sucesso");
    },
    onError: (error) => {
      toast.error("Erro ao enviar resposta: " + error.message);
    }
  });

  const resolveTicketMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("support_tickets")
        .update({ status: 'resolved' })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-tickets"] });
      if (selectedTicket) setSelectedTicket({ ...selectedTicket, status: 'resolved' });
      toast.success("Chamado resolvido");
    }
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Central de Suporte</h2>
          <p className="text-muted-foreground text-sm">Gerencie todos os chamados dos seus clientes.</p>
        </div>
      </div>


        <Card className="flex-1 overflow-hidden flex flex-col">
          <CardHeader className="p-4 border-b">
            <CardTitle className="text-lg">Chamados Recentes</CardTitle>
          </CardHeader>
          <CardContent className="p-0 overflow-auto flex-1">
            {isLoading ? (
              <div className="p-4 text-center text-sm text-muted-foreground animate-pulse">Carregando chamados...</div>
            ) : tickets?.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground italic">Nenhum chamado aberto.</div>
            ) : (
              <div className="divide-y">
                {tickets?.map((ticket) => (
                  <button
                    key={ticket.id}
                    onClick={() => setSelectedTicket(ticket)}
                    className={`w-full text-left p-4 hover:bg-muted/50 transition-colors flex flex-col gap-1 ${selectedTicket?.id === ticket.id ? "bg-primary/5" : ""}`}
                  >
                    <div className="flex justify-between items-start w-full">
                      <span className="font-bold text-sm truncate pr-2">{ticket.subject}</span>
                      <Badge variant={
                        ticket.status === 'open' ? 'destructive' : 
                        ticket.status === 'in_progress' ? 'default' : 
                        'outline'
                      } className="text-[10px] h-4 px-1">
                        {ticket.status}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                      <Building2 size={10} />
                      <span className="truncate">{(ticket.tenant as any)?.business_name || "Barbearia"}</span>
                      <span>•</span>
                      <span>{format(new Date(ticket.created_at), "dd/MM", { locale: ptBR })}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="md:col-span-8">
        {selectedTicket ? (
          <Card className="h-full flex flex-col">
            <CardHeader className="border-b flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-xl">{selectedTicket.subject}</CardTitle>
                <CardDescription className="flex items-center gap-2 mt-1">
                  Abriu em {format(new Date(selectedTicket.created_at), "dd 'de' MMMM 'às' HH:mm", { locale: ptBR })}
                </CardDescription>
              </div>
              <div className="flex gap-2">
                {selectedTicket.status !== 'resolved' && (
                  <Button variant="outline" size="sm" onClick={() => resolveTicketMutation.mutate(selectedTicket.id)}>
                    <CheckCircle2 className="mr-2 h-4 w-4 text-green-500" /> Resolver
                  </Button>
                )}
                <Button variant="ghost" size="icon">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="flex-1 overflow-auto p-6 space-y-6">
              <div className="bg-muted/30 rounded-lg p-4 border italic text-sm">
                <strong>Descrição original:</strong><br />
                {selectedTicket.description || "Sem descrição adicional."}
              </div>

              <div className="space-y-4">
                {messages?.map((msg) => (
                  <div key={msg.id} className={`flex ${msg.is_admin_reply ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[80%] rounded-2xl px-4 py-3 shadow-sm ${
                      msg.is_admin_reply 
                        ? "bg-primary text-primary-foreground rounded-tr-none" 
                        : "bg-muted rounded-tl-none border"
                    }`}>
                      <div className="flex items-center gap-2 mb-1">
                        {msg.is_admin_reply ? <ShieldCheck size={12} /> : <User size={12} />}
                        <span className="text-[10px] font-bold uppercase tracking-wider opacity-70">
                          {msg.is_admin_reply ? "Suporte SaaS" : "Barbearia"}
                        </span>
                      </div>
                      <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                      <span className="text-[10px] opacity-60 mt-1 block text-right">
                        {format(new Date(msg.created_at), "HH:mm")}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
            <CardFooter className="border-t p-4 bg-muted/20">
              <div className="flex w-full gap-2">
                <Input 
                  placeholder="Digite sua resposta..." 
                  className="flex-1"
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && sendReplyMutation.mutate()}
                  disabled={selectedTicket.status === 'resolved'}
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
          <div className="h-full flex items-center justify-center border-2 border-dashed rounded-lg bg-card">
            <div className="text-center space-y-2">
              <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto opacity-20" />
              <p className="text-muted-foreground font-medium">Selecione um chamado para visualizar a conversa</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ShieldCheck({ size }: { size?: number }) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width={size || 16} 
      height={size || 16} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}
