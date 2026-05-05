import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/hooks/use-auth";
import { usePlanLimits } from "@/hooks/use-plan-limits";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { 
  MessageSquare, 
  CreditCard, 
  Palette, 
  Globe, 
  Save, 
  Plus, 
  Trash2, 
  QrCode, 
  Lock,
  CheckCircle2,
  RefreshCw,
  Calendar,
  Gift,
  Upload
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export const Route = createFileRoute("/settings")({
  component: SettingsComponent,
});

function SettingsComponent() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { plan, limits, usage, checkLimit, refresh: refreshLimits } = usePlanLimits();
  const [saving, setSaving] = useState(false);
  const [whatsappInstances, setWhatsappInstances] = useState<any[]>([]);
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [newInstanceName, setNewInstanceName] = useState("");
  const [connectionType, setConnectionType] = useState<"qrcode" | "api_key">("qrcode");
  const [apiUrl, setApiUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [connectingInstance, setConnectingInstance] = useState<string | null>(null);
  const [qrValue, setQrValue] = useState("");
  const [isSyncing, setIsSyncing] = useState(false);

  const [formData, setFormData] = useState({
    business_name: "",
    slug: "",
    whatsapp_enabled: false,
    scheduling_mode: "automatic" as "manual" | "automatic",
    payment_gateway_provider: "none",
    payment_gateway_key: "",
    primary_color: "#7c3aed",
    secondary_color: "#f4f4f5",
    logo_url: "",
    cashback_enabled: false,
    cashback_percentage: 0,
    free_service_threshold: 10,
    address: "",
    google_maps_url: "",
    font_family: "Inter",
    font_size: "16px",
    font_color: "#000000",
  });

  useEffect(() => {
    if (!loading && !user) {
      navigate({ to: "/auth" });
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user) {
      fetchProfile();
      fetchWhatsappInstances();
    }
  }, [user]);

  async function fetchProfile() {
    if (!user) {
      console.warn("fetchProfile called without user");
      return;
    }
    
    console.log("Fetching profile for user ID:", user.id, "Email:", user.email);
    
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();

      if (error) {
        console.error("Supabase error fetching profile:", error);
        toast.error("Erro ao carregar configurações");
        return;
      }

      if (data) {
        console.log("Profile data successfully loaded from Supabase:", data);
        setFormData({
          business_name: data.business_name || "",
          slug: data.slug || "",
          whatsapp_enabled: data.whatsapp_enabled || false,
          scheduling_mode: (data.scheduling_mode as "manual" | "automatic") || "automatic",
          payment_gateway_provider: data.payment_gateway_provider || "none",
          payment_gateway_key: data.payment_gateway_key || "",
          primary_color: data.primary_color || "#7c3aed",
          secondary_color: data.secondary_color || "#f4f4f5",
          logo_url: data.logo_url || "",
          cashback_enabled: data.cashback_enabled || false,
          cashback_percentage: data.cashback_percentage || 0,
          free_service_threshold: data.free_service_threshold || 10,
          address: data.address || "",
          google_maps_url: data.google_maps_url || "",
          font_family: data.font_family || "Inter",
          font_size: data.font_size || "16px",
          font_color: data.font_color || "#000000",
        });
      } else {
        console.warn("No profile found in database for ID:", user.id);
        toast.error("Perfil não encontrado no banco de dados.");
      }
    } catch (e) {
      console.error("Exception in fetchProfile:", e);
    }
  }

  async function handleForceSync() {
    setIsSyncing(true);
    try {
      await fetchProfile();
      toast.success("Dados sincronizados com o banco!");
    } catch (error) {
      console.error("Error syncing profile:", error);
      toast.error("Erro ao sincronizar dados");
    } finally {
      setIsSyncing(false);
    }
  }

  async function fetchWhatsappInstances() {
    if (!user) return;
    const { data, error } = await supabase
      .from("whatsapp_instances")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true });

    if (data) setWhatsappInstances(data);
  }

  async function handleAddWhatsapp() {
    if (!user) return;
    if (!checkLimit("whatsappConnections")) {
      toast.error(`Seu plano ${plan === "free" ? "Grátis" : "Pro"} permite apenas ${limits.whatsappConnections} conexão(ões).`);
      return;
    }

    const trimmedName = newInstanceName.trim();
    if (!trimmedName) {
      toast.error("Dê um nome para esta conexão (ex: Principal, Recepção)");
      return;
    }

    if (connectionType === "api_key") {
      if (!apiUrl.trim() || !apiKey.trim()) {
        toast.error("Preencha a URL e a Chave da API");
        return;
      }
    }

    console.log("Creating WhatsApp instance for user:", user.id);

    const { data, error } = await supabase
      .from("whatsapp_instances")
      .insert({
        user_id: user.id,
        name: trimmedName,
        status: connectionType === "api_key" ? "connected" : "pending",
        connection_type: connectionType,
        api_url: connectionType === "api_key" ? apiUrl : null,
        api_key: connectionType === "api_key" ? apiKey : null
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating WhatsApp connection:", error);
      toast.error("Erro ao criar conexão: " + error.message);
      return;
    }

    setNewInstanceName("");
    setApiUrl("");
    setApiKey("");
    setWhatsappInstances([...whatsappInstances, data]);
    
    if (connectionType === "qrcode") {
      setConnectingInstance(data.id);
      setQrValue(`https://meu-saas.com/connect/${data.id}-${Math.random().toString(36).substr(2, 9)}`);
      setIsQrModalOpen(true);
    } else {
      toast.success("Conexão via API configurada com sucesso!");
    }
    
    refreshLimits();
  }

  async function handleDeleteWhatsapp(id: string) {
    const { error } = await supabase
      .from("whatsapp_instances")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Error deleting WhatsApp connection:", error);
      toast.error("Erro ao remover conexão");
      return;
    }

    setWhatsappInstances(whatsappInstances.filter(i => i.id !== id));
    toast.success("Conexão removida");
    refreshLimits();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    
    setSaving(true);

    // Prevent saving gateway config for free plan
    const updatedData = { ...formData };
    if (plan === "free" || plan === "basic") {
      updatedData.payment_gateway_provider = "none";
      updatedData.payment_gateway_key = "";
    }

    const { error } = await supabase
      .from("profiles")
      .update({
        business_name: updatedData.business_name,
        slug: updatedData.slug,
        whatsapp_enabled: updatedData.whatsapp_enabled,
        scheduling_mode: updatedData.scheduling_mode,
        payment_gateway_provider: updatedData.payment_gateway_provider === "none" ? null : updatedData.payment_gateway_provider,
        payment_gateway_key: updatedData.payment_gateway_key,
        primary_color: updatedData.primary_color,
        secondary_color: updatedData.secondary_color,
        logo_url: updatedData.logo_url,
        cashback_enabled: updatedData.cashback_enabled,
        cashback_percentage: updatedData.cashback_percentage,
        free_service_threshold: updatedData.free_service_threshold,
        address: updatedData.address,
        google_maps_url: updatedData.google_maps_url,
        font_family: updatedData.font_family,
        font_size: updatedData.font_size,
        font_color: updatedData.font_color,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    setSaving(false);

    if (error) {
      if (error.code === "23505") {
        toast.error("Este endereço (URL) já está em uso.");
      } else {
        toast.error("Erro ao salvar configurações");
      }
      return;
    }

    toast.success("Configurações salvas com sucesso!");
  }

  // Simulated QR Code connection
  const simulateConnection = async () => {
    if (!connectingInstance) return;
    
    setSaving(true);
    const toastId = toast.loading("Autenticando com o WhatsApp...");
    
    // Simulate network delay
    setTimeout(async () => {
      const { error } = await supabase
        .from("whatsapp_instances")
        .update({ 
          status: "connected",
          phone: "+55 (11) 9" + Math.floor(Math.random() * 90000000 + 10000000)
        })
        .eq("id", connectingInstance);

      setSaving(false);
      
      if (error) {
        console.error("Error updating connection status:", error);
        toast.error("Erro ao finalizar conexão", { id: toastId });
      } else {
        setIsQrModalOpen(false);
        setConnectingInstance(null);
        await fetchWhatsappInstances();
        await refreshLimits();
        toast.success("WhatsApp conectado com sucesso!", { id: toastId });
      }
    }, 2000);
  };

  if (loading || !user) return null;

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Configurações</h2>
            <p className="text-muted-foreground">Gerencie sua barbearia, integrações e personalização.</p>
          </div>
          {plan === "free" && (
            <Button variant="outline" className="bg-primary/10 border-primary/20 text-primary gap-2" asChild>
              <Link to="/subscription">Fazer Upgrade para Pro</Link>
            </Button>
          )}
        </div>

        <form onSubmit={handleSubmit}>
          <Tabs defaultValue="general" className="space-y-6">
            <TabsList className="grid w-full grid-cols-3 md:grid-cols-6 max-w-[800px]">
              <TabsTrigger value="general" className="gap-2 text-xs sm:text-sm">
                <Globe size={16} /> <span className="hidden sm:inline">Geral</span>
              </TabsTrigger>
              <TabsTrigger value="appearance" className="gap-2 text-xs sm:text-sm">
                <Palette size={16} /> <span className="hidden sm:inline">Aparência</span>
              </TabsTrigger>
              <TabsTrigger value="scheduling" className="gap-2 text-xs sm:text-sm">
                <Calendar size={16} /> <span className="hidden sm:inline">Agendamento</span>
              </TabsTrigger>
              <TabsTrigger value="whatsapp" className="gap-2 text-xs sm:text-sm">
                <MessageSquare size={16} /> <span className="hidden sm:inline">WhatsApp</span>
              </TabsTrigger>
              <TabsTrigger value="payments" className="gap-2 text-xs sm:text-sm">
                <CreditCard size={16} /> <span className="hidden sm:inline">Pagamentos</span>
              </TabsTrigger>
              <TabsTrigger value="loyalty" className="gap-2 text-xs sm:text-sm">
                <Gift size={16} /> <span className="hidden sm:inline">Fidelidade</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="general" className="space-y-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <div className="space-y-1">
                    <CardTitle>Informações do Negócio</CardTitle>
                    <CardDescription>Configure os dados básicos da sua página pública.</CardDescription>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    type="button"
                    onClick={handleForceSync}
                    disabled={isSyncing}
                    className="gap-2"
                  >
                    <RefreshCw className={`h-4 w-4 ${isSyncing ? "animate-spin" : ""}`} />
                    {isSyncing ? "Sincronizando..." : "Sincronizar"}
                  </Button>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-2">
                    <Label htmlFor="business_name">Nome da Barbearia</Label>
                    <Input 
                      id="business_name" 
                      value={formData.business_name} 
                      onChange={(e) => setFormData({ ...formData, business_name: e.target.value })}
                      placeholder="Ex: Barbearia do João"
                      required
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="slug">Endereço da sua Página (URL)</Label>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground text-sm hidden sm:inline">meu-saas.com/</span>
                      <Input 
                        id="slug" 
                        value={formData.slug} 
                        onChange={(e) => setFormData({ ...formData, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') })}
                        placeholder="minha-barbearia"
                        required
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">Este será o link que seus clientes usarão para agendar.</p>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="address">Endereço Físico</Label>
                    <Input 
                      id="address" 
                      value={formData.address} 
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      placeholder="Ex: Rua das Flores, 123 - Centro, São Paulo - SP"
                    />
                    <p className="text-xs text-muted-foreground">O endereço completo que aparecerá para os clientes.</p>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="google_maps_url">Link do Google Maps (Embed)</Label>
                    <Input 
                      id="google_maps_url" 
                      value={formData.google_maps_url} 
                      onChange={(e) => setFormData({ ...formData, google_maps_url: e.target.value })}
                      placeholder='Ex: <iframe src="https://www.google.com/maps/embed?pb=..." ...></iframe>'
                    />
                    <p className="text-xs text-muted-foreground">Copie o código de incorporação (embed) do Google Maps para exibir o mapa na sua página.</p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="appearance" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Personalização Visual</CardTitle>
                  <CardDescription>Deixe a página com a cara da sua marca.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="grid gap-2">
                      <Label htmlFor="primary_color">Cor Primária</Label>
                      <div className="flex gap-2">
                        <Input 
                          id="primary_color" 
                          type="color" 
                          className="w-12 h-10 p-1"
                          value={formData.primary_color} 
                          onChange={(e) => setFormData({ ...formData, primary_color: e.target.value })}
                        />
                        <Input 
                          value={formData.primary_color} 
                          onChange={(e) => setFormData({ ...formData, primary_color: e.target.value })}
                          placeholder="#000000"
                        />
                      </div>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="secondary_color">Cor de Fundo</Label>
                      <div className="flex gap-2">
                        <Input 
                          id="secondary_color" 
                          type="color" 
                          className="w-12 h-10 p-1"
                          value={formData.secondary_color} 
                          onChange={(e) => setFormData({ ...formData, secondary_color: e.target.value })}
                        />
                        <Input 
                          value={formData.secondary_color} 
                          onChange={(e) => setFormData({ ...formData, secondary_color: e.target.value })}
                          placeholder="#F4F4F5"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4 pt-4 border-t">
                    <h4 className="font-medium text-sm">Configurações de Fonte</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="grid gap-2">
                        <Label htmlFor="font_family">Tipografia</Label>
                        <Select 
                          value={formData.font_family} 
                          onValueChange={(value) => setFormData({ ...formData, font_family: value })}
                        >
                          <SelectTrigger id="font_family">
                            <SelectValue placeholder="Selecione a fonte" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Inter">Inter (Padrão)</SelectItem>
                            <SelectItem value="Roboto">Roboto</SelectItem>
                            <SelectItem value="Open Sans">Open Sans</SelectItem>
                            <SelectItem value="Montserrat">Montserrat</SelectItem>
                            <SelectItem value="Playfair Display">Playfair Display (Elegante)</SelectItem>
                            <SelectItem value="Oswald">Oswald (Moderna)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="font_size">Tamanho da Fonte</Label>
                        <Select 
                          value={formData.font_size} 
                          onValueChange={(value) => setFormData({ ...formData, font_size: value })}
                        >
                          <SelectTrigger id="font_size">
                            <SelectValue placeholder="Selecione o tamanho" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="14px">Pequeno (14px)</SelectItem>
                            <SelectItem value="16px">Normal (16px)</SelectItem>
                            <SelectItem value="18px">Médio (18px)</SelectItem>
                            <SelectItem value="20px">Grande (20px)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="font_color">Cor da Fonte</Label>
                        <div className="flex gap-2">
                          <Input 
                            id="font_color" 
                            type="color" 
                            className="w-12 h-10 p-1"
                            value={formData.font_color} 
                            onChange={(e) => setFormData({ ...formData, font_color: e.target.value })}
                          />
                          <Input 
                            value={formData.font_color} 
                            onChange={(e) => setFormData({ ...formData, font_color: e.target.value })}
                            placeholder="#000000"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4 pt-4 border-t">
                    <h4 className="font-medium text-sm">Logo da Barbearia</h4>
                    <div className="flex items-center gap-4">
                      <div className="h-16 w-16 rounded-lg bg-muted flex items-center justify-center overflow-hidden border">
                        {formData.logo_url ? (
                          <img src={formData.logo_url} alt="Logo Preview" className="h-full w-full object-contain" />
                        ) : (
                          <Upload className="h-6 w-6 text-muted-foreground/30" />
                        )}
                      </div>
                      <div className="flex-1 space-y-2">
                        <Label htmlFor="logo_file">Anexar Arquivo de Logo</Label>
                        <Input 
                          id="logo_file" 
                          type="file" 
                          accept="image/*"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file || !user) return;
                            
                            try {
                              setSaving(true);
                              const fileExt = file.name.split('.').pop();
                              const fileName = `${user.id}-logo-${Math.random()}.${fileExt}`;
                              
                              const { error: uploadError } = await supabase.storage
                                .from('barber-avatars') // Using existing bucket for simplicity
                                .upload(fileName, file);
                                
                              if (uploadError) throw uploadError;
                              
                              const { data: { publicUrl } } = supabase.storage
                                .from('barber-avatars')
                                .getPublicUrl(fileName);
                                
                              setFormData({ ...formData, logo_url: publicUrl });
                              toast.success("Logo carregado com sucesso!");
                            } catch (error: any) {
                              toast.error("Erro ao carregar logo: " + error.message);
                            } finally {
                              setSaving(false);
                            }
                          }}
                        />
                        <p className="text-[10px] text-muted-foreground">Recomendado: imagem quadrada ou horizontal com fundo transparente.</p>
                      </div>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="logo_url">Ou URL do Logo</Label>
                      <Input 
                        id="logo_url" 
                        value={formData.logo_url} 
                        onChange={(e) => setFormData({ ...formData, logo_url: e.target.value })}
                        placeholder="https://exemplo.com/logo.png"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="scheduling" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Configurações de Agendamento</CardTitle>
                  <CardDescription>Defina como seus clientes podem marcar horários.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-4">
                    <div className="flex items-start gap-4 p-4 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer" onClick={() => setFormData({ ...formData, scheduling_mode: "manual" })}>
                      <div className="mt-1">
                        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${formData.scheduling_mode === 'manual' ? 'border-primary' : 'border-muted-foreground'}`}>
                          {formData.scheduling_mode === 'manual' && <div className="w-2 h-2 rounded-full bg-primary" />}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-base cursor-pointer">Agendamento Manual</Label>
                        <p className="text-sm text-muted-foreground">
                          Seus clientes verão seu contato de WhatsApp e deverão entrar em contato para agendar. Você insere o horário manualmente na agenda.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-4 p-4 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer" onClick={() => setFormData({ ...formData, scheduling_mode: "automatic" })}>
                      <div className="mt-1">
                        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${formData.scheduling_mode === 'automatic' ? 'border-primary' : 'border-muted-foreground'}`}>
                          {formData.scheduling_mode === 'automatic' && <div className="w-2 h-2 rounded-full bg-primary" />}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-base cursor-pointer">Agendamento Automático (Self-Service)</Label>
                        <p className="text-sm text-muted-foreground">
                          Seus clientes escolhem o serviço, profissional e horário diretamente na sua página. O agendamento é confirmado automaticamente conforme sua disponibilidade.
                        </p>
                      </div>
                    </div>
                  </div>

                  {formData.scheduling_mode === 'automatic' && (
                    <div className="bg-primary/5 p-4 rounded-lg border border-primary/10 animate-in fade-in slide-in-from-top-2">
                      <div className="flex items-center gap-2 text-primary font-medium mb-1">
                        <CheckCircle2 size={16} />
                        <span>Recomendado</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        O modo automático aumenta sua produtividade e permite que clientes agendem mesmo fora do horário comercial.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="whatsapp" className="space-y-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0">
                  <div>
                    <CardTitle>Instâncias de WhatsApp</CardTitle>
                    <CardDescription>Conecte seus números para notificações automáticas.</CardDescription>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-bold uppercase text-muted-foreground">Uso do Plano</span>
                    <p className="text-sm font-bold">{usage.whatsappConnections} / {limits.whatsappConnections === Infinity ? "∞" : limits.whatsappConnections}</p>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between space-x-2 border p-4 rounded-lg bg-muted/50 mb-4">
                    <div className="space-y-0.5">
                      <Label className="text-base">Ativar Notificações</Label>
                      <p className="text-sm text-muted-foreground">Habilite globalmente as mensagens automáticas.</p>
                    </div>
                    <Switch 
                      checked={formData.whatsapp_enabled} 
                      onCheckedChange={(checked) => setFormData({ ...formData, whatsapp_enabled: checked })}
                    />
                  </div>

                  <div className="space-y-3">
                    {whatsappInstances.map((instance) => (
                      <div key={instance.id} className="flex items-center justify-between p-3 border rounded-lg bg-card">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-full ${instance.status === 'connected' ? 'bg-green-100 text-green-600' : 'bg-yellow-100 text-yellow-600'}`}>
                            <MessageSquare size={18} />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-sm">{instance.name}</p>
                              <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground uppercase">
                                {instance.connection_type === 'api_key' ? 'API' : 'QR Code'}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className={`w-2 h-2 rounded-full ${instance.status === 'connected' ? 'bg-green-500' : 'bg-yellow-500'}`}></span>
                              <span className="text-xs text-muted-foreground">
                                {instance.status === 'connected' ? 'Conectado' : 'Aguardando QR Code'}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {instance.status !== 'connected' && instance.connection_type === 'qrcode' && (
                            <Button 
                              variant="outline" 
                              size="sm" 
                              onClick={() => {
                                setConnectingInstance(instance.id);
                                setIsQrModalOpen(true);
                              }}
                              className="gap-2"
                            >
                              <QrCode size={14} /> Conectar
                            </Button>
                          )}
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => handleDeleteWhatsapp(instance.id)}
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 size={16} />
                          </Button>
                        </div>
                      </div>
                    ))}

                    {whatsappInstances.length === 0 && (
                      <div className="text-center py-6 border-2 border-dashed rounded-lg text-muted-foreground">
                        Nenhum número conectado.
                      </div>
                    )}

                    <div className="space-y-4 pt-4 border-t">
                      <div className="grid gap-2">
                        <Label>Nova Conexão</Label>
                        <div className="flex gap-2">
                          <Input 
                            placeholder="Nome da conexão (ex: Principal)" 
                            value={newInstanceName}
                            onChange={(e) => setNewInstanceName(e.target.value)}
                            disabled={!checkLimit("whatsappConnections")}
                          />
                          <Select 
                            value={connectionType} 
                            onValueChange={(value: any) => setConnectionType(value)}
                            disabled={!checkLimit("whatsappConnections")}
                          >
                            <SelectTrigger className="w-[180px]">
                              <SelectValue placeholder="Tipo de conexão" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="qrcode">QR Code</SelectItem>
                              <SelectItem value="api_key">Chave de API</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      {connectionType === "api_key" && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2">
                          <div className="grid gap-2">
                            <Label htmlFor="api_url">URL da API</Label>
                            <Input 
                              id="api_url"
                              placeholder="https://api.whatsapp.com/v1" 
                              value={apiUrl}
                              onChange={(e) => setApiUrl(e.target.value)}
                            />
                          </div>
                          <div className="grid gap-2">
                            <Label htmlFor="api_key">Chave da API</Label>
                            <Input 
                              id="api_key"
                              type="password"
                              placeholder="Sua chave secreta" 
                              value={apiKey}
                              onChange={(e) => setApiKey(e.target.value)}
                            />
                          </div>
                        </div>
                      )}

                      <Button 
                        type="button" 
                        onClick={handleAddWhatsapp} 
                        disabled={!checkLimit("whatsappConnections")}
                        className="w-full gap-2"
                      >
                        <Plus size={18} /> Adicionar e Conectar
                      </Button>
                    </div>

                    {!checkLimit("whatsappConnections") && (
                      <p className="text-xs text-destructive font-medium text-center">
                        Você atingiu o limite de conexões do seu plano. {plan === "free" && "Faça upgrade para adicionar mais."}
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Dialog open={isQrModalOpen} onOpenChange={setIsQrModalOpen}>
                <DialogContent className="sm:max-w-[425px]">
                  <DialogHeader>
                    <DialogTitle>Conectar WhatsApp</DialogTitle>
                    <DialogDescription>
                      Abra o WhatsApp no seu celular, vá em Aparelhos Conectados e escaneie o código abaixo.
                      <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded text-amber-700 text-xs">
                        <b>Ambiente de Teste:</b> O QR Code abaixo é figurativo. Para prosseguir com a demonstração, clique no botão "Simular Leitura" abaixo.
                      </div>
                    </DialogDescription>
                  </DialogHeader>
                  <div className="flex flex-col items-center justify-center p-6 space-y-6">
                    <div className="relative p-6 border-4 border-primary rounded-xl bg-white shadow-lg">
                      {/* Dynamic QR Code */}
                      <div className="w-48 h-48 bg-white flex items-center justify-center relative overflow-hidden group">
                        {qrValue ? (
                          <QRCodeSVG 
                            value={qrValue} 
                            size={192}
                            level="H"
                            includeMargin={false}
                            imageSettings={{
                              src: formData.logo_url || "/placeholder.svg",
                              x: undefined,
                              y: undefined,
                              height: 40,
                              width: 40,
                              excavate: true,
                            }}
                          />
                        ) : (
                          <div className="flex flex-col items-center gap-2 text-muted-foreground">
                            <RefreshCw className="animate-spin" />
                            <p className="text-xs">Gerando código...</p>
                          </div>
                        )}
                        <div className="absolute inset-0 bg-white/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer" onClick={() => setQrValue(qrValue + "1")}>
                           <RefreshCw size={32} className="text-primary" />
                        </div>
                      </div>
                    </div>
                    
                    <div className="w-full space-y-4">
                      <div className="flex items-start gap-3 text-sm">
                        <div className="bg-primary/10 text-primary w-5 h-5 rounded-full flex items-center justify-center shrink-0 font-bold">1</div>
                        <p>Abra o WhatsApp no seu celular</p>
                      </div>
                      <div className="flex items-start gap-3 text-sm">
                        <div className="bg-primary/10 text-primary w-5 h-5 rounded-full flex items-center justify-center shrink-0 font-bold">2</div>
                        <p>Toque em <b>Menu</b> ou <b>Configurações</b> e selecione <b>Aparelhos Conectados</b></p>
                      </div>
                      <div className="flex items-start gap-3 text-sm">
                        <div className="bg-primary/10 text-primary w-5 h-5 rounded-full flex items-center justify-center shrink-0 font-bold">3</div>
                        <p>Toque em <b>Conectar um aparelho</b> e aponte para esta tela</p>
                      </div>
                    </div>

                    <Button className="w-full gap-2" onClick={simulateConnection}>
                      <CheckCircle2 size={18} /> Simular Leitura do QR Code
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </TabsContent>

            <TabsContent value="payments" className="space-y-4">
              <Card className={plan === "free" ? "relative overflow-hidden" : ""}>
                {plan === "free" && (
                  <div className="absolute inset-0 z-10 bg-background/60 backdrop-blur-[2px] flex flex-col items-center justify-center p-6 text-center">
                    <div className="bg-primary/10 p-3 rounded-full text-primary mb-4">
                      <Lock size={32} />
                    </div>
                    <h3 className="text-xl font-bold">Recurso Exclusivo do Plano Pro</h3>
                    <p className="text-muted-foreground max-w-sm mt-2 mb-6">
                      A integração com gateways de pagamento para receber agendamentos antecipados está disponível apenas para assinantes Pro.
                    </p>
                    <Button asChild>
                      <Link to="/subscription">Fazer Upgrade Agora</Link>
                    </Button>
                  </div>
                )}
                <CardHeader>
                  <CardTitle>Gateway de Pagamento</CardTitle>
                  <CardDescription>Configure como você deseja receber pelos agendamentos.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-2">
                    <Label htmlFor="provider">Provedor</Label>
                    <Select 
                      value={formData.payment_gateway_provider} 
                      onValueChange={(value) => setFormData({ ...formData, payment_gateway_provider: value })}
                      disabled={plan === "free"}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um provedor" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Nenhum (Apenas agendamento)</SelectItem>
                        <SelectItem value="stripe">Stripe</SelectItem>
                        <SelectItem value="mercadopago">Mercado Pago</SelectItem>
                        <SelectItem value="paggue">Paggue</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {formData.payment_gateway_provider !== "none" && (
                    <div className="grid gap-2 animate-in fade-in slide-in-from-top-2">
                      <Label htmlFor="api_key">Chave de API (Secret Key)</Label>
                      <Input 
                        id="api_key" 
                        type="password"
                        value={formData.payment_gateway_key} 
                        onChange={(e) => setFormData({ ...formData, payment_gateway_key: e.target.value })}
                        placeholder="sk_test_..."
                        disabled={plan === "free"}
                      />
                      <p className="text-xs text-muted-foreground">
                        Sua chave de API é criptografada e nunca compartilhada.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="loyalty" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Sistema de Cashback</CardTitle>
                  <CardDescription>Configure como seus clientes ganham crédito a cada serviço.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="space-y-0.5">
                      <Label className="text-base">Ativar Cashback</Label>
                      <p className="text-sm text-muted-foreground">
                        Habilita o acúmulo de saldo para seus clientes.
                      </p>
                    </div>
                    <Switch 
                      checked={formData.cashback_enabled} 
                      onCheckedChange={(checked) => setFormData({ ...formData, cashback_enabled: checked })}
                    />
                  </div>

                  {formData.cashback_enabled && (
                    <div className="grid gap-4 animate-in fade-in slide-in-from-top-2">
                      <div className="grid gap-2">
                        <Label htmlFor="cashback_percentage">Porcentagem de Retorno (%)</Label>
                        <div className="flex items-center gap-4">
                          <Input 
                            id="cashback_percentage" 
                            type="number"
                            min="0"
                            max="100"
                            value={formData.cashback_percentage} 
                            onChange={(e) => setFormData({ ...formData, cashback_percentage: parseFloat(e.target.value) || 0 })}
                            className="max-w-[150px]"
                          />
                          <span className="text-sm text-muted-foreground">
                            A cada R$ 100,00 gastos, o cliente receberá R$ {formData.cashback_percentage.toFixed(2)} de crédito.
                          </span>
                        </div>
                      </div>

                      <Alert>
                        <Gift className="h-4 w-4" />
                        <AlertTitle>Como funciona?</AlertTitle>
                        <AlertDescription>
                          O saldo é gerado automaticamente após a conclusão de um agendamento pago. 
                          Os clientes podem usar esse saldo para obter descontos em serviços futuros ou na compra de produtos.
                        </AlertDescription>
                      </Alert>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Cartão Fidelidade</CardTitle>
                  <CardDescription>A cada X serviços realizados, o próximo é gratuito.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid gap-2">
                    <Label htmlFor="free_service_threshold">Meta para Serviço Gratuito</Label>
                    <div className="flex items-center gap-4">
                      <Input 
                        id="free_service_threshold" 
                        type="number"
                        min="2"
                        max="100"
                        value={formData.free_service_threshold} 
                        onChange={(e) => setFormData({ ...formData, free_service_threshold: parseInt(e.target.value) || 10 })}
                        className="max-w-[150px]"
                      />
                      <span className="text-sm text-muted-foreground">
                        Após completar {formData.free_service_threshold} procedimentos, o cliente ganha o próximo gratuitamente.
                      </span>
                    </div>
                  </div>

                  <Alert>
                    <Gift className="h-4 w-4" />
                    <AlertTitle>Como funciona?</AlertTitle>
                    <AlertDescription>
                      O sistema contabiliza automaticamente cada agendamento marcado como "Concluído". 
                      O cliente poderá acompanhar o progresso em sua página de histórico.
                    </AlertDescription>
                  </Alert>
                </CardContent>
              </Card>
            </TabsContent>

            <div className="flex justify-end">
              <Button type="submit" className="gap-2" disabled={saving}>
                <Save size={18} /> {saving ? "Salvando..." : "Salvar Configurações"}
              </Button>
            </div>
          </Tabs>
        </form>
      </div>
    </AppLayout>
  );
}
