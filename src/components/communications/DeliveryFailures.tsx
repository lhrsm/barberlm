import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { getMessages } from "@/lib/communications.functions";
import { AlertTriangle, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Props {
  tenantId: string;
}

export function DeliveryFailures({ tenantId }: Props) {
  const { data: messages, isLoading } = useQuery({
    queryKey: ['communication-messages-failures', tenantId],
    queryFn: () => getMessages({ data: { tenantId, status: 'failed', limit: 50 } })
  });

  return (
    <Card className="bg-[#0b0f17] border-zinc-800/80 overflow-hidden">
      <CardHeader className="border-b border-zinc-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-red-500/10 border border-red-500/30 grid place-items-center">
              <AlertTriangle size={20} className="text-red-400" />
            </div>
            <div>
              <CardTitle className="text-lg">Falhas de Entrega</CardTitle>
              <p className="text-xs text-zinc-500">Monitore e recupere mensagens que não puderam ser enviadas.</p>
            </div>
          </div>
          <Button variant="outline" size="sm" className="border-zinc-800 h-9 rounded-lg font-bold text-xs">
            <Trash2 size={14} className="mr-2" /> Limpar Tudo
          </Button>
        </div>
      </CardHeader>
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-zinc-800 bg-zinc-900/30">
              <th className="p-4 text-[10px] font-black uppercase tracking-widest text-zinc-500">Canal</th>
              <th className="p-4 text-[10px] font-black uppercase tracking-widest text-zinc-500">Destinatário</th>
              <th className="p-4 text-[10px] font-black uppercase tracking-widest text-zinc-500">Motivo do Erro</th>
              <th className="p-4 text-[10px] font-black uppercase tracking-widest text-zinc-500 text-right">Ação</th>
            </tr>
          </thead>
          <tbody>
            {messages?.map((msg: any) => (
              <tr key={msg.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/20 transition-colors">
                <td className="p-4">
                  <Badge variant="outline" className="bg-red-500/10 text-red-400 border-red-500/20 capitalize text-[10px]">
                    {msg.channel_type}
                  </Badge>
                </td>
                <td className="p-4">
                  <p className="text-sm font-bold">{msg.customer?.name || 'Cliente Externo'}</p>
                  <p className="text-[10px] text-zinc-500">{msg.recipient_address}</p>
                </td>
                <td className="p-4 max-w-sm">
                  <p className="text-xs text-red-400/80 line-clamp-2 italic">"{msg.error_message || 'Erro desconhecido pelo provedor.'}"</p>
                  <p className="text-[10px] text-zinc-500 mt-1">
                    {format(new Date(msg.created_at), "dd/MM HH:mm:ss", { locale: ptBR })}
                  </p>
                </td>
                <td className="p-4 text-right">
                  <Button size="sm" variant="ghost" className="h-8 text-sky-400 hover:text-sky-300 font-bold text-[10px] uppercase">
                    <RefreshCw size={12} className="mr-1.5" /> Reenviar
                  </Button>
                </td>
              </tr>
            ))}
            {!messages?.length && !isLoading && (
              <tr>
                <td colSpan={4} className="p-12 text-center text-zinc-500 text-sm italic">
                  Tudo certo! Nenhuma falha crítica detectada recentemente.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
