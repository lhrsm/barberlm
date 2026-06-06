import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Camera, Save, X } from "lucide-react";

export function EditProfileDialog({ isOpen, onClose, barber, onUpdate }: any) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    bio: "",
    avatar_url: "",
    active: true,
    category: "",
    specialties_string: ""
  });

  useEffect(() => {
    if (barber && isOpen) {
      setFormData({
        name: barber.name || "",
        phone: barber.phone || "",
        email: barber.email || "",
        bio: barber.bio || "",
        avatar_url: barber.avatar_url || "",
        active: barber.active !== false,
        category: barber.category || "",
        specialties_string: Array.isArray(barber.specialties) ? barber.specialties.join(", ") : ""
      });
    }
  }, [barber, isOpen]);

  const handleSave = async () => {
    setLoading(true);
    try {
      const specialties = formData.specialties_string
        .split(",")
        .map(s => s.trim())
        .filter(s => s.length > 0);

      const { error } = await supabase
        .from("barbers")
        .update({
          name: formData.name,
          phone: formData.phone,
          email: formData.email,
          bio: formData.bio,
          avatar_url: formData.avatar_url,
          active: formData.active,
          category: formData.category,
          specialties: specialties
        })
        .eq("id", barber.id);
      
      if (error) throw error;
      toast.success("Perfil atualizado!");
      if (onUpdate) onUpdate();
      onClose();
    } catch (e: any) {
      toast.error("Erro ao salvar: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto bg-[#0b0f17] border-[#D4AF37]/20 rounded-2xl shadow-2xl text-white">
        <DialogHeader className="border-b border-[#D4AF37]/10 pb-4">
          <DialogTitle className="text-xl font-black text-[#D4AF37] uppercase tracking-wider">Editar Perfil Profissional</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6 py-6">
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <Avatar className="h-28 w-28 border-4 border-[#D4AF37]/30 shadow-[0_0_20px_rgba(212,175,55,0.2)]">
                <AvatarImage src={formData.avatar_url} />
                <AvatarFallback className="bg-[#D4AF37]/10 text-[#D4AF37] text-3xl font-black">
                  {formData.name.substring(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="absolute bottom-0 right-0 bg-[#D4AF37] p-2 rounded-full text-black shadow-lg">
                <Camera className="h-4 w-4" />
              </div>
            </div>
            
            <div className="w-full space-y-2">
              <Label className="text-[#D4AF37] font-black uppercase text-[10px] tracking-[0.2em] ml-1">URL da Foto</Label>
              <Input 
                placeholder="https://..." 
                value={formData.avatar_url}
                onChange={(e) => setFormData({...formData, avatar_url: e.target.value})}
                className="bg-[#05070d] border-[#D4AF37]/20 focus-visible:ring-[#D4AF37]/40 rounded-xl h-11 text-white placeholder:text-gray-600 font-medium"
              />
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-[#D4AF37] font-black uppercase text-[10px] tracking-[0.2em] ml-1">Nome Completo</Label>
              <Input 
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                className="bg-[#05070d] border-[#D4AF37]/20 focus-visible:ring-[#D4AF37]/40 rounded-xl h-11 text-white font-bold"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-[#D4AF37] font-black uppercase text-[10px] tracking-[0.2em] ml-1">E-mail</Label>
              <Input 
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
                className="bg-[#05070d] border-[#D4AF37]/20 focus-visible:ring-[#D4AF37]/40 rounded-xl h-11 text-white font-bold"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-[#D4AF37] font-black uppercase text-[10px] tracking-[0.2em] ml-1">Telefone / WhatsApp</Label>
              <Input 
                value={formData.phone}
                onChange={(e) => setFormData({...formData, phone: e.target.value})}
                className="bg-[#05070d] border-[#D4AF37]/20 focus-visible:ring-[#D4AF37]/40 rounded-xl h-11 text-white font-bold"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-[#D4AF37] font-black uppercase text-[10px] tracking-[0.2em] ml-1">Cargo / Tipo</Label>
              <Input 
                placeholder="Ex: Freelancer, Master, etc."
                value={formData.category}
                onChange={(e) => setFormData({...formData, category: e.target.value})}
                className="bg-[#05070d] border-[#D4AF37]/20 focus-visible:ring-[#D4AF37]/40 rounded-xl h-11 text-white font-bold"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-[#D4AF37] font-black uppercase text-[10px] tracking-[0.2em] ml-1">Especialidades (separadas por vírgula)</Label>
            <Input 
              placeholder="Ex: Corte Degradê, Barba, Pigmentação"
              value={formData.specialties_string}
              onChange={(e) => setFormData({...formData, specialties_string: e.target.value})}
              className="bg-[#05070d] border-[#D4AF37]/20 focus-visible:ring-[#D4AF37]/40 rounded-xl h-11 text-white font-bold"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-[#D4AF37] font-black uppercase text-[10px] tracking-[0.2em] ml-1">Bio / Descrição Profissional</Label>
            <Textarea 
              value={formData.bio}
              onChange={(e) => setFormData({...formData, bio: e.target.value})}
              className="bg-[#05070d] border-[#D4AF37]/20 focus-visible:ring-[#D4AF37]/40 min-h-[100px] rounded-xl text-white font-medium resize-none"
            />
          </div>

          <div className="flex items-center justify-between p-4 bg-[#D4AF37]/5 rounded-xl border border-[#D4AF37]/10">
            <div className="space-y-1">
              <Label className="text-[#D4AF37] font-black uppercase text-[10px] tracking-wider">Perfil Disponível</Label>
              <p className="text-[10px] text-gray-500 font-medium leading-tight">Os clientes poderão ver seu perfil e realizar agendamentos.</p>
            </div>
            <Switch 
              checked={formData.active}
              onCheckedChange={(checked) => setFormData({...formData, active: checked})}
              className="data-[state=checked]:bg-[#D4AF37]"
            />
          </div>
        </div>

        <DialogFooter className="gap-3 border-t border-[#D4AF37]/10 pt-6 mt-2">
          <Button 
            variant="ghost" 
            onClick={onClose}
            className="text-gray-400 hover:text-white hover:bg-white/5 font-bold rounded-xl h-10 px-6"
          >
            <X className="h-4 w-4 mr-2" /> Cancelar
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={loading}
            className="bg-[#D4AF37] hover:bg-[#B8962E] text-black border-0 rounded-xl font-black px-8 h-10 transition-all hover:scale-[1.02] active:scale-[0.98] shadow-[0_0_20px_rgba(212,175,55,0.2)]"
          >
            {loading ? (
              <div className="h-5 w-5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" /> Salvar Perfil
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
