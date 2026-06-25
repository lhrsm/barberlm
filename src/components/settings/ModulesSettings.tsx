import { useModules, type ModuleKey } from "@/hooks/use-modules";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";
import {
  ShoppingBag,
  CreditCard,
  Gift,
  Coins,
  Megaphone,
  MessageSquare,
  CircleDollarSign,
  GraduationCap,
  Share2,
  Headset,
  Ticket,
  Phone,
  KeyRound,
  Lock,
  Crown,
  type LucideIcon,
} from "lucide-react";

interface ModuleDef {
  key: ModuleKey;
  name: string;
  description: string;
  icon: LucideIcon;
  requiredPlan: "starter" | "pro" | "elite";
}

const MODULES: ModuleDef[] = [
  { key: "support", name: "Suporte", description: "Abrir chamados e receber ajuda da equipe Barbex.", icon: Headset, requiredPlan: "starter" },
  { key: "whatsapp", name: "WhatsApp", description: "Configure o número de WhatsApp da barbearia.", icon: Phone, requiredPlan: "starter" },
  { key: "commissions", name: "Comissões", description: "Calcule comissões dos barbeiros automaticamente.", icon: CircleDollarSign, requiredPlan: "pro" },
  { key: "loyalty", name: "Fidelidade", description: "Programa de pontos por atendimentos realizados.", icon: Gift, requiredPlan: "pro" },
  { key: "campaigns", name: "Campanhas", description: "Envie campanhas promocionais para seus clientes.", icon: Megaphone, requiredPlan: "pro" },
  { key: "coupons", name: "Cupons", description: "Crie cupons de desconto para campanhas.", icon: Ticket, requiredPlan: "pro" },
  { key: "subscriptions", name: "Assinaturas", description: "Crie planos recorrentes para seus clientes.", icon: CreditCard, requiredPlan: "pro" },
  { key: "cashback", name: "Cashback", description: "Devolva uma porcentagem em créditos para o cliente.", icon: Coins, requiredPlan: "pro" },
  { key: "products", name: "Loja / Produtos", description: "Venda produtos como pomadas, shampoos e acessórios.", icon: ShoppingBag, requiredPlan: "pro" },
  { key: "automations", name: "Automações", description: "Mensagens automáticas de confirmação, lembrete e retorno.", icon: MessageSquare, requiredPlan: "elite" },
  { key: "integrations", name: "Integrações", description: "Conecte com WhatsApp, Z-API, Stripe e outros.", icon: Share2, requiredPlan: "elite" },
  { key: "tutorials", name: "Tutoriais", description: "Acesso a vídeos e materiais de apoio.", icon: GraduationCap, requiredPlan: "elite" },
  { key: "pix_key", name: "Chave PIX", description: "Cadastre uma chave PIX para receber pagamentos.", icon: KeyRound, requiredPlan: "elite" },
];

const PLAN_LABELS: Record<string, string> = {
  starter: "Starter",
  pro: "Pro",
  elite: "Elite",
};

const PLAN_TIER: Record<string, number> = {
  starter: 1, pro: 2, elite: 3,
};

