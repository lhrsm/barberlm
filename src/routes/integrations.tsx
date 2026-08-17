import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/layout/AppLayout";
import { useTenant } from "@/hooks/use-tenant";
import { usePlanLimits } from "@/hooks/use-plan-limits";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { 
  Share2, 
  MessageSquare, 
  Mail, 
  Sparkles, 
  Zap, 
  CheckCircle2, 
  AlertCircle, 
  ExternalLink,
  ShieldCheck,
  RefreshCw,
  Settings2,
  Trash2,
  Lock,
  Plus,
  Calendar,
  Camera,
  Send,
  CreditCard,
  Workflow,
  BarChart3,
  Globe,
  Webhook,
  Activity,
  History,
  PlayCircle,
  Loader2
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

import { ZApiWhatsAppCard } from "@/components/integrations/ZApiWhatsAppCard";
import { WebhooksCard } from "@/components/integrations/WebhooksCard";
import { ConfigurableIntegrationCard } from "@/components/integrations/ConfigurableIntegrationCard";
import { ResendSettingsCard } from "@/components/integrations/ResendSettingsCard";
import { withModule } from "@/components/modules/withModule";


export const Route = createFileRoute("/integrations")({
  component: withModule("integrations", "Integrações", IntegrationsComponent),
});

function IntegrationsComponent() {
  const { tenantId } = useTenant();
  const { plan } = usePlanLimits();
  
  const [emailLogs, setEmailLogs] = useState<any[]>([]);
  const [isTestModalOpen, setIsTestModalOpen] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [isTesting, setIsTesting] = useState(false);
  const [aiSettings, setAiSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (tenantId) {
      fetchSettings();
    }
  }, [tenantId]);

  async function fetchSettings() {
    if (!tenantId) return;
    
    try {
      const [logsRes, aiRes] = await Promise.all([
        supabase.from("email_logs" as any).select("*").eq("tenant_id", tenantId).order("created_at", { ascending: false }).limit(5),
        supabase.from("ai_settings").select("*").eq("tenant_id", tenantId).maybeSingle()
      ]);

      if (logsRes.data) setEmailLogs(logsRes.data);
      if (aiRes.data) setAiSettings(aiRes.data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  const handleTestSend = async () => {
    if (!testEmail || !tenantId) return;
    setIsTesting(true);
    
    try {
      const { sendTransactionalEmail } = await import("@/lib/resend.functions");
      await sendTransactionalEmail({
        data: {
          recipient: testEmail,
          templateKey: 'test_email',
          tenantId
        }
      });
      toast.success("E-mail de teste enviado!");
      setIsTestModalOpen(false);
      fetchSettings();
    } catch (error) {
      toast.error("Falha ao enviar teste");
    } finally {
      setIsTesting(false);
    }
  };


  return (
    <AppLayout>
      <div className="min-h-screen bg-[#05070d] text-white -m-4 md:-m-6 lg:-m-8 p-4 md:p-6 lg:p-8">
        <div className="space-y-6">
          {/* Header */}
          <div className="bg-[#0b0f17] border border-zinc-800/80 rounded-2xl p-5 md:p-6 shadow-[0_8px_28px_rgba(16,185,129,0.08)] flex items-center gap-4">
            <div className="shrink-0 h-14 w-14 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-emerald-600/5 border border-emerald-500/30 grid place-items-center shadow-[0_4px_20px_rgba(16,185,129,0.15)]">
              <Share2 className="h-7 w-7 text-emerald-400" />
            </div>
            <div className="min-w-0">
              <h2 className="text-2xl md:text-3xl font-black tracking-tight text-white">Integrações</h2>
              <p className="text-sm text-zinc-400 mt-1">Conecte suas ferramentas favoritas para automatizar seu negócio.</p>
            </div>
          </div>

          <div className="grid gap-4 md:gap-6 grid-cols-1 md:grid-cols-2 pb-10">
            {/* WhatsApp Z-API */}
            {tenantId && <ZApiWhatsAppCard tenantId={tenantId} />}

            {/* Resend E-mail */}
            <Card className="flex flex-col bg-[#0b0f17] border border-zinc-800/80 text-white rounded-2xl overflow-hidden shadow-[0_8px_28px_rgba(16,185,129,0.06)] hover:border-gold/30 transition-all">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div className="h-11 w-11 rounded-xl bg-sky-500/10 border border-sky-500/30 grid place-items-center">
                    <Mail size={20} className="text-sky-400" />
                  </div>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border bg-emerald-500/10 text-emerald-400 border-emerald-500/30">
                    Conectado
                  </span>
                </div>
                <CardTitle className="text-lg mt-4 text-white">Resend Enterprise</CardTitle>
                <CardDescription className="text-zinc-400">Canal oficial de e-mails transacionais (notify.barbex.shop).</CardDescription>
              </CardHeader>
              <CardContent className="flex-1 space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-zinc-500">Domínio</span>
                    <span className="font-bold text-white">notify.barbex.shop</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-zinc-500">Remetente</span>
                    <span className="font-bold text-white">noreply@notify.barbex.shop</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-zinc-500">Status do Provedor</span>
                    <Badge className="bg-emerald-500/10 text-emerald-400 border-none font-bold">Operacional</Badge>
                  </div>
                </div>

                <div className="pt-4 space-y-3">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-zinc-500 flex items-center gap-2">
                    <History size={12} /> Últimos Envios
                  </h4>
                  <div className="space-y-2">
                    {emailLogs.length === 0 ? (
                      <p className="text-xs text-zinc-600 italic">Nenhum envio registrado recentemente.</p>
                    ) : (
                      emailLogs.map((log: any) => (
                        <div key={log.id} className="flex items-center justify-between p-2 rounded-lg bg-black/20 text-[10px]">
                          <span className="text-zinc-400 truncate max-w-[120px]">{log.recipient}</span>
                          <Badge variant="outline" className={cn(
                            "h-5 text-[8px] font-black uppercase border-none",
                            log.status === 'delivered' ? "text-emerald-400 bg-emerald-500/5" : "text-amber-400 bg-amber-500/5"
                          )}>
                            {log.status}
                          </Badge>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </CardContent>
              <CardFooter className="border-t border-zinc-800/80 pt-4 gap-2">
                <Button 
                  onClick={() => setIsTestModalOpen(true)}
                  size="sm" 
                  className="h-8 px-3 text-xs rounded-lg bg-gold text-black font-black uppercase tracking-widest hover:bg-gold/90"
                >
                  <PlayCircle size={14} className="mr-1.5" /> Testar Envio
                </Button>
                <Button 
                  variant="ghost"
                  size="sm" 
                  className="h-8 px-3 text-xs rounded-lg text-zinc-400 hover:text-white"
                  onClick={() => toast.info("Logs detalhados em breve")}
                >
                  <Activity size={14} className="mr-1.5" /> Ver Logs
                </Button>
              </CardFooter>
            </Card>

            {/* Modal de Teste */}
            {isTestModalOpen && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                <div className="w-full max-w-md bg-[#0b0f17] border border-gold/20 rounded-[2rem] p-8 space-y-6">
                  <div className="text-center space-y-2">
                    <Mail className="w-12 h-12 text-gold mx-auto mb-4" />
                    <h3 className="text-xl font-black uppercase italic tracking-tighter text-white">Testar Integração</h3>
                    <p className="text-zinc-400 text-sm">Enviaremos um e-mail de teste para validar a configuração.</p>
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">E-mail Destinatário</Label>
                    <Input 
                      type="email" 
                      value={testEmail} 
                      onChange={(e) => setTestEmail(e.target.value)} 
                      placeholder="seu-email@exemplo.com"
                      className="h-12 rounded-xl bg-[#05070d] border-zinc-800 text-white"
                    />
                  </div>

                  <div className="flex gap-3">
                    <Button 
                      variant="ghost" 
                      onClick={() => setIsTestModalOpen(false)}
                      className="flex-1 h-12 rounded-xl text-zinc-400"
                    >
                      Cancelar
                    </Button>
                    <Button 
                      onClick={handleTestSend}
                      disabled={isTesting || !testEmail}
                      className="flex-1 h-12 rounded-xl bg-gold text-black font-black uppercase tracking-widest"
                    >
                      {isTesting ? <Loader2 className="animate-spin" /> : "Enviar Teste"}
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* OpenAI */}
            <Card className={cn(
              "flex flex-col bg-[#0b0f17] border border-zinc-800/80 text-white rounded-2xl overflow-hidden shadow-[0_8px_28px_rgba(168,85,247,0.06)] transition-all",
              plan === 'elite' ? "hover:border-purple-500/30" : "opacity-80"
            )}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div className="h-11 w-11 rounded-xl bg-purple-500/10 border border-purple-500/30 grid place-items-center">
                    <Sparkles size={20} className="text-purple-400" />
                  </div>
                  {plan !== 'elite' ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border bg-amber-500/10 text-amber-400 border-amber-500/30">
                      <Lock size={10} /> ELITE
                    </span>
                  ) : (
                  <span className={cn(
                      "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border",
                      aiSettings?.id
                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                        : "bg-zinc-500/10 text-zinc-400 border-zinc-500/30"
                    )}>
                      {aiSettings?.id ? "Ativo" : "Pendente"}
                    </span>
                  )}
                </div>
                <CardTitle className="text-lg mt-4 text-white">OpenAI (IA Generativa)</CardTitle>
                <CardDescription className="text-zinc-400">Gere templates e melhore a comunicação com inteligência artificial.</CardDescription>
              </CardHeader>
              <CardContent className="flex-1 space-y-4">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">API Key (OpenAI)</Label>
                  <Input type="password" defaultValue={aiSettings?.api_key} placeholder="sk-..." disabled={plan !== 'elite'} className="h-10 rounded-xl bg-[#05070d] border-zinc-800 text-white placeholder:text-zinc-600 focus-visible:border-purple-500/50 disabled:opacity-50" />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Modelo</Label>
                  <Input defaultValue={aiSettings?.model || 'gpt-4o-mini'} placeholder="gpt-4o-mini" disabled={plan !== 'elite'} className="h-10 rounded-xl bg-[#05070d] border-zinc-800 text-white placeholder:text-zinc-600 focus-visible:border-purple-500/50 disabled:opacity-50" />
                </div>
              </CardContent>
              <CardFooter className="border-t border-zinc-800/80 pt-4 justify-start">
                {plan !== 'elite' ? (
                  <Button size="sm" className="h-8 px-3 text-xs rounded-lg gap-1.5 bg-[#0b0f17] border border-amber-500/40 text-amber-400 hover:bg-amber-500/10 hover:text-amber-300 font-bold" asChild>
                    <a href="/subscription">Upgrade Elite <Zap size={12} className="fill-current" /></a>
                  </Button>
                ) : (
                  <Button size="sm" className="h-8 px-3 text-xs rounded-lg bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-400 hover:to-purple-500 text-white font-bold shadow-[0_4px_16px_rgba(168,85,247,0.3)]">
                    Conectar IA
                  </Button>
                )}

              </CardFooter>
            </Card>

            {/* Webhooks Customizados (ativo) */}
            {tenantId && <WebhooksCard tenantId={tenantId} />}

            {/* Integrações configuráveis */}
            {tenantId && (
              <>
                <ConfigurableIntegrationCard
                  tenantId={tenantId}
                  provider="google_calendar"
                  title="Google Calendar"
                  description="Sincronize automaticamente os agendamentos com a agenda Google dos profissionais."
                  icon={<Calendar size={20} className="text-blue-400" />}
                  iconBg="bg-blue-500/10 border-blue-500/30"
                  accentColor="blue"
                  docsUrl="https://console.cloud.google.com/apis/credentials"
                  fields={[
                    { key: "client_id", label: "Client ID", placeholder: "xxxxxxxx.apps.googleusercontent.com", required: true },
                    { key: "client_secret", label: "Client Secret", placeholder: "GOCSPX-...", type: "password", required: true },
                    { key: "calendar_id", label: "Calendar ID", placeholder: "primary", helper: "Use 'primary' para a agenda principal." },
                  ]}
                />

                <ConfigurableIntegrationCard
                  tenantId={tenantId}
                  provider="instagram"
                  title="Instagram"
                  description="Receba mensagens diretas do Instagram dentro do seu inbox da Barbex."
                  icon={<Camera size={20} className="text-pink-400" />}
                  iconBg="bg-pink-500/10 border-pink-500/30"
                  accentColor="pink"
                  docsUrl="https://developers.facebook.com/apps/"
                  fields={[
                    { key: "page_id", label: "Page ID", placeholder: "Ex: 17841400000000000", required: true },
                    { key: "access_token", label: "Access Token", placeholder: "EAAG...", type: "password", required: true },
                  ]}
                />

                <ConfigurableIntegrationCard
                  tenantId={tenantId}
                  provider="telegram"
                  title="Telegram Bot"
                  description="Notifique clientes e profissionais via Telegram de forma instantânea."
                  icon={<Send size={20} className="text-cyan-400" />}
                  iconBg="bg-cyan-500/10 border-cyan-500/30"
                  accentColor="cyan"
                  docsUrl="https://core.telegram.org/bots#how-do-i-create-a-bot"
                  fields={[
                    { key: "bot_token", label: "Bot Token", placeholder: "123456:ABC-...", type: "password", required: true, helper: "Crie um bot com o @BotFather no Telegram." },
                    { key: "chat_id", label: "Chat ID (opcional)", placeholder: "-1001234567890" },
                  ]}
                />

                <ConfigurableIntegrationCard
                  tenantId={tenantId}
                  provider="mercado_pago"
                  title="Mercado Pago"
                  description="Aceite pagamentos online, Pix e cartão direto no checkout do agendamento."
                  icon={<CreditCard size={20} className="text-amber-400" />}
                  iconBg="bg-amber-500/10 border-amber-500/30"
                  accentColor="amber"
                  docsUrl="https://www.mercadopago.com.br/developers/panel/app"
                  fields={[
                    { key: "public_key", label: "Public Key", placeholder: "APP_USR-...", required: true },
                    { key: "access_token", label: "Access Token", placeholder: "APP_USR-...", type: "password", required: true },
                  ]}
                />

                <ConfigurableIntegrationCard
                  tenantId={tenantId}
                  provider="n8n_make"
                  title="n8n / Make"
                  description="Automatize fluxos avançados conectando a Barbex a milhares de apps."
                  icon={<Workflow size={20} className="text-orange-400" />}
                  iconBg="bg-orange-500/10 border-orange-500/30"
                  accentColor="orange"
                  fields={[
                    { key: "webhook_url", label: "Webhook URL", placeholder: "https://hook.n8n.cloud/...", type: "url", required: true },
                    { key: "auth_header", label: "Header de Autenticação (opcional)", placeholder: "Bearer xxx", type: "password" },
                  ]}
                />

                <ConfigurableIntegrationCard
                  tenantId={tenantId}
                  provider="ga4"
                  title="Google Analytics 4"
                  description="Acompanhe métricas de tráfego e conversões da sua página pública de agendamento."
                  icon={<BarChart3 size={20} className="text-rose-400" />}
                  iconBg="bg-rose-500/10 border-rose-500/30"
                  accentColor="rose"
                  docsUrl="https://analytics.google.com/"
                  fields={[
                    { key: "measurement_id", label: "Measurement ID", placeholder: "G-XXXXXXXXXX", required: true },
                    { key: "api_secret", label: "API Secret (opcional)", placeholder: "xxxxxxxx", type: "password" },
                  ]}
                />

                <ConfigurableIntegrationCard
                  tenantId={tenantId}
                  provider="meta_pixel"
                  title="Meta Pixel"
                  description="Rastreie conversões de campanhas no Facebook e Instagram Ads."
                  icon={<Globe size={20} className="text-indigo-400" />}
                  iconBg="bg-indigo-500/10 border-indigo-500/30"
                  accentColor="indigo"
                  docsUrl="https://business.facebook.com/events_manager2"
                  fields={[
                    { key: "pixel_id", label: "Pixel ID", placeholder: "1234567890", required: true },
                    { key: "access_token", label: "Conversions API Token (opcional)", placeholder: "EAAG...", type: "password" },
                  ]}
                />
              </>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

export default IntegrationsComponent;
