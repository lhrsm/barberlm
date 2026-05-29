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
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto bg-white border-[#D4AF37] rounded-[12px] shadow-[0_4px_16px_rgba(0,0,0,0.15)]">
        <DialogHeader>
          <DialogTitle className="text-xl font-black text-[#111827]">Editar Perfil</DialogTitle>
        </DialogHeader>
        <div className="space-y-6 py-4">
          <div className="flex flex-col items-center gap-4 mb-4">
            <Avatar className="h-24 w-24 border-4 border-[#D4AF37] shadow-lg">
              <AvatarImage src={formData.avatar_url} />
              <AvatarFallback className="bg-[#D4AF37]/10 text-[#D4AF37] text-2xl font-black">{formData.name.substring(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="w-full space-y-2">
              <Label className="text-[#111827] font-black uppercase text-[10px] tracking-wider">URL da Foto</Label>
              <Input 
                placeholder="https://..." 
                value={formData.avatar_url}
                onChange={(e) => setFormData({...formData, avatar_url: e.target.value})}
                className="text-sm border-[#D4AF37]/30 focus-visible:ring-[#D4AF37]/20 rounded-[10px] text-[#111827] placeholder:text-[#6B7280] bg-white font-medium"
              />
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-[#111827] font-black uppercase text-[10px] tracking-wider">Nome Completo</Label>
              <Input 
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                className="border-[#D4AF37]/30 focus-visible:ring-[#D4AF37]/20 rounded-[10px] font-bold text-[#111827] bg-white"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-[#111827] font-black uppercase text-[10px] tracking-wider">E-mail</Label>
              <Input 
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
                className="border-[#D4AF37]/30 focus-visible:ring-[#D4AF37]/20 rounded-[10px] font-bold text-[#111827] bg-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-[#111827] font-black uppercase text-[10px] tracking-wider">Telefone / WhatsApp</Label>
              <Input 
                value={formData.phone}
                onChange={(e) => setFormData({...formData, phone: e.target.value})}
                className="border-[#D4AF37]/30 focus-visible:ring-[#D4AF37]/20 rounded-[10px] font-bold text-[#111827] bg-white"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-[#111827] font-black uppercase text-[10px] tracking-wider">Cargo / Tipo</Label>
              <Input 
                placeholder="Ex: Freelancer, Master, etc."
                value={formData.category}
                onChange={(e) => setFormData({...formData, category: e.target.value})}
                className="border-[#D4AF37]/30 focus-visible:ring-[#D4AF37]/20 rounded-[10px] font-bold text-[#111827] bg-white"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-[#111827] font-black uppercase text-[10px] tracking-wider">Especialidades (separadas por vírgula)</Label>
            <Input 
              placeholder="Ex: Corte Degradê, Barba, Pigmentação"
              value={formData.specialties_string}
              onChange={(e) => setFormData({...formData, specialties_string: e.target.value})}
              className="border-[#D4AF37]/30 focus-visible:ring-[#D4AF37]/20 rounded-[10px] font-bold text-[#111827] bg-white"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-[#111827] font-black uppercase text-[10px] tracking-wider">Bio / Descrição</Label>
            <Textarea 
              value={formData.bio}
              onChange={(e) => setFormData({...formData, bio: e.target.value})}
              className="border-[#D4AF37]/30 focus-visible:ring-[#D4AF37]/20 min-h-[100px] rounded-[10px] font-medium text-[#111827] bg-white"
            />
          </div>

          <div className="flex items-center justify-between p-4 bg-[#D4AF37]/5 rounded-[12px] border border-[#D4AF37]/20">
            <div className="space-y-0.5">
              <Label className="text-[#111827] font-black uppercase text-[10px]">Perfil Disponível</Label>
              <p className="text-[10px] text-[#6B7280] font-medium">Clientes podem ver seu perfil e agendar</p>
            </div>
            <Switch 
              checked={formData.active}
              onCheckedChange={(checked) => setFormData({...formData, active: checked})}
              className="data-[state=checked]:bg-[#D4AF37]"
            />
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-0 mt-4">
          <Button 
            variant="ghost" 
            onClick={onClose}
            className="text-[#6B7280] hover:bg-gray-100 font-bold rounded-[10px]"
          >
            Cancelar
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={loading}
            className="bg-[#111111] hover:bg-[#1a1a1a] text-white border border-[#D4AF37] rounded-[10px] font-black px-6 h-11 transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            {loading ? "Salvando..." : "Salvar Alterações"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
