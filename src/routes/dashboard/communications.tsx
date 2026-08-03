import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/layout/AppLayout";
import { 
  MessageSquare, 
  Inbox, 
  History, 
  FileText, 
  Share2, 
  Settings,
  LayoutDashboard,
  AlertTriangle,
  Ghost
} from "lucide-react";
import { 
  PremiumTabs, 
  PremiumTabsList, 
  PremiumTabsBody, 
  PremiumTabsContent 
} from "@/components/ui/premium-tabs";
import { CommunicationOverview } from "@/components/communications/CommunicationOverview";
import { ChannelManager } from "@/components/communications/ChannelManager";
import { UnifiedInbox } from "@/components/communications/UnifiedInbox";
import { TemplateManager } from "@/components/communications/TemplateManager";
import { DeliveryFailures } from "@/components/communications/DeliveryFailures";
import { DeadLetterQueue } from "@/components/communications/DeadLetterQueue";
import { useTenant } from "@/hooks/use-tenant";
import { withModule } from "@/components/modules/withModule";

function CommunicationsPage() {
  const { tenantId } = useTenant();

  if (!tenantId) return null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-2xl bg-gold/10 border border-gold/20 grid place-items-center">
            <MessageSquare className="text-gold" size={24} />
          </div>
          <div>
            <h1 className="text-4xl font-black text-white uppercase italic tracking-tighter leading-none">Omnichannel</h1>
            <p className="text-zinc-500 font-medium text-sm mt-1">Central de Inteligência de Comunicação e Relacionamento.</p>
          </div>
        </div>
      </div>

      <PremiumTabs defaultValue="overview">
        <PremiumTabsList 
          tabs={[
            { value: "overview", label: "Visão Geral", icon: LayoutDashboard },
            { value: "inbox", label: "Caixa de Entrada", icon: Inbox },
            { value: "history", label: "Mensagens", icon: History },
            { value: "templates", label: "Templates", icon: FileText },
            { value: "channels", label: "Canais", icon: Share2 },
            { value: "failures", label: "Falhas", icon: AlertTriangle },
            { value: "dlq", label: "Dead Letter", icon: Ghost },
            { value: "settings", label: "Configurações", icon: Settings },
          ]}
        />
        <PremiumTabsBody>
          <PremiumTabsContent value="overview">
            <CommunicationOverview tenantId={tenantId} />
          </PremiumTabsContent>
          
          <PremiumTabsContent value="inbox">
            <UnifiedInbox tenantId={tenantId} />
          </PremiumTabsContent>
          
          <PremiumTabsContent value="history">
            <UnifiedInbox tenantId={tenantId} />
          </PremiumTabsContent>

          <PremiumTabsContent value="templates">
            <TemplateManager tenantId={tenantId} />
          </PremiumTabsContent>

          <PremiumTabsContent value="channels">
            <ChannelManager tenantId={tenantId} />
          </PremiumTabsContent>

          <PremiumTabsContent value="failures">
            <DeliveryFailures tenantId={tenantId} />
          </PremiumTabsContent>

          <PremiumTabsContent value="dlq">
            <DeadLetterQueue tenantId={tenantId} />
          </PremiumTabsContent>

          <PremiumTabsContent value="settings">
            <div className="p-8 text-center text-zinc-500 italic bg-[#0b0f17] border border-zinc-800 rounded-2xl">
              Configurações avançadas de roteamento e fallback em breve.
            </div>
          </PremiumTabsContent>
        </PremiumTabsBody>
      </PremiumTabs>
    </div>
  );
}

export const Route = createFileRoute("/dashboard/communications")({
  component: withModule("communications", "Omnichannel", CommunicationsPage),
});
