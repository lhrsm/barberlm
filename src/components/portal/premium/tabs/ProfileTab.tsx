import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Camera, Mail, Calendar, Phone, Save, Download, Smartphone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { usePwaInstall } from "@/hooks/use-pwa-install";

type Props = {
  customerData: any;
  setCustomerData: (data: any) => void;
  customerName: string;
  setCustomerName: (name: string) => void;
  submitting: boolean;
  setSubmitting: (submitting: boolean) => void;
  fetchClientData: (id: string) => void;
  slug: string;
  setClient: (client: any) => void;
};

export function ProfileTab({ 
  customerData, 
  setCustomerData, 
  customerName, 
  setCustomerName, 
  submitting, 
  setSubmitting, 
  fetchClientData, 
  slug,
  setClient
}: Props) {
  return (
    <div className="max-w-2xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
      <Card className="bg-white/5 border-white/10 shadow-lg backdrop-blur-xl">
        <CardHeader>
          <CardTitle className="text-white">Meu Perfil</CardTitle>
          <CardDescription className="text-gray-400">Atualize suas informações de contato e foto de perfil.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-col items-center gap-4 py-4">
            <div className="relative group">
              <div className="h-32 w-32 rounded-full bg-white/5 overflow-hidden border-2 border-gold/50 group-hover:border-gold transition-colors duration-300">
                {customerData?.avatar_url ? (
                  <img src={customerData.avatar_url} alt="Profile" className="h-full w-full object-cover" />
                ) : (
                  <div className="h-full w-full flex items-center justify-center text-4xl font-black text-white/20 bg-primary/5">
                    {customerData?.name?.[0] || "?"}
                  </div>
                )}
              </div>
              <label className="absolute bottom-1 right-1 h-10 w-10 bg-gold rounded-full flex items-center justify-center text-black cursor-pointer shadow-lg hover:scale-110 transition-transform active:scale-95 z-10">
                <Camera size={18} />
                <input 
                  type="file" 
                  className="hidden" 
                  accept="image/*" 
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file || !customerData?.id) return;
                    
                    setSubmitting(true);
                    try {
                      const fileExt = file.name.split('.').pop();
                      const fileName = `${customerData.id}-${Math.random()}.${fileExt}`;
                      const filePath = `customer-avatars/${fileName}`;

                      const { error: uploadError } = await supabase.storage
                        .from('barber-avatars')
                        .upload(filePath, file);

                      if (uploadError) throw uploadError;

                      const { data: { publicUrl } } = supabase.storage
                        .from('barber-avatars')
                        .getPublicUrl(filePath);

                      const { error: updateError } = await supabase
                        .from('customers')
                        .update({ avatar_url: publicUrl })
                        .eq('id', customerData.id);

                      if (updateError) throw updateError;
                      toast.success("Foto atualizada!");
                      fetchClientData(customerData.id);
                    } catch (err: any) {
                      toast.error("Erro ao enviar imagem");
                      console.error(err);
                    } finally {
                      setSubmitting(false);
                    }
                  }}
                />
              </label>
            </div>
            <p className="text-xs text-gray-500 font-medium">Clique na câmera para alterar sua foto</p>
          </div>

          <div className="grid gap-6">
            <div className="grid gap-2">
              <Label htmlFor="profile-name" className="text-white font-bold ml-1">Nome Completo</Label>
              <Input 
                id="profile-name" 
                className="bg-white/5 border-white/10 text-white focus:border-gold h-12 rounded-xl"
                value={customerName || (customerData?.name || "")} 
                onChange={(e) => setCustomerName(e.target.value)}
              />
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="profile-email" className="text-white font-bold ml-1">E-mail</Label>
              <div className="relative">
                <Mail className="absolute left-4 top-3.5 h-5 w-5 text-gray-500" />
                <Input 
                  id="profile-email" 
                  type="email"
                  placeholder="seu@email.com"
                  className="pl-12 bg-white/5 border-white/10 text-white focus:border-gold h-12 rounded-xl"
                  value={customerData?.email || ""}
                  onChange={(e) => setCustomerData({ ...customerData, email: e.target.value })}
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="profile-birthdate" className="text-white font-bold ml-1">Data de Nascimento</Label>
              <div className="relative">
                <Calendar className="absolute left-4 top-3.5 h-5 w-5 text-gray-500" />
                <Input 
                  id="profile-birthdate" 
                  type="text"
                  placeholder="dd/mm/aaaa"
                  className="pl-12 bg-white/5 border-white/10 text-white focus:border-gold h-12 rounded-xl"
                  value={(() => {
                    const date = customerData?.birth_date || "";
                    if (date.includes("-")) {
                      const [year, month, day] = date.split("-");
                      return `${day}/${month}/${year}`;
                    }
                    return date;
                  })()}
                  onChange={(e) => {
                    let value = e.target.value.replace(/\D/g, "");
                    if (value.length > 8) value = value.slice(0, 8);
                    if (value.length > 4) {
                      value = `${value.slice(0, 2)}/${value.slice(2, 4)}/${value.slice(4)}`;
                    } else if (value.length > 2) {
                      value = `${value.slice(0, 2)}/${value.slice(2)}`;
                    }
                    
                    let isoValue = value;
                    if (value.includes("/") && value.split("/").length === 3) {
                      const [d, m, y] = value.split("/");
                      if (y.length === 4) isoValue = `${y}-${m}-${d}`;
                    }
                    
                    setCustomerData({ ...customerData, birth_date: isoValue });
                  }}
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="profile-phone" className="text-white font-bold ml-1">WhatsApp</Label>
              <div className="relative">
                <Phone className="absolute left-4 top-3.5 h-5 w-5 text-gray-400" />
                <Input 
                  id="profile-phone" 
                  value={customerData?.phone || ""} 
                  disabled 
                  className="pl-12 bg-white/10 border-white/5 text-gray-500 h-12 rounded-xl cursor-not-allowed"
                />
              </div>
              <p className="text-[10px] text-gray-500 italic ml-1">O número de WhatsApp é o seu identificador e não pode ser alterado.</p>
            </div>
          </div>
        </CardContent>
        <CardContent className="pt-0 pb-8">
          <Button 
            className="w-full h-12 gap-2 bg-gold text-black hover:bg-gold/80 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] font-black uppercase tracking-widest rounded-xl shadow-[0_8px_20px_-8px_rgba(212,175,55,0.4)]" 
            disabled={submitting}
            onClick={async () => {
              if (!customerData?.id || !customerName) return;
              setSubmitting(true);
              try {
                const { error } = await supabase
                  .from('customers')
                  .update({ 
                    name: customerName,
                    email: customerData.email,
                    birth_date: customerData.birth_date
                  })
                  .eq('id', customerData.id);
                if (error) throw error;
                
                const sessionData = JSON.parse(localStorage.getItem(`client_portal_session_${slug}`) || "{}");
                sessionData.name = customerName;
                localStorage.setItem(`client_portal_session_${slug}`, JSON.stringify(sessionData));
                // setClient removed here to match parent state cleanup if needed, 
                // but the toast and fetch are the priority.
                window.dispatchEvent(new CustomEvent('profile-updated'));
                
                toast.success("Perfil atualizado com sucesso!");
                fetchClientData(customerData.id);
              } catch (e) {
                toast.error("Erro ao salvar alterações");
              } finally {
                setSubmitting(false);
              }
            }}
          >
            {submitting ? (
              <div className="h-5 w-5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
            ) : (
              <Save size={20} />
            )}
            {submitting ? "Salvando..." : "Salvar Alterações"}
          </Button>

          {/* PWA INSTALLATION OPTION */}
          <div className="pt-6 border-t border-white/10">
            <PwaProfileOption />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function PwaProfileOption() {
  const { isInstalled, isInstallable, promptInstall, isIOS, showIOSGuide, setShowIOSGuide } = usePwaInstall();

  if (isInstalled) {
    return (
      <div className="flex items-center justify-between p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
            <Smartphone className="h-5 w-5" />
          </div>
          <div>
            <p className="font-bold text-white">Aplicativo instalado</p>
            <p className="text-zinc-400 text-[11px]">Você já tem o Barbex na tela inicial do seu celular.</p>
          </div>
        </div>
        <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400 font-bold text-[10px] uppercase">
          Instalado
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl bg-white/5 border border-white/10 text-xs">
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-lg bg-gold/15 text-gold flex items-center justify-center shrink-0">
          <Download className="h-5 w-5" />
        </div>
        <div>
          <p className="font-bold text-white">Instalar Aplicativo</p>
          <p className="text-zinc-400 text-[11px]">Adicione à tela inicial para agendar com 1 toque.</p>
        </div>
      </div>
      <Button
        type="button"
        onClick={promptInstall}
        variant="outline"
        className="w-full sm:w-auto h-9 px-4 rounded-xl border-gold/40 text-gold hover:bg-gold/10 font-bold text-xs uppercase tracking-wider"
      >
        <Download className="h-3.5 w-3.5 mr-1.5" />
        Instalar App
      </Button>
    </div>
  );
}
