import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { getMessages } from "@/lib/communications.functions";
import { Ghost, RefreshCw, XCircle, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Props {
  tenantId: string;
}

export function DeadLetterQueue({ tenantId }: Props) {
  const { data: messages, isLoading } = useQuery({
    queryKey: ['communication-messages-dead-letter', tenantId],
    queryFn: () => getMessages({ data: { tenantId, status: 'failed', limit: 20 } })
  });

  return (
    <Card className="bg-[#0b0f17] border-zinc-800/80 overflow-hidden shadow-2xl">
      <CardHeader className="border-b border-zinc-800 bg-zinc-900/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-amber-500/10 border border-amber-500/30 grid place-items-center">
              <Ghost size={20} className="text-amber-400" />
            </div>
            <div>
              <CardTitle className="text-lg">Fila de Mensagens Mortas (DLQ)</CardTitle>
              <p className="text-xs text-zinc-500 italic">Mensagens que esgotaram todas as tentativas de reenvio.</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="border-zinc-800 h-9 rounded-lg font-bold text-xs hover:bg-zinc-800">
              Limpar Fila
            </Button>
            <Button size="sm" className="bg-amber-500 hover:bg-amber-600 text-black h-9 rounded-lg font-black text-xs uppercase shadow-lg shadow-amber-500/20">
              <RefreshCw size={14} className="mr-2" /> Tentar Tudo
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <div className="p-0">
        {!messages?.length && !isLoading ? (
          <div className="flex flex-col items-center justify-center p-20 text-center space-y-4">
            <div className="h-16 w-16 rounded-full bg-zinc-900 grid place-items-center border border-zinc-800">
              <CheckCircle2 className="h-8 w-8 text-emerald-500/50" />
            </div>
            <div className="space-y-1">
              <h3 className="text-zinc-400 font-bold uppercase tracking-widest text-[10px]">Fila Limpa</h3>
              <p className="text-zinc-600 text-sm max-w-[200px]">Nenhuma mensagem crítica em estado de falha permanente.</p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-900/30">
                  <th className="p-4 text-[10px] font-black uppercase tracking-widest text-zinc-500">Info</th>
                  <th className="p-4 text-[10px] font-black uppercase tracking-widest text-zinc-500">Destinatário</th>
                  <th className="p-4 text-[10px] font-black uppercase tracking-widest text-zinc-500">Último Erro</th>
                  <th className="p-4 text-[10px] font-black uppercase tracking-widest text-zinc-500 text-right">Ação</th>
                </tr>
              </thead>
              <tbody>
                {messages?.map((msg: any) => (
                  <tr key={msg.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/20 transition-all duration-300">
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                         <Badge variant="outline" className="bg-zinc-800/50 text-zinc-400 border-zinc-700 font-mono text-[9px] uppercase tracking-tighter">
                            {msg.channel_type}
                         </Badge>
                         <span className="text-[10px] font-medium text-zinc-500">
                            {format(new Date(msg.created_at), "dd/MM HH:mm", { locale: ptBR })}
                         </span>
                      </div>
                    </td>
                    <td className="p-4">
                      <p className="text-sm font-black text-white">{msg.customer?.name || '---'}</p>
                      <p className="text-[10px] text-zinc-500 font-mono">{msg.recipient_address}</p>
                    </td>
                    <td className="p-4">
                      <div className="flex items-start gap-2">
                        <XCircle size={12} className="text-rose-500 mt-1 shrink-0" />
                        <span className="text-xs text-rose-400/80 leading-relaxed max-w-[300px] truncate-2-lines">
                          {msg.error_message || 'Falha na resposta do gateway.'}
                        </span>
                      </div>
                    </td>
                    <td className="p-4 text-right space-x-2">
                       <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-600 hover:text-rose-500 transition-colors">
                          <Trash2 size={14} />
                       </Button>
                       <Button variant="outline" size="sm" className="h-8 border-zinc-800 text-sky-400 hover:text-sky-300 font-black text-[10px] uppercase">
                          <RefreshCw size={12} className="mr-1.5" /> Retry
                       </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Card>
  );
}

import { CheckCircle2 } from "lucide-react";
