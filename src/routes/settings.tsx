import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/hooks/use-auth";
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
import { Settings as SettingsIcon, MessageSquare, CreditCard, Palette, Globe, Save } from "lucide-react";

export const Route = createFileRoute("/settings")({
  component: SettingsComponent,
});

function SettingsComponent() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    business_name: "",
    slug: "",
    whatsapp_number: "",
    whatsapp_enabled: false,
    payment_gateway_provider: "none",
    payment_gateway_key: "",
    primary_color: "#7c3aed",
    secondary_color: "#f4f4f5",
    logo_url: "",
  });

  useEffect(() => {
    if (!loading && !user) {
      navigate({ to: "/auth" });
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user) {
      fetchProfile();
    }
  }, [user]);

  async function fetchProfile() {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    if (error) {
      toast.error("Erro ao carregar configurações");
      return;
    }

    if (data) {
      setFormData({
        business_name: data.business_name || "",
        slug: data.slug || "",
        whatsapp_number: data.whatsapp_number || "",
        whatsapp_enabled: data.whatsapp_enabled || false,
        payment_gateway_provider: data.payment_gateway_provider || "none",
        payment_gateway_key: data.payment_gateway_key || "",
        primary_color: data.primary_color || "#7c3aed",
        secondary_color: data.secondary_color || "#f4f4f5",
        logo_url: data.logo_url || "",
      });
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    const { error } = await supabase
      .from("profiles")
      .update({
        business_name: formData.business_name,
        slug: formData.slug,
        whatsapp_number: formData.whatsapp_number,
        whatsapp_enabled: formData.whatsapp_enabled,
        payment_gateway_provider: formData.payment_gateway_provider === "none" ? null : formData.payment_gateway_provider,
        payment_gateway_key: formData.payment_gateway_key,
        primary_color: formData.primary_color,
        secondary_color: formData.secondary_color,
        logo_url: formData.logo_url,
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

  if (loading || !user) return null;

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Configurações</h2>
          <p className="text-muted-foreground">Gerencie sua barbearia, integrações e personalização.</p>
        </div>

        <form onSubmit={handleSubmit}>
          <Tabs defaultValue="general" className="space-y-6">
            <TabsList className="grid w-full grid-cols-4 max-w-[600px]">
              <TabsTrigger value="general" className="gap-2">
                <Globe size={16} /> Geral
              </TabsTrigger>
              <TabsTrigger value="appearance" className="gap-2">
                <Palette size={16} /> Aparência
              </TabsTrigger>
              <TabsTrigger value="whatsapp" className="gap-2">
                <MessageSquare size={16} /> WhatsApp
              </TabsTrigger>
              <TabsTrigger value="payments" className="gap-2">
                <CreditCard size={16} /> Pagamentos
              </TabsTrigger>
            </TabsList>

            <TabsContent value="general" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Informações do Negócio</CardTitle>
                  <CardDescription>Configure os dados básicos da sua página pública.</CardDescription>
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
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="appearance" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Personalização Visual</CardTitle>
                  <CardDescription>Deixe a página com a cara da sua marca.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
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
                  <div className="grid gap-2">
                    <Label htmlFor="logo_url">URL do Logo</Label>
                    <Input 
                      id="logo_url" 
                      value={formData.logo_url} 
                      onChange={(e) => setFormData({ ...formData, logo_url: e.target.value })}
                      placeholder="https://exemplo.com/logo.png"
                    />
                    <p className="text-xs text-muted-foreground">Insira o link da imagem do seu logotipo.</p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="whatsapp" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Integração WhatsApp</CardTitle>
                  <CardDescription>Envie notificações automáticas e facilite o contato.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between space-x-2 border p-4 rounded-lg bg-muted/50">
                    <div className="space-y-0.5">
                      <Label className="text-base">Ativar Notificações</Label>
                      <p className="text-sm text-muted-foreground">Habilite para enviar lembretes de agendamento.</p>
                    </div>
                    <Switch 
                      checked={formData.whatsapp_enabled} 
                      onCheckedChange={(checked) => setFormData({ ...formData, whatsapp_enabled: checked })}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="whatsapp_number">Número do WhatsApp</Label>
                    <Input 
                      id="whatsapp_number" 
                      value={formData.whatsapp_number} 
                      onChange={(e) => setFormData({ ...formData, whatsapp_number: e.target.value })}
                      placeholder="Ex: 5511999999999"
                    />
                    <p className="text-xs text-muted-foreground">Inclua o DDI (55) e o DDD.</p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="payments" className="space-y-4">
              <Card>
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
                      />
                      <p className="text-xs text-muted-foreground">
                        Sua chave de API é criptografada e nunca compartilhada.
                      </p>
                    </div>
                  )}
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
