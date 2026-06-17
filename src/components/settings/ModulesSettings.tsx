import { useModules, type ModuleKey } from "@/hooks/use-modules";
import { Switch } from "@/components/ui/switch";
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
  type LucideIcon,
} from "lucide-react";

interface ModuleDef {
  key: ModuleKey;
  name: string;
  description: string;
  icon: LucideIcon;
  badge?: "Recomendado" | "Opcional";
}

const MODULES: ModuleDef[] = [
  { key: "products", name: "Loja / Produtos", description: "Venda produtos como pomadas, shampoos e acessórios.", icon: ShoppingBag, badge: "Opcional" },
  { key: "subscriptions", name: "Assinaturas", description: "Crie planos recorrentes para seus clientes.", icon: CreditCard, badge: "Recomendado" },
  { key: "loyalty", name: "Fidelidade", description: "Programa de pontos por atendimentos realizados.", icon: Gift, badge: "Recomendado" },
  { key: "cashback", name: "Cashback", description: "Devolva uma porcentagem em créditos para o cliente.", icon: Coins, badge: "Opcional" },
  { key: "campaigns", name: "Campanhas", description: "Envie campanhas promocionais para seus clientes.", icon: Megaphone, badge: "Opcional" },
  { key: "automations", name: "Automações", description: "Mensagens automáticas de confirmação, lembrete e retorno.", icon: MessageSquare, badge: "Recomendado" },
  { key: "commissions", name: "Comissões", description: "Calcule comissões dos barbeiros automaticamente.", icon: CircleDollarSign, badge: "Recomendado" },
  { key: "tutorials", name: "Tutoriais", description: "Acesso a vídeos e materiais de apoio.", icon: GraduationCap, badge: "Opcional" },
  { key: "integrations", name: "Integrações", description: "Conecte com WhatsApp, Z-API, Stripe e outros.", icon: Share2, badge: "Opcional" },
  { key: "support", name: "Suporte", description: "Abrir chamados e receber ajuda da equipe Barbex.", icon: Headset, badge: "Recomendado" },
  { key: "coupons", name: "Cupons", description: "Crie cupons de desconto para campanhas.", icon: Ticket, badge: "Opcional" },
  { key: "whatsapp", name: "WhatsApp", description: "Configure o número de WhatsApp da barbearia.", icon: Phone, badge: "Recomendado" },
  { key: "pix_key", name: "Chave PIX", description: "Cadastre uma chave PIX para receber pagamentos.", icon: KeyRound, badge: "Opcional" },
];

export function ModulesSettings() {
  const { modules, toggleModule, isToggling, isLoading } = useModules();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl sm:text-2xl font-bold text-white">Módulos</h2>
        <p className="text-sm text-white/60 mt-1">Ative apenas os recursos que sua barbearia utiliza.</p>
      </div>

      {isLoading ? (
        <div className="text-white/60 text-center py-10">Carregando módulos...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
          {MODULES.map((mod) => {
            const Icon = mod.icon;
            const enabled = !!modules[mod.key];
            return (
              <div
                key={mod.key}
                className="relative bg-gradient-to-br from-[#0A1020] to-[#0B1426] border border-[rgba(255,184,0,.15)] rounded-2xl p-4 sm:p-5 hover:border-[rgba(255,184,0,.35)] transition-colors"
              >
                <div className="flex items-start gap-3">
                  <div className="shrink-0 w-11 h-11 rounded-xl bg-gradient-to-br from-amber-500/15 to-transparent border border-amber-500/25 flex items-center justify-center">
                    <Icon className="w-5 h-5 text-amber-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm sm:text-base font-semibold text-white">{mod.name}</h3>
                      {mod.badge && (
                        <span className={`text-[10px] px-2 py-0.5 rounded-full border ${
                          mod.badge === "Recomendado"
                            ? "bg-amber-500/10 border-amber-500/30 text-amber-300"
                            : "bg-white/5 border-white/15 text-white/60"
                        }`}>{mod.badge}</span>
                      )}
                    </div>
                    <p className="text-xs sm:text-sm text-white/60 mt-1 leading-snug">{mod.description}</p>
                  </div>
                  <Switch
                    checked={enabled}
                    disabled={isToggling}
                    onCheckedChange={(v) => toggleModule(mod.key, v)}
                    className="data-[state=checked]:bg-amber-500"
                  />
                </div>
                <div className="mt-3 flex items-center justify-between text-[11px]">
                  <span className={enabled ? "text-emerald-400" : "text-white/40"}>
                    {enabled ? "● Ativo" : "○ Desativado"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4 text-xs sm:text-sm text-amber-200/80">
        💡 Dicas: Se ativar <strong>Assinaturas</strong>, considere ativar também <strong>Comissões</strong>. Para <strong>Automações</strong> e <strong>Campanhas</strong>, é recomendado ativar o <strong>WhatsApp</strong>.
      </div>
    </div>
  );
}
