import * as React from "react";
import { format, parseISO, addMinutes } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  X, 
  User, 
  Phone, 
  Scissors, 
  Calendar, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  RefreshCcw, 
  CreditCard,
  MessageSquare,
  Package,
  DollarSign
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface AppointmentDetailsModalProps {
  appointmentId?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  onReschedule?: (appointment: any) => void;
}

export function AppointmentDetailsModal({ 
  appointmentId, 
  open, 
  onOpenChange,
  onSuccess,
  onReschedule
}: AppointmentDetailsModalProps) {
  const [appointment, setAppointment] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(false);
  const [actionLoading, setActionLoading] = React.useState(false);

  React.useEffect(() => {
    if (open && appointmentId) {
      fetchAppointment();
    } else {
      setAppointment(null);
    }
  }, [open, appointmentId]);

  async function fetchAppointment() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("appointments")
        .select(`
          *,
          customers(name, phone, avatar_url, credits, cashback_balance),
          services(name, duration_minutes, price),
          barbers(name)
        `)
        .eq("id", appointmentId)
        .single();

      if (error) throw error;
      setAppointment(data);
    } catch (error: any) {
      console.error("Error fetching appointment details:", error);
      toast.error("Erro ao carregar detalhes do agendamento");
    } finally {
      setLoading(false);
    }
  }

  const updateStatus = async (newStatus: string) => {
    if (!appointment) return;
    setActionLoading(true);
    try {
      const { error } = await supabase
        .from("appointments")
        .update({ status: newStatus })
        .eq("id", appointment.id);

      if (error) throw error;

      toast.success(`Status atualizado para ${getStatusLabel(newStatus)}`);
      if (onSuccess) onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error updating status:", error);
      toast.error("Erro ao atualizar status");
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      awaiting_confirmation: "Aguardando Confirmação",
      scheduled: "Agendado",
      confirmed: "Confirmado",
      awaiting_payment: "Aguardando Pagamento",
      completed: "Concluído",
      cancelled: "Cancelado",
      in_progress: "Em Atendimento"
    };
    return labels[status] || status;
  };

  const getStatusBadge = (status: string) => {
    const configs: Record<string, { color: string, icon: any }> = {
      confirmed: { color: "bg-emerald-500", icon: CheckCircle2 },
      scheduled: { color: "bg-blue-500", icon: Calendar },
      awaiting_payment: { color: "bg-amber-500", icon: DollarSign },
      cancelled: { color: "bg-red-500", icon: XCircle },
      completed: { color: "bg-zinc-500", icon: CheckCircle2 },
      awaiting_confirmation: { color: "bg-amber-400", icon: Clock },
    };
    const config = configs[status] || { color: "bg-zinc-400", icon: Clock };
    const Icon = config.icon;

    return (
      <Badge className={cn("gap-1.5 font-bold uppercase tracking-wider text-[10px] px-3 py-1", config.color)}>
        <Icon size={12} />
        {getStatusLabel(status)}
      </Badge>
    );
  };

  const getPaymentMethodLabel = (method: string) => {
    const labels: Record<string, string> = {
      pix: "PIX",
      barbershop: "Pagar na Unidade",
      credits: "Créditos/Carteira",
      card: "Cartão"
    };
    return labels[method] || method || "Não informado";
  };

  if (loading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[500px] flex items-center justify-center min-h-[400px]">
          <RefreshCcw className="animate-spin text-sky-500" size={32} />
        </DialogContent>
      </Dialog>
    );
  }

  if (!appointment) return null;

  const showConfirm = ["awaiting_confirmation", "scheduled", "awaiting_payment"].includes(appointment.status);
  const showComplete = ["confirmed", "scheduled", "in_progress"].includes(appointment.status);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden bg-white border border-zinc-200 rounded-2xl shadow-xl shadow-black/10 text-zinc-900">
        <DialogHeader className="p-6 bg-zinc-50/50 border-b border-zinc-100">
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <DialogTitle className="text-2xl font-black tracking-tight flex items-center gap-2">
                Detalhes do Agendamento
              </DialogTitle>
              <div className="flex items-center gap-2">
                {getStatusBadge(appointment.status)}
                <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest">#{appointment.id.slice(0, 8)}</span>
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
          {/* Client Info */}
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-sky-50 flex items-center justify-center text-sky-600">
                  <User size={20} />
                </div>
                <div>
                  <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Cliente</p>
                  <p className="text-sm font-bold">{appointment.customers?.name || "Cliente Final"}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
                  <Phone size={20} />
                </div>
                <div>
                  <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Telefone</p>
                  <p className="text-sm font-bold">{appointment.customers?.phone || "Não informado"}</p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600">
                  <Scissors size={20} />
                </div>
                <div>
                  <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Serviço</p>
                  <p className="text-sm font-bold">{appointment.services?.name}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
                  <User size={20} />
                </div>
                <div>
                  <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Barbeiro</p>
                  <p className="text-sm font-bold">{appointment.barbers?.name}</p>
                </div>
              </div>
            </div>
          </div>

          <hr className="border-zinc-100" />

          {/* Time and Payment */}
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-zinc-50 flex items-center justify-center text-zinc-600">
                  <Calendar size={20} />
                </div>
                <div>
                  <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Data</p>
                  <p className="text-sm font-bold">{format(parseISO(appointment.start_time), "dd 'de' MMMM", { locale: ptBR })}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-zinc-50 flex items-center justify-center text-zinc-600">
                  <Clock size={20} />
                </div>
                <div>
                  <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Horário</p>
                  <p className="text-sm font-bold">{format(parseISO(appointment.start_time), "HH:mm")}</p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-zinc-50 flex items-center justify-center text-zinc-600">
                  <DollarSign size={20} />
                </div>
                <div>
                  <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Valor</p>
                  <p className="text-sm font-bold">R$ {(appointment.total_price || 0).toFixed(2)}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-zinc-50 flex items-center justify-center text-zinc-600">
                  <CreditCard size={20} />
                </div>
                <div>
                  <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Pagamento</p>
                  <p className="text-sm font-bold">{getPaymentMethodLabel(appointment.payment_method)}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Products/Notes */}
          {(appointment.items?.length > 1 || appointment.notes) && (
            <>
              <hr className="border-zinc-100" />
              <div className="space-y-4">
                {appointment.items?.length > 1 && (
                  <div className="space-y-2">
                    <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                      <Package size={14} /> Itens Adicionais
                    </p>
                    <div className="space-y-1">
                      {appointment.items.filter((i: any) => i.type !== 'service').map((item: any, idx: number) => (
                        <div key={idx} className="flex justify-between text-sm py-1">
                          <span className="font-medium">{item.name} x{item.quantity}</span>
                          <span className="font-bold">R$ {(item.price * item.quantity).toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {appointment.notes && (
                  <div className="space-y-2">
                    <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                      <MessageSquare size={14} /> Observações
                    </p>
                    <p className="text-sm text-zinc-600 bg-zinc-50 p-3 rounded-xl border border-zinc-100">
                      {appointment.notes}
                    </p>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        <div className="p-6 bg-zinc-50/50 border-t border-zinc-100 flex flex-wrap gap-3 items-center justify-center sm:justify-end">
          <Button 
            variant="outline" 
            className="rounded-xl border-zinc-200 bg-white text-zinc-900 font-bold px-6 h-11"
            onClick={() => onOpenChange(false)}
          >
            Fechar
          </Button>

          {appointment.status !== 'cancelled' && (
            <Button 
              variant="outline"
              className="rounded-xl border-red-100 bg-red-50 text-red-600 hover:bg-red-100 font-bold px-6 h-11"
              onClick={() => updateStatus('cancelled')}
              disabled={actionLoading}
            >
              Cancelar
            </Button>
          )}

          <Button 
            variant="outline"
            className="rounded-xl border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 font-bold px-6 h-11"
            onClick={() => {
              onReschedule?.(appointment);
              onOpenChange(false);
            }}
            disabled={actionLoading}
          >
            Reagendar
          </Button>

          {showConfirm && (
            <Button 
              className="rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold px-6 h-11 shadow-sm"
              onClick={() => updateStatus('confirmed')}
              disabled={actionLoading}
            >
              Confirmar
            </Button>
          )}

          {showComplete && (
            <Button 
              className="rounded-xl bg-blue-500 hover:bg-blue-600 text-white font-bold px-6 h-11 shadow-sm"
              onClick={() => updateStatus('completed')}
              disabled={actionLoading}
            >
              Concluir
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
