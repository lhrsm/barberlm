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
    bio: "",
    avatar_url: "",
    active: true,
    specialties: [] as string[]
  });

  useEffect(() => {
    if (barber) {
      setFormData({
        name: barber.name || "",
        phone: barber.phone || "",
        bio: barber.bio || "",
        avatar_url: barber.avatar_url || "",
        active: barber.active !== false,
        specialties: barber.specialties || []
      });
    }
  }, [barber]);

  const handleSave = async () => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from("barbers")
        .update(formData)
        .eq("id", barber.id);
      
      if (error) throw error;
      toast.success("Perfil atualizado!");
      onUpdate();
      onClose();
    } catch (e: any) {
      toast.error("Erro ao salvar: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto bg-white border-[#D4AF37] rounded-2xl shadow-xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-[#111827]">Editar Perfil</DialogTitle>
        </DialogHeader>
        <div className="space-y-6 py-4">
          <div className="flex flex-col items-center gap-4 mb-4">
            <Avatar className="h-24 w-24 border-4 border-[#D4AF37]/20 shadow-lg">
              <AvatarImage src={formData.avatar_url} />
              <AvatarFallback className="bg-[#D4AF37]/10 text-[#D4AF37] text-2xl">{formData.name.substring(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="w-full space-y-2">
              <Label className="text-[#111827] font-bold">URL da Foto</Label>
              <Input 
                placeholder="https://..." 
                value={formData.avatar_url}
                onChange={(e) => setFormData({...formData, avatar_url: e.target.value})}
                className="text-xs border-[#D4AF37]/30 focus-visible:ring-[#D4AF37]/20"
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <Label className="text-[#111827] font-bold">Nome Completo</Label>
            <Input 
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              className="border-[#D4AF37]/30 focus-visible:ring-[#D4AF37]/20"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-[#111827] font-bold">Telefone / WhatsApp</Label>
            <Input 
              value={formData.phone}
              onChange={(e) => setFormData({...formData, phone: e.target.value})}
              className="border-[#D4AF37]/30 focus-visible:ring-[#D4AF37]/20"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-[#111827] font-bold">Bio / Descrição</Label>
            <Textarea 
              value={formData.bio}
              onChange={(e) => setFormData({...formData, bio: e.target.value})}
              className="border-[#D4AF37]/30 focus-visible:ring-[#D4AF37]/20 min-h-[100px]"
            />
          </div>

          <div className="flex items-center justify-between p-3 bg-[#D4AF37]/5 rounded-xl border border-[#D4AF37]/20">
            <div className="space-y-0.5">
              <Label className="text-[#111827] font-bold">Perfil Visível</Label>
              <p className="text-[10px] text-[#6B7280]">Clientes podem ver seu perfil e agendar</p>
            </div>
            <Switch 
              checked={formData.active}
              onCheckedChange={(checked) => setFormData({...formData, active: checked})}
              className="data-[state=checked]:bg-[#D4AF37]"
            />
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button 
            variant="ghost" 
            onClick={onClose}
            className="text-[#6B7280] hover:bg-gray-100"
          >
            Cancelar
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={loading}
            className="bg-[#D4AF37] hover:bg-[#B8962E] text-black font-bold"
          >
            {loading ? "Salvando..." : "Salvar Alterações"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
