import React, { useState, useEffect } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Calendar as CalendarIcon, Clock, AlertCircle, Trash2, Plus } from "lucide-react";
import { format, parseISO, isWithinInterval, addDays, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { getTimeOff, createTimeOff, updateTimeOff, deleteTimeOff, checkConflicts, TimeOff } from "@/lib/time-off.functions";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";

interface ProfessionalTimeOffDialogProps {
  professional: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const TIME_OFF_TYPES = [
  { value: 'day_off', label: 'Folga' },
  { value: 'personal_block', label: 'Bloqueio Pessoal' },
  { value: 'break', label: 'Intervalo Extra' },
  { value: 'meeting', label: 'Reunião' },
  { value: 'training', label: 'Treinamento' },
  { value: 'vacation', label: 'Férias' },
  { value: 'medical_leave', label: 'Licença Médica' },
  { value: 'personal_leave', label: 'Licença Pessoal' },
];

export function ProfessionalTimeOffDialog({ professional, open, onOpenChange }: ProfessionalTimeOffDialogProps) {
  const [timeOffs, setTimeOffs] = useState<TimeOff[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [isCheckingConflicts, setIsCheckingConflicts] = useState(false);
  const [conflicts, setConflicts] = useState<any[]>([]);
  
  const [formData, setFormData] = useState({
    type: 'personal_block',
    title: '',
    description: '',
    starts_at: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
    ends_at: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
    all_day: false
  });

  useEffect(() => {
    if (open && professional?.id) {
      loadTimeOffs();
    }
  }, [open, professional?.id]);

  async function loadTimeOffs() {
    setIsLoading(true);
    try {
      const data = await getTimeOff({ data: { professionalId: professional.id } });
      setTimeOffs(data);
    } catch (error) {
      console.error("Error loading time off:", error);
      toast.error("Erro ao carregar ausências");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleCheckConflicts() {
    if (!formData.starts_at || !formData.ends_at) return;
    
    setIsCheckingConflicts(true);
    try {
      const data = await checkConflicts({
        data: {
          professionalId: professional.id,
          startsAt: formData.starts_at,
          endsAt: formData.ends_at
        }
      });

      setConflicts(data as any[]);
    } catch (error) {
      console.error("Error checking conflicts:", error);
    } finally {
      setIsCheckingConflicts(false);
    }
  }

  useEffect(() => {
    if (isAdding && formData.starts_at && formData.ends_at) {
      const timer = setTimeout(() => {
        handleCheckConflicts();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [formData.starts_at, formData.ends_at, isAdding]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (new Date(formData.starts_at) >= new Date(formData.ends_at)) {
      toast.error("A data de término deve ser posterior à data de início");
      return;
    }

    try {
      await createTimeOff({
        data: {
          professional_id: professional.id,
          type: formData.type as any,
          title: formData.title,
          description: formData.description,
          starts_at: new Date(formData.starts_at).toISOString(),
          ends_at: new Date(formData.ends_at).toISOString(),
          all_day: formData.all_day
        }
      });

      toast.success("Ausência registrada com sucesso");
      setIsAdding(false);
      setFormData({
        type: 'personal_block',
        title: '',
        description: '',
        starts_at: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
        ends_at: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
        all_day: false
      });
      loadTimeOffs();
    } catch (error) {
      console.error("Error creating time off:", error);
      toast.error("Erro ao registrar ausência");
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Tem certeza que deseja excluir esta ausência?")) return;
    
    try {
      await deleteTimeOff({ data: { id } });
      toast.success("Ausência excluída");
      loadTimeOffs();
    } catch (error) {
      console.error("Error deleting time off:", error);
      toast.error("Erro ao excluir ausência");
    }
  }

  const getTypeLabel = (type: string) => {
    return TIME_OFF_TYPES.find(t => t.value === type)?.label || type;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Gestão de Ausências - {professional?.name}</DialogTitle>
          <DialogDescription>
            Configure folgas, férias e períodos de indisponibilidade.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {!isAdding ? (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">Histórico e Agendamentos</h3>
                <Button onClick={() => setIsAdding(true)} variant="default">
                  <Plus className="w-4 h-4 mr-2" />
                  Nova Ausência
                </Button>
              </div>

              {isLoading ? (
                <div className="flex justify-center p-8">
                  <Clock className="w-8 h-8 animate-spin text-muted-foreground" />
                </div>
              ) : timeOffs.length === 0 ? (
                <div className="text-center p-8 border-2 border-dashed rounded-lg text-muted-foreground">
                  Nenhuma ausência registrada.
                </div>
              ) : (
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Início</TableHead>
                        <TableHead>Término</TableHead>
                        <TableHead>Título</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {timeOffs.map((to) => (
                        <TableRow key={to.id}>
                          <TableCell>
                            <Badge variant="outline">{getTypeLabel(to.type)}</Badge>
                          </TableCell>
                          <TableCell>{format(parseISO(to.starts_at), "dd/MM/yy HH:mm", { locale: ptBR })}</TableCell>
                          <TableCell>{format(parseISO(to.ends_at), "dd/MM/yy HH:mm", { locale: ptBR })}</TableCell>
                          <TableCell>{to.title || '-'}</TableCell>
                          <TableCell className="text-right">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => handleDelete(to.id)}
                              className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4 border p-4 rounded-lg bg-muted/30">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Tipo de Ausência</Label>
                  <Select 
                    value={formData.type} 
                    onValueChange={(v) => setFormData({...formData, type: v})}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      {TIME_OFF_TYPES.map(t => (
                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Título (Opcional)</Label>
                  <Input 
                    placeholder="Ex: Consulta médica, Férias..." 
                    value={formData.title}
                    onChange={(e) => setFormData({...formData, title: e.target.value})}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Início</Label>
                  <Input 
                    type="datetime-local" 
                    value={formData.starts_at}
                    onChange={(e) => setFormData({...formData, starts_at: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Término</Label>
                  <Input 
                    type="datetime-local" 
                    value={formData.ends_at}
                    onChange={(e) => setFormData({...formData, ends_at: e.target.value})}
                  />
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="all_day" 
                  checked={formData.all_day}
                  onCheckedChange={(checked) => setFormData({...formData, all_day: !!checked})}
                />
                <Label htmlFor="all_day">Dia Inteiro</Label>
              </div>

              <div className="space-y-2">
                <Label>Descrição / Notas</Label>
                <Textarea 
                  placeholder="Informações adicionais..." 
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                />
              </div>

              {conflicts.length > 0 && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Atenção: Conflitos Detectados</AlertTitle>
                  <AlertDescription>
                    Existem {conflicts.length} agendamentos neste período:
                    <ul className="mt-2 list-disc list-inside text-sm">
                      {conflicts.slice(0, 3).map((c, idx) => (
                        <li key={idx}>
                          {c.customer_name} - {format(parseISO(c.start_time), "HH:mm")} ({c.service_name})
                        </li>
                      ))}
                      {conflicts.length > 3 && <li>... e mais {conflicts.length - 3} outros</li>}
                    </ul>
                    <p className="mt-2 font-semibold">Os agendamentos não serão cancelados automaticamente. Você precisará remarcá-los manualmente.</p>
                  </AlertDescription>
                </Alert>
              )}

              <div className="flex justify-end space-x-2">
                <Button type="button" variant="ghost" onClick={() => setIsAdding(false)}>
                  Cancelar
                </Button>
                <Button type="submit">
                  Confirmar Ausência
                </Button>
              </div>
            </form>
          )}
        </div>

        <DialogFooter className="border-t pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
