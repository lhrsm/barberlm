import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { AppLayout } from "@/components/layout/AppLayout";
import { useTenant } from "@/hooks/use-tenant";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  Megaphone,
  Users,
  Coins,
  CreditCard,
  Ticket,
  ShoppingBag,
  Star,
  Zap,
  BarChart3,
  CalendarDays,
  Sparkles,
  RefreshCcw,
  Lightbulb,
  Gift,
  Crown,
  Cake,
  AlertTriangle,
  LayoutDashboard,
  Target,
  Filter,
  Settings,
  History,
  AlertCircle,
  HelpCircle,
  Plus,
} from "lucide-react";
import { useIntelligenceData } from "@/components/intelligence/useIntelligenceData";
import { buildIntelligence, brl } from "@/components/intelligence/engine";
import { SectionCard, CustomerList, EmptyState, SkeletonBlock } from "@/components/intelligence/ui";
import { useMarketingData } from "@/components/marketing/useMarketingData";
import { buildMarketing, type UnifiedCampaign } from "@/components/marketing/engine";

import { MarketingOverview } from "@/components/marketing-hub/MarketingOverview";
import { CampaignList } from "@/components/marketing-hub/CampaignList";
import { AudienceBuilder } from "@/components/marketing-hub/AudienceBuilder";

