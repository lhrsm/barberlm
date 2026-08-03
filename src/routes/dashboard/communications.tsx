import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/layout/AppLayout";
import { useTenant } from "@/hooks/use-tenant";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { withModule } from "@/components/modules/withModule";
import { 
  LayoutDashboard, 
  MessageSquare, 
  Settings, 
  History, 
  Zap, 
  AlertTriangle, 
  ShieldCheck, 
  Users,
  FileText
} from "lucide-react";

import { CommunicationOverview } from "@/components/communications/CommunicationOverview";
import { ChannelManager } from "@/components/communications/ChannelManager";
import { UnifiedInbox } from "@/components/communications/UnifiedInbox";
import { TemplateManager } from "@/components/communications/TemplateManager";
import { DeliveryFailures } from "@/components/communications/DeliveryFailures";

export const Route = createFileRoute("/dashboard/communications")({
  component: withModule("automations", "Omnichannel", CommunicationsPage),
});

function CommunicationsPage() {
  const { tenantId } = useTenant();

  if (!tenantId) return null;

  return (
    <AppLayout>
      <div className="min-h-screen bg-[#05070d] text-white -m-4 md:-m-6 lg:-m-8 p-4 md:p-6 lg:p-8">
        <div className="space-y-6">
          {/* Header */}
          <div className="bg-[#0b0f17] border border-zinc-800/80 rounded-2xl p-5 md:p-6 shadow-[0_8px_28px_rgba(212,175,55,0.08)] flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="shrink-0 h-14 w-14 rounded-2xl bg-gradient-to-br from-[#D4AF37]/20 to-[#D4AF37]/5 border border-[#D4AF37]/30 grid place-items-center shadow-[0_4px_20px_rgba(212,175,55,0.15)]">
                <MessageSquare className="h-7 w-7 text-[#D4AF37]" />
              </div>
              <div className="min-w-0">
                <h2 className="text-2xl md:text-3xl font-black tracking-tight text-white">Central Omnichannel</h2>
                <p className="text-sm text-zinc-400 mt-1">Gestão inteligente de todas as suas comunicações.</p>
              </div>
            </div>
          </div>

          <Tabs defaultValue="overview" className="space-y-6">
            <TabsList className="bg-[#0b0f17] border border-zinc-800/80 p-1 rounded-xl h-auto flex flex-wrap gap-1">
              <TabsTrigger value="overview" className="data-[state=active]:bg-[#D4AF37] data-[state=active]:text-black font-bold py-2 px-4 rounded-lg transition-all flex items-center gap-2">
                <LayoutDashboard size={16} />
                <span className="hidden sm:inline">Visão Geral</span>
              </TabsTrigger>
              <TabsTrigger value="inbox" className="data-[state=active]:bg-[#D4AF37] data-[state=active]:text-black font-bold py-2 px-4 rounded-lg transition-all flex items-center gap-2">
                <MessageSquare size={16} />
                <span className="hidden sm:inline">Caixa de Entrada</span>
              </TabsTrigger>
              <TabsTrigger value="channels" className="data-[state=active]:bg-[#D4AF37] data-[state=active]:text-black font-bold py-2 px-4 rounded-lg transition-all flex items-center gap-2">
                <Zap size={16} />
                <span className="hidden sm:inline">Canais</span>
              </TabsTrigger>
              <TabsTrigger value="templates" className="data-[state=active]:bg-[#D4AF37] data-[state=active]:text-black font-bold py-2 px-4 rounded-lg transition-all flex items-center gap-2">
                <FileText size={16} />
                <span className="hidden sm:inline">Templates</span>
              </TabsTrigger>
              <TabsTrigger value="failures" className="data-[state=active]:bg-[#D4AF37] data-[state=active]:text-black font-bold py-2 px-4 rounded-lg transition-all flex items-center gap-2">
                <AlertTriangle size={16} />
                <span className="hidden sm:inline">Falhas</span>
              </TabsTrigger>
              <TabsTrigger value="preferences" className="data-[state=active]:bg-[#D4AF37] data-[state=active]:text-black font-bold py-2 px-4 rounded-lg transition-all flex items-center gap-2">
                <Users size={16} />
                <span className="hidden sm:inline">Preferências</span>
              </TabsTrigger>
              <TabsTrigger value="settings" className="data-[state=active]:bg-[#D4AF37] data-[state=active]:text-black font-bold py-2 px-4 rounded-lg transition-all flex items-center gap-2">
                <Settings size={16} />
                <span className="hidden sm:inline">Configurações</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview">
              <CommunicationOverview tenantId={tenantId} />
            </TabsContent>
            
            <TabsContent value="inbox">
              <UnifiedInbox tenantId={tenantId} />
            </TabsContent>

            <TabsContent value="channels">
              <ChannelManager tenantId={tenantId} />
            </TabsContent>

            <TabsContent value="templates">
              <TemplateManager tenantId={tenantId} />
            </TabsContent>

            <TabsContent value="failures">
              <DeliveryFailures tenantId={tenantId} />
            </TabsContent>
            
            <TabsContent value="preferences">
              <div className="bg-[#0b0f17] border border-zinc-800/80 rounded-2xl p-6">
                <h3 className="text-xl font-bold mb-4">Gestão de Consentimentos (LGPD)</h3>
                <p className="text-zinc-400">Em desenvolvimento. Aqui você poderá gerenciar opt-ins e opt-outs dos seus clientes por canal.</p>
              </div>
            </TabsContent>

            <TabsContent value="settings">
              <div className="bg-[#0b0f17] border border-zinc-800/80 rounded-2xl p-6">
                <h3 className="text-xl font-bold mb-4">Configurações Avançadas</h3>
                <p className="text-zinc-400">Configurações de fallback, prioridades e filas de processamento.</p>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </AppLayout>
  );
}
