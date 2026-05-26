import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/hooks/use-auth";
import { usePlanLimits } from "@/hooks/use-plan-limits";
import { cn } from "@/lib/utils";
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
  Upload,
  Copy,
  Check,
  ExternalLink,
  UserRound,
  History
} from "lucide-react";
import { WhatsAppSettings } from "@/components/settings/WhatsAppSettings";
import { CouponManagement } from "@/components/admin/CouponManagement";

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
  const { user, loading, role } = useAuth();
  const navigate = useNavigate();
  const { plan, limits, usage, checkLimit, refresh: refreshLimits } = usePlanLimits();
  const [saving, setSaving] = useState(false);
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
    pix_key: "",
    pix_qr_code_url: "",
    whatsapp_number: "",
    // Z-API settings
    instance_id: "",
    instance_token: "",
    client_token: "",
  });


  useEffect(() => {
    if (!loading && !user) {
      navigate({ to: "/auth" });
      return;
    }

    if (!loading && user && role === 'super_admin') {
      navigate({ to: "/admin" });
      return;
    }
  }, [user, loading, role, navigate]);

  useEffect(() => {
    if (user && role !== 'super_admin') {
      fetchProfile();
    }
  }, [user, role]);

  async function fetchProfile() {
    if (!user) {
      console.warn("fetchProfile called without user");
      return;
    }
    
    console.log("Fetching profile for user ID:", user.id, "Email:", user.email);
    
    try {
      // Fetch profile
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id);
      
      if (profileError) {
        console.error("Supabase error fetching profile:", profileError);
        toast.error(`Erro ao carregar configurações: ${profileError.message}`);
        return;
      }

      // Fetch barbershop settings
      const { data: settingsData, error: settingsError } = await supabase
        .from("barbershop_settings")
        .select("*")
        .eq("barber_id", user.id)
        .maybeSingle();

      if (settingsError) {
        console.error("Error fetching barbershop settings:", settingsError);
      }

      if (profileData && profileData.length > 0) {
        const profile = profileData[0];
        setFormData({
          business_name: profile.business_name || "",
          slug: profile.slug || "",
          whatsapp_enabled: profile.whatsapp_enabled || false,
          scheduling_mode: (profile.scheduling_mode as "manual" | "automatic") || "automatic",
          payment_gateway_provider: profile.payment_gateway_provider || "none",
          payment_gateway_key: profile.payment_gateway_key || "",
          primary_color: profile.primary_color || "#7c3aed",
          secondary_color: profile.secondary_color || "#f4f4f5",
          logo_url: profile.logo_url || "",
          cashback_enabled: profile.cashback_enabled || false,
          cashback_percentage: profile.cashback_percentage || 0,
          free_service_threshold: profile.free_service_threshold || 10,
          address: profile.address || "",
          google_maps_url: profile.google_maps_url || "",
          font_family: profile.font_family || "Inter",
          font_size: profile.font_size || "16px",
          font_color: profile.font_color || "#000000",
          pix_key: profile.pix_key || "",
          pix_qr_code_url: profile.pix_qr_code_url || "",
          whatsapp_number: settingsData?.whatsapp_number || profile.whatsapp_number || "",
          instance_id: settingsData?.instance_id || "",
          instance_token: settingsData?.instance_token || "",
          client_token: settingsData?.client_token || "",
        });
      } else {
        toast.error("Perfil não encontrado.");
      }
    } catch (e: any) {
      console.error("Unexpected error in fetchProfile:", e);
      toast.error("Erro inesperado ao buscar dados.");
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    
    setSaving(true);

    // Prevent saving gateway config for free plan
    const updatedData = { ...formData };
    if (plan === "free" || plan === "starter") {
      updatedData.payment_gateway_provider = "none";
      updatedData.payment_gateway_key = "";
    }

    const { error: profileError } = await supabase
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
        pix_key: updatedData.pix_key,
        pix_qr_code_url: updatedData.pix_qr_code_url,
        whatsapp_number: updatedData.whatsapp_number,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    // Save to barbershop_settings
    const { error: settingsError } = await supabase
      .from("barbershop_settings")
      .upsert({
        barber_id: user.id,
        instance_id: updatedData.instance_id,
        instance_token: updatedData.instance_token,
        client_token: updatedData.client_token,
        whatsapp_number: updatedData.whatsapp_number,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'barber_id' });

    setSaving(false);

    if (profileError || settingsError) {
      const error = profileError || settingsError;
      if (error?.code === "23505") {
        toast.error("Este endereço (URL) já está em uso.");
      } else {
        toast.error("Erro ao salvar configurações: " + error?.message);
      }
      return;
    }

    toast.success("Configurações salvas com sucesso!");
  }

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
            <TabsList className="grid w-full grid-cols-5 md:grid-cols-9 max-w-[1100px] bg-white border border-slate-200 text-black">
              <TabsTrigger value="general" className="gap-2 text-xs sm:text-sm">
                <Globe size={16} /> <span className="hidden sm:inline">Geral</span>
              </TabsTrigger>
              <TabsTrigger value="profile" className="gap-2 text-xs sm:text-sm">
                <UserRound size={16} /> <span className="hidden sm:inline">Perfil</span>
              </TabsTrigger>
              <TabsTrigger value="appearance" className="gap-2 text-xs sm:text-sm">
                <Palette size={16} /> <span className="hidden sm:inline">Aparência</span>
              </TabsTrigger>
              <TabsTrigger value="scheduling" className="gap-2 text-xs sm:text-sm">
                <Calendar size={16} /> <span className="hidden sm:inline">Agendamento</span>
              </TabsTrigger>
              <TabsTrigger value="coupons" className="gap-2 text-xs sm:text-sm">
                <Gift size={16} /> <span className="hidden sm:inline">Cupons</span>
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
              <TabsTrigger value="pix" className="gap-2 text-xs sm:text-sm">
                <QrCode size={16} /> <span className="hidden sm:inline">Chave PIX</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="profile" className="space-y-4">
              <Card className="bg-white border-2 border-slate-200 text-black">
                <CardHeader>
                  <CardTitle>Meu Perfil</CardTitle>
                  <CardDescription>Gerencie suas informações pessoais e foto de perfil.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center gap-6">
                    <div className="h-24 w-24 rounded-full bg-muted flex items-center justify-center overflow-hidden border-2 border-primary/20">
                      {formData.logo_url ? (
                        <img src={formData.logo_url} alt="Profile" className="h-full w-full object-cover" />
                      ) : (
                        <UserRound className="h-12 w-12 text-muted-foreground/30" />
                      )}
                    </div>
                    <div className="flex-1 space-y-2">
                      <Label htmlFor="profile_avatar">Alterar Foto de Perfil</Label>
                      <Input 
                        id="profile_avatar" 
                        type="file" 
                        accept="image/*"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file || !user) return;
                          
                          try {
                            setSaving(true);
                            const fileExt = file.name.split('.').pop();
                            const fileName = `${user.id}-avatar-${Date.now()}.${fileExt}`;
                            
                            const { error: uploadError } = await supabase.storage
                              .from('barber-avatars')
                              .upload(fileName, file);
                              
                            if (uploadError) throw uploadError;
                            
                            const { data: { publicUrl } } = supabase.storage
                              .from('barber-avatars')
                              .getPublicUrl(fileName);
                              
                            setFormData({ ...formData, logo_url: publicUrl });
                            toast.success("Foto de perfil atualizada!");
                          } catch (error: any) {
                            toast.error("Erro ao carregar imagem: " + error.message);
                          } finally {
                            setSaving(false);
                          }
                        }}
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label>E-mail (Login)</Label>
                      <Input value={user?.email || ""} disabled className="bg-muted" />
                      <p className="text-[10px] text-muted-foreground">O e-mail não pode ser alterado diretamente.</p>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="profile_name">Nome para Exibição</Label>
                      <Input 
                        id="profile_name" 
                        value={formData.business_name} 
                        onChange={(e) => setFormData({ ...formData, business_name: e.target.value })}
                        placeholder="Seu nome"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="general" className="space-y-4">
              <Card className="bg-white border-2 border-slate-200 text-black">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <div className="space-y-1">
                    <CardTitle>Informações do Negócio</CardTitle>
                    <CardDescription>Logado como: <span className="font-mono text-primary font-bold">{user?.email}</span> (ID: {typeof user?.id === 'string' ? user.id.substring(0, 8) : '---'}...)</CardDescription>
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
                      <span className="text-muted-foreground text-sm hidden sm:inline">{window.location.origin}/</span>
                      <Input 
                        id="slug" 
                        value={formData.slug} 
                        onChange={(e) => setFormData({ ...formData, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') })}
                        placeholder="minha-barbearia"
                        required
                      />
                      <Button 
                        type="button" 
                        variant="outline" 
                        size="icon" 
                        onClick={() => {
                          const url = `${window.location.origin}/${formData.slug}`;
                          navigator.clipboard.writeText(url);
                          toast.success("Link copiado!");
                        }}
                        title="Copiar link"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button 
                        type="button" 
                        variant="ghost" 
                        size="icon" 
                        asChild
                        title="Ver página"
                      >
                        <a href={`/${formData.slug}`} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="coupons" className="space-y-4">
              <Card className="bg-white border-2 border-slate-200 text-black">
                <CardContent className="pt-6">
                  <CouponManagement />
                </CardContent>
              </Card>
            </TabsContent>

                    <p className="text-xs text-muted-foreground">Este será o link que seus clientes usarão para agendar.</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="whatsapp_number">WhatsApp da Barbearia (Single Source)</Label>
                      <Input 
                        id="whatsapp_number" 
                        value={formData.whatsapp_number} 
                        onChange={(e) => setFormData({ ...formData, whatsapp_number: e.target.value })}
                        placeholder="Ex: 5571999999999"
                      />
                      <p className="text-xs text-muted-foreground font-medium text-amber-600">Este número será usado em TODAS as automações.</p>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="instance_id">ID da Instância Z-API</Label>
                      <Input 
                        id="instance_id" 
                        value={formData.instance_id} 
                        onChange={(e) => setFormData({ ...formData, instance_id: e.target.value })}
                        placeholder="Ex: 3F3A5..."
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="instance_token">Token da Instância Z-API</Label>
                      <Input 
                        id="instance_token" 
                        type="password"
                        value={formData.instance_token} 
                        onChange={(e) => setFormData({ ...formData, instance_token: e.target.value })}
                        placeholder="Token da instância"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="client_token">Client Token Z-API</Label>
                      <Input 
                        id="client_token" 
                        type="password"
                        value={formData.client_token} 
                        onChange={(e) => setFormData({ ...formData, client_token: e.target.value })}
                        placeholder="F0A1B..."
                      />
                      <p className="text-[10px] text-muted-foreground">Obrigatório para automações funcionarem corretamente.</p>
                    </div>
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
              <Card className="bg-white border-2 border-slate-200 text-black">
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
              <Card className="bg-white border-2 border-slate-200 text-black">
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
              <WhatsAppSettings />
            </TabsContent>

            <TabsContent value="payments" className="space-y-4">
              <Card className={cn("bg-white border-2 border-slate-200 text-black", plan === "free" ? "relative overflow-hidden" : "")}>
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
              <Card className="bg-white border-2 border-slate-200 text-black">
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

              <Card className="bg-white border-2 border-slate-200 text-black">
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

            <TabsContent value="pix" className="space-y-4">
              <Card className="bg-white border-2 border-slate-200 text-black">
                <CardHeader>
                  <CardTitle>Configuração de Pagamento PIX</CardTitle>
                  <CardDescription>Cadastre sua chave PIX para recebimentos diretos dos clientes.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid gap-2">
                    <Label htmlFor="pix_key">Chave PIX</Label>
                    <Input 
                      id="pix_key" 
                      value={formData.pix_key} 
                      onChange={(e) => setFormData({ ...formData, pix_key: e.target.value })}
                      placeholder="CPF, E-mail, Celular ou Chave Aleatória"
                    />
                    <p className="text-xs text-muted-foreground">Esta chave será exibida para o cliente no momento do pagamento.</p>
                  </div>

                  <div className="space-y-4 pt-4 border-t">
                    <h4 className="font-medium text-sm">QR Code do PIX</h4>
                    <div className="flex items-center gap-4">
                      <div className="h-24 w-24 rounded-lg bg-muted flex items-center justify-center overflow-hidden border">
                        {formData.pix_qr_code_url ? (
                          <img src={formData.pix_qr_code_url} alt="PIX QR Code Preview" className="h-full w-full object-contain" />
                        ) : (
                          <QrCode className="h-8 w-8 text-muted-foreground/30" />
                        )}
                      </div>
                      <div className="flex-1 space-y-2">
                        <Label htmlFor="pix_qr_file">Upload do QR Code (Imagem)</Label>
                        <Input 
                          id="pix_qr_file" 
                          type="file" 
                          accept="image/*"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file || !user) return;
                            
                            try {
                              setSaving(true);
                              const fileExt = file.name.split('.').pop();
                              const fileName = `${user.id}-pix-qr-${Math.random()}.${fileExt}`;
                              
                              const { error: uploadError } = await supabase.storage
                                .from('barber-avatars') 
                                .upload(fileName, file);
                                
                              if (uploadError) throw uploadError;
                              
                              const { data: { publicUrl } } = supabase.storage
                                .from('barber-avatars')
                                .getPublicUrl(fileName);
                                
                              setFormData({ ...formData, pix_qr_code_url: publicUrl });
                              toast.success("QR Code carregado com sucesso!");
                            } catch (error: any) {
                              toast.error("Erro ao carregar QR Code: " + error.message);
                            } finally {
                              setSaving(false);
                            }
                          }}
                        />
                        <p className="text-[10px] text-muted-foreground">Upload da imagem do seu QR Code gerado pelo banco.</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <div className="flex justify-end">
              <Button type="submit" className="gap-2 bg-black text-white hover:scale-105 transition-all h-12 px-8 rounded-xl font-bold uppercase tracking-tight" disabled={saving}>
                <Save size={18} /> {saving ? "Salvando..." : "Salvar Configurações (Confirmar)"}
              </Button>
            </div>
          </Tabs>
        </form>
      </div>
    </AppLayout>
  );
}
