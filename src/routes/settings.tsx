import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { AppLayout } from "@/components/layout/AppLayout";
import { PortalContentEditor } from "@/components/settings/PortalContentEditor";
import { CheckinQRCard } from "@/components/settings/CheckinQRCard";
import { useAuth } from "@/hooks/use-auth";
import { useTenant } from "@/hooks/use-tenant";
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
  History,
  Info,
  Layout,
  ShieldCheck,
  AlertTriangle,
  Coins,
  Trophy
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ModulesSettings } from "@/components/settings/ModulesSettings";
import { WhatsAppSettings } from "@/components/settings/WhatsAppSettings";
import { InternalRecipientsSettings } from "@/components/settings/InternalRecipientsSettings";
import { PaymentsSettings } from "@/components/settings/PaymentsSettings";
import { LgpdSettings } from "@/components/settings/LgpdSettings";
import { DangerZone } from "@/components/settings/DangerZone";
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

function normalizeSocial(kind: "instagram" | "facebook" | "tiktok" | "youtube" | "whatsapp", raw: string): string {
  const v = (raw || "").trim();
  if (!v) return "";
  if (kind === "whatsapp") {
    if (/^https?:\/\//i.test(v)) return v;
    const digits = v.replace(/\D/g, "");
    return digits ? `https://wa.me/${digits}` : "";
  }
  if (/^https?:\/\//i.test(v)) return v;
  const handle = v.replace(/^@/, "").replace(/\s+/g, "");
  if (!handle) return "";
  switch (kind) {
    case "instagram": return `https://instagram.com/${handle}`;
    case "facebook": return `https://facebook.com/${handle}`;
    case "tiktok": return `https://tiktok.com/@${handle}`;
    case "youtube": return `https://youtube.com/@${handle}`;
  }
}

function SettingsComponent() {
  const { user, loading, role } = useAuth();
  const { tenantId } = useTenant();
  const effectiveTenantId = tenantId || user?.id || null;
  const navigate = useNavigate();
  const { plan, limits, usage, checkLimit, refresh: refreshLimits } = usePlanLimits();
  const [saving, setSaving] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);


  const [formData, setFormData] = useState<any>({
    business_name: "",
    responsible_name: "",
    slug: "",
    whatsapp_enabled: false,
    scheduling_mode: "automatic" as "manual" | "automatic",
    slot_buffer_minutes: 0,

    payment_gateway_provider: "none",
    payment_gateway_key: "",
    primary_color: "",
    secondary_color: "",
    logo_url: "",
    avatar_url: "",
    barbershop_logo_url: "",

    loyalty_mode: "none" as "none" | "cashback" | "loyalty" | "subscription",
    cashback_enabled: false,
    cashback_percentage: 0,
    cashback_type: "percentage",
    cashback_fixed_value: 0,
    cashback_minimum_amount: 0,
    cashback_expiration_days: 0,
    free_service_threshold: 10,
    // Novo módulo de fidelidade (loyalty_settings)
    loyalty_enabled: false,
    loyalty_appointments_required: 10,
    loyalty_benefit_type: "free_service" as "free_service" | "percent_discount" | "fixed_discount" | "free_addon",
    loyalty_benefit_value: 0,
    loyalty_benefit_description: "Serviço grátis",
    loyalty_max_benefit_value: 0,
    loyalty_validity_days: 0,
    loyalty_premium_enabled: false,
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
    opening_date: "",
    cancellation_window_hours: 2,
    barber_can_cancel: false,
    barber_can_reschedule: false,
    social_instagram: "",
    social_facebook: "",
    social_tiktok: "",
    social_youtube: "",
    social_whatsapp: "",
    gallery_images: [] as string[],
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

  const [debugInfo, setDebugInfo] = useState<any>(null);

  useEffect(() => {
    console.log("[/settings] AUTH USER:", user);
    console.log("[/settings] USER ID:", user?.id);
    console.log("[/settings] ROLE:", role);
    console.log("[/settings] TENANT ID RESOLVIDO:", effectiveTenantId);
    if (user && role !== 'super_admin' && effectiveTenantId) {
      fetchProfile();
    }
  }, [user, role, effectiveTenantId]);

  async function fetchProfile() {
    if (!effectiveTenantId) {
      console.warn("[/settings] fetchProfile called without effectiveTenantId");
      return;
    }

    console.log("[/settings] Fetching profile for tenant ID:", effectiveTenantId);

    try {
      // Fetch profile
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", effectiveTenantId);

      console.log("[/settings] PROFILE RESULT:", profileData);
      console.log("[/settings] PROFILE ERROR:", profileError);

      if (profileError) {
        console.error("[/settings] Supabase error fetching profile:", profileError);
        toast.error(`Erro ao carregar configurações: ${profileError.message}`);
        return;
      }

      // Fetch barbershop settings
      const { data: settingsData, error: settingsError } = await supabase
        .from("barbershop_settings")
        .select("*")
        .eq("barber_id", effectiveTenantId)
        .maybeSingle();

      if (settingsError) {
        console.error("[/settings] Error fetching barbershop settings:", settingsError);
      }

      // Fetch barbershops row (business-level source of truth for logo/name/slug)
      const { data: shopData, error: shopError } = await supabase
        .from("barbershops")
        .select("name, slug, logo_url")
        .eq("owner_id", effectiveTenantId)
        .maybeSingle();

      console.log("[/settings] BARBERSHOP RESULT:", shopData);
      console.log("[/settings] BARBERSHOP ERROR:", shopError);

      // Fetch loyalty settings (novo módulo)
      const { data: loyaltyData } = await supabase
        .from("loyalty_settings" as any)
        .select("*")
        .eq("tenant_id", effectiveTenantId)
        .maybeSingle();

      // Snapshot for on-screen debug panel
      const profileRow = profileData && profileData[0];
      setDebugInfo({
        user_id: user?.id,
        tenant_id: effectiveTenantId,
        profile_id: profileRow?.id ?? null,
        profile_error: profileError,
        shop_error: shopError,
        business_name: profileRow?.business_name ?? null,
        slug: profileRow?.slug ?? null,
        logo_url: profileRow?.logo_url ?? null,
        barbershop_logo_url: (profileRow as any)?.barbershop_logo_url ?? null,
        avatar_url: (profileRow as any)?.avatar_url ?? null,
        primary_color: profileRow?.primary_color ?? null,
        secondary_color: profileRow?.secondary_color ?? null,
        pix_key: profileRow?.pix_key ?? null,
        pix_qr_code_url: profileRow?.pix_qr_code_url ?? null,
        opening_date: profileRow?.opening_date ?? null,
        shop_name: shopData?.name ?? null,
        shop_slug: shopData?.slug ?? null,
        shop_logo_url: shopData?.logo_url ?? null,
      });


      if (profileData && profileData.length > 0) {
        const profile = profileData[0];
        const businessLogo =
          (profile as any).barbershop_logo_url ||
          profile.logo_url ||
          shopData?.logo_url ||
          "";
        setFormData({
          business_name: profile.business_name || shopData?.name || "",
          responsible_name: (profile as any).responsible_name || "",
          slug: profile.slug || shopData?.slug || "",
          whatsapp_enabled: profile.whatsapp_enabled || false,
          scheduling_mode: (profile.scheduling_mode as "manual" | "automatic") || "automatic",
          slot_buffer_minutes: Number((profile as any).slot_buffer_minutes || 0),

          payment_gateway_provider: profile.payment_gateway_provider || "none",
          payment_gateway_key: profile.payment_gateway_key || "",
          primary_color: profile.primary_color || "",
          secondary_color: profile.secondary_color || "",
          logo_url: profile.logo_url || shopData?.logo_url || "",
          avatar_url: (profile as any).avatar_url || "",
          barbershop_logo_url: businessLogo,

          loyalty_mode: ((profile as any).loyalty_mode as any) || "none",
          cashback_enabled: profile.cashback_enabled || false,
          cashback_percentage: profile.cashback_percentage || 0,
          cashback_type: profile.cashback_type || "percentage",
          cashback_fixed_value: profile.cashback_fixed_value || 0,
          cashback_minimum_amount: profile.cashback_minimum_amount || 0,
          cashback_expiration_days: profile.cashback_expiration_days || 0,
          free_service_threshold: profile.free_service_threshold || 10,
          loyalty_enabled: (loyaltyData as any)?.enabled ?? false,
          loyalty_appointments_required: (loyaltyData as any)?.appointments_required ?? 10,
          loyalty_benefit_type: ((loyaltyData as any)?.benefit_type as any) ?? "free_service",
          loyalty_benefit_value: Number((loyaltyData as any)?.benefit_value ?? 0),
          loyalty_benefit_description: (loyaltyData as any)?.benefit_description ?? "Serviço grátis",
          loyalty_max_benefit_value: Number((loyaltyData as any)?.max_benefit_value ?? 0),
          loyalty_validity_days: (loyaltyData as any)?.validity_days ?? 0,
          loyalty_premium_enabled: (loyaltyData as any)?.premium_enabled ?? false,

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
          opening_date: profile.opening_date || "",
          cancellation_window_hours: profile.cancellation_window_hours ?? 2,
          barber_can_cancel: (profile as any).barber_can_cancel ?? false,
          barber_can_reschedule: (profile as any).barber_can_reschedule ?? false,
          social_instagram: (profile as any).social_links?.instagram || "",
          social_facebook: (profile as any).social_links?.facebook || "",
          social_tiktok: (profile as any).social_links?.tiktok || "",
          social_youtube: (profile as any).social_links?.youtube || "",
          social_whatsapp: (profile as any).social_links?.whatsapp || "",
          gallery_images: Array.isArray((profile as any).gallery_images) ? (profile as any).gallery_images : [],
        });
        setDataLoaded(true);
        console.log("[/settings] SETTINGS FORM VALUES applied for profile:", profile.id, {
          business_name: profile.business_name,
          slug: profile.slug,
          logo_url: profile.logo_url,
          barbershop_logo_url: (profile as any).barbershop_logo_url,
          avatar_url: (profile as any).avatar_url,
          primary_color: profile.primary_color,
          pix_key: profile.pix_key,
          pix_qr_code_url: profile.pix_qr_code_url,
        });
      } else {
        console.warn("[/settings] Perfil não encontrado para id:", effectiveTenantId);
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
    if (!dataLoaded) {
      toast.error("Aguarde o carregamento dos dados antes de salvar.");
      return;
    }

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
        responsible_name: profileUpdateData.responsible_name,
        slug: profileUpdateData.slug,
        whatsapp_enabled: profileUpdateData.whatsapp_enabled,
        scheduling_mode: profileUpdateData.scheduling_mode,
        slot_buffer_minutes: Number(profileUpdateData.slot_buffer_minutes || 0),

        payment_gateway_provider: profileUpdateData.payment_gateway_provider === "none" ? null : profileUpdateData.payment_gateway_provider,
        payment_gateway_key: profileUpdateData.payment_gateway_key,
        ...(profileUpdateData.primary_color ? { primary_color: profileUpdateData.primary_color } : {}),
        ...(profileUpdateData.secondary_color ? { secondary_color: profileUpdateData.secondary_color } : {}),
        logo_url: profileUpdateData.logo_url,
        avatar_url: profileUpdateData.avatar_url,
        barbershop_logo_url: updatedData.barbershop_logo_url,

        // loyalty_mode mantido por compatibilidade — derivado dos switches independentes
        loyalty_mode: profileUpdateData.loyalty_enabled
          ? 'loyalty'
          : (profileUpdateData.cashback_enabled ? 'cashback' : 'none'),
        cashback_enabled: !!profileUpdateData.cashback_enabled,
        cashback_percentage: profileUpdateData.cashback_percentage,
        cashback_type: profileUpdateData.cashback_type,
        cashback_fixed_value: profileUpdateData.cashback_fixed_value,
        cashback_minimum_amount: profileUpdateData.cashback_minimum_amount,
        cashback_expiration_days: parseInt(profileUpdateData.cashback_expiration_days) || null,
        free_service_threshold: profileUpdateData.loyalty_appointments_required || profileUpdateData.free_service_threshold,

        address: profileUpdateData.address,
        google_maps_url: profileUpdateData.google_maps_url,
        font_family: profileUpdateData.font_family,
        font_size: profileUpdateData.font_size,
        font_color: profileUpdateData.font_color,
        pix_key: profileUpdateData.pix_key,
        pix_qr_code_url: profileUpdateData.pix_qr_code_url,
        whatsapp_number: profileUpdateData.whatsapp_number,
        opening_date: profileUpdateData.opening_date || null,
        cancellation_window_hours: parseInt(profileUpdateData.cancellation_window_hours) || 2,
        barber_can_cancel: !!profileUpdateData.barber_can_cancel,
        barber_can_reschedule: !!profileUpdateData.barber_can_reschedule,
        social_links: {
          instagram: normalizeSocial("instagram", profileUpdateData.social_instagram),
          facebook: normalizeSocial("facebook", profileUpdateData.social_facebook),
          tiktok: normalizeSocial("tiktok", profileUpdateData.social_tiktok),
          youtube: normalizeSocial("youtube", profileUpdateData.social_youtube),
          whatsapp: normalizeSocial("whatsapp", profileUpdateData.social_whatsapp),
        },
        gallery_images: Array.isArray(profileUpdateData.gallery_images) ? profileUpdateData.gallery_images : [],
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

    // Save loyalty_settings (módulo de fidelidade tradicional — switch independente)
    const loyaltyEnabledFinal = !!updatedData.loyalty_enabled;
    const { error: loyaltyError } = await supabase
      .from("loyalty_settings" as any)
      .upsert({
        tenant_id: user.id,
        enabled: loyaltyEnabledFinal,
        appointments_required: Math.max(1, parseInt(String(updatedData.loyalty_appointments_required)) || 10),
        benefit_type: updatedData.loyalty_benefit_type || 'free_service',
        benefit_value: Number(updatedData.loyalty_benefit_value) || 0,
        benefit_description: updatedData.loyalty_benefit_description || 'Serviço grátis',
        max_benefit_value: Number(updatedData.loyalty_max_benefit_value) || 0,
        validity_days: Math.max(0, parseInt(String(updatedData.loyalty_validity_days)) || 0),
        premium_enabled: !!updatedData.loyalty_premium_enabled,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'tenant_id' });


    setSaving(false);

    if (profileError || settingsError || loyaltyError) {
      const error = profileError || settingsError || loyaltyError;

      if (error?.code === "23505") {
        toast.error("Este endereço (URL) já está em uso.");
      } else {
        toast.error("Erro ao salvar configurações: " + error?.message);
      }
      return;
    }

    toast.success("Configurações salvas com sucesso!");
    // Invalidate auth and profile queries to reflect changes in the header immediately
    await supabase.auth.refreshSession();
    // Re-fetch local data to keep everything in sync
    await fetchProfile();
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

        {/* TEMPORARY DEBUG PANEL — remover após validação */}
        {debugInfo && (
          <details className="rounded-2xl border border-amber-500/40 bg-amber-500/5 p-4 text-[11px] text-amber-100" open>
            <summary className="cursor-pointer text-amber-300 font-black uppercase tracking-widest text-[11px]">
              🔎 Debug Settings Data (temporário)
            </summary>
            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1 font-mono">
              {Object.entries(debugInfo).map(([k, v]) => (
                <div key={k} className="flex gap-2 border-b border-amber-500/10 py-1">
                  <span className="text-amber-400 min-w-[170px]">{k}:</span>
                  <span className="break-all text-white/90">
                    {v === null || v === undefined ? <em className="text-red-400">null</em> : typeof v === "object" ? JSON.stringify(v) : String(v)}
                  </span>
                </div>
              ))}
            </div>
          </details>
        )}

        <Tabs defaultValue="general" className="space-y-0">
          <div className="premium-tabs-scroll overflow-x-auto bg-[#050816] px-2 pt-2 -mx-4 sm:mx-0 rounded-t-[24px]">
            <TabsList className="flex w-max min-w-full items-end gap-1 bg-transparent p-0 h-auto">
              {[
                { value: "general", icon: Globe, label: "Geral" },
                { value: "profile", icon: UserRound, label: "Perfil" },
                { value: "modules", icon: Layout, label: "Módulos" },
                { value: "appearance", icon: Palette, label: "Aparência" },
                { value: "scheduling", icon: Calendar, label: "Agenda" },
                { value: "coupons", icon: Gift, label: "Cupons" },
                { value: "whatsapp", icon: MessageSquare, label: "WhatsApp" },
                { value: "payments", icon: CreditCard, label: "Pagamentos" },
                { value: "loyalty", icon: Gift, label: "Fidelidade" },
                { value: "pix", icon: QrCode, label: "PIX" },
                { value: "lgpd", icon: ShieldCheck, label: "LGPD" },
                { value: "danger", icon: AlertTriangle, label: "Zona de Perigo" },
              ].map((tab) => (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  className="gap-2 h-11 px-5 rounded-t-[22px] rounded-b-none text-[12px] sm:text-[13px] font-semibold uppercase tracking-wider whitespace-nowrap transition-all duration-300 data-[state=active]:bg-white data-[state=active]:text-[#111111] data-[state=active]:font-bold data-[state=active]:shadow-[0_-2px_12px_rgba(0,0,0,.15)] data-[state=inactive]:bg-transparent data-[state=inactive]:text-white/70 data-[state=inactive]:hover:text-white"
                >
                  <tab.icon size={15} /> <span>{tab.label}</span>
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          <div className="rounded-b-[24px] sm:rounded-[24px] sm:rounded-tl-none border border-[rgba(255,184,0,0.15)] bg-[#0A1020] p-4 md:p-6 -mx-4 sm:mx-0">


          <TabsContent value="modules" className="space-y-4">
            <ModulesSettings />
          </TabsContent>

          <TabsContent value="lgpd" className="space-y-4">
            <LgpdSettings />
          </TabsContent>

          <TabsContent value="danger" className="space-y-4">
            <DangerZone />
          </TabsContent>



          {!dataLoaded && (
            <div className="mt-4 mb-2 flex items-center gap-3 rounded-2xl border border-[#1f2937] bg-[#0b0f17] px-4 py-3 text-slate-400">
              <RefreshCw className="h-4 w-4 animate-spin text-[#ea580c]" />
              <span className="text-xs font-bold uppercase tracking-widest">Carregando suas configurações…</span>
            </div>
          )}

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
                  <div className="flex flex-col md:flex-row items-center md:items-start gap-8">
                    <div className="flex flex-col items-center gap-4 shrink-0">
                      <div className="h-28 w-28 rounded-full bg-[#05070d] flex items-center justify-center overflow-hidden border-2 border-[#ea580c]/30 shadow-[0_0_20px_rgba(234,88,12,0.1)]">
                        {formData.avatar_url ? (
                          <img src={formData.avatar_url} alt="Profile" className="h-full w-full object-cover" />
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
                              
                              setFormData({ ...formData, avatar_url: publicUrl });
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


                    <div className="flex-1 w-full grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                      <div className="grid gap-2">
                        <Label className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">E-mail (Login)</Label>
                        <Input value={user?.email || ""} disabled className="bg-[#05070d]/50 border-[#1f2937] text-slate-500 cursor-not-allowed h-12 rounded-xl" />
                        <p className="text-[10px] text-slate-600 font-medium italic">O e-mail não pode ser alterado diretamente.</p>
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="profile_name" className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">Nome para Exibição</Label>
                        <Input 
                          id="profile_name" 
                          value={formData.responsible_name} 
                          onChange={(e) => setFormData({ ...formData, responsible_name: e.target.value })}
                          placeholder="Seu nome (administrador)"
                          className="bg-[#05070d] border-[#1f2937] text-white focus:border-[#ea580c] transition-all rounded-xl h-12"
                        />
                      </div>
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
                    size="sm" 
                    type="button"
                    onClick={handleForceSync}
                    disabled={isSyncing}
                    className="group relative overflow-hidden gap-2 h-10 px-5 rounded-[10px] bg-gradient-to-r from-gold via-[#F5D877] to-gold text-black font-black uppercase text-xs tracking-wider shadow-[0_4px_16px_rgba(212,175,55,0.28)] hover:shadow-[0_6px_22px_rgba(212,175,55,0.45)] transition-all disabled:opacity-60"
                  >
                    <span className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/40 to-transparent" />
                    <RefreshCw className={`relative h-4 w-4 ${isSyncing ? "animate-spin" : ""}`} />
                    <span className="relative">{isSyncing ? "Sincronizando..." : "Sincronizar"}</span>
                  </Button>
                </CardHeader>
                <CardContent className="p-6 space-y-8">
                  <div className="flex flex-col md:flex-row items-center md:items-start gap-8 py-6 border-b border-[#1f2937]/50 mb-4 bg-[#05070d]/30 rounded-2xl p-6">
                    <div className="flex flex-col items-center gap-4 shrink-0">
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#ea580c]">Logo da Barbearia</p>
                      <div className="h-40 w-44 rounded-2xl bg-[#05070d] border-2 border-dashed border-[#1f2937] flex items-center justify-center overflow-hidden relative group hover:border-[#ea580c]/50 transition-all shadow-inner">
                        {formData.barbershop_logo_url ? (
                          <img src={formData.barbershop_logo_url} alt="Logo" className="h-full w-full object-contain p-4 transition-transform group-hover:scale-105" />
                        ) : (
                          <div className="text-center p-4">
                            <ImageIcon className="w-10 h-10 text-slate-800 mx-auto mb-2" />
                            <p className="text-[10px] text-slate-600 font-black tracking-widest uppercase">Sem Logo</p>
                          </div>
                        )}
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all">
                          <p className="text-white text-[10px] font-bold uppercase tracking-widest">Alterar</p>
                        </div>
                        <input 
                          type="file" 
                          accept="image/*"
                          className="absolute inset-0 opacity-0 cursor-pointer"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file || !user) return;
                            try {
                              setSaving(true);
                              const fileExt = file.name.split('.').pop();
                              const fileName = `${user.id}/${user.id}-logo-${Date.now()}.${fileExt}`;
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
                      <p className="text-[10px] text-slate-500 text-center max-w-[150px] font-medium italic">PNG transparente recomendado.</p>
                    </div>

                    <div className="flex-1 w-full grid grid-cols-1 md:grid-cols-1 gap-6 pt-4">
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
                        <p className="text-[10px] text-slate-600 font-medium italic">Link público: {window.location.origin}/{formData.slug}</p>
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="opening_date" className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">Data de inauguração da barbearia</Label>
                        <Input 
                          id="opening_date" 
                          type="date"
                          value={formData.opening_date} 
                          onChange={(e) => setFormData({ ...formData, opening_date: e.target.value })}
                          className="bg-[#05070d] border-[#1f2937] text-white focus:border-[#ea580c] transition-all rounded-xl h-12"
                        />
                      </div>
                      <div className="grid gap-2 md:col-span-2">
                        <Label htmlFor="address" className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">Endereço completo</Label>
                        <Input
                          id="address"
                          value={formData.address}
                          onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                          placeholder="Rua, número, bairro, cidade - UF"
                          className="bg-[#05070d] border-[#1f2937] text-white focus:border-[#ea580c] transition-all rounded-xl h-12"
                        />
                        <p className="text-[10px] text-slate-600 font-medium italic">Aparece no rodapé e no mapa da página pública da barbearia.</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-[#0b0f17] border border-[#1f2937] text-white rounded-[20px] shadow-xl overflow-hidden">
                <CardHeader className="border-b border-[#1f2937]/50 bg-[#0b0f17]/50 p-6">
                  <CardTitle className="text-xl font-black uppercase italic tracking-wider flex items-center gap-2">
                    <Globe className="text-[#ea580c] h-5 w-5" />
                    Redes Sociais
                  </CardTitle>
                  <CardDescription className="text-slate-400 font-medium">
                    Cole a URL completa ou o @usuário. Campos vazios não aparecem no site público.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-6 grid gap-5 md:grid-cols-2">
                  {[
                    { key: "social_instagram", label: "Instagram", ph: "@suabarbearia ou https://instagram.com/..." },
                    { key: "social_facebook", label: "Facebook", ph: "suabarbearia ou https://facebook.com/..." },
                    { key: "social_tiktok", label: "TikTok", ph: "@suabarbearia ou https://tiktok.com/@..." },
                    { key: "social_youtube", label: "YouTube", ph: "@suabarbearia ou https://youtube.com/@..." },
                    { key: "social_whatsapp", label: "WhatsApp", ph: "5571999999999 ou https://wa.me/..." },
                  ].map((f) => (
                    <div key={f.key} className="grid gap-2">
                      <Label htmlFor={f.key} className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">{f.label}</Label>
                      <Input
                        id={f.key}
                        value={(formData as any)[f.key]}
                        onChange={(e) => setFormData({ ...formData, [f.key]: e.target.value })}
                        placeholder={f.ph}
                        className="bg-[#05070d] border-[#1f2937] text-white focus:border-[#ea580c] transition-all rounded-xl h-12"
                      />
                    </div>
                  ))}
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

                  <div className="space-y-6 pt-6 border-t border-[#1f2937]/50">
                    <div>
                      <h4 className="font-black uppercase italic text-[#ea580c] text-xs tracking-[0.2em]">Galeria de Fotos</h4>
                      <p className="text-[11px] text-slate-500 font-medium mt-1">Fotos aparecerão na página pública, entre a seção "Especialistas" e "Depoimentos". Se você não cadastrar nenhuma foto, a seção não aparece.</p>
                    </div>

                    <div className="bg-[#05070d]/30 p-6 rounded-2xl border border-[#1f2937]/30 space-y-4">
                      <Label htmlFor="gallery_files" className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">Adicionar Fotos (várias de uma vez)</Label>
                      <Input
                        id="gallery_files"
                        type="file"
                        accept="image/*"
                        multiple
                        className="h-11 rounded-xl cursor-pointer bg-[#05070d] border-[#1f2937] text-white file:bg-[#ea580c] file:text-black file:font-bold file:border-none file:px-4 file:h-full file:mr-4"
                        onChange={async (e) => {
                          const files = Array.from(e.target.files || []);
                          if (!files.length || !user) return;
                          try {
                            setSaving(true);
                            const uploadedUrls: string[] = [];
                            for (const file of files) {
                              const fileExt = file.name.split('.').pop();
                              const fileName = `${user.id}/${user.id}-gallery-${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`;
                              const { error: uploadError } = await supabase.storage
                                .from('barber-avatars')
                                .upload(fileName, file);
                              if (uploadError) throw uploadError;
                              const { data: { publicUrl } } = supabase.storage
                                .from('barber-avatars')
                                .getPublicUrl(fileName);
                              uploadedUrls.push(publicUrl);
                            }
                            setFormData({ ...formData, gallery_images: [...(formData.gallery_images || []), ...uploadedUrls] });
                            toast.success(`${uploadedUrls.length} foto(s) adicionada(s)! Clique em salvar para publicar.`);
                            (e.target as HTMLInputElement).value = "";
                          } catch (error: any) {
                            toast.error("Erro ao carregar foto: " + error.message);
                          } finally {
                            setSaving(false);
                          }
                        }}
                      />
                      <p className="text-[10px] text-slate-500 font-medium italic">Sugestão: fotos horizontais 4:3 em alta resolução do ambiente, cortes prontos, produtos, equipe em ação.</p>

                      {formData.gallery_images && formData.gallery_images.length > 0 ? (
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 pt-2">
                          {formData.gallery_images.map((url: string, idx: number) => (
                            <div key={`${url}-${idx}`} className="relative group aspect-square rounded-xl overflow-hidden border border-[#1f2937] bg-[#05070d]">
                              <img src={url} alt={`Foto ${idx + 1}`} className="h-full w-full object-cover" />
                              <button
                                type="button"
                                onClick={() => {
                                  const next = [...formData.gallery_images];
                                  next.splice(idx, 1);
                                  setFormData({ ...formData, gallery_images: next });
                                }}
                                className="absolute top-2 right-2 h-8 w-8 rounded-lg bg-black/70 border border-red-500/40 text-red-400 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center hover:bg-red-500/20"
                                aria-label="Remover foto"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="rounded-xl border border-dashed border-[#1f2937] p-6 text-center text-[11px] text-slate-500 font-medium uppercase tracking-widest">
                          Nenhuma foto cadastrada — a seção não aparecerá no site.
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-[#0b0f17] border border-[#1f2937] text-white rounded-[20px] shadow-xl overflow-hidden">
                <CardHeader className="border-b border-[#1f2937]/50 bg-[#0b0f17]/50 p-6">
                  <CardTitle className="text-xl font-black uppercase italic tracking-wider">Conteúdo do Portal</CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  <PortalContentEditor userId={user?.id} />
                </CardContent>
              </Card>
              <CheckinQRCard />
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

                  <div className="space-y-2 rounded-2xl border border-[#1f2937] bg-[#05070d] p-5">
                    <Label className="text-base font-black uppercase italic">Intervalo entre atendimentos</Label>
                    <p className="text-xs text-slate-400 font-medium leading-relaxed">
                      Tempo reservado automaticamente após cada atendimento (limpeza, higienização e organização).
                    </p>
                    <Select
                      value={String(formData.slot_buffer_minutes ?? 0)}
                      onValueChange={(v) => setFormData({ ...formData, slot_buffer_minutes: Number(v) })}
                    >
                      <SelectTrigger className="h-12 bg-[#0b0f17] border-[#1f2937] text-white">
                        <SelectValue placeholder="0 minutos" />
                      </SelectTrigger>
                      <SelectContent>
                        {[0, 5, 10, 15, 20, 30].map((m) => (
                          <SelectItem key={m} value={String(m)}>
                            {m} minutos
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>


              <Card className="bg-[#0b0f17] border border-[#1f2937] text-white rounded-[20px] shadow-xl overflow-hidden mt-6">
                <CardHeader className="border-b border-[#1f2937]/50 bg-[#0b0f17]/50 p-6">
                  <CardTitle className="text-xl font-black uppercase italic tracking-wider flex items-center gap-2">
                    <Trash2 className="text-[#ea580c] h-5 w-5" />
                    Política de Cancelamento
                  </CardTitle>
                  <CardDescription className="text-slate-400">Configure as regras para cancelamentos de clientes via link público.</CardDescription>
                </CardHeader>
                <CardContent className="p-6 space-y-6">
                  <div className="grid gap-2">
                    <Label htmlFor="cancellation_window" className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">Antecedência Mínima para Cancelamento (Horas)</Label>
                    <Input 
                      id="cancellation_window" 
                      type="number"
                      min="0"
                      value={formData.cancellation_window_hours} 
                      onChange={(e) => setFormData({ ...formData, cancellation_window_hours: e.target.value })}
                      placeholder="Ex: 2"
                      className="bg-[#05070d] border-[#1f2937] text-white focus:border-[#ea580c] transition-all rounded-xl h-12"
                    />
                    <p className="text-[10px] text-slate-500 font-medium italic">
                      O cliente só poderá cancelar através do link se faltarem mais que {formData.cancellation_window_hours} horas para o atendimento.
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-[#0a0d14] border border-[#1f2937] rounded-2xl overflow-hidden">
                <CardHeader className="border-b border-[#1f2937] bg-[#050816]">
                  <CardTitle className="text-white font-black uppercase tracking-wider text-sm">Permissões do Barbeiro</CardTitle>
                  <CardDescription className="text-slate-400">Controle o que cada barbeiro pode fazer no próprio painel.</CardDescription>
                </CardHeader>
                <CardContent className="p-6 space-y-5">
                  <div className="flex items-start justify-between gap-4 p-4 rounded-xl bg-[#05070d] border border-[#1f2937]">
                    <div>
                      <p className="text-white font-bold text-sm">Permitir barbeiro cancelar agendamento?</p>
                      <p className="text-[11px] text-slate-500 font-medium mt-1">Quando desativado, o barbeiro poderá apenas solicitar o cancelamento via WhatsApp.</p>
                    </div>
                    <Switch
                      checked={!!formData.barber_can_cancel}
                      onCheckedChange={(v) => setFormData({ ...formData, barber_can_cancel: v })}
                    />
                  </div>
                  <div className="flex items-start justify-between gap-4 p-4 rounded-xl bg-[#05070d] border border-[#1f2937]">
                    <div>
                      <p className="text-white font-bold text-sm">Permitir barbeiro reagendar agendamento?</p>
                      <p className="text-[11px] text-slate-500 font-medium mt-1">Quando desativado, o barbeiro poderá apenas solicitar o reagendamento via WhatsApp ao cliente.</p>
                    </div>
                    <Switch
                      checked={!!formData.barber_can_reschedule}
                      onCheckedChange={(v) => setFormData({ ...formData, barber_can_reschedule: v })}
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>


            <TabsContent value="coupons" className="space-y-4">
              <CouponManagement />
            </TabsContent>

            <TabsContent value="whatsapp" className="space-y-6">
              <Card className="bg-[#0b0f17] border border-[#1f2937] text-white rounded-[20px] shadow-xl overflow-hidden">
                <CardHeader className="border-b border-[#1f2937]/50 bg-[#0b0f17]/50 p-6">
                  <CardTitle className="text-xl font-black uppercase italic tracking-wider flex items-center gap-2">
                    <MessageSquare className="text-[#ea580c] h-5 w-5" />
                    Configuração Z-API
                  </CardTitle>
                  <CardDescription className="text-slate-400">Configure as credenciais da sua instância Z-API para automações premium.</CardDescription>
                </CardHeader>
                <CardContent className="p-6 space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="grid gap-2">
                      <Label htmlFor="whatsapp_number" className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">WhatsApp da Barbearia (Formatado)</Label>
                      <Input 
                        id="whatsapp_number" 
                        value={formData.whatsapp_number} 
                        onChange={(e) => setFormData({ ...formData, whatsapp_number: e.target.value })}
                        placeholder="Ex: 5571999999999"
                        className="bg-[#05070d] border-[#1f2937] text-white focus:border-[#ea580c] transition-all rounded-xl h-12"
                      />
                      <p className="text-[10px] text-amber-500/80 font-black uppercase italic tracking-tighter">Número mestre para disparos de automação.</p>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="instance_id" className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">ID da Instância</Label>
                      <Input 
                        id="instance_id" 
                        value={formData.instance_id} 
                        onChange={(e) => setFormData({ ...formData, instance_id: e.target.value })}
                        placeholder="ID da sua instância Z-API"
                        className="bg-[#05070d] border-[#1f2937] text-white focus:border-[#ea580c] transition-all rounded-xl h-12"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="instance_token" className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">Token da Instância</Label>
                      <div className="relative">
                        <Input 
                          id="instance_token" 
                          type="password"
                          value={formData.instance_token} 
                          onChange={(e) => setFormData({ ...formData, instance_token: e.target.value })}
                          placeholder="Token secreto"
                          className="bg-[#05070d] border-[#1f2937] text-white focus:border-[#ea580c] transition-all rounded-xl h-12 pr-12"
                        />
                        <Lock className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-700" />
                      </div>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="client_token" className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">Client Token</Label>
                      <div className="relative">
                        <Input 
                          id="client_token" 
                          type="password"
                          value={formData.client_token} 
                          onChange={(e) => setFormData({ ...formData, client_token: e.target.value })}
                          placeholder="Client token"
                          className="bg-[#05070d] border-[#1f2937] text-white focus:border-[#ea580c] transition-all rounded-xl h-12 pr-12"
                        />
                        <Lock className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-700" />
                      </div>
                    </div>
                  </div>
                  
                  <div className="pt-4 border-t border-[#1f2937]/30 flex flex-col sm:flex-row gap-3 justify-center items-center">
                    <Button 
                      type="button" 
                      size="sm"
                      className="group relative overflow-hidden bg-gradient-to-r from-gold via-[#F5D877] to-gold text-black rounded-lg font-black uppercase text-[11px] tracking-wide h-8 px-3 shadow-[0_2px_10px_rgba(212,175,55,0.25)] hover:shadow-[0_4px_14px_rgba(212,175,55,0.4)] transition-all"
                    >
                      <span className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/40 to-transparent" />
                      <span className="relative">Testar Conexão</span>
                    </Button>
                    <Button 
                      type="button" 
                      variant="outline" 
                      size="sm"
                      className="border-gold/40 text-gold bg-gold/5 hover:bg-gold/15 hover:text-[#F5D877] hover:border-gold/70 rounded-lg font-bold uppercase text-[11px] tracking-wide h-8 px-3 transition-all"
                    >
                      Sincronizar Webhook
                    </Button>

                  </div>
                </CardContent>
              </Card>

              <WhatsAppSettings />

              <InternalRecipientsSettings />
            </TabsContent>

            <TabsContent value="payments" className="space-y-4">
              {plan === "free" ? (
                <Card className="bg-[#0b0f17] border border-[#1f2937] text-white rounded-[20px] shadow-xl overflow-hidden relative">
                  <div className="p-10 text-center">
                    <div className="mx-auto bg-[#ea580c]/10 p-4 rounded-full text-[#ea580c] mb-4 shadow-[0_0_30px_rgba(234,88,12,0.2)] w-fit">
                      <Lock size={40} />
                    </div>
                    <h3 className="text-2xl font-black uppercase italic tracking-tighter">Exclusivo Plano Pro</h3>
                    <p className="text-slate-400 max-w-sm mt-3 mb-8 font-medium mx-auto">
                      A integração com gateways de pagamento para receber agendamentos antecipados está disponível apenas para assinantes Pro.
                    </p>
                    <Button className="bg-[#ea580c] hover:bg-[#ea580c]/90 text-black font-bold h-12 px-8 rounded-xl shadow-lg hover:scale-105 transition-all" asChild>
                      <Link to="/subscription">Fazer Upgrade Agora</Link>
                    </Button>
                  </div>
                </Card>
              ) : (
                <PaymentsSettings />
              )}
            </TabsContent>

            <TabsContent value="loyalty" className="space-y-6">
              {/* Header da aba */}
              <div className="px-1">
                <h3 className="text-2xl font-black uppercase italic tracking-wider text-white flex items-center gap-3">
                  <Gift className="text-[#ea580c] h-6 w-6" />
                  Estratégias de Fidelização
                </h3>
                <p className="text-slate-400 text-sm font-medium mt-1">
                  Ative apenas os recursos que deseja utilizar na sua barbearia.
                  Cada estratégia funciona de forma independente.
                </p>
              </div>

              {/* CARD 1 — CASHBACK */}
              <Card className="bg-[#0b0f17] border border-[#1f2937] text-white rounded-[20px] shadow-xl overflow-hidden">
                <CardHeader className="border-b border-[#1f2937]/50 bg-[#0b0f17]/50 p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-[#ea580c]/20 to-transparent border border-[#ea580c]/30 grid place-items-center shrink-0">
                        <Coins className="text-[#ea580c] h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <CardTitle className="text-lg font-black uppercase italic tracking-wider flex items-center gap-2 flex-wrap">
                          Cashback
                          <Badge variant="outline" className={formData.cashback_enabled ? "border-emerald-500/40 text-emerald-400" : "border-slate-600/40 text-slate-500"}>
                            {formData.cashback_enabled ? "Ativo" : "Inativo"}
                          </Badge>
                        </CardTitle>
                        <CardDescription className="text-slate-400 mt-1">
                          Conceda saldo para utilização em futuros agendamentos. Ex.: cliente gasta R$ 100 e recebe R$ 10.
                        </CardDescription>
                      </div>
                    </div>
                    <Switch
                      checked={formData.cashback_enabled}
                      onCheckedChange={(checked) => setFormData({ ...formData, cashback_enabled: checked })}
                      className="data-[state=checked]:bg-[#ea580c] shrink-0"
                    />
                  </div>
                </CardHeader>
                {formData.cashback_enabled && (
                <CardContent className="p-6 space-y-6 animate-in fade-in slide-in-from-top-2">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="grid gap-3 p-5 bg-[#05070d] border border-[#1f2937] rounded-2xl">
                      <Label className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">Tipo de Retorno</Label>
                      <Select value={formData.cashback_type} onValueChange={(value) => setFormData({ ...formData, cashback_type: value })}>
                        <SelectTrigger className="bg-[#0b0f17] border-[#1f2937] text-white h-12 rounded-xl">
                          <SelectValue placeholder="Selecione o tipo" />
                        </SelectTrigger>
                        <SelectContent className="bg-[#0b0f17] border-[#1f2937] text-white">
                          <SelectItem value="percentage">Percentual (%)</SelectItem>
                          <SelectItem value="fixed">Valor Fixo (R$)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {formData.cashback_type === 'percentage' ? (
                      <div className="grid gap-3 p-5 bg-[#05070d] border border-[#1f2937] rounded-2xl">
                        <Label htmlFor="cashback_percentage" className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">Percentual de Cashback (%)</Label>
                        <Input id="cashback_percentage" type="number" min="0" max="100"
                          value={formData.cashback_percentage}
                          onChange={(e) => setFormData({ ...formData, cashback_percentage: parseFloat(e.target.value) || 0 })}
                          className="bg-[#0b0f17] border-[#1f2937] text-white focus:border-[#ea580c] h-12 rounded-xl w-full text-lg font-black text-center italic" />
                        <p className="text-[10px] text-slate-600 font-medium uppercase italic">
                          A cada R$ 100,00, o cliente recebe R$ <span className="text-[#ea580c] font-black">{formData.cashback_percentage.toFixed(2)}</span>.
                        </p>
                      </div>
                    ) : (
                      <div className="grid gap-3 p-5 bg-[#05070d] border border-[#1f2937] rounded-2xl">
                        <Label htmlFor="cashback_fixed_value" className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">Valor Fixo (R$)</Label>
                        <Input id="cashback_fixed_value" type="number" min="0" step="0.01"
                          value={formData.cashback_fixed_value}
                          onChange={(e) => setFormData({ ...formData, cashback_fixed_value: parseFloat(e.target.value) || 0 })}
                          className="bg-[#0b0f17] border-[#1f2937] text-white focus:border-[#ea580c] h-12 rounded-xl w-full text-lg font-black text-center italic" />
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="grid gap-3 p-5 bg-[#05070d] border border-[#1f2937] rounded-2xl">
                      <Label htmlFor="cashback_minimum_amount" className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">Valor Mínimo do Serviço (R$)</Label>
                      <Input id="cashback_minimum_amount" type="number" min="0" step="0.01"
                        value={formData.cashback_minimum_amount}
                        onChange={(e) => setFormData({ ...formData, cashback_minimum_amount: parseFloat(e.target.value) || 0 })}
                        className="bg-[#0b0f17] border-[#1f2937] text-white focus:border-[#ea580c] h-12 rounded-xl w-full text-lg font-black italic" />
                      <p className="text-[10px] text-slate-600 font-medium uppercase italic">Cashback só será gerado para serviços acima deste valor.</p>
                    </div>
                    <div className="grid gap-3 p-5 bg-[#05070d] border border-[#1f2937] rounded-2xl">
                      <Label htmlFor="cashback_expiration_days" className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">Validade do Crédito (Dias)</Label>
                      <Input id="cashback_expiration_days" type="number" min="0"
                        value={formData.cashback_expiration_days}
                        onChange={(e) => setFormData({ ...formData, cashback_expiration_days: parseInt(e.target.value) || 0 })}
                        className="bg-[#0b0f17] border-[#1f2937] text-white focus:border-[#ea580c] h-12 rounded-xl w-full text-lg font-black italic" />
                      <p className="text-[10px] text-slate-600 font-medium uppercase italic">Use 0 para validade ilimitada.</p>
                    </div>
                  </div>

                  <div className="bg-[#ea580c]/5 border border-[#ea580c]/20 p-4 rounded-2xl flex gap-3">
                    <Info className="h-5 w-5 text-[#ea580c] shrink-0" />
                    <div className="space-y-1">
                      <p className="text-xs font-black uppercase tracking-widest italic text-[#ea580c]">Regra automática para assinantes</p>
                      <p className="text-[10px] text-slate-400 font-medium leading-relaxed uppercase">
                        Cashback não é gerado em serviços cobertos integralmente pelo plano de assinatura.
                        Quando o assinante paga um valor extra (diferença), o cashback incide apenas sobre essa diferença.
                      </p>
                    </div>
                  </div>
                </CardContent>
                )}
              </Card>

              {/* CARD 2 — FIDELIDADE TRADICIONAL */}
              <Card className="bg-[#0b0f17] border border-[#1f2937] text-white rounded-[20px] shadow-xl overflow-hidden">
                <CardHeader className="border-b border-[#1f2937]/50 bg-[#0b0f17]/50 p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-[#ea580c]/20 to-transparent border border-[#ea580c]/30 grid place-items-center shrink-0">
                        <Gift className="text-[#ea580c] h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <CardTitle className="text-lg font-black uppercase italic tracking-wider flex items-center gap-2 flex-wrap">
                          Fidelidade Tradicional
                          <Badge variant="outline" className={formData.loyalty_enabled ? "border-emerald-500/40 text-emerald-400" : "border-slate-600/40 text-slate-500"}>
                            {formData.loyalty_enabled ? "Ativo" : "Inativo"}
                          </Badge>
                        </CardTitle>
                        <CardDescription className="text-slate-400 mt-1">
                          Programa baseado em quantidade de atendimentos. Ex.: a cada 10 atendimentos, ganhe 1 serviço grátis.
                        </CardDescription>
                      </div>
                    </div>
                    <Switch
                      checked={formData.loyalty_enabled}
                      onCheckedChange={(checked) => setFormData({ ...formData, loyalty_enabled: checked })}
                      className="data-[state=checked]:bg-[#ea580c] shrink-0"
                    />
                  </div>
                </CardHeader>
                {formData.loyalty_enabled && (
                <CardContent className="p-6 space-y-6 animate-in fade-in slide-in-from-top-2">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="grid gap-3 p-5 bg-[#05070d] border border-[#1f2937] rounded-2xl">
                      <Label htmlFor="loyalty_appointments_required" className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">Quantidade Necessária</Label>
                      <Input id="loyalty_appointments_required" type="number" min="1" max="100"
                        value={formData.loyalty_appointments_required}
                        onChange={(e) => setFormData({ ...formData, loyalty_appointments_required: parseInt(e.target.value) || 1 })}
                        className="bg-[#0b0f17] border-[#1f2937] text-white focus:border-[#ea580c] h-12 rounded-xl w-full text-lg font-black text-center italic" />
                      <p className="text-[10px] text-slate-600 font-medium uppercase italic">Meta de atendimentos para liberar o benefício.</p>
                    </div>
                    <div className="grid gap-3 p-5 bg-[#05070d] border border-[#1f2937] rounded-2xl">
                      <Label className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">Tipo de Recompensa</Label>
                      <Select value={formData.loyalty_benefit_type} onValueChange={(value) => setFormData({ ...formData, loyalty_benefit_type: value })}>
                        <SelectTrigger className="bg-[#0b0f17] border-[#1f2937] text-white h-12 rounded-xl"><SelectValue /></SelectTrigger>
                        <SelectContent className="bg-[#0b0f17] border-[#1f2937] text-white">
                          <SelectItem value="free_service">Serviço grátis</SelectItem>
                          <SelectItem value="percent_discount">Desconto percentual (%)</SelectItem>
                          <SelectItem value="fixed_discount">Desconto fixo (R$)</SelectItem>
                          <SelectItem value="free_addon">Brinde / serviço adicional grátis</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {(formData.loyalty_benefit_type === 'percent_discount' || formData.loyalty_benefit_type === 'fixed_discount') && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="grid gap-3 p-5 bg-[#05070d] border border-[#1f2937] rounded-2xl">
                        <Label htmlFor="loyalty_benefit_value" className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">
                          {formData.loyalty_benefit_type === 'percent_discount' ? 'Percentual de desconto (%)' : 'Valor do desconto (R$)'}
                        </Label>
                        <Input id="loyalty_benefit_value" type="number" min="0" step="0.01"
                          value={formData.loyalty_benefit_value}
                          onChange={(e) => setFormData({ ...formData, loyalty_benefit_value: parseFloat(e.target.value) || 0 })}
                          className="bg-[#0b0f17] border-[#1f2937] text-white focus:border-[#ea580c] h-12 rounded-xl w-full text-lg font-black text-center italic" />
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="grid gap-3 p-5 bg-[#05070d] border border-[#1f2937] rounded-2xl">
                      <Label htmlFor="loyalty_benefit_description" className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">Descrição visível ao cliente</Label>
                      <Input id="loyalty_benefit_description" type="text"
                        value={formData.loyalty_benefit_description}
                        onChange={(e) => setFormData({ ...formData, loyalty_benefit_description: e.target.value })}
                        placeholder="Ex.: Corte grátis"
                        className="bg-[#0b0f17] border-[#1f2937] text-white focus:border-[#ea580c] h-12 rounded-xl w-full font-bold" />
                    </div>
                    <div className="grid gap-3 p-5 bg-[#05070d] border border-[#1f2937] rounded-2xl">
                      <Label htmlFor="loyalty_validity_days" className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">Validade da Recompensa (dias)</Label>
                      <Input id="loyalty_validity_days" type="number" min="0"
                        value={formData.loyalty_validity_days}
                        onChange={(e) => setFormData({ ...formData, loyalty_validity_days: parseInt(e.target.value) || 0 })}
                        className="bg-[#0b0f17] border-[#1f2937] text-white focus:border-[#ea580c] h-12 rounded-xl w-full text-lg font-black text-center italic" />
                      <p className="text-[10px] text-slate-600 font-medium uppercase italic">0 = sem expiração.</p>
                    </div>
                  </div>

                  <div className="bg-[#ea580c]/5 border border-[#ea580c]/20 p-4 rounded-2xl flex gap-3">
                    <CheckCircle2 className="h-5 w-5 text-[#ea580c] shrink-0" />
                    <div className="space-y-1">
                      <p className="text-xs font-black uppercase tracking-widest italic text-[#ea580c]">Regra</p>
                      <p className="text-[10px] text-slate-400 font-medium leading-relaxed uppercase">
                        Aplicável apenas a clientes avulsos. Assinantes acumulam recompensas pela Fidelidade Premium (por tempo).
                      </p>
                    </div>
                  </div>
                </CardContent>
                )}
              </Card>

              {/* CARD 3 — FIDELIDADE PREMIUM POR TEMPO */}
              <Card className="bg-gradient-to-br from-[#0b0f17] to-[#0a0a1a] border border-gold/30 text-white rounded-[20px] shadow-xl overflow-hidden">
                <CardHeader className="border-b border-gold/15 bg-[#0b0f17]/50 p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-gold/20 to-transparent border border-gold/40 grid place-items-center shrink-0">
                        <Trophy className="text-gold h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <CardTitle className="text-lg font-black uppercase italic tracking-wider flex items-center gap-2 flex-wrap">
                          Fidelidade Premium
                          <Badge variant="outline" className={formData.loyalty_premium_enabled ? "border-gold/40 text-gold" : "border-slate-600/40 text-slate-500"}>
                            {formData.loyalty_premium_enabled ? "Ativo" : "Inativo"}
                          </Badge>
                        </CardTitle>
                        <CardDescription className="text-slate-400 mt-1">
                          Campanhas avançadas, templates personalizados e benefícios exclusivos para assinantes (3, 6, 12 meses, indicação e mais).
                        </CardDescription>
                      </div>
                    </div>
                    <Switch
                      checked={formData.loyalty_premium_enabled}
                      onCheckedChange={(checked) => setFormData({ ...formData, loyalty_premium_enabled: checked })}
                      className="data-[state=checked]:bg-gold"
                    />
                  </div>
                </CardHeader>
                {formData.loyalty_premium_enabled && (
                <CardContent className="p-6 space-y-4">
                  <div className="bg-[#05070d] border border-[#1f2937] rounded-2xl p-5 space-y-3">
                    <p className="text-xs font-black uppercase tracking-widest text-gold">O que está incluído</p>
                    <ul className="text-[11px] text-slate-300 space-y-1.5 leading-relaxed">
                      <li>• Biblioteca com 20 templates prontos (Clube dos 10, Cashback Progressivo, VIP, Aniversariante e mais).</li>
                      <li>• Campanhas personalizadas com regras, recompensas e mensagens automáticas.</li>
                      <li>• Benefícios para assinantes por tempo (3, 6 e 12 meses) e indicação.</li>
                      <li>• Dashboard de desempenho e sugestões com IA.</li>
                    </ul>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button asChild size="sm" className="h-9 px-4 text-[11px] bg-gold hover:bg-gold/90 text-black font-black uppercase tracking-wider rounded-lg">
                      <Link to="/loyalty/templates">
                        <Trophy className="h-3.5 w-3.5 mr-1.5" /> Gerenciar Fidelidade
                      </Link>
                    </Button>
                    <Button asChild size="sm" className="group relative overflow-hidden h-9 px-4 text-[11px] rounded-lg bg-gradient-to-r from-gold via-[#F5D877] to-gold text-black font-black uppercase tracking-wider shadow-[0_4px_14px_rgba(212,175,55,0.28)] hover:shadow-[0_6px_20px_rgba(212,175,55,0.45)] transition-all">
                      <Link to="/loyalty">
                        <span className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/40 to-transparent" />
                        <span className="relative">Recompensas de Assinantes</span>
                      </Link>
                    </Button>
                  </div>
                </CardContent>
                )}
              </Card>
            </TabsContent>



            <TabsContent value="pix" className="space-y-4">
              <Card className="bg-[#0b0f17] border border-[#1f2937] text-white rounded-[20px] shadow-xl overflow-hidden">
                <CardHeader className="border-b border-[#1f2937]/50 bg-[#0b0f17]/50 p-6">
                  <CardTitle className="text-xl font-black uppercase italic tracking-wider flex items-center gap-2">
                    <QrCode className="text-[#ea580c] h-5 w-5" />
                    Configuração de Pagamento PIX
                  </CardTitle>
                  <CardDescription className="text-slate-400">Cadastre sua chave PIX para recebimentos diretos premium.</CardDescription>
                </CardHeader>
                <CardContent className="p-6 space-y-8">
                  <div className="grid gap-3 p-5 bg-[#05070d] border border-[#1f2937] rounded-2xl">
                    <Label htmlFor="pix_key" className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">Chave PIX (CPF, E-mail, Celular ou Aleatória)</Label>
                    <Input 
                      id="pix_key" 
                      value={formData.pix_key} 
                      onChange={(e) => setFormData({ ...formData, pix_key: e.target.value })}
                      placeholder="Sua chave PIX aqui"
                      className="bg-[#0b0f17] border-[#1f2937] text-white focus:border-[#ea580c] h-12 rounded-xl text-lg font-bold"
                    />
                    <p className="text-[10px] text-slate-600 font-bold uppercase italic tracking-wider">Esta chave será exibida para o cliente no momento do pagamento.</p>
                  </div>

                  <div className="space-y-6 pt-6 border-t border-[#1f2937]/50">
                    <h4 className="font-black uppercase italic text-[#ea580c] text-xs tracking-[0.2em]">QR Code do PIX</h4>
                    <div className="flex flex-col items-center gap-8 py-6 bg-[#05070d]/30 rounded-2xl border border-[#1f2937]/30">
                      <div className="h-44 w-44 rounded-2xl bg-[#05070d] flex items-center justify-center overflow-hidden border-2 border-[#1f2937] shadow-[0_0_30px_rgba(0,0,0,0.5)] group relative">
                        {formData.pix_qr_code_url ? (
                          <img src={formData.pix_qr_code_url} alt="PIX QR Code Preview" className="h-full w-full object-contain p-2 transition-transform group-hover:scale-110" />
                        ) : (
                          <QrCode className="h-16 w-16 text-slate-800" />
                        )}
                      </div>
                      <div className="w-full max-w-sm space-y-3 px-6">
                        <Label htmlFor="pix_qr_file" className="text-center block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Upload do QR Code (Imagem)</Label>
                        <Input 
                          id="pix_qr_file" 
                          type="file" 
                          accept="image/*"
                          className="h-11 rounded-xl cursor-pointer bg-[#05070d] border-[#1f2937] text-white file:bg-[#ea580c] file:text-black file:font-bold file:border-none file:px-4 file:h-full file:mr-4"
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
                        <p className="text-[10px] text-slate-600 font-bold text-center uppercase italic">Otimize a experiência de pagamento do seu cliente.</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <div className="flex justify-center pt-10 pb-20">
              <Button 
                type="submit" 
                className="gap-2 bg-[#ea580c] text-white hover:bg-[#ea580c]/90 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 h-12 px-8 w-full max-w-[320px] rounded-xl font-black uppercase text-xs tracking-widest shadow-lg group" 
                disabled={saving || !dataLoaded}
              >
                {saving ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 group-hover:rotate-12 transition-transform" />
                )}
                {saving ? "Salvando..." : "Salvar Configurações"}
              </Button>
            </div>
          </form>
          </div>
        </Tabs>
      </div>
    </AppLayout>
  );
}
