import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { getMessages } from "@/lib/communications.functions";
import { MessageSquare, Search, Filter, ArrowUpRight, ArrowDownLeft } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Props {
  tenantId: string;
}

export function UnifiedInbox({ tenantId }: Props) {
  const { data: messages, isLoading } = useQuery({
    queryKey: ['communication-messages-inbox', tenantId],
    queryFn: () => getMessages({ data: { tenantId, limit: 50 } })
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="relative w-full sm:max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
          <Input 
            placeholder="Buscar conversas ou clientes..." 
            className="pl-10 bg-[#0b0f17] border-zinc-800 rounded-xl"
          />
        </div>
        <Button variant="outline" className="w-full sm:w-auto border-zinc-800 rounded-xl">
          <Filter size={18} className="mr-2" /> Filtros
        </Button>
      </div>

      <Card className="bg-[#0b0f17] border-zinc-800/80 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-900/30">
                <th className="p-4 text-[10px] font-black uppercase tracking-widest text-zinc-500">Canal</th>
                <th className="p-4 text-[10px] font-black uppercase tracking-widest text-zinc-500">Destinatário</th>
                <th className="p-4 text-[10px] font-black uppercase tracking-widest text-zinc-500">Última Mensagem</th>
                <th className="p-4 text-[10px] font-black uppercase tracking-widest text-zinc-500">Status</th>
                <th className="p-4 text-[10px] font-black uppercase tracking-widest text-zinc-500 text-right">Data</th>
              </tr>
            </thead>
            <tbody>
              {messages?.map((msg: any) => (
                <tr key={msg.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/20 transition-colors cursor-pointer">
                  <td className="p-4">
                    <Badge variant="outline" className="bg-zinc-900/50 border-zinc-800 capitalize text-[10px]">
                      {msg.channel_type}
                    </Badge>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      {msg.direction === 'outbound' ? <ArrowUpRight size={14} className="text-zinc-500" /> : <ArrowDownLeft size={14} className="text-[#D4AF37]" />}
                      <div>
                        <p className="text-sm font-bold">{msg.customer?.name || 'Cliente Externo'}</p>
                        <p className="text-[10px] text-zinc-500">{msg.recipient_address}</p>
                      </div>
                    </div>
                  </td>
                  <td className="p-4 max-w-xs">
                    <p className="text-xs text-zinc-400 truncate">{msg.content}</p>
                  </td>
                  <td className="p-4">
                    <span className="text-[10px] font-black uppercase tracking-widest text-emerald-500">
                      {msg.status}
                    </span>
                  </td>
                  <td className="p-4 text-right">
                    <p className="text-[10px] text-zinc-500">
                      {format(new Date(msg.created_at), "dd/MM HH:mm", { locale: ptBR })}
                    </p>
                  </td>
                </tr>
              ))}
              {!messages?.length && !isLoading && (
                <tr>
                  <td colSpan={5} className="p-12 text-center text-zinc-500 text-sm">
                    Nenhuma mensagem na caixa de entrada.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
