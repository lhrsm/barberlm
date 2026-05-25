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
  Plus
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

import { ZApiWhatsAppCard } from "@/components/integrations/ZApiWhatsAppCard";

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
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Integrações</h2>
          <p className="text-muted-foreground">Conecte suas ferramentas favoritas para automatizar seu negócio.</p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* WhatsApp Evolution API */}
          {tenantId && <ZApiWhatsAppCard tenantId={tenantId} />}


          {/* Resend E-mail */}
          <Card className="flex flex-col bg-white border-2 border-slate-200 text-black shadow-sm">
            <CardHeader>
              <div className="flex justify-between items-start">
                <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
                  <Mail size={24} />
                </div>
                <Badge variant={email?.id ? "default" : "secondary"} className={email?.id ? "bg-blue-500" : ""}>
                  {email?.id ? "Configurado" : "Pendente"}
                </Badge>
              </div>
              <CardTitle className="text-xl mt-4">E-mail (Resend)</CardTitle>
              <CardDescription>Envie e-mails profissionais com seu próprio domínio.</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 space-y-4">
              <form id="email-form" onSubmit={saveEmail} className="space-y-4">
                <div className="space-y-2">
                  <Label>API Key (Resend)</Label>
                  <Input name="api_key" type="password" defaultValue={email?.api_key} placeholder="re_..." required />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>E-mail do Remetente</Label>
                    <Input name="sender_email" defaultValue={email?.sender_email} placeholder="contato@seudominio.com" required />
                  </div>
                  <div className="space-y-2">
                    <Label>Nome do Remetente</Label>
                    <Input name="sender_name" defaultValue={email?.sender_name} placeholder="Barbearia X" required />
                  </div>
                </div>
              </form>
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 flex gap-3">
                <ShieldCheck className="text-blue-600 shrink-0" size={20} />
                <p className="text-[10px] text-blue-700">Certifique-se de configurar o DNS no painel do Resend para garantir a entrega dos e-mails.</p>
              </div>
            </CardContent>
            <CardFooter className="border-t pt-4">
              <Button form="email-form" className="w-full">Salvar Configurações</Button>
            </CardFooter>
          </Card>

          {/* OpenAI */}
          <Card className={cn(
            "flex flex-col bg-white border-2 border-slate-200 text-black shadow-sm",
            plan !== 'elite' && "opacity-75 grayscale-[0.5]"
          )}>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div className="p-2 bg-purple-50 rounded-lg text-purple-600">
                  <Sparkles size={24} />
                </div>
                {plan !== 'elite' ? (
                  <Badge variant="secondary" className="gap-1">
                    <Lock size={10} /> ELITE
                  </Badge>
                ) : (
                  <Badge variant={ai?.id ? "default" : "secondary"} className={ai?.id ? "bg-purple-500" : ""}>
                    {ai?.id ? "Ativo" : "Pendente"}
                  </Badge>
                )}
              </div>
              <CardTitle className="text-xl mt-4">OpenAI (IA Generativa)</CardTitle>
              <CardDescription>Gere templates e melhore a comunicação com inteligência artificial.</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 space-y-4">
              <div className="space-y-2">
                <Label>API Key (OpenAI)</Label>
                <Input type="password" defaultValue={ai?.api_key} placeholder="sk-..." disabled={plan !== 'elite'} />
              </div>
              <div className="space-y-2">
                <Label>Modelo</Label>
                <Input defaultValue={ai?.model || 'gpt-4o-mini'} placeholder="gpt-4o-mini" disabled={plan !== 'elite'} />
              </div>
            </CardContent>
            <CardFooter className="border-t pt-4">
              {plan !== 'elite' ? (
                <Button className="w-full gap-2" variant="outline" asChild>
                  <a href="/subscription">Fazer Upgrade para Elite <Zap size={14} className="fill-current" /></a>
                </Button>
              ) : (
                <Button className="w-full">Conectar IA</Button>
              )}
            </CardFooter>
          </Card>

          {/* Webhooks (Future) */}
          <Card className="flex flex-col opacity-50 border-dashed">
            <CardHeader>
              <div className="p-2 bg-gray-50 rounded-lg text-gray-600 w-fit">
                <Zap size={24} />
              </div>
              <CardTitle className="text-xl mt-4">Webhooks Customizados</CardTitle>
              <CardDescription>Em breve: Envie dados para outras ferramentas via Zapier, Make, etc.</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 flex items-center justify-center">
              <Button variant="ghost" disabled className="gap-2">
                <Plus size={18} /> Adicionar Webhook
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}

export default IntegrationsComponent;
