import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { 
  Settings, 
  Globe, 
  CreditCard, 
  Shield, 
  Share2, 
  Save, 
  Upload,
  Power,
  Lock,
  History,
  Info,
  ExternalLink,
  Smartphone,
  Webhook,
  AlertCircle
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/settings")({
  component: AdminSettings,
});

function AdminSettings() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("geral");

  const { data: settings, isLoading, error: queryError } = useQuery({
    queryKey: ["admin-system-settings"],
    queryFn: async () => {
      console.log("Fetching system settings...");
      const { data, error } = await supabase
        .from("system_settings")
        .select("*")
        .maybeSingle(); // Usar maybeSingle para evitar erro se não existir
      
      if (error) {
        console.error("Supabase error fetching settings:", error);
        throw error;
      }
      return data;
    }
  });

  const [formData, setFormData] = useState<any>(null);

  useEffect(() => {
    if (settings) {
      setFormData(settings);
    }
  }, [settings]);

  const updateMutation = useMutation({
    mutationFn: async (newData: any) => {
      if (!settings?.id) throw new Error("ID de configurações não encontrado");
      const { error } = await supabase
        .from("system_settings")
        .update(newData)
        .eq("id", settings.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-system-settings"] });
      toast.success("Configurações atualizadas com sucesso!");
    },
    onError: (error) => {
      toast.error("Erro ao salvar configurações: " + error.message);
    }
  });

  if (isLoading) {
    return (
      <div className="p-20 flex flex-col items-center justify-center gap-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
        <p className="text-gray-500 font-black italic uppercase tracking-widest">Acessando Nucleo do Sistema...</p>
      </div>
    );
  }

  if (queryError || (!settings && !isLoading)) {
    return (
      <div className="p-20 text-center space-y-4">
        <AlertCircle className="w-12 h-12 text-rose-500 mx-auto" />
        <h3 className="text-xl font-bold text-white uppercase italic">Erro de Conexão</h3>
        <p className="text-gray-400">Não foi possível carregar as configurações do banco.</p>
        <Button 
          onClick={() => queryClient.invalidateQueries({ queryKey: ["admin-system-settings"] })}
          className="bg-white/5 border border-white/10"
        >
          Tentar Novamente
        </Button>
      </div>
    );
  }

  if (!formData) return null;

  const handleSave = () => {
    updateMutation.mutate(formData);
  };

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-4xl font-black tracking-tight text-white italic uppercase">{formData?.saas_name || "Configurações de SaaS"}</h2>
          <p className="text-gray-400 font-medium text-lg">{formData?.main_url || "Gerenciamento global de infraestrutura e segurança."}</p>
        </div>
        <Button 
          onClick={handleSave} 
          disabled={updateMutation.isPending}
          className="h-12 px-8 rounded-2xl bg-gradient-to-r from-purple-600 to-pink-600 text-white gap-2 font-bold uppercase tracking-wider text-xs italic shadow-[0_0_20px_rgba(168,85,247,0.4)] transition-all hover:scale-105 active:scale-95"
        >
          <Save className="w-4 h-4" />
          {updateMutation.isPending ? "Salvando..." : "Salvar Alterações"}
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-8">
        <TabsList className="bg-white/5 border border-white/10 p-1 rounded-2xl h-auto flex flex-wrap gap-1">
          {[
            { id: "geral", label: "Geral", icon: Globe },
            { id: "faturamento", label: "Faturamento", icon: CreditCard },
            { id: "seguranca", label: "Segurança", icon: Shield },
            { id: "integracoes", label: "Integrações", icon: Share2 },
          ].map((tab) => (
            <TabsTrigger 
              key={tab.id} 
              value={tab.id}
              className={cn(
                "flex-1 md:flex-none px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest gap-2 transition-all data-[state=active]:bg-purple-600 data-[state=active]:text-white data-[state=inactive]:text-gray-500 data-[state=inactive]:hover:bg-white/5",
              )}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="geral" className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <Card className="glass border-white/5 rounded-[2.5rem] p-8">
              <CardHeader className="p-0 mb-8">
                <CardTitle className="text-xl font-bold text-white italic tracking-tight uppercase flex items-center gap-2">
                  <Info className="text-purple-400 w-5 h-5" />
                  Identidade Visual & Info
                </CardTitle>
              </CardHeader>
              <div className="space-y-6">
                <div className="space-y-2">
                  <Label className="text-gray-400 text-[10px] uppercase font-bold tracking-widest px-1">Nome do SaaS</Label>
                  <Input 
                    value={formData.saas_name}
                    onChange={(e) => setFormData({...formData, saas_name: e.target.value})}
                    className="h-12 bg-white/5 border-white/10 rounded-xl focus:ring-purple-500/50"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-gray-400 text-[10px] uppercase font-bold tracking-widest px-1">URL Principal</Label>
                  <Input 
                    value={formData.main_url}
                    onChange={(e) => setFormData({...formData, main_url: e.target.value})}
                    className="h-12 bg-white/5 border-white/10 rounded-xl"
                  />
                </div>
                <div className="space-y-4">
                  <Label className="text-gray-400 text-[10px] uppercase font-bold tracking-widest px-1">Logo do SaaS</Label>
                  <div className="flex flex-col gap-4">
                    {formData.saas_logo && (
                      <div className="w-32 h-32 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center p-4">
                        <img src={formData.saas_logo} alt="Logo preview" className="max-w-full max-h-full object-contain" />
                      </div>
                    )}
                    <div className="flex gap-4">
                      <Input 
                        type="file"
                        accept="image/*"
                        className="hidden"
                        id="logo-upload"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          
                          const fileExt = file.name.split('.').pop();
                          const filePath = `saas-logo-${Math.random()}.${fileExt}`;
                          
                          toast.promise(
                            (async () => {
                              const { data, error } = await supabase.storage
                                .from('system-assets')
                                .upload(filePath, file);
                              
                              if (error) throw error;
                              
                              const { data: { publicUrl } } = supabase.storage
                                .from('system-assets')
                                .getPublicUrl(filePath);
                                
                              setFormData({ ...formData, saas_logo: publicUrl });
                              return publicUrl;
                            })(),
                            {
                              loading: 'Enviando logo...',
                              success: 'Logo enviada com sucesso!',
                              error: (err) => `Erro ao enviar: ${err.message}`
                            }
                          );
                        }}
                      />
                      <Button 
                        asChild
                        variant="outline" 
                        className="h-12 flex-1 rounded-xl bg-white/5 border-white/10 gap-2 font-bold uppercase tracking-widest text-[10px]"
                      >
                        <label htmlFor="logo-upload" className="cursor-pointer">
                          <Upload size={18} />
                          {formData.saas_logo ? "Alterar Logo" : "Upload Logo"}
                        </label>
                      </Button>
                      {formData.saas_logo && (
                        <Button 
                          variant="ghost" 
                          onClick={() => setFormData({...formData, saas_logo: null})}
                          className="h-12 px-4 rounded-xl text-rose-500 hover:bg-rose-500/10"
                        >
                          Remover
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </Card>

            <Card className="glass border-white/5 rounded-[2.5rem] p-8 border-rose-500/10">
              <CardHeader className="p-0 mb-8">
                <CardTitle className="text-xl font-bold text-rose-400 italic tracking-tight uppercase flex items-center gap-2">
                  <Power className="w-5 h-5" />
                  Estado do Sistema
                </CardTitle>
              </CardHeader>
              <div className="space-y-8">
                <div className="flex items-center justify-between p-6 rounded-3xl bg-rose-500/5 border border-rose-500/10">
                  <div className="space-y-1">
                    <p className="text-white font-bold uppercase tracking-tight text-sm">Manutenção Global</p>
                    <p className="text-xs text-gray-500 leading-relaxed max-w-[280px]">Ative para bloquear o acesso de todos os usuários enquanto realiza atualizações críticas.</p>
                  </div>
                  <Switch 
                    checked={formData.maintenance_mode}
                    onCheckedChange={(val) => setFormData({...formData, maintenance_mode: val})}
                    className="data-[state=checked]:bg-rose-500"
                  />
                </div>
                
                <div className="p-6 rounded-3xl bg-amber-500/5 border border-amber-500/10 space-y-4">
                  <p className="text-amber-400 text-[10px] uppercase font-black tracking-widest">Aviso Importante</p>
                  <p className="text-xs text-gray-400 leading-relaxed">
                    A URL principal define o domínio de redirecionamento para checkouts e e-mails transacionais. Certifique-se de que o SSL está ativo no domínio configurado.
                  </p>
                </div>
              </div>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="faturamento" className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <Card className="glass border-white/5 rounded-[2.5rem] p-8 max-w-3xl">
            <CardHeader className="p-0 mb-8">
              <CardTitle className="text-xl font-bold text-white italic tracking-tight uppercase flex items-center gap-2">
                <Webhook className="text-blue-400 w-5 h-5" />
                Configurações Stripe
              </CardTitle>
              <CardDescription className="text-gray-400">Credenciais para processamento de pagamentos reais.</CardDescription>
            </CardHeader>
            <div className="space-y-8">
              <div className="space-y-2">
                <Label className="text-gray-400 text-[10px] uppercase font-bold tracking-widest px-1">Stripe Secret Key</Label>
                <div className="relative">
                  <Input 
                    type="password"
                    value={formData.stripe_secret_key || ""}
                    onChange={(e) => setFormData({...formData, stripe_secret_key: e.target.value})}
                    className="h-12 bg-white/5 border-white/10 rounded-xl pr-12"
                    placeholder="sk_live_..."
                  />
                  <Lock className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-gray-400 text-[10px] uppercase font-bold tracking-widest px-1">Stripe Webhook Secret</Label>
                <div className="relative">
                  <Input 
                    type="password"
                    value={formData.stripe_webhook_secret || ""}
                    onChange={(e) => setFormData({...formData, stripe_webhook_secret: e.target.value})}
                    className="h-12 bg-white/5 border-white/10 rounded-xl pr-12"
                    placeholder="whsec_..."
                  />
                  <Webhook className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" />
                </div>
              </div>
              <div className="p-4 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex gap-3">
                <Info className="text-blue-400 w-5 h-5 shrink-0" />
                <p className="text-xs text-blue-200/60 font-medium">
                  Use estas chaves para integrar seu SaaS diretamente com o gateway. Nunca compartilhe estas credenciais fora do painel administrativo.
                </p>
              </div>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="seguranca" className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <Card className="glass border-white/5 rounded-[2.5rem] p-8">
              <CardHeader className="p-0 mb-8">
                <CardTitle className="text-xl font-bold text-white italic tracking-tight uppercase flex items-center gap-2">
                  <Smartphone className="text-purple-400 w-5 h-5" />
                  Acesso & Autenticação
                </CardTitle>
              </CardHeader>
              <div className="space-y-6">
                <div className="flex items-center justify-between p-5 rounded-2xl bg-white/5 border border-white/5">
                  <div className="space-y-0.5">
                    <p className="text-white font-bold text-sm uppercase italic">2FA Administrativo</p>
                    <p className="text-xs text-gray-500">Exigir código via App para logins Super Admin.</p>
                  </div>
                  <Switch 
                    checked={formData.two_factor_auth_enabled}
                    onCheckedChange={(val) => setFormData({...formData, two_factor_auth_enabled: val})}
                    className="data-[state=checked]:bg-purple-600"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-gray-400 text-[10px] uppercase font-bold tracking-widest px-1">Restrição de Acesso</Label>
                  <select 
                    className="w-full h-12 bg-white/5 border-white/10 rounded-xl px-4 text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                    value={formData.admin_access_level}
                    onChange={(e) => setFormData({...formData, admin_access_level: e.target.value})}
                  >
                    <option value="restricted" className="bg-gray-900">Apenas IPs Autorizados</option>
                    <option value="open" className="bg-gray-900">Qualquer Localidade</option>
                    <option value="internal" className="bg-gray-900">Rede Interna (VPN)</option>
                  </select>
                </div>
              </div>
            </Card>

            <Card className="glass border-white/5 rounded-[2.5rem] p-8">
              <CardHeader className="p-0 mb-8">
                <CardTitle className="text-xl font-bold text-white italic tracking-tight uppercase flex items-center gap-2">
                  <History className="text-blue-400 w-5 h-5" />
                  Auditoria & Compliance
                </CardTitle>
              </CardHeader>
              <div className="space-y-6">
                <div className="flex items-center justify-between p-5 rounded-2xl bg-white/5 border border-white/5">
                  <div className="space-y-0.5">
                    <p className="text-white font-bold text-sm uppercase italic">Logs de Atividade</p>
                    <p className="text-xs text-gray-500">Registrar todas as ações de Super Admins no banco.</p>
                  </div>
                  <Switch 
                    checked={formData.audit_logs_enabled}
                    onCheckedChange={(val) => setFormData({...formData, audit_logs_enabled: val})}
                    className="data-[state=checked]:bg-blue-600"
                  />
                </div>
                <Button variant="outline" className="w-full h-12 rounded-xl border-white/10 bg-white/5 gap-2 text-xs font-bold uppercase tracking-widest">
                  <ExternalLink size={14} /> Exportar Relatório de Auditoria
                </Button>
              </div>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="integracoes" className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { name: "WhatsApp (Z-API)", status: "Conectado", icon: "https://cdn-icons-png.flaticon.com/512/733/733585.png", color: "text-emerald-400" },
              { name: "E-mail (Resend)", status: "Ativo", icon: "https://avatars.githubusercontent.com/u/104191638?s=200&v=4", color: "text-white" },
              { name: "OpenAI (IA)", status: "Configurado", icon: "https://openai.com/favicon.ico", color: "text-purple-400" },
              { name: "Google Analytics", status: "Inativo", icon: "https://www.gstatic.com/analytics-suite/header/suite/v2/ic_analytics.svg", color: "text-gray-500" },
            ].map((integ, i) => (
              <Card key={i} className="glass border-white/5 rounded-3xl p-6 group hover:border-white/10 transition-all">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center p-2 group-hover:scale-110 transition-transform">
                    <img src={integ.icon} alt={integ.name} className="w-full h-full object-contain" />
                  </div>
                  <div>
                    <h4 className="font-bold text-white text-sm uppercase tracking-tighter">{integ.name}</h4>
                    <span className={cn("text-[10px] font-black uppercase tracking-widest", integ.color)}>{integ.status}</span>
                  </div>
                </div>
                <Button variant="ghost" className="w-full rounded-xl bg-white/5 text-[10px] font-bold uppercase tracking-widest border border-white/5 group-hover:border-purple-500/30">
                  Gerenciar Conexão
                </Button>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
