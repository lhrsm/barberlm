import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/AppLayout";
import { MembershipDashboard } from "@/components/membership/MembershipDashboard";
import { getMembershipStats } from "@/lib/membership.functions";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Crown, 
  Settings2, 
  History, 
  Users2, 
  BarChart3,
  ShieldCheck,
  PauseCircle,
  Clock
} from "lucide-react";
import { withModule } from "@/components/modules/withModule";

export const Route = createFileRoute("/dashboard/membership")({
  loader: async ({ context }) => {
    // context matches the generic record in the start template
    // using queryClient from context if provided by the router instance
    const queryClient = (context as any).queryClient;
    if (queryClient) {
      await queryClient.ensureQueryData({
        queryKey: ["membership-stats"],
        queryFn: () => getMembershipStats()
      });
    }
  },
  component: withModule("subscriptions", "Clube Barbex 2.0", MembershipDashboardRoute),
});

function MembershipDashboardRoute() {
  const { data: stats } = useSuspenseQuery({
    queryKey: ["membership-stats"],
    queryFn: () => getMembershipStats()
  });

  return (
    <AppLayout>
      <div className="container mx-auto p-6 space-y-8 animate-in fade-in duration-500">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
              <Crown className="h-8 w-8 text-gold-500" />
              Clube Barbex <span className="text-gold-500/50">2.0</span>
            </h1>
            <p className="text-zinc-400 mt-1">
              Gestão estratégica de assinaturas, retenção e fidelização premium.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="px-4 py-2 bg-gold-500/10 border border-gold-500/20 rounded-full flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-gold-500" />
              <span className="text-xs font-semibold text-gold-500 uppercase tracking-wider">Premium Engine Ativo</span>
            </div>
          </div>
        </header>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="bg-zinc-900/80 border border-zinc-800 p-1 rounded-xl">
            <TabsTrigger value="overview" className="rounded-lg data-[state=active]:bg-gold-500 data-[state=active]:text-black gap-2">
              <BarChart3 className="h-4 w-4" />
              Cockpit Executivo
            </TabsTrigger>
            <TabsTrigger value="members" className="rounded-lg data-[state=active]:bg-gold-500 data-[state=active]:text-black gap-2">
              <Users2 className="h-4 w-4" />
              Membros Ativos
            </TabsTrigger>
            <TabsTrigger value="benefits" className="rounded-lg data-[state=active]:bg-gold-500 data-[state=active]:text-black gap-2">
              <Settings2 className="h-4 w-4" />
              Configuração de Benefícios
            </TabsTrigger>
            <TabsTrigger value="history" className="rounded-lg data-[state=active]:bg-gold-500 data-[state=active]:text-black gap-2">
              <History className="h-4 w-4" />
              Logs de Utilização
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6 outline-none">
            <MembershipDashboard stats={stats} />
          </TabsContent>

          <TabsContent value="members" className="outline-none">
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-12 text-center">
              <div className="max-w-md mx-auto space-y-4">
                <Users2 className="h-12 w-12 text-zinc-700 mx-auto" />
                <h3 className="text-xl font-semibold text-white">Lista de Membros</h3>
                <p className="text-zinc-500">Módulo de gestão de base em fase de sincronização com o motor 2.0.</p>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="benefits" className="outline-none">
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-12 text-center">
              <div className="max-w-md mx-auto space-y-4">
                <Settings2 className="h-12 w-12 text-zinc-700 mx-auto" />
                <h3 className="text-xl font-semibold text-white">Editor de Benefícios Granulares</h3>
                <p className="text-zinc-500">Configure limites mensais por categoria de serviço (Corte, Barba, Combo) e regras de carência.</p>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="history" className="outline-none">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="bg-zinc-900/30 border border-zinc-800 p-4 rounded-xl flex items-center gap-4">
                <div className="h-10 w-10 bg-blue-500/10 rounded-lg flex items-center justify-center">
                  <Clock className="h-5 w-5 text-blue-400" />
                </div>
                <div>
                  <div className="text-xs text-zinc-500 uppercase font-bold">Último Uso</div>
                  <div className="text-sm font-medium text-white">Há 14 minutos</div>
                </div>
              </div>
              <div className="bg-zinc-900/30 border border-zinc-800 p-4 rounded-xl flex items-center gap-4">
                <div className="h-10 w-10 bg-amber-500/10 rounded-lg flex items-center justify-center">
                  <PauseCircle className="h-5 w-5 text-amber-400" />
                </div>
                <div>
                  <div className="text-xs text-zinc-500 uppercase font-bold">Pausas Ativas</div>
                  <div className="text-sm font-medium text-white">3 Membros</div>
                </div>
              </div>
            </div>
            
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-12 text-center">
              <p className="text-zinc-500">Carregando histórico detalhado de consumo...</p>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
