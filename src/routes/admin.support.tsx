import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { 
  MessageSquare, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  MoreVertical,
  User,
  Send,
  Building2,
  ShieldCheck,
  Search,
  Filter,
  Download,
  Trash2,
  LifeBuoy
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export const Route = createFileRoute("/admin/support")({
  component: AdminSupport,
});

function AdminSupport() {
  const [selectedTicket, setSelectedTicket] = useState<any>(null);
  const [reply, setReply] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const queryClient = useQueryClient();

  const { data: tickets, isLoading } = useQuery({
    queryKey: ["admin-tickets"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("support_tickets")
        .select(`
          *,
          barbershop:barbershops(name, logo_url)
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

      const payload = {
        ticket_id: selectedTicket.id,
        sender_id: user.id,
        message: reply,
        is_admin_reply: true
      };

      console.log('ADMIN MESSAGE PAYLOAD', payload);

      const { data, error } = await supabase
        .from("support_messages")
        .insert(payload)
        .select();
      
      console.log('SUPABASE RESPONSE (admin message)', { data, error });
      
      if (error) throw error;

      // Update ticket status
      await supabase
        .from("support_tickets")
        .update({ status: 'responded' })
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

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string, status: string }) => {
      const { error } = await supabase
        .from("support_tickets")
        .update({ status })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["admin-tickets"] });
      if (selectedTicket?.id === variables.id) {
        setSelectedTicket({ ...selectedTicket, status: variables.status });
      }
      toast.success(`Status atualizado para ${variables.status}`);
    }
  });

  const filteredTickets = tickets?.filter(t => 
    t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (t.barbershop as any)?.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'open': return <Badge variant="destructive">Aberto</Badge>;
      case 'in_progress': return <Badge className="bg-amber-500">Em andamento</Badge>;
      case 'responded': return <Badge className="bg-purple-500">Respondido</Badge>;
      case 'resolved': return <Badge className="bg-green-500">Resolvido</Badge>;
      case 'closed': return <Badge variant="secondary">Fechado</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-white">Suporte ao Cliente</h2>
          <p className="text-gray-400">Gerencie todos os tickets de suporte do SaaS.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 h-[calc(100vh-14rem)]">
        {/* Sidebar Tickets List */}
        <div className="md:col-span-4 flex flex-col gap-4 overflow-hidden">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
            <Input 
              placeholder="Buscar chamado ou empresa..." 
              className="pl-10 bg-white/5 border-white/10 text-white"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <Card className="flex-1 overflow-hidden flex flex-col bg-black/40 border-white/10">
            <CardHeader className="p-4 border-b border-white/10">
              <div className="flex justify-between items-center">
                <CardTitle className="text-sm font-bold uppercase tracking-wider text-gray-400">Tickets</CardTitle>
                <Badge variant="outline" className="border-white/10 text-gray-500">{filteredTickets?.length || 0}</Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0 overflow-y-auto flex-1 custom-scrollbar">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center p-8 gap-3">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
                  <span className="text-xs text-gray-500">Carregando...</span>
                </div>
              ) : filteredTickets?.length === 0 ? (
                <div className="p-12 text-center">
                  <MessageSquare className="h-12 w-12 text-gray-800 mx-auto mb-4" />
                  <p className="text-gray-500 text-sm">Nenhum chamado encontrado.</p>
                </div>
              ) : (
                <div className="divide-y divide-white/5">
                  {filteredTickets?.map((ticket) => (
                    <button
                      key={ticket.id}
                      onClick={() => setSelectedTicket(ticket)}
                      className={`w-full text-left p-4 hover:bg-white/5 transition-all flex flex-col gap-2 ${selectedTicket?.id === ticket.id ? "bg-purple-500/10 border-l-2 border-purple-500" : ""}`}
                    >
                      <div className="flex justify-between items-start w-full">
                        <span className="font-bold text-sm text-white line-clamp-1 flex-1 pr-2">{ticket.title}</span>
                        {getStatusBadge(ticket.status || 'open')}
                      </div>
                      <div className="flex items-center justify-between text-[11px]">
                        <div className="flex items-center gap-1.5 text-gray-400">
                          <Building2 size={12} className="text-purple-400" />
                          <span className="truncate max-w-[120px]">{(ticket.barbershop as any)?.name}</span>
                        </div>
                        <span className="text-gray-500">{ticket.created_at ? format(new Date(ticket.created_at), "dd/MM HH:mm") : ""}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Ticket Chat View */}
        <div className="md:col-span-8 overflow-hidden">
          {selectedTicket ? (
            <Card className="h-full flex flex-col bg-black/40 border-white/10 shadow-2xl overflow-hidden">
              <CardHeader className="border-b border-white/10 p-6 bg-white/[0.02]">
                <div className="flex flex-row items-center justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-3">
                      <CardTitle className="text-xl font-bold text-white">{selectedTicket.title}</CardTitle>
                      <Badge variant="outline" className="border-purple-500/30 text-purple-400 bg-purple-500/5">
                        {selectedTicket.category || "Suporte"}
                      </Badge>
                    </div>
                    <CardDescription className="flex items-center gap-2 text-gray-400 text-xs">
                      De: <span className="text-purple-400 font-bold">{(selectedTicket.barbershop as any)?.name}</span> 
                      • Aberto em {selectedTicket.created_at ? format(new Date(selectedTicket.created_at), "dd/MM/yyyy 'às' HH:mm") : ""}
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" className="bg-white/5 border-white/10 text-gray-300 hover:text-white">
                          Status: {selectedTicket.status} <Filter size={14} className="ml-2" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="bg-black border-white/10 text-white">
                        <DropdownMenuItem onClick={() => updateStatusMutation.mutate({ id: selectedTicket.id, status: 'in_progress' })}>
                          Em andamento
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => updateStatusMutation.mutate({ id: selectedTicket.id, status: 'responded' })}>
                          Marcar como Respondido
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => updateStatusMutation.mutate({ id: selectedTicket.id, status: 'resolved' })} className="text-green-500">
                          Resolver Chamado
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => updateStatusMutation.mutate({ id: selectedTicket.id, status: 'closed' })} className="text-gray-500">
                          Fechar
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                {/* Initial Description */}
                <div className="flex justify-start">
                  <div className="max-w-[85%] rounded-2xl px-5 py-4 bg-white/5 border border-white/10">
                    <div className="flex items-center gap-2 mb-2">
                      <Building2 size={12} className="text-purple-400" />
                      <span className="text-[10px] font-bold uppercase tracking-wider text-purple-400">{(selectedTicket.barbershop as any)?.name} (Original)</span>
                    </div>
                    <p className="text-sm text-gray-200 whitespace-pre-wrap leading-relaxed">{selectedTicket.description}</p>
                    
                    {selectedTicket.attachment_urls?.length > 0 && (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {selectedTicket.attachment_urls.map((url: string, i: number) => (
                          <a 
                            key={i} 
                            href={url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 p-2 bg-black/40 rounded-lg border border-white/10 text-[10px] text-gray-400 hover:text-white hover:bg-white/10 transition-all"
                          >
                            <Download size={10} /> Anexo {i + 1}
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-white/5"></span></div>
                  <div className="relative flex justify-center text-[10px] uppercase tracking-widest text-gray-600">
                    <span className="bg-[#0c0c0c] px-2 font-bold">Histórico de Mensagens</span>
                  </div>
                </div>

                <div className="space-y-4">
                  {messages?.map((msg) => (
                    <div key={msg.id} className={`flex ${msg.is_admin_reply ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[80%] rounded-2xl px-4 py-3 shadow-xl ${
                        msg.is_admin_reply 
                          ? "bg-purple-600 text-white rounded-tr-none" 
                          : "bg-white/10 text-gray-200 rounded-tl-none border border-white/5"
                      }`}>
                        <div className="flex items-center gap-2 mb-1">
                          {msg.is_admin_reply ? <ShieldCheck size={12} /> : <User size={12} />}
                          <span className="text-[10px] font-bold uppercase tracking-wider opacity-70">
                            {msg.is_admin_reply ? "Você (Suporte)" : (selectedTicket.barbershop as any)?.name}
                          </span>
                        </div>
                        <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.message}</p>
                        
                        {(msg.attachment_urls && msg.attachment_urls.length > 0) && (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {msg.attachment_urls.map((url: string, i: number) => (
                              <a 
                                key={i} 
                                href={url} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className={`flex items-center gap-1.5 p-1.5 rounded-lg border text-[10px] transition-all ${
                                  msg.is_admin_reply ? "bg-black/20 border-white/10 hover:bg-black/40" : "bg-black/40 border-white/10 hover:bg-white/10"
                                }`}
                              >
                                <Download size={10} /> {i + 1}
                              </a>
                            ))}
                          </div>
                        )}

                        <span className="text-[10px] opacity-60 mt-1 block text-right">
                          {msg.created_at ? format(new Date(msg.created_at), "HH:mm") : ""}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
              
              <CardFooter className="border-t border-white/10 p-4 bg-white/[0.01]">
                <div className="flex w-full gap-3">
                  <Input 
                    placeholder="Digite sua resposta..." 
                    className="flex-1 bg-white/5 border-white/10 text-white"
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendReplyMutation.mutate()}
                    disabled={selectedTicket.status === 'resolved' || selectedTicket.status === 'closed'}
                  />
                  <Button 
                    onClick={() => sendReplyMutation.mutate()} 
                    className="bg-purple-600 hover:bg-purple-700 text-white shadow-lg shadow-purple-600/20"
                    disabled={!reply.trim() || sendReplyMutation.isPending || selectedTicket.status === 'resolved'}
                  >
                    {sendReplyMutation.isPending ? <div className="animate-spin h-4 w-4 border-b-2 border-white rounded-full"></div> : <Send size={18} />}
                  </Button>
                </div>
              </CardFooter>
            </Card>
          ) : (
            <div className="h-full flex items-center justify-center border-2 border-dashed border-white/10 rounded-2xl bg-black/20">
              <div className="text-center space-y-4">
                <div className="w-16 h-16 bg-purple-500/10 rounded-full flex items-center justify-center mx-auto">
                  <MessageSquare className="h-8 w-8 text-purple-500/40" />
                </div>
                <p className="text-gray-500 font-medium">Selecione um chamado para visualizar a conversa</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
