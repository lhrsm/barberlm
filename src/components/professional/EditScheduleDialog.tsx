import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";

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
      // Default fallback
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
      <DialogContent className="max-w-md max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Editar Horários</DialogTitle>
        </DialogHeader>
        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-4 py-4">
            {sortedDays.map(day => (
              <div key={day} className="border p-3 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="font-bold">{dayNames[day]}</Label>
                  <Switch 
                    checked={hours[day]?.enabled}
                    onCheckedChange={() => handleToggle(day)}
                  />
                </div>
                {hours[day]?.enabled && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase">Início</Label>
                      <Input 
                        type="time" 
                        value={hours[day].start}
                        onChange={(e) => handleTimeChange(day, 'start', e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase">Fim</Label>
                      <Input 
                        type="time" 
                        value={hours[day].end}
                        onChange={(e) => handleTimeChange(day, 'end', e.target.value)}
                      />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
        <DialogFooter className="pt-4">
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={loading}>Salvar Horários</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
