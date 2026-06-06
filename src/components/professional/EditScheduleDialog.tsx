import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Clock, Save, X, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";

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
    if (barber && isOpen) {
      if (barber.working_hours && Object.keys(barber.working_hours).length > 0) {
        const merged: any = {};
        sortedDays.forEach(day => {
          merged[day] = barber.working_hours[day] || { start: "09:00", end: "18:00", enabled: false };
        });
        setHours(merged);
      } else {
        const initial: any = {};
        sortedDays.forEach(day => {
          initial[day] = { start: "09:00", end: "18:00", enabled: false };
        });
        setHours(initial);
      }
    }
  }, [barber, isOpen]);

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
      <DialogContent className="max-w-md max-h-[90vh] flex flex-col bg-[#0b0f17] border-[#D4AF37]/20 rounded-2xl shadow-2xl text-white p-0 overflow-hidden">
        <DialogHeader className="p-6 border-b border-[#D4AF37]/10 bg-[#0b0f17]">
          <DialogTitle className="text-xl font-black flex items-center gap-3 text-[#D4AF37] uppercase tracking-wider">
            <Calendar className="h-6 w-6" /> Configurar Agenda
          </DialogTitle>
        </DialogHeader>
        
        <ScrollArea className="flex-1 px-6">
          <div className="space-y-4 py-6">
            {sortedDays.map(day => (
              <div 
                key={day} 
                className={cn(
                  "border rounded-2xl p-5 transition-all duration-300",
                  hours[day]?.enabled 
                    ? "bg-[#D4AF37]/5 border-[#D4AF37]/30 shadow-[0_0_15px_rgba(212,175,55,0.05)]" 
                    : "bg-[#05070d] border-white/5 opacity-60"
                )}
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex flex-col">
                    <Label className="font-black text-sm text-white uppercase tracking-wide">{dayNames[day]}</Label>
                    <span className={cn(
                      "text-[9px] font-bold tracking-widest mt-0.5",
                      hours[day]?.enabled ? "text-[#D4AF37]" : "text-gray-600"
                    )}>
                      {hours[day]?.enabled ? "EXPEDIENTE ATIVO" : "FECHADO / FOLGA"}
                    </span>
                  </div>
                  <Switch 
                    checked={hours[day]?.enabled}
                    onCheckedChange={() => handleToggle(day)}
                    className="data-[state=checked]:bg-[#D4AF37]"
                  />
                </div>
                
                {hours[day]?.enabled && (
                  <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2 duration-300">
                    <div className="space-y-2">
                      <Label className="text-[9px] uppercase font-black text-[#D4AF37]/70 tracking-widest ml-1">Início</Label>
                      <div className="relative">
                        <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#D4AF37]/50" />
                        <Input 
                          type="time" 
                          value={hours[day].start}
                          onChange={(e) => handleTimeChange(day, 'start', e.target.value)}
                          className="bg-[#05070d] border-[#D4AF37]/20 focus-visible:ring-[#D4AF37]/40 h-11 pl-10 rounded-xl font-bold text-white transition-all"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[9px] uppercase font-black text-[#D4AF37]/70 tracking-widest ml-1">Fim</Label>
                      <div className="relative">
                        <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#D4AF37]/50" />
                        <Input 
                          type="time" 
                          value={hours[day].end}
                          onChange={(e) => handleTimeChange(day, 'end', e.target.value)}
                          className="bg-[#05070d] border-[#D4AF37]/20 focus-visible:ring-[#D4AF37]/40 h-11 pl-10 rounded-xl font-bold text-white transition-all"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
        
        <DialogFooter className="p-6 border-t border-[#D4AF37]/10 bg-[#0b0f17] gap-3">
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
                <Save className="h-4 w-4 mr-2" /> Salvar Horários
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
