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
  Instagram,
  Send,
  CreditCard,
  Workflow,
  BarChart3,
  Facebook,
  Webhook,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

import { ZApiWhatsAppCard } from "@/components/integrations/ZApiWhatsAppCard";
import { WebhooksCard } from "@/components/integrations/WebhooksCard";


export const Route = createFileRoute("/integrations")({
  component: IntegrationsComponent,
});

function IntegrationsComponent() {
  const { tenantId } = useTenant();
  const { plan } = usePlanLimits();
  
  const [email, setEmail] = useState<any>(null);
  const [ai, setAi] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (tenantId) {
      fetchSettings();
    }
  }, [tenantId]);

  async function fetchSettings() {
    if (!tenantId) return;
    
    try {
      const [emailRes, aiRes] = await Promise.all([
        supabase.from("email_settings").select("*").eq("tenant_id", tenantId).maybeSingle(),
        supabase.from("ai_settings").select("*").eq("tenant_id", tenantId).maybeSingle()
      ]);

      if (emailRes.data) setEmail(emailRes.data);
      if (aiRes.data) setAi(aiRes.data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  const saveEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantId) return;
    
    const formData = new FormData(e.currentTarget as HTMLFormElement);
    const data = {
      tenant_id: tenantId,
      api_key: formData.get('api_key') as string,
      sender_email: formData.get('sender_email') as string,
      sender_name: formData.get('sender_name') as string,
    };

    const { error } = email?.id 
      ? await supabase.from("email_settings").update(data).eq("id", email.id)
      : await supabase.from("email_settings").insert(data);

    if (error) toast.error("Erro ao salvar E-mail");
    else {
      toast.success("E-mail configurado!");
      fetchSettings();
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
            <Card className="flex flex-col bg-[#0b0f17] border border-zinc-800/80 text-white rounded-2xl overflow-hidden shadow-[0_8px_28px_rgba(16,185,129,0.06)] hover:border-emerald-500/30 transition-all">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div className="h-11 w-11 rounded-xl bg-sky-500/10 border border-sky-500/30 grid place-items-center">
                    <Mail size={20} className="text-sky-400" />
                  </div>
                  <span className={cn(
                    "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border",
                    email?.id
                      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                      : "bg-zinc-500/10 text-zinc-400 border-zinc-500/30"
                  )}>
                    {email?.id ? "Configurado" : "Pendente"}
                  </span>
                </div>
                <CardTitle className="text-lg mt-4 text-white">E-mail (Resend)</CardTitle>
                <CardDescription className="text-zinc-400">Envie e-mails profissionais com seu próprio domínio.</CardDescription>
              </CardHeader>
              <CardContent className="flex-1 space-y-4">
                <form id="email-form" onSubmit={saveEmail} className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">API Key (Resend)</Label>
                    <Input name="api_key" type="password" defaultValue={email?.api_key} placeholder="re_..." required className="h-10 rounded-xl bg-[#05070d] border-zinc-800 text-white placeholder:text-zinc-600 focus-visible:border-emerald-500/50" />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">E-mail Remetente</Label>
                      <Input name="sender_email" defaultValue={email?.sender_email} placeholder="contato@seudominio.com" required className="h-10 rounded-xl bg-[#05070d] border-zinc-800 text-white placeholder:text-zinc-600 focus-visible:border-emerald-500/50" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Nome Remetente</Label>
                      <Input name="sender_name" defaultValue={email?.sender_name} placeholder="Barbearia X" required className="h-10 rounded-xl bg-[#05070d] border-zinc-800 text-white placeholder:text-zinc-600 focus-visible:border-emerald-500/50" />
                    </div>
                  </div>
                </form>
                <div className="bg-sky-500/5 p-3 rounded-xl border border-sky-500/20 flex gap-2.5">
                  <ShieldCheck className="text-sky-400 shrink-0 mt-0.5" size={16} />
                  <p className="text-[11px] text-sky-300/80 leading-relaxed">Certifique-se de configurar o DNS no painel do Resend para garantir a entrega dos e-mails.</p>
                </div>
              </CardContent>
              <CardFooter className="border-t border-zinc-800/80 pt-4">
                <Button form="email-form" className="w-full bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white font-bold shadow-[0_4px_16px_rgba(16,185,129,0.3)]">
                  Salvar Configurações
                </Button>
              </CardFooter>
            </Card>

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
                      ai?.id
                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                        : "bg-zinc-500/10 text-zinc-400 border-zinc-500/30"
                    )}>
                      {ai?.id ? "Ativo" : "Pendente"}
                    </span>
                  )}
                </div>
                <CardTitle className="text-lg mt-4 text-white">OpenAI (IA Generativa)</CardTitle>
                <CardDescription className="text-zinc-400">Gere templates e melhore a comunicação com inteligência artificial.</CardDescription>
              </CardHeader>
              <CardContent className="flex-1 space-y-4">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">API Key (OpenAI)</Label>
                  <Input type="password" defaultValue={ai?.api_key} placeholder="sk-..." disabled={plan !== 'elite'} className="h-10 rounded-xl bg-[#05070d] border-zinc-800 text-white placeholder:text-zinc-600 focus-visible:border-purple-500/50 disabled:opacity-50" />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Modelo</Label>
                  <Input defaultValue={ai?.model || 'gpt-4o-mini'} placeholder="gpt-4o-mini" disabled={plan !== 'elite'} className="h-10 rounded-xl bg-[#05070d] border-zinc-800 text-white placeholder:text-zinc-600 focus-visible:border-purple-500/50 disabled:opacity-50" />
                </div>
              </CardContent>
              <CardFooter className="border-t border-zinc-800/80 pt-4">
                {plan !== 'elite' ? (
                  <Button className="w-full gap-2 bg-[#0b0f17] border border-amber-500/40 text-amber-400 hover:bg-amber-500/10 hover:text-amber-300 font-bold" asChild>
                    <a href="/subscription">Fazer Upgrade para Elite <Zap size={14} className="fill-current" /></a>
                  </Button>
                ) : (
                  <Button className="w-full bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-400 hover:to-purple-500 text-white font-bold shadow-[0_4px_16px_rgba(168,85,247,0.3)]">
                    Conectar IA
                  </Button>
                )}
              </CardFooter>
            </Card>

            {/* Webhooks (Future) */}
            <Card className="flex flex-col bg-[#0b0f17] border border-dashed border-zinc-700/60 text-white rounded-2xl overflow-hidden">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div className="h-11 w-11 rounded-xl bg-zinc-800/50 border border-zinc-700/50 grid place-items-center">
                    <Zap size={20} className="text-zinc-500" />
                  </div>
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border bg-zinc-500/10 text-zinc-400 border-zinc-500/30">
                    Em breve
                  </span>
                </div>
                <CardTitle className="text-lg mt-4 text-white">Webhooks Customizados</CardTitle>
                <CardDescription className="text-zinc-400">Envie dados para outras ferramentas via Zapier, Make, etc.</CardDescription>
              </CardHeader>
              <CardContent className="flex-1 flex items-center justify-center pb-6">
                <Button variant="ghost" disabled className="gap-2 text-zinc-500">
                  <Plus size={18} /> Adicionar Webhook
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

export default IntegrationsComponent;