export const Route = createFileRoute("/marketing")({
  component: MarketingPage,
  head: () => ({
    meta: [
      { title: "Marketing Hub Enterprise | Barbex" },
      {
        name: "description",
        content:
          "Plataforma completa de marketing e crescimento para barbearias: campanhas, segmentações, automações e resultados em tempo real.",
      },
      { property: "og:title", content: "Marketing Hub Enterprise | Barbex" },
      {
        property: "og:description",
        content: "Evolua o marketing da sua barbearia com inteligência de dados e automações poderosas.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

export function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-[#0b0f17] p-4 transition-all duration-200 hover:border-gold/30">
      <div className="flex items-center justify-between mb-1">
        <p className="text-[10px] font-black uppercase tracking-widest text-white/40">{label}</p>
        {hint && (
          <div className="group relative">
            <HelpCircle size={10} className="text-white/20" />
            <div className="pointer-events-none absolute bottom-full left-1/2 mb-2 w-32 -translate-x-1/2 rounded-lg bg-black/90 p-2 text-[10px] text-white opacity-0 transition-opacity group-hover:opacity-100 border border-white/10 shadow-xl z-50">
              {hint}
            </div>
          </div>
        )}
      </div>
      <p className="text-xl font-black text-white">{value}</p>
    </div>
  );
}

function MarketingPage() {
  const { tenantId } = useTenant();
  const intel = useIntelligenceData(tenantId ?? null);
  const mkt = useMarketingData(tenantId ?? null);
  const iq = useMemo(() => buildIntelligence(intel.data), [intel.data]);
  const model = useMemo(() => buildMarketing(mkt.data, iq), [mkt.data, iq]);
  const loading = intel.isLoading || mkt.isLoading;

  const refetchAll = () => {
    intel.refetch();
    mkt.refetch();
  };

  return (
    <AppLayout>
      <div className="min-h-screen bg-[#06090f] pb-20">
        <div className="mx-auto max-w-[1400px] px-4 pt-8 md:px-6">
          {/* Header */}
          <header className="mb-8 flex flex-wrap items-end justify-between gap-6">
            <div className="animate-in fade-in slide-in-from-left duration-700">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-gold/20 to-gold/5 p-[1px]">
                  <div className="flex h-full w-full items-center justify-center rounded-2xl bg-[#0b0f17]">
                    <Megaphone className="text-gold" size={20} />
                  </div>
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.3em] text-gold">Barbex Marketing Hub Enterprise</p>
                  <h1 className="mt-1 text-2xl font-black text-white md:text-3xl">Marketing Hub</h1>
                </div>
              </div>
              <p className="mt-2 max-w-2xl text-sm text-white/55">
                Centralize seu planejamento comercial, crie campanhas segmentadas e acompanhe resultados reais de crescimento.
              </p>
            </div>

            <div className="flex items-center gap-3 animate-in fade-in slide-in-from-right duration-700">
              <Button onClick={refetchAll} variant="outline" className="border-white/10 bg-white/5 font-bold text-white hover:bg-white/10">
                <RefreshCcw className={cn("mr-2 h-4 w-4", (intel.isFetching || mkt.isFetching) && "animate-spin")} />
                Atualizar
              </Button>
              <Button asChild variant="outline" className="border-white/10 bg-white/5 font-bold text-white hover:bg-white/10">
                <Link to="/automations">
                  <Zap size={16} className="mr-2 text-gold" />
                  Automações
                </Link>
              </Button>
              <Button asChild className="bg-gold font-black text-black hover:bg-gold/90 shadow-[0_0_20px_rgba(212,175,55,0.2)]">
                <Link to="/campaigns">
                  <Plus size={18} className="mr-2" />
                  Nova Campanha
                </Link>
              </Button>
            </div>
          </header>

          <Tabs defaultValue="visao-geral" className="w-full">
            <TabsList className="flex w-full flex-wrap justify-start gap-1 rounded-2xl border border-white/[0.07] bg-[#0b0f17] p-1 mb-8 overflow-x-auto no-scrollbar">
              {[
                ["visao-geral", "Visão Geral", LayoutDashboard],
                ["campanhas", "Campanhas", Megaphone],
                ["publicos", "Públicos", Users],
                ["segmentacoes", "Segmentações", Filter],
                ["templates", "Templates", Target],
                ["calendario", "Calendário", CalendarDays],
                ["oportunidades", "Oportunidades", Lightbulb],
                ["resultados", "Resultados", BarChart3],
                ["automacoes", "Automações", Zap],
                ["configuracoes", "Configurações", Settings],
              ].map(([value, label, Icon]: any) => (
                <TabsTrigger
                  key={value}
                  value={value}
                  className="flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-black uppercase tracking-widest text-white/40 transition-all data-[state=active]:bg-gold data-[state=active]:text-black hover:text-white/80"
                >
                  <Icon size={14} />
                  {label}
                </TabsTrigger>
              ))}
            </TabsList>

            {/* VISÃO GERAL */}
            <TabsContent value="visao-geral" className="mt-0 focus-visible:outline-none">
              <MarketingOverview model={model} loading={loading} iq={iq} />
            </TabsContent>

            {/* CAMPANHAS */}
            <TabsContent value="campanhas" className="mt-0 focus-visible:outline-none">
              <CampaignList model={model} loading={loading} />
            </TabsContent>

            {/* PÚBLICOS */}
            <TabsContent value="publicos" className="mt-0 focus-visible:outline-none">
              <AudienceBuilder loading={loading} />
            </TabsContent>

            {/* SEGMENTAÇÕES */}
            <TabsContent value="segmentacoes" className="mt-0 focus-visible:outline-none">
              <div className="rounded-3xl border border-white/[0.07] bg-[#0b0f17] p-12 text-center">
                <Filter className="mx-auto mb-4 text-white/10" size={48} />
                <h3 className="text-xl font-black text-white">Segmentação Inteligente</h3>
                <p className="mx-auto mt-2 max-w-md text-sm text-white/40">
                  O motor de segmentação está sendo atualizado para permitir filtros cruzados entre serviços, produtos e frequência.
                </p>
              </div>
            </TabsContent>

            {/* OUTRAS ABAS */}
            {["templates", "calendario", "oportunidades", "resultados", "automacoes", "configuracoes"].map((tab) => (
              <TabsContent key={tab} value={tab} className="mt-0 focus-visible:outline-none">
                <div className="rounded-3xl border border-white/[0.07] bg-[#0b0f17] p-12 text-center">
                  <Settings className="mx-auto mb-4 text-white/10 animate-spin-slow" size={48} />
                  <h3 className="text-xl font-black text-white">Em Desenvolvimento</h3>
                  <p className="mx-auto mt-2 max-w-md text-sm text-white/40">
                    Esta funcionalidade do Marketing Hub Enterprise está sendo preparada para o seu tenant.
                  </p>
                </div>
              </TabsContent>
            ))}
          </Tabs>
        </div>
      </div>
    </AppLayout>
  );
}
