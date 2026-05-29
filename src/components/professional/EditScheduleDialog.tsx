import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Clock } from "lucide-react";

const dayNames: Record<string, string> = {
  monday: "Segunda-feira",
  tuesday: "Terça-feira",
  wednesday: "Quarta-feira",
  thursday: "Quinta-feira",
  friday: "Sexta-feira",
  saturday: "Sábado",
  sunday: "Domingo"
};

const sortedDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

export function EditScheduleDialog({ isOpen, onClose, barber, onUpdate }: any) {
  const [loading, setLoading] = useState(false);
  const [hours, setHours] = useState<any>({});

  useEffect(() => {
    if (barber?.working_hours) {
      setHours(barber.working_hours);
    } else {
      const initial: any = {};
      sortedDays.forEach(day => {
        initial[day] = { start: "09:00", end: "18:00", enabled: true };
      });
      setHours(initial);
    }
  }, [barber]);

  const handleToggle = (day: string) => {
    setHours({
      ...hours,
      [day]: { ...hours[day], enabled: !hours[day].enabled }
    });
  };

  const handleTimeChange = (day: string, field: string, value: string) => {
    setHours({
      ...hours,
      [day]: { ...hours[day], [field]: value }
    });
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from("barbers")
        .update({ working_hours: hours })
        .eq("id", barber.id);
      
      if (error) throw error;
      toast.success("Horários atualizados!");
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
      <DialogContent className="max-w-md max-h-[90vh] flex flex-col bg-white border-[#D4AF37] rounded-[12px] shadow-[0_4px_16px_rgba(0,0,0,0.15)]">
        <DialogHeader className="border-b border-[#D4AF37]/10 pb-6">
          <DialogTitle className="text-xl font-black flex items-center gap-2 text-[#111827]">
            <Clock className="h-6 w-6 text-[#D4AF37]" /> Editar Horários
          </DialogTitle>
        </DialogHeader>
        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-4 py-6">
            {sortedDays.map(day => (
              <div key={day} className="bg-white border border-[#D4AF37]/20 p-5 rounded-[12px] shadow-sm space-y-4 transition-all hover:border-[#D4AF37]/40">
                <div className="flex items-center justify-between">
                  <Label className="font-black text-sm text-[#111827] uppercase tracking-wide">{dayNames[day]}</Label>
                  <Switch 
                    checked={hours[day]?.enabled}
                    onCheckedChange={() => handleToggle(day)}
                    className="data-[state=checked]:bg-[#D4AF37]"
                  />
                </div>
                {hours[day]?.enabled && (
                  <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-1 duration-200">
                    <div className="space-y-2">
                      <Label className="text-[10px] uppercase font-black text-[#D4AF37] tracking-wider">Início</Label>
                      <Input 
                        type="time" 
                        value={hours[day].start}
                        onChange={(e) => handleTimeChange(day, 'start', e.target.value)}
                        className="border-[#D4AF37]/30 focus-visible:ring-[#D4AF37]/20 h-10 rounded-[8px] font-bold"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] uppercase font-black text-[#D4AF37] tracking-wider">Fim</Label>
                      <Input 
                        type="time" 
                        value={hours[day].end}
                        onChange={(e) => handleTimeChange(day, 'end', e.target.value)}
                        className="border-[#D4AF37]/30 focus-visible:ring-[#D4AF37]/20 h-10 rounded-[8px] font-bold"
                      />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
        <DialogFooter className="pt-6 border-t border-[#D4AF37]/10 gap-2 sm:gap-0">
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
            {loading ? "Salvando..." : "Salvar Horários"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
