import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageSquare, CheckCircle2, AlertCircle, Clock, Zap } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { getMessages, getChannels } from "@/lib/communications.functions";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Props {
  tenantId: string;
}

export function CommunicationOverview({ tenantId }: Props) {
  const { data: messages } = useQuery({
    queryKey: ['communication-messages-summary', tenantId],
    queryFn: () => getMessages({ data: { tenantId, limit: 10 } })
  });

  const { data: channels } = useQuery({
    queryKey: ['communication-channels', tenantId],
    queryFn: () => getChannels({ data: { tenantId } })
  });


  const stats = [
    { label: "Enviadas", value: "0", icon: CheckCircle2, color: "text-emerald-400" },
    { label: "Lidas", value: "0", icon: Zap, color: "text-[#D4AF37]" },
    { label: "Falhas", value: "0", icon: AlertCircle, color: "text-red-400" },
    { label: "Em Fila", value: "0", icon: Clock, color: "text-blue-400" },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, i) => (
          <Card key={i} className="bg-[#0b0f17] border-zinc-800/80">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-widest text-zinc-500">{stat.label}</p>
                  <h4 className="text-2xl font-bold mt-1">{stat.value}</h4>
                </div>
                <stat.icon className={`h-8 w-8 ${stat.color} opacity-20`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 bg-[#0b0f17] border-zinc-800/80">
          <CardHeader>
            <CardTitle className="text-lg">Atividades Recentes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {messages?.length === 0 ? (
                <p className="text-sm text-zinc-500 text-center py-8">Nenhuma mensagem recente.</p>
              ) : (
                messages?.map((msg: any) => (
                  <div key={msg.id} className="flex items-center gap-4 p-3 rounded-xl bg-[#05070d] border border-zinc-800/50">
                    <div className="h-10 w-10 rounded-full bg-zinc-800 flex items-center justify-center">
                      <MessageSquare size={18} className="text-zinc-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold truncate">
                        {msg.customer?.name || msg.recipient_address}
                      </p>
                      <p className="text-xs text-zinc-500 truncate">{msg.content}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-zinc-500">
                        {format(new Date(msg.created_at), "HH:mm", { locale: ptBR })}
                      </p>
                      <span className="text-[10px] font-black uppercase tracking-tighter text-emerald-500">
                        {msg.status}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#0b0f17] border-zinc-800/80">
          <CardHeader>
            <CardTitle className="text-lg">Saúde dos Canais</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {channels?.map((channel: any) => (
                <div key={channel.id} className="flex items-center justify-between p-3 rounded-xl bg-[#05070d] border border-zinc-800/50">
                  <div className="flex items-center gap-3">
                    <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-sm font-bold capitalize">{channel.type}</span>
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-emerald-500">
                    {channel.status}
                  </span>
                </div>
              ))}
              {!channels?.length && (
                <p className="text-sm text-zinc-500">Nenhum canal ativo.</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
