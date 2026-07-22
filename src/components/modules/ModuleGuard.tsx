import { Link } from "@tanstack/react-router";
import { Lock, Settings, Crown, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useModules, type ModuleKey } from "@/hooks/use-modules";
import { ReactNode } from "react";

interface ModuleGuardProps {
  module: ModuleKey;
  title?: string;
  children: ReactNode;
}

// Mapeamento de módulo → plano mínimo necessário
const MODULE_REQUIRED_PLAN: Record<string, { slug: string; name: string }> = {
  // Starter
  whatsapp: { slug: "starter", name: "Starter" },
  automations_basic: { slug: "starter", name: "Starter" },
  client_portal: { slug: "starter", name: "Starter" },
  barber_panel: { slug: "starter", name: "Starter" },
  basic_finance: { slug: "starter", name: "Starter" },
  reports_basic: { slug: "starter", name: "Starter" },
  // Pro
  commissions: { slug: "pro", name: "Pro" },
  loyalty: { slug: "pro", name: "Pro" },
  campaigns: { slug: "pro", name: "Pro" },
  coupons: { slug: "pro", name: "Pro" },
  subscriptions: { slug: "pro", name: "Pro" },
  cashback: { slug: "pro", name: "Pro" },
  products: { slug: "pro", name: "Pro" },
  stock: { slug: "pro", name: "Pro" },
  payment_gateway: { slug: "pro", name: "Pro" },
  store: { slug: "pro", name: "Pro" },
  dashboard_advanced: { slug: "pro", name: "Pro" },
  reports_advanced: { slug: "pro", name: "Pro" },
  advanced_finance: { slug: "pro", name: "Pro" },
  automations_smart: { slug: "pro", name: "Pro" },
  subscription_rewards: { slug: "pro", name: "Pro" },
  // Elite
  ai: { slug: "elite", name: "Elite" },
  api: { slug: "elite", name: "Elite" },
  automations: { slug: "elite", name: "Elite" },
  automations_unlimited: { slug: "elite", name: "Elite" },
  integrations: { slug: "elite", name: "Elite" },
  tutorials: { slug: "elite", name: "Elite" },
  pix_key: { slug: "elite", name: "Elite" },
  multi_units: { slug: "elite", name: "Elite" },
  white_label: { slug: "elite", name: "Elite" },
  api_access: { slug: "elite", name: "Elite" },
  corporate_reports: { slug: "elite", name: "Elite" },
  ai_scheduler: { slug: "elite", name: "Elite" },
  ai_commercial: { slug: "elite", name: "Elite" },
  ai_recovery: { slug: "elite", name: "Elite" },
  ai_products: { slug: "elite", name: "Elite" },
  ai_subscriptions: { slug: "elite", name: "Elite" },
  ai_smart_replies: { slug: "elite", name: "Elite" },
  ai_campaigns: { slug: "elite", name: "Elite" },
  ai_loyalty: { slug: "elite", name: "Elite" },
  ai_whatsapp: { slug: "elite", name: "Elite" },
  ai_google_reviews: { slug: "elite", name: "Elite" },
  ai_upsell: { slug: "elite", name: "Elite" },
  ai_cross_sell: { slug: "elite", name: "Elite" },
};


export function ModuleGuard({ module, title, children }: ModuleGuardProps) {
  const { isAllowed, isEnabled, plan, isLoading, accessSource } = useModules();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh] text-white/60">
        Carregando...
      </div>
    );
  }

  const allowedByPlan = isAllowed(module);
  const enabledByTenant = isEnabled(module);
  const source = accessSource(module);

  // Caso 1: não incluso no plano nem contratado como add-on → upgrade OU add-on
  if (!allowedByPlan) {
    const required = MODULE_REQUIRED_PLAN[module];
    return (
      <div className="flex items-center justify-center min-h-[60vh] px-4">
        <div className="max-w-lg w-full text-center bg-gradient-to-br from-[#0A1020] to-[#0B1426] border border-amber-500/30 rounded-2xl p-8 shadow-2xl">
          <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-gradient-to-br from-amber-500/25 to-transparent border border-amber-500/40 flex items-center justify-center">
            <Crown className="w-8 h-8 text-amber-400" />
          </div>
          <span className="inline-block text-[10px] font-bold px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/40 text-amber-300 uppercase tracking-wider mb-3">
            Recurso Premium
          </span>
          <h2 className="text-2xl font-bold text-white mb-2">
            {title || "Este recurso"} não está no seu plano
          </h2>
          <p className="text-sm text-white/60 mb-2">
            Seu plano atual é <strong className="text-white/80">{plan?.name ?? "—"}</strong>.
          </p>
          <p className="text-sm text-white/60 mb-6">
            Contrate <strong className="text-amber-300">apenas este módulo</strong> como adicional, ou faça upgrade para o plano <strong className="text-amber-300">{required?.name || "superior"}</strong>.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <Link to="/subscription/addons" className="flex-1">
              <Button className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-black font-bold rounded-xl h-11">
                Adicionar este módulo
                <ArrowUpRight className="w-4 h-4 ml-1" />
              </Button>
            </Link>
            <Link to="/subscription" className="flex-1">
              <Button variant="outline" className="w-full border-white/15 bg-white/5 hover:bg-white/10 text-white rounded-xl h-11">
                Comparar planos
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Caso 2: incluso (plano ou add-on) mas desativado pela barbearia
  if (!enabledByTenant) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] px-4">
        <div className="max-w-md w-full text-center bg-gradient-to-br from-[#0A1020] to-[#0B1426] border border-[rgba(255,184,0,.18)] rounded-2xl p-8 shadow-xl">
          <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-gradient-to-br from-[#f59e0b]/20 to-transparent border border-[rgba(255,184,0,.25)] flex items-center justify-center">
            <Lock className="w-7 h-7 text-amber-400" />
          </div>
          {source === "addon" && (
            <span className="inline-block text-[10px] font-bold px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 uppercase tracking-wider mb-3">
              Módulo adicional ativo
            </span>
          )}
          <h2 className="text-xl font-bold text-white mb-2">
            {title ? `${title} desativado` : "Este módulo está desativado"}
          </h2>
          <p className="text-sm text-white/60 mb-6">
            {source === "addon"
              ? "Você contratou este módulo como adicional, mas ele está desativado. Ative-o em Configurações."
              : "Este recurso está incluso no seu plano, mas não está ativo. Ative-o nas configurações quando quiser usar."}
          </p>
          <Link to="/settings">
            <Button className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-black font-semibold rounded-xl h-11">
              <Settings className="w-4 h-4 mr-2" />
              Ativar em Configurações
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

