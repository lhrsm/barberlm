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
  ChevronLeft,
  CheckCircle2,
  X
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { useTenant } from "@/hooks/use-tenant";

interface TicketDetailsProps {
  ticket: any;
  onBack: () => void;
}

export function TicketDetails({ ticket, onBack }: TicketDetailsProps) {
  const [message, setMessage] = useState("");
  const [attachments, setAttachments] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const queryClient = useQueryClient();
  const { tenantId } = useTenant();

  const { data: messages, isLoading } = useQuery({
    queryKey: ["ticket-messages", ticket.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("support_messages")
        .select("*")
        .eq("ticket_id", ticket.id)
        .order("created_at", { ascending: true });
      
      if (error) throw error;
      return data;
    }
  });

  const sendMessageMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");

      const attachmentUrls: string[] = [];

      if (attachments.length > 0) {
        setIsUploading(true);
        for (const file of attachments) {
          const fileExt = file.name.split('.').pop();
          const fileName = `${Math.random()}.${fileExt}`;
          const filePath = `${tenantId}/${fileName}`;

          const { error: uploadError } = await supabase.storage
            .from('support-attachments')
            .upload(filePath, file);

          if (uploadError) throw uploadError;

          const { data: { publicUrl } } = supabase.storage
            .from('support-attachments')
            .getPublicUrl(filePath);
          
          attachmentUrls.push(publicUrl);
        }
      }

      const payload = {
        ticket_id: ticket.id,
        sender_id: user.id,
        message: message,
        is_admin_reply: false,
        attachment_url: attachmentUrls[0] || null,
        attachment_urls: attachmentUrls
      };

      console.log('MESSAGE PAYLOAD', payload);

      const { data, error } = await supabase
        .from("support_messages")
        .insert(payload)
        .select();

      console.log('SUPABASE RESPONSE (message)', { data, error });
      
      if (error) throw error;

      // Update ticket status back to open if it was responded or resolved (optional logic)
      if (ticket.status === 'responded') {
        await supabase
          .from("support_tickets")
          .update({ status: 'open' })
          .eq("id", ticket.id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ticket-messages", ticket.id] });
      setMessage("");
      setAttachments([]);
      setIsUploading(false);
      toast.success("Mensagem enviada");
    },
    onError: (error: any) => {
      setIsUploading(false);
      toast.error("Erro ao enviar: " + error.message);
    }
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'open': return <Badge className="bg-blue-500">Aberto</Badge>;
      case 'in_progress': return <Badge className="bg-amber-500">Em andamento</Badge>;
      case 'responded': return <Badge className="bg-purple-500">Respondido</Badge>;
      case 'resolved': return <Badge className="bg-green-500">Resolvido</Badge>;
      case 'closed': return <Badge variant="secondary">Fechado</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={onBack} className="gap-2">
        <ChevronLeft size={16} /> Voltar aos tickets
      </Button>

      <Card className="flex flex-col min-h-[600px] h-[calc(100vh-200px)]">
        <CardHeader className="border-b flex flex-row items-center justify-between py-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <CardTitle className="text-lg">{ticket.title}</CardTitle>
              {getStatusBadge(ticket.status)}
            </div>
            <CardDescription className="text-xs">
              Protocolo: #{ticket.id.split('-')[0].toUpperCase()} • Categoria: {ticket.category}
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="flex-1 overflow-y-auto p-4 space-y-6">
          {/* Original Description */}
          <div className="flex justify-start">
            <div className="max-w-[85%] rounded-2xl px-4 py-3 bg-muted border border-border">
              <div className="flex items-center gap-2 mb-2">
                <User size={12} className="text-primary" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Você (Descrição Inicial)</span>
              </div>
              <p className="text-sm whitespace-pre-wrap">{ticket.description}</p>
              
              {ticket.attachment_urls?.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {ticket.attachment_urls.map((url: string, i: number) => (
                    <a 
                      key={i} 
                      href={url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 p-2 bg-background rounded-lg border text-[10px] hover:bg-accent transition-colors"
                    >
                      <Download size={10} /> Ver Anexo {i + 1}
                    </a>
                  ))}
                </div>
              )}
              
              <span className="text-[10px] opacity-60 mt-2 block text-right">
                {(() => {
                  try {
                    return ticket.created_at ? format(new Date(ticket.created_at), "dd/MM 'às' HH:mm", { locale: ptBR }) : "";
                  } catch (e) {
                    return "";
                  }
                })()}
              </span>
            </div>
          </div>

          {isLoading ? (
            <div className="flex justify-center p-8">
              <Loader2 className="animate-spin text-primary" />
            </div>
          ) : (
            messages?.map((msg) => (
              <div key={msg.id} className={`flex ${msg.is_admin_reply ? "justify-start" : "justify-end"}`}>
                <div className={`max-w-[85%] rounded-2xl px-4 py-3 shadow-sm ${
                  msg.is_admin_reply 
                    ? "bg-primary/10 border border-primary/20 text-foreground rounded-tl-none" 
                    : "bg-primary text-primary-foreground rounded-tr-none"
                }`}>
                  <div className="flex items-center gap-2 mb-1">
                    {msg.is_admin_reply ? <ShieldCheck size={12} className="text-primary" /> : <User size={12} />}
                    <span className="text-[10px] font-bold uppercase tracking-wider opacity-70">
                      {msg.is_admin_reply ? "Suporte Barbex" : "Você"}
                    </span>
                  </div>
                  <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                  
                  {(msg.attachment_urls && msg.attachment_urls.length > 0) && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {msg.attachment_urls.map((url: string, i: number) => (
                        <a 
                          key={i} 
                          href={url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className={`flex items-center gap-1.5 p-1.5 rounded-lg border text-[10px] transition-colors ${
                            msg.is_admin_reply ? "bg-background hover:bg-accent" : "bg-primary-foreground/10 hover:bg-primary-foreground/20 text-primary-foreground"
                          }`}
                        >
                          <Download size={10} /> Anexo {i + 1}
                        </a>
                      ))}
                    </div>
                  )}

                  <span className="text-[10px] opacity-60 mt-1 block text-right">
                    {(() => {
                      try {
                        return msg.created_at ? format(new Date(msg.created_at), "HH:mm") : "";
                      } catch (e) {
                        return "";
                      }
                    })()}
                  </span>
                </div>
              </div>
            ))
          )}
        </CardContent>

        <CardFooter className="border-t p-4 bg-muted/30">
          <div className="w-full space-y-2">
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <Input 
                  placeholder="Escreva sua mensagem..." 
                  className="pr-10"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessageMutation.mutate()}
                  disabled={ticket.status === 'closed' || ticket.status === 'resolved'}
                />
                <label className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer text-muted-foreground hover:text-primary transition-colors">
                  <Paperclip size={18} />
                  <input 
                    type="file" 
                    className="hidden" 
                    multiple 
                    onChange={(e) => e.target.files && setAttachments(Array.from(e.target.files))}
                  />
                </label>
              </div>
              <Button 
                onClick={() => sendMessageMutation.mutate()} 
                disabled={(!message.trim() && attachments.length === 0) || sendMessageMutation.isPending || ticket.status === 'closed'}
              >
                {sendMessageMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
            
            {attachments.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {attachments.map((file, i) => (
                  <Badge key={i} variant="secondary" className="gap-1.5 py-1">
                    {file.name}
                    <X size={12} className="cursor-pointer" onClick={() => setAttachments(prev => prev.filter((_, idx) => idx !== i))} />
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