export function ModulesSettings() {
  const { modules, plan, toggleModule, isToggling, isLoading, isAllowed } = useModules();
  const currentTier = plan ? PLAN_TIER[plan.slug] ?? 0 : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-white">Módulos do seu plano</h2>
          <p className="text-sm text-white/60 mt-1">
            Ative apenas os recursos que sua barbearia utiliza. Módulos bloqueados ficam disponíveis em planos superiores.
          </p>
        </div>
        {plan && (
          <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500/10 border border-amber-500/30">
            <Crown className="w-4 h-4 text-amber-400" />
            <span className="text-sm font-semibold text-amber-300">Plano {plan.name}</span>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="text-white/60 text-center py-10">Carregando módulos...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
          {MODULES.map((mod) => {
            const Icon = mod.icon;
            const allowed = isAllowed(mod.key);
            const enabled = allowed && !!modules[mod.key];
            const required = PLAN_TIER[mod.requiredPlan] ?? 1;
            const isStarterAlwaysOn = allowed && required === 1; // Incluso no plano (Starter base)
            const lockedReason = !allowed ? `Disponível no plano ${PLAN_LABELS[mod.requiredPlan]}` : null;

            return (
              <div
                key={mod.key}
                className={`relative rounded-2xl p-4 sm:p-5 border transition-colors ${
                  !allowed
                    ? "bg-zinc-950/60 border-white/10 opacity-80"
                    : "bg-gradient-to-br from-[#0A1020] to-[#0B1426] border-[rgba(255,184,0,.15)] hover:border-[rgba(255,184,0,.35)]"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`shrink-0 w-11 h-11 rounded-xl flex items-center justify-center border ${
                    allowed
                      ? "bg-gradient-to-br from-amber-500/15 to-transparent border-amber-500/25"
                      : "bg-white/5 border-white/10"
                  }`}>
                    {allowed ? (
                      <Icon className="w-5 h-5 text-amber-400" />
                    ) : (
                      <Lock className="w-5 h-5 text-white/40" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className={`text-sm sm:text-base font-semibold ${allowed ? "text-white" : "text-white/60"}`}>{mod.name}</h3>
                      {lockedReason ? (
                        <span className="text-[10px] px-2 py-0.5 rounded-full border bg-white/5 border-white/15 text-white/60">
                          {lockedReason}
                        </span>
                      ) : isStarterAlwaysOn ? (
                        <span className="text-[10px] px-2 py-0.5 rounded-full border bg-emerald-500/10 border-emerald-500/30 text-emerald-300">
                          Incluso no plano
                        </span>
                      ) : (
                        <span className={`text-[10px] px-2 py-0.5 rounded-full border ${
                          enabled
                            ? "bg-amber-500/10 border-amber-500/30 text-amber-300"
                            : "bg-white/5 border-white/15 text-white/60"
                        }`}>
                          {enabled ? "Ativado" : "Disponível"}
                        </span>
                      )}
                    </div>
                    <p className="text-xs sm:text-sm text-white/60 mt-1 leading-snug">{mod.description}</p>
                  </div>
                  <Switch
                    checked={enabled}
                    disabled={isToggling || !allowed}
                    onCheckedChange={(v) => toggleModule(mod.key, v)}
                    className="h-6 w-11 border-white/20 data-[state=checked]:bg-amber-500 data-[state=unchecked]:bg-white/15 disabled:opacity-50"
                    thumbClassName="h-5 w-5 bg-white shadow-md data-[state=checked]:translate-x-5"
                  />
                </div>

                <div className="mt-3 flex items-center justify-between text-[11px]">
                  <span className={!allowed ? "text-white/30" : enabled ? "text-emerald-400" : "text-white/40"}>
                    {!allowed ? "🔒 Bloqueado" : enabled ? "● Ativo" : "○ Desativado"}
                  </span>
                  {!allowed && (
                    <Button
                      asChild
                      size="sm"
                      className="h-7 text-[11px] bg-amber-500 hover:bg-amber-600 text-black font-bold"
                    >
                      <Link to="/subscription">Fazer Upgrade</Link>
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {plan && currentTier < 3 && (
        <div className="mt-2 p-5 rounded-2xl bg-gradient-to-r from-amber-500/10 to-transparent border border-amber-500/30 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h4 className="text-sm sm:text-base font-bold text-white">Desbloqueie mais recursos</h4>
            <p className="text-xs sm:text-sm text-white/60 mt-1">
              Faça upgrade do seu plano para liberar todos os módulos premium.
            </p>
          </div>
          <Button asChild className="bg-amber-500 hover:bg-amber-600 text-black font-bold">
            <Link to="/subscription">Ver planos</Link>
          </Button>
        </div>
      )}
    </div>
  );
}
