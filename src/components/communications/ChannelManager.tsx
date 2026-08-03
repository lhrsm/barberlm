import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getChannels, updateChannelStatus } from "@/lib/communications.functions";
import { MessageSquare, Mail, Smartphone, Bell, Send, Settings2, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

interface Props {
  tenantId: string;
}

export function ChannelManager({ tenantId }: Props) {
  const queryClient = useQueryClient();
  const { data: channels, isLoading } = useQuery({
    queryKey: ['communication-channels', tenantId],
    queryFn: () => getChannels({ data: { tenantId } })
  });

  const updateMutation = useMutation({
    mutationFn: (vars: { id: string, status: string, isActive: boolean }) => updateChannelStatus({ data: vars }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['communication-channels', tenantId] });
      toast.success("Canal atualizado com sucesso!");
    }
  });

  const availableChannels = [
    { type: 'whatsapp', name: 'WhatsApp', icon: MessageSquare, color: 'text-emerald-400', description: 'Integração oficial via Z-API.' },
    { type: 'email', name: 'E-mail', icon: Mail, color: 'text-sky-400', description: 'Envio transacional e marketing via Resend.' },
    { type: 'sms', name: 'SMS', icon: Smartphone, color: 'text-amber-400', description: 'Mensagens rápidas e offline.' },
    { type: 'push', name: 'Web Push', icon: Bell, color: 'text-purple-400', description: 'Notificações direto no navegador.' },
    { type: 'internal', name: 'Interno', icon: Send, color: 'text-[#D4AF37]', description: 'Notificações no dashboard para equipe.' },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {availableChannels.map((chan) => {
        const config = channels?.find((c: any) => c.type === chan.type);
        const isActive = config?.is_active || false;

        return (
          <Card key={chan.type} className="bg-[#0b0f17] border-zinc-800/80 hover:border-[#D4AF37]/30 transition-all">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div className="flex items-center gap-3">
                <div className={`h-10 w-10 rounded-xl bg-zinc-900 border border-zinc-800 grid place-items-center`}>
                  <chan.icon className={`h-5 w-5 ${chan.color}`} />
                </div>
                <div>
                  <CardTitle className="text-base font-bold">{chan.name}</CardTitle>
                  <CardDescription className="text-[10px] text-zinc-500 uppercase tracking-widest font-black">
                    {config?.provider_name || 'Nenhum Provedor'}
                  </CardDescription>
                </div>
              </div>
              <Badge variant={isActive ? "default" : "secondary"} className={isActive ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : ""}>
                {isActive ? "Ativo" : "Inativo"}
              </Badge>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-zinc-400 mb-6 leading-relaxed">
                {chan.description}
              </p>
              
              {!config && (
                <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-3 mb-6 flex gap-3">
                  <ShieldAlert className="text-amber-400 shrink-0" size={16} />
                  <p className="text-[10px] text-amber-300/80">Este canal ainda não foi configurado para esta unidade.</p>
                </div>
              )}

              <div className="flex items-center gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="flex-1 h-9 rounded-lg border-zinc-800 hover:bg-zinc-800 text-xs font-bold"
                  disabled={!config}
                >
                  <Settings2 size={14} className="mr-2" /> Configurar
                </Button>
                {config && (
                  <Button 
                    size="sm" 
                    variant={isActive ? "destructive" : "default"}
                    className={`h-9 rounded-lg text-xs font-bold ${!isActive ? "bg-emerald-600 hover:bg-emerald-500" : ""}`}
                    onClick={() => updateMutation.mutate({ id: config.id, status: isActive ? 'inactive' : 'active', isActive: !isActive })}
                    disabled={updateMutation.isPending}
                  >
                    {isActive ? "Desativar" : "Ativar"}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
