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
import { ImageIcon } from "lucide-react";
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

  const [formData, setFormData] = useState<any>({
    business_name: "",
    slug: "",
    whatsapp_enabled: false,
    scheduling_mode: "automatic" as "manual" | "automatic",
    payment_gateway_provider: "none",
    payment_gateway_key: "",
    primary_color: "#7c3aed",
    secondary_color: "#f4f4f5",
    logo_url: "",
    barbershop_logo_url: "",
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
          barbershop_logo_url: (profile as any).barbershop_logo_url || "",
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

    const { barbershop_logo_url: _, ...profileUpdateData } = updatedData;
    const { error: profileError } = await supabase
      .from("profiles")
      .update({
        business_name: profileUpdateData.business_name,
        slug: profileUpdateData.slug,
        whatsapp_enabled: profileUpdateData.whatsapp_enabled,
        scheduling_mode: profileUpdateData.scheduling_mode,
        payment_gateway_provider: profileUpdateData.payment_gateway_provider === "none" ? null : profileUpdateData.payment_gateway_provider,
        payment_gateway_key: profileUpdateData.payment_gateway_key,
        primary_color: profileUpdateData.primary_color,
        secondary_color: profileUpdateData.secondary_color,
        logo_url: profileUpdateData.logo_url,
        barbershop_logo_url: updatedData.barbershop_logo_url,
        cashback_enabled: profileUpdateData.cashback_enabled,
        cashback_percentage: profileUpdateData.cashback_percentage,
        free_service_threshold: profileUpdateData.free_service_threshold,
        address: profileUpdateData.address,
        google_maps_url: profileUpdateData.google_maps_url,
        font_family: profileUpdateData.font_family,
        font_size: profileUpdateData.font_size,
        font_color: profileUpdateData.font_color,
        pix_key: profileUpdateData.pix_key,
        pix_qr_code_url: profileUpdateData.pix_qr_code_url,
        whatsapp_number: profileUpdateData.whatsapp_number,
        updated_at: new Date().toISOString(),
      } as any)
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
      <div className="space-y-6 min-h-screen bg-[#05070a] -m-4 sm:-m-6 md:-m-8 p-4 sm:p-6 md:p-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-3xl font-black tracking-tight text-white uppercase italic">Configurações</h2>
            <p className="text-slate-400 text-sm font-medium">Gerencie sua barbearia, integrações e personalização premium.</p>
          </div>
          {plan === "free" && (
            <Button variant="outline" className="bg-amber-500/10 border-amber-500/20 text-amber-500 gap-2 hover:bg-amber-500 hover:text-black transition-all" asChild>
              <Link to="/subscription">Fazer Upgrade para Pro</Link>
            </Button>
          )}
        </div>

        <Tabs defaultValue="general" className="space-y-6">
          <div className="overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 hide-scrollbar">
            <TabsList className="flex w-max min-w-full bg-[#0b0f17] border border-[#1f2937] p-1 rounded-2xl h-auto">
              {[
                { value: "general", icon: Globe, label: "Geral" },
                { value: "profile", icon: UserRound, label: "Perfil" },
                { value: "appearance", icon: Palette, label: "Aparência" },
                { value: "scheduling", icon: Calendar, label: "Agendamento" },
                { value: "coupons", icon: Gift, label: "Cupons" },
                { value: "whatsapp", icon: MessageSquare, label: "WhatsApp" },
                { value: "payments", icon: CreditCard, label: "Pagamentos" },
                { value: "loyalty", icon: Gift, label: "Fidelidade" },
                { value: "pix", icon: QrCode, label: "Chave PIX" },
              ].map((tab) => (
                <TabsTrigger 
                  key={tab.value}
                  value={tab.value} 
                  className="gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold uppercase tracking-wider transition-all data-[state=active]:bg-[#ea580c] data-[state=active]:text-black data-[state=inactive]:text-slate-400 data-[state=inactive]:hover:text-[#ea580c]"
                >
                  <tab.icon size={16} /> <span>{tab.label}</span>
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          <form onSubmit={handleSubmit}>
            <TabsContent value="profile" className="space-y-4">
              <Card className="bg-[#0b0f17] border border-[#1f2937] text-white rounded-[20px] shadow-xl overflow-hidden">
                <CardHeader className="border-b border-[#1f2937]/50 bg-[#0b0f17]/50">
                  <CardTitle className="text-xl font-black uppercase italic tracking-wider flex items-center gap-2">
                    <UserRound className="text-[#ea580c] h-5 w-5" />
                    Meu Perfil
                  </CardTitle>
                  <CardDescription className="text-slate-400">Gerencie suas informações pessoais e foto de perfil premium.</CardDescription>
                </CardHeader>
                <CardContent className="p-6 space-y-6">
                  <div className="flex flex-col items-center gap-6">
                    <div className="flex flex-col items-center gap-4 w-full">
                      <div className="h-28 w-28 rounded-full bg-[#05070d] flex items-center justify-center overflow-hidden border-2 border-[#ea580c]/30 shadow-[0_0_20px_rgba(234,88,12,0.1)]">
                        {formData.logo_url ? (
                          <img src={formData.logo_url} alt="Profile" className="h-full w-full object-cover" />
                        ) : (
                          <UserRound className="h-14 w-14 text-slate-700" />
                        )}
                      </div>
                      <div className="w-full max-w-sm space-y-2 text-center">
                        <Label htmlFor="profile_avatar" className="text-xs font-black text-slate-500 uppercase tracking-[0.2em]">Foto de Perfil</Label>
                        <Input 
                          id="profile_avatar" 
                          type="file" 
                          accept="image/*"
                          className="h-11 rounded-xl cursor-pointer bg-[#05070d] border-[#1f2937] text-white file:bg-[#ea580c] file:text-black file:font-bold file:border-none file:px-4 file:h-full file:mr-4 hover:border-[#ea580c]/50 transition-all"
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
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="grid gap-2">
                      <Label className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">E-mail (Login)</Label>
                      <Input value={user?.email || ""} disabled className="bg-[#05070d]/50 border-[#1f2937] text-slate-500 cursor-not-allowed" />
                      <p className="text-[10px] text-slate-600 font-medium italic">O e-mail não pode ser alterado diretamente.</p>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="profile_name" className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">Nome para Exibição</Label>
                      <Input 
                        id="profile_name" 
                        value={formData.business_name} 
                        onChange={(e) => setFormData({ ...formData, business_name: e.target.value })}
                        placeholder="Seu nome"
                        className="bg-[#05070d] border-[#1f2937] text-white focus:border-[#ea580c] transition-all rounded-xl"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="general" className="space-y-4">
              <Card className="bg-[#0b0f17] border border-[#1f2937] text-white rounded-[20px] shadow-xl overflow-hidden">
                <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-[#1f2937]/50 bg-[#0b0f17]/50 p-6">
                  <div className="space-y-1">
                    <CardTitle className="text-xl font-black uppercase italic tracking-wider flex items-center gap-2">
                      <Globe className="text-[#ea580c] h-5 w-5" />
                      Informações do Negócio
                    </CardTitle>
                    <CardDescription className="text-slate-400 font-medium">Logado como: <span className="text-[#ea580c]">{user?.email}</span></CardDescription>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    type="button"
                    onClick={handleForceSync}
                    disabled={isSyncing}
                    className="gap-2 border-[#ea580c] text-[#ea580c] hover:bg-[#ea580c] hover:text-black transition-all rounded-xl h-10 px-4"
                  >
                    <RefreshCw className={`h-4 w-4 ${isSyncing ? "animate-spin" : ""}`} />
                    {isSyncing ? "Sincronizando..." : "Sincronizar"}
                  </Button>
                </CardHeader>
                <CardContent className="p-6 space-y-8">
                  <div className="flex flex-col items-center gap-4 py-6 border-b border-[#1f2937]/50 mb-4 bg-[#05070d]/30 rounded-2xl">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#ea580c]">Logo da Barbearia</p>
                    <div className="h-40 w-full max-w-[240px] rounded-2xl bg-[#05070d] border-2 border-dashed border-[#1f2937] flex items-center justify-center overflow-hidden relative group hover:border-[#ea580c]/50 transition-all shadow-inner">
                      {formData.barbershop_logo_url ? (
                        <img src={formData.barbershop_logo_url} alt="Logo" className="h-full w-full object-contain p-4 transition-transform group-hover:scale-105" />
                      ) : (
                        <div className="text-center p-4">
                          <ImageIcon className="w-10 h-10 text-slate-800 mx-auto mb-2" />
                          <p className="text-[10px] text-slate-600 font-black tracking-widest uppercase">Sem Logo Definida</p>
                        </div>
                      )}
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all">
                        <p className="text-white text-xs font-bold uppercase tracking-widest">Alterar Logo</p>
                      </div>
                      <Input 
                        type="file" 
                        accept="image/*"
                        className="absolute inset-0 opacity-0 cursor-pointer"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file || !user) return;
                          try {
                            setSaving(true);
                            const fileExt = file.name.split('.').pop();
                            const fileName = `${user.id}-logo-${Date.now()}.${fileExt}`;
                            const { error: uploadError } = await supabase.storage.from('barber-avatars').upload(fileName, file);
                            if (uploadError) throw uploadError;
                            const { data: { publicUrl } } = supabase.storage.from('barber-avatars').getPublicUrl(fileName);
                            setFormData({ ...formData, barbershop_logo_url: publicUrl });
                            toast.success("Logo atualizada!");
                          } catch (error: any) {
                            toast.error("Erro: " + error.message);
                          } finally {
                            setSaving(false);
                          }
                        }}
                      />
                    </div>
                    <p className="text-[10px] text-slate-500 text-center max-w-[250px] font-medium italic">Recomendamos PNG com fundo transparente ou fundo contrastante.</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="grid gap-2">
                      <Label htmlFor="business_name" className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">Nome da Barbearia</Label>
                      <Input 
                        id="business_name" 
                        value={formData.business_name} 
                        onChange={(e) => setFormData({ ...formData, business_name: e.target.value })}
                        placeholder="Ex: Barbearia Premium"
                        required
                        className="bg-[#05070d] border-[#1f2937] text-white focus:border-[#ea580c] transition-all rounded-xl h-12"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="slug" className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">URL da sua Página</Label>
                      <div className="flex items-center gap-2">
                        <Input 
                          id="slug" 
                          value={formData.slug} 
                          onChange={(e) => setFormData({ ...formData, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') })}
                          placeholder="minha-barbearia"
                          required
                          className="bg-[#05070d] border-[#1f2937] text-white focus:border-[#ea580c] transition-all rounded-xl h-12 flex-1"
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
                          className="h-12 w-12 border-[#1f2937] bg-[#05070d] hover:bg-[#1f2937] text-[#ea580c] transition-all rounded-xl"
                          title="Copiar link"
                        >
                          <Copy className="h-5 w-5" />
                        </Button>
                        <Button 
                          type="button" 
                          variant="outline" 
                          size="icon" 
                          asChild
                          className="h-12 w-12 border-[#1f2937] bg-[#05070d] hover:bg-[#1f2937] text-[#ea580c] transition-all rounded-xl"
                          title="Ver página"
                        >
                          <a href={`/${formData.slug}`} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="h-5 w-5" />
                          </a>
                        </Button>
                      </div>
                      <p className="text-[10px] text-slate-600 font-medium">Link público: {window.location.origin}/{formData.slug}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>



            <TabsContent value="appearance" className="space-y-4">
              <Card className="bg-[#0b0f17] border border-[#1f2937] text-white rounded-[20px] shadow-xl overflow-hidden">
                <CardHeader className="border-b border-[#1f2937]/50 bg-[#0b0f17]/50 p-6">
                  <CardTitle className="text-xl font-black uppercase italic tracking-wider flex items-center gap-2">
                    <Palette className="text-[#ea580c] h-5 w-5" />
                    Personalização Visual
                  </CardTitle>
                  <CardDescription className="text-slate-400">Deixe a página com a cara da sua marca premium.</CardDescription>
                </CardHeader>
                <CardContent className="p-6 space-y-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="grid gap-3">
                      <Label htmlFor="primary_color" className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">Cor Primária (Destaques)</Label>
                      <div className="flex gap-2">
                        <Input 
                          id="primary_color" 
                          type="color" 
                          className="w-14 h-12 p-1 bg-[#05070d] border-[#1f2937] rounded-xl cursor-pointer"
                          value={formData.primary_color} 
                          onChange={(e) => setFormData({ ...formData, primary_color: e.target.value })}
                        />
                        <Input 
                          value={formData.primary_color} 
                          onChange={(e) => setFormData({ ...formData, primary_color: e.target.value })}
                          placeholder="#EA580C"
                          className="bg-[#05070d] border-[#1f2937] text-white focus:border-[#ea580c] transition-all rounded-xl h-12"
                        />
                      </div>
                    </div>
                    <div className="grid gap-3">
                      <Label htmlFor="secondary_color" className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">Cor de Fundo</Label>
                      <div className="flex gap-2">
                        <Input 
                          id="secondary_color" 
                          type="color" 
                          className="w-14 h-12 p-1 bg-[#05070d] border-[#1f2937] rounded-xl cursor-pointer"
                          value={formData.secondary_color} 
                          onChange={(e) => setFormData({ ...formData, secondary_color: e.target.value })}
                        />
                        <Input 
                          value={formData.secondary_color} 
                          onChange={(e) => setFormData({ ...formData, secondary_color: e.target.value })}
                          placeholder="#05070D"
                          className="bg-[#05070d] border-[#1f2937] text-white focus:border-[#ea580c] transition-all rounded-xl h-12"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-6 pt-6 border-t border-[#1f2937]/50">
                    <h4 className="font-black uppercase italic text-[#ea580c] text-xs tracking-[0.2em]">Configurações de Tipografia</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="grid gap-2">
                        <Label htmlFor="font_family" className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">Família de Fonte</Label>
                        <Select 
                          value={formData.font_family} 
                          onValueChange={(value) => setFormData({ ...formData, font_family: value })}
                        >
                          <SelectTrigger id="font_family" className="bg-[#05070d] border-[#1f2937] text-white h-12 rounded-xl focus:ring-[#ea580c]">
                            <SelectValue placeholder="Selecione a fonte" />
                          </SelectTrigger>
                          <SelectContent className="bg-[#0b0f17] border-[#1f2937] text-white">
                            <SelectItem value="Inter">Inter (Padrão)</SelectItem>
                            <SelectItem value="Roboto">Roboto</SelectItem>
                            <SelectItem value="Montserrat">Montserrat</SelectItem>
                            <SelectItem value="Playfair Display">Playfair Display (Elegante)</SelectItem>
                            <SelectItem value="Oswald">Oswald (Moderna)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="font_size" className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">Tamanho Base</Label>
                        <Select 
                          value={formData.font_size} 
                          onValueChange={(value) => setFormData({ ...formData, font_size: value })}
                        >
                          <SelectTrigger id="font_size" className="bg-[#05070d] border-[#1f2937] text-white h-12 rounded-xl focus:ring-[#ea580c]">
                            <SelectValue placeholder="Selecione o tamanho" />
                          </SelectTrigger>
                          <SelectContent className="bg-[#0b0f17] border-[#1f2937] text-white">
                            <SelectItem value="14px">Pequeno (14px)</SelectItem>
                            <SelectItem value="16px">Normal (16px)</SelectItem>
                            <SelectItem value="18px">Médio (18px)</SelectItem>
                            <SelectItem value="20px">Grande (20px)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="font_color" className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">Cor do Texto</Label>
                        <div className="flex gap-2">
                          <Input 
                            id="font_color" 
                            type="color" 
                            className="w-14 h-12 p-1 bg-[#05070d] border-[#1f2937] rounded-xl cursor-pointer"
                            value={formData.font_color} 
                            onChange={(e) => setFormData({ ...formData, font_color: e.target.value })}
                          />
                          <Input 
                            value={formData.font_color} 
                            onChange={(e) => setFormData({ ...formData, font_color: e.target.value })}
                            placeholder="#FFFFFF"
                            className="bg-[#05070d] border-[#1f2937] text-white focus:border-[#ea580c] transition-all rounded-xl h-12"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-6 pt-6 border-t border-[#1f2937]/50">
                    <h4 className="font-black uppercase italic text-[#ea580c] text-xs tracking-[0.2em]">Logo de Rodapé/Fundo</h4>
                    <div className="flex flex-col sm:flex-row items-center gap-6 bg-[#05070d]/30 p-6 rounded-2xl border border-[#1f2937]/30">
                      <div className="h-24 w-24 rounded-xl bg-[#05070d] flex items-center justify-center overflow-hidden border border-[#1f2937] shadow-inner shrink-0">
                        {formData.logo_url ? (
                          <img src={formData.logo_url} alt="Logo Preview" className="h-full w-full object-contain p-2" />
                        ) : (
                          <Upload className="h-8 w-8 text-slate-800" />
                        )}
                      </div>
                      <div className="flex-1 space-y-3 w-full">
                        <Label htmlFor="logo_file" className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">Anexar Arquivo de Logo</Label>
                        <Input 
                          id="logo_file" 
                          type="file" 
                          accept="image/*"
                          className="h-11 rounded-xl cursor-pointer bg-[#05070d] border-[#1f2937] text-white file:bg-[#ea580c] file:text-black file:font-bold file:border-none file:px-4 file:h-full file:mr-4"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file || !user) return;
                            
                            try {
                              setSaving(true);
                              const fileExt = file.name.split('.').pop();
                              const fileName = `${user.id}-logo-${Math.random()}.${fileExt}`;
                              
                              const { error: uploadError } = await supabase.storage
                                .from('barber-avatars') 
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
                        <p className="text-[10px] text-slate-500 font-medium italic">Fundo transparente altamente recomendado.</p>
                      </div>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="logo_url" className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">Ou Link Direto da Imagem (URL)</Label>
                      <Input 
                        id="logo_url" 
                        value={formData.logo_url} 
                        onChange={(e) => setFormData({ ...formData, logo_url: e.target.value })}
                        placeholder="https://exemplo.com/logo.png"
                        className="bg-[#05070d] border-[#1f2937] text-white focus:border-[#ea580c] transition-all rounded-xl h-12"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="scheduling" className="space-y-4">
              <Card className="bg-[#0b0f17] border border-[#1f2937] text-white rounded-[20px] shadow-xl overflow-hidden">
                <CardHeader className="border-b border-[#1f2937]/50 bg-[#0b0f17]/50 p-6">
                  <CardTitle className="text-xl font-black uppercase italic tracking-wider flex items-center gap-2">
                    <Calendar className="text-[#ea580c] h-5 w-5" />
                    Configurações de Agendamento
                  </CardTitle>
                  <CardDescription className="text-slate-400">Defina como seus clientes podem marcar horários premium.</CardDescription>
                </CardHeader>
                <CardContent className="p-6 space-y-6">
                  <div className="grid grid-cols-1 gap-4">
                    <div 
                      className={cn(
                        "flex items-start gap-4 p-5 border rounded-2xl transition-all cursor-pointer group",
                        formData.scheduling_mode === 'manual' 
                          ? "bg-[#ea580c]/5 border-[#ea580c] shadow-[0_0_15px_rgba(234,88,12,0.1)]" 
                          : "bg-[#05070d] border-[#1f2937] hover:border-[#ea580c]/30"
                      )} 
                      onClick={() => setFormData({ ...formData, scheduling_mode: "manual" })}
                    >
                      <div className="mt-1">
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${formData.scheduling_mode === 'manual' ? 'border-[#ea580c]' : 'border-slate-700'}`}>
                          {formData.scheduling_mode === 'manual' && <div className="w-2.5 h-2.5 rounded-full bg-[#ea580c]" />}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-base font-black uppercase italic cursor-pointer group-hover:text-[#ea580c] transition-colors">Agendamento Manual</Label>
                        <p className="text-xs text-slate-400 font-medium leading-relaxed">
                          Seus clientes verão seu contato de WhatsApp e deverão entrar em contato para agendar. Você insere o horário manualmente na agenda.
                        </p>
                      </div>
                    </div>

                    <div 
                      className={cn(
                        "flex items-start gap-4 p-5 border rounded-2xl transition-all cursor-pointer group",
                        formData.scheduling_mode === 'automatic' 
                          ? "bg-[#ea580c]/5 border-[#ea580c] shadow-[0_0_15px_rgba(234,88,12,0.1)]" 
                          : "bg-[#05070d] border-[#1f2937] hover:border-[#ea580c]/30"
                      )} 
                      onClick={() => setFormData({ ...formData, scheduling_mode: "automatic" })}
                    >
                      <div className="mt-1">
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${formData.scheduling_mode === 'automatic' ? 'border-[#ea580c]' : 'border-slate-700'}`}>
                          {formData.scheduling_mode === 'automatic' && <div className="w-2.5 h-2.5 rounded-full bg-[#ea580c]" />}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-base font-black uppercase italic cursor-pointer group-hover:text-[#ea580c] transition-colors">Agendamento Automático (Self-Service)</Label>
                        <p className="text-xs text-slate-400 font-medium leading-relaxed">
                          Seus clientes escolhem o serviço, profissional e horário diretamente na sua página. O agendamento é confirmado automaticamente conforme sua disponibilidade.
                        </p>
                      </div>
                    </div>
                  </div>

                  {formData.scheduling_mode === 'automatic' && (
                    <div className="bg-[#ea580c]/10 p-5 rounded-2xl border border-[#ea580c]/20 animate-in fade-in slide-in-from-top-2">
                      <div className="flex items-center gap-2 text-[#ea580c] font-black uppercase text-xs tracking-widest mb-1 italic">
                        <CheckCircle2 size={14} />
                        <span>Recomendado para Máxima Conversão</span>
                      </div>
                      <p className="text-[10px] text-slate-500 font-bold leading-relaxed uppercase">
                        O modo automático aumenta sua produtividade e permite que clientes agendem mesmo fora do horário comercial.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="coupons" className="space-y-4">
              <CouponManagement />
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
                    <div className="flex flex-col items-center gap-6">
                      <div className="h-32 w-32 rounded-lg bg-muted flex items-center justify-center overflow-hidden border shadow-inner">
                        {formData.pix_qr_code_url ? (
                          <img src={formData.pix_qr_code_url} alt="PIX QR Code Preview" className="h-full w-full object-contain" />
                        ) : (
                          <QrCode className="h-12 w-12 text-muted-foreground/30" />
                        )}
                      </div>
                      <div className="w-full space-y-3">
                        <Label htmlFor="pix_qr_file" className="text-center block text-sm font-bold text-slate-500 uppercase tracking-widest">Upload do QR Code (Imagem)</Label>
                        <Input 
                          id="pix_qr_file" 
                          type="file" 
                          accept="image/*"
                          className="h-12 rounded-[14px] cursor-pointer bg-slate-50/50"
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
                        <p className="text-[10px] text-muted-foreground text-center">Upload da imagem do seu QR Code gerado pelo banco para facilitar pagamentos Pix.</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <div className="flex justify-end pt-6">
              <Button type="submit" className="gap-2 bg-black text-white hover:scale-105 transition-all h-12 px-8 rounded-xl font-bold uppercase tracking-tight" disabled={saving}>
                <Save size={18} /> {saving ? "Salvando..." : "Salvar Configurações (Confirmar)"}
              </Button>
            </div>
          </form>
        </Tabs>
      </div>
    </AppLayout>
  );
}
