import React from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { resolveCommandCenterContext } from "@/lib/command-center.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Users, 
  Clock, 
  AlertCircle, 
  Wallet, 
  Package, 
  Monitor, 
  Maximize2,
  Calendar,
  CheckCircle2,
  Play
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export const Route = createFileRoute("/dashboard/centro-de-comando")({
  component: CommandCenterPage,
});

function CommandCenterPage() {
  const { data: context } = useSuspenseQuery({
    queryKey: ["command-center-context"],
    queryFn: () => resolveCommandCenterContext(),
    refetchInterval: 30000, // Realtime simulation via polling (can be upgraded to full subscriptions)
  });

  const [isFocusMode, setIsFocusMode] = React.useState(false);

  return (
    <div className={`flex flex-col gap-6 p-6 min-h-screen bg-background/50 transition-all duration-300 ${isFocusMode ? 'max-w-7xl mx-auto' : ''}`}>
      {/* 5. HERO OPERACIONAL */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-gold-DEFAULT via-gold-light to-gold-DEFAULT bg-clip-text text-transparent">
            Centro de Comando
          </h1>
          <p className="text-muted-foreground flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            {format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR })}
            <span className="mx-1">•</span>
            {context.metrics.active_professionals} profissionais ativos
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setIsFocusMode(!isFocusMode)}
            className={isFocusMode ? "bg-gold-DEFAULT/10 border-gold-DEFAULT text-gold-DEFAULT" : ""}
          >
            <Maximize2 className="w-4 h-4 mr-2" />
            Modo Foco
          </Button>
          <Button variant="outline" size="sm">
            <Monitor className="w-4 h-4 mr-2" />
            Modo TV
          </Button>
        </div>
      </header>

      {/* 6. STATUS GERAL */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatusCard 
          title="Fila de Espera" 
          value={context.metrics.waiting_clients} 
          icon={Users}
          status={context.metrics.waiting_clients > 3 ? "critical" : context.metrics.waiting_clients > 0 ? "warning" : "normal"}
        />
        <StatusCard 
          title="Em Andamento" 
          value={context.metrics.in_progress} 
          icon={Play}
          status="normal"
        />
        <StatusCard 
          title="Pagamentos" 
          value={context.metrics.pending_payments} 
          icon={Wallet}
          status={context.metrics.pending_payments > 0 ? "warning" : "normal"}
        />
        <StatusCard 
          title="Pedidos" 
          value={context.metrics.pending_orders} 
          icon={Package}
          status={context.metrics.pending_orders > 0 ? "warning" : "normal"}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 7. OPERAÇÃO EM TEMPO REAL & 8. FILA */}
        <div className="lg:col-span-2 space-y-6">
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <Users className="w-5 h-5 text-gold-DEFAULT" />
                Profissionais & Atendimentos
              </h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {context.professionals.map((prof: any) => (
                <ProfessionalCard key={prof.id} professional={prof} appointments={context.appointments} />
              ))}
            </div>
          </section>

          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <Clock className="w-5 h-5 text-gold-DEFAULT" />
                Fila da Recepção
              </h2>
              <Badge variant="outline" className="text-gold-DEFAULT border-gold-DEFAULT">
                {context.waiting_list.length} aguardando
              </Badge>
            </div>
            <Card className="bg-background/40 backdrop-blur-sm border-gold-DEFAULT/20 overflow-hidden">
              <CardContent className="p-0">
                {context.waiting_list.length > 0 ? (
                  <div className="divide-y divide-gold-DEFAULT/10">
                    {context.waiting_list.map((item: any) => (
                      <div key={item.id} className="p-4 flex items-center justify-between hover:bg-gold-DEFAULT/5 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-gold-DEFAULT/10 flex items-center justify-center border border-gold-DEFAULT/20">
                            <span className="text-gold-DEFAULT font-bold">{item.customer_name?.[0]}</span>
                          </div>
                          <div>
                            <p className="font-medium">{item.customer_name}</p>
                            <p className="text-xs text-muted-foreground">{item.service_name} • {item.professional_name}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-xs font-mono text-gold-DEFAULT">Aguardando {item.waiting_time || "5m"}</p>
                          <Button size="sm" variant="ghost" className="h-7 text-xs px-2 hover:bg-gold-DEFAULT hover:text-black">
                            Check-in
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-12 text-center text-muted-foreground">
                    Nenhum cliente na fila no momento.
                  </div>
                )}
              </CardContent>
            </Card>
          </section>
        </div>

        {/* 17. ALERTAS CRÍTICOS & ATALHOS */}
        <div className="space-y-6">
          <section>
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-500" />
              Alertas Prioritários
            </h2>
            <div className="space-y-3">
              {context.alerts.length > 0 ? (
                context.alerts.map((alert: any) => (
                  <AlertItem key={alert.id} alert={alert} />
                ))
              ) : (
                <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20 text-green-500 text-sm flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  Operação estável. Nenhum alerta crítico.
                </div>
              )}
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">Ações Rápidas</h2>
            <div className="grid grid-cols-2 gap-2">
              <QuickAction icon={Calendar} label="Novo Agendamento" />
              <QuickAction icon={Users} label="Novo Walk-in" />
              <QuickAction icon={Wallet} label="Receber PIX" />
              <QuickAction icon={Package} label="Vender Produto" />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function StatusCard({ title, value, icon: Icon, status }: any) {
  const statusColors = {
    normal: "border-gold-DEFAULT/20 text-foreground",
    warning: "border-orange-500/50 bg-orange-500/5 text-orange-500",
    critical: "border-red-500/50 bg-red-500/5 text-red-500 animate-pulse",
  };

  return (
    <Card className={`backdrop-blur-sm ${statusColors[status as keyof typeof statusColors]}`}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium opacity-80">{title}</CardTitle>
        <Icon className="w-4 h-4" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );
}

function ProfessionalCard({ professional, appointments }: any) {
  const currentApp = appointments.find((a: any) => a.barber_id === professional.id && a.status === 'in_progress');
  
  return (
    <Card className="bg-background/40 backdrop-blur-sm border-gold-DEFAULT/10 hover:border-gold-DEFAULT/30 transition-all group">
      <CardContent className="p-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="relative">
            <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-gold-DEFAULT/20">
              {professional.avatar_url ? (
                <img src={professional.avatar_url} alt={professional.full_name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-gold-DEFAULT/10 flex items-center justify-center text-gold-DEFAULT font-bold">
                  {professional.full_name?.[0]}
                </div>
              )}
            </div>
            <div className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-background ${currentApp ? 'bg-orange-500' : 'bg-green-500'}`} />
          </div>
          <div>
            <h3 className="font-semibold">{professional.full_name}</h3>
            <p className="text-xs text-muted-foreground">
              {currentApp ? "Atendendo agora" : "Disponível"}
            </p>
          </div>
        </div>

        {currentApp ? (
          <div className="space-y-2 p-2 rounded bg-gold-DEFAULT/5 border border-gold-DEFAULT/10">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Cliente:</span>
              <span className="font-medium">{currentApp.customer_name}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Serviço:</span>
              <span className="font-medium">{currentApp.service_name}</span>
            </div>
          </div>
        ) : (
          <div className="p-4 text-center border border-dashed border-gold-DEFAULT/10 rounded-lg">
            <p className="text-xs text-muted-foreground">Aguardando próximo</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function AlertItem({ alert }: any) {
  return (
    <div className="p-3 rounded-lg border border-red-500/20 bg-red-500/5 flex items-start gap-3">
      <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
      <div>
        <p className="text-sm font-medium">{alert.title || "Alerta Operacional"}</p>
        <p className="text-xs text-muted-foreground">{alert.description || "Atenção necessária nesta tarefa."}</p>
      </div>
    </div>
  );
}

function QuickAction({ icon: Icon, label }: any) {
  return (
    <Button variant="outline" className="h-auto py-3 flex-col gap-2 border-gold-DEFAULT/20 hover:border-gold-DEFAULT hover:bg-gold-DEFAULT/5">
      <Icon className="w-5 h-5 text-gold-DEFAULT" />
      <span className="text-[10px] uppercase font-bold tracking-wider">{label}</span>
    </Button>
  );
}
