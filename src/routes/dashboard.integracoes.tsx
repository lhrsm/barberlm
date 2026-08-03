import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/layout/AppLayout";
import { useTenant } from "@/hooks/use-tenant";
import { useModules } from "@/hooks/use-modules";
import { withModule } from "@/components/modules/withModule";
import { 
  Zap, 
  CreditCard, 
  MessageSquare, 
  BarChart3, 
  Webhook, 
  Settings2,
  ShieldCheck,
  AlertTriangle,
  RefreshCw,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  Clock,
  ExternalLink,
  Lock,
  Calendar,
  Layers,
  Activity
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
  PremiumTabs, 
  PremiumTabsList, 
  PremiumTabsBody, 
  PremiumTabsContent 
} from "@/components/ui/premium-tabs";
import { useQuery } from "@tanstack/react-query";
import { getIntegrationHealth } from "@/lib/integrations-center.functions";
import { cn } from "@/lib/utils";

function IntegrationsCenterPage() {
  const { tenantId } = useTenant();
  const { plan } = useModules();

  const { data: health, isLoading } = useQuery({
    queryKey: ['integrations-health', tenantId],
    queryFn: () => getIntegrationHealth({ data: { tenantId: tenantId! } }),
    enabled: !!tenantId,
    refetchInterval: 30000 // 30s
  });

  if (!tenantId) return null;

  const categories = [
    { id: 'payments', label: 'Pagamentos', icon: CreditCard, count: 4 },
    { id: 'comms', label: 'Comunicação', icon: MessageSquare, count: 2 },
    { id: 'marketing', label: 'Marketing & Analytics', icon: BarChart3, count: 0 },
    { id: 'dev', label: 'Desenvolvimento', icon: Webhook, count: 1 },
  ];


  return (
    <div className="flex flex-col gap-6">
      {/* Header Premium */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 grid place-items-center shadow-lg shadow-emerald-500/5">
            <Zap className="text-emerald-400" size={28} />
          </div>
          <div>
            <h1 className="text-4xl font-black text-white uppercase italic tracking-tighter leading-none">Central de Integrações</h1>
            <p className="text-zinc-500 font-medium text-sm mt-1">Gerencie o ecossistema de conexões e monitoramento do Barbex.</p>
          </div>
        </div>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {categories.map(cat => (
          <Card key={cat.id} className="bg-[#0b0f17] border-zinc-800/80 hover:border-emerald-500/30 transition-all group">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="h-10 w-10 rounded-xl bg-zinc-900 border border-zinc-800 grid place-items-center group-hover:scale-110 transition-transform">
                <cat.icon size={20} className="text-zinc-400 group-hover:text-emerald-400" />
              </div>
              <div>
                <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">{cat.label}</p>
                <p className="text-xl font-black text-white">{cat.count} <span className="text-xs text-zinc-600 font-bold uppercase ml-1">Ativas</span></p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <PremiumTabs defaultValue="catalog">
        <PremiumTabsList 
          tabs={[
            { value: "catalog", label: "Catálogo", icon: Layers },
            { value: "monitor", label: "Monitoramento", icon: Activity },
            { value: "webhooks", label: "Webhooks", icon: Webhook },
            { value: "logs", label: "Logs & Auditoria", icon: ShieldCheck },
            { value: "settings", label: "Configurações", icon: Settings2 },
          ]}
        />
        <PremiumTabsBody>
          <PremiumTabsContent value="catalog">
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Stripe Integration Card */}
                <IntegrationCard 
                  name="Stripe"
                  provider="stripe"
                  description="Gateway oficial para assinaturas e infraestrutura SaaS."
                  status={health?.payments?.find((p: any) => p.provider === 'stripe')?.status || 'active'}
                  environment={health?.payments?.find((p: any) => p.provider === 'stripe')?.environment || 'live'}

                  category="Pagamentos"
                  icon={<CreditCard className="text-sky-400" />}
                />

                {/* Z-API Integration Card */}
                <IntegrationCard 
                  name="Z-API (WhatsApp)"
                  provider="zapi"
                  description="Motor de automações e mensagens transacionais via WhatsApp."
                  status={health?.whatsapp?.status || 'active'}
                  health={health?.whatsapp?.health}
                  category="Comunicação"
                  icon={<MessageSquare className="text-emerald-400" />}
                />

                {/* Mercado Pago Integration Card */}
                <IntegrationCard 
                  name="Mercado Pago"
                  provider="mercadopago"
                  description="Recebimento de PIX e cartões para clientes finais."
                  status={health?.payments?.find((p: any) => p.provider === 'mercadopago')?.status || 'not_configured'}
                  category="Pagamentos"
                  icon={<CreditCard className="text-blue-400" />}
                />

                <IntegrationCard 
                  name="Asaas"
                  provider="asaas"
                  description="Split de pagamentos e antecipação automática de recebíveis."
                  status={health?.payments?.find((p: any) => p.provider === 'asaas')?.status || 'not_configured'}
                  category="Pagamentos"
                  icon={<CreditCard className="text-orange-400" />}
                />

                <IntegrationCard 
                  name="InfinitePay"
                  provider="infinitepay"
                  description="Pagamentos via Cloud POS e links de alta conversão."
                  status={health?.payments?.find((p: any) => p.provider === 'infinitepay')?.status || 'not_configured'}
                  category="Pagamentos"
                  icon={<CreditCard className="text-purple-400" />}
                />

                <IntegrationCard 
                  name="Google Calendar"
                  provider="google"
                  description="Sincronização de agenda profissional com Google."
                  status="coming_soon"
                  category="Agenda"
                  icon={<Calendar className="text-rose-400" />}
                />

                <IntegrationCard 
                  name="Barbex API (v1)"
                  provider="internal"
                  description="Acesso programático para desenvolvedores e integração com ERPs externos."
                  status="coming_soon"
                  category="Desenvolvimento"
                  icon={<Webhook className="text-zinc-400" />}
                />
             </div>

          </PremiumTabsContent>

          <PremiumTabsContent value="monitor">
             <Card className="bg-[#0b0f17] border-zinc-800/80">
                <CardHeader>
                   <CardTitle>Saúde dos Provedores</CardTitle>
                   <CardDescription>Status em tempo real das conexões externas.</CardDescription>
                </CardHeader>
                <CardContent>
                   <div className="space-y-4">
                      {isLoading ? (
                        <div className="p-8 text-center text-zinc-500 italic">Carregando telemetria...</div>
                      ) : (
                        health?.payments?.map((p: any) => (
                          <div key={p.id} className="flex items-center justify-between p-4 bg-zinc-900/50 border border-zinc-800 rounded-xl">
                            <div className="flex items-center gap-4">
                              <Badge variant="outline" className="uppercase text-[9px] font-black">{p.provider}</Badge>
                              <span className="text-sm font-bold text-white uppercase">{p.environment}</span>
                            </div>
                            <div className="flex items-center gap-6">
                              <div className="text-right">
                                <p className="text-[10px] text-zinc-500 font-black uppercase">Latência</p>
                                <p className="text-xs font-mono text-emerald-400">42ms</p>
                              </div>
                              <Badge className={cn(
                                "h-6 px-3 font-black uppercase text-[10px] tracking-widest",
                                p.status === 'active' ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-rose-500/10 text-rose-400 border-rose-500/20"
                              )}>
                                {p.status === 'active' ? 'Operacional' : 'Falha'}
                              </Badge>
                            </div>
                          </div>
                        ))
                      )}
                   </div>
                </CardContent>
             </Card>
          </PremiumTabsContent>

          <PremiumTabsContent value="webhooks">
             <div className="p-12 text-center text-zinc-500 italic bg-[#0b0f17] border border-zinc-800 rounded-2xl">
                Gestão avançada de Webhooks Customizados disponível em breve nesta central.
             </div>
          </PremiumTabsContent>
        </PremiumTabsBody>
      </PremiumTabs>
    </div>
  );
}

function IntegrationCard({ name, description, status, health, category, icon, environment }: any) {
  const statusConfig: any = {
    active: { label: 'Ativa', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', icon: CheckCircle2 },
    error: { label: 'Falha', color: 'bg-rose-500/10 text-rose-400 border-rose-500/20', icon: XCircle },
    not_configured: { label: 'Pendente', color: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20', icon: Clock },
    coming_soon: { label: 'Em breve', color: 'bg-amber-500/10 text-amber-400 border-amber-500/20', icon: Zap },
  };

  const cfg = statusConfig[status] || statusConfig.not_configured;

  return (
    <Card className="bg-[#0b0f17] border-zinc-800/80 hover:border-emerald-500/30 transition-all flex flex-col h-full shadow-xl">
      <CardHeader className="pb-4">
        <div className="flex justify-between items-start">
          <div className="h-12 w-12 rounded-xl bg-zinc-900 border border-zinc-800 grid place-items-center">
            {icon}
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <Badge variant="outline" className={cn("h-6 px-2.5 font-black uppercase text-[9px] tracking-wider italic border", cfg.color)}>
              <cfg.icon size={10} className="mr-1.5" /> {cfg.label}
            </Badge>
            {environment && (
              <Badge variant="secondary" className="h-5 px-2 text-[8px] font-black uppercase bg-zinc-800 text-zinc-400 border-none tracking-tighter">
                {environment}
              </Badge>
            )}
          </div>
        </div>
        <div className="mt-4">
          <CardTitle className="text-lg text-white font-black italic uppercase tracking-tight">{name}</CardTitle>
          <p className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] mt-0.5">{category}</p>
        </div>
      </CardHeader>
      <CardContent className="flex-1 pb-6">
        <p className="text-xs text-zinc-400 leading-relaxed italic line-clamp-2">"{description}"</p>
        
        {health === 'degraded' && (
          <div className="mt-4 p-2 bg-amber-500/5 border border-amber-500/20 rounded-lg flex items-center gap-2">
            <AlertTriangle size={14} className="text-amber-500" />
            <span className="text-[10px] font-bold text-amber-500 uppercase">Instabilidade Detectada</span>
          </div>
        )}
      </CardContent>
      <CardFooter className="border-t border-zinc-800/50 pt-4 bg-zinc-900/10">
        <div className="flex w-full gap-2">
          <Button variant="ghost" className="flex-1 h-9 text-[10px] font-black uppercase tracking-widest text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-xl">
            Logs
          </Button>
          <Button className="flex-1 h-9 bg-emerald-500 hover:bg-emerald-600 text-black text-[10px] font-black uppercase tracking-widest rounded-xl shadow-lg shadow-emerald-500/10">
            Configurar
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}

export const Route = createFileRoute("/dashboard/integracoes")({
  component: withModule("integrations_center", "Central de Integrações", IntegrationsCenterPage),
});

