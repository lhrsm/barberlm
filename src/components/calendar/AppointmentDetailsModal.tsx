import * as React from "react";
import { format, parseISO } from "date-fns";
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
  DollarSign,
  ChevronRight,
  Timer
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
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useQueryClient } from "@tanstack/react-query";
import { useAppointmentStatus } from "@/hooks/use-appointment-status";

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
  const queryClient = useQueryClient();
  const { updateStatus: centralUpdateStatus } = useAppointmentStatus();

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
          customers(id, name, phone, avatar_url, credits, cashback_balance),
          services(id, name, duration_minutes, price),
          barbers(id, name, avatar_url)
        `)
        .eq("id", appointmentId!)
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
    
    const result = await centralUpdateStatus(
      appointment.id, 
      newStatus, 
      {}, 
      'admin_panel'
    );

    if (result.success) {
      if (onSuccess) onSuccess();
      onOpenChange(false);
    }
    
    setActionLoading(false);
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      awaiting_confirmation: "Pendente",
      scheduled: "Agendado",
      confirmed: "Confirmado",
      awaiting_payment: "Pgto Pendente",
      completed: "Concluído",
      cancelled: "Cancelado",
      in_progress: "Em Atendimento",
      pending: "Pendente"
    };
    return labels[status] || status;
  };

  const getStatusBadge = (status: string) => {
    const configs: Record<string, { color: string, icon: any }> = {
      confirmed: { color: "bg-emerald-500", icon: CheckCircle2 },
      scheduled: { color: "bg-blue-500", icon: Calendar },
      awaiting_payment: { color: "bg-amber-500", icon: DollarSign },
      cancelled: { color: "bg-red-500", icon: XCircle },
      completed: { color: "bg-sky-500", icon: CheckCircle2 },
      awaiting_confirmation: { color: "bg-amber-400", icon: Clock },
      pending: { color: "bg-amber-400", icon: Clock },
      in_progress: { color: "bg-indigo-500", icon: RefreshCcw },
    };
    const config = configs[status] || { color: "bg-zinc-400", icon: Clock };
    const Icon = config.icon;

    return (
      <Badge className={cn("gap-1.5 font-bold uppercase tracking-wider text-[10px] px-3 py-1 text-white border-none rounded-full", config.color)}>
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
        <DialogContent className="sm:max-w-[500px] flex items-center justify-center min-h-[400px] bg-white border-none shadow-2xl">
          <RefreshCcw className="animate-spin text-black" size={32} />
        </DialogContent>
      </Dialog>
    );
  }

  if (!appointment) return null;

  const showConfirm = ["awaiting_confirmation", "scheduled", "awaiting_payment", "pending"].includes(appointment.status);
  const showComplete = ["confirmed", "scheduled"].includes(appointment.status);
  const showCancel = ["scheduled", "pending", "awaiting_payment", "confirmed", "awaiting_confirmation"].includes(appointment.status);
  const showReschedule = ["scheduled", "pending", "awaiting_payment", "confirmed", "awaiting_confirmation"].includes(appointment.status);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px] p-0 overflow-hidden bg-white border border-zinc-200 rounded-[2rem] shadow-2xl text-zinc-900">
        <DialogHeader className="p-8 pb-6 border-b border-zinc-100">
          <div className="flex flex-col gap-4">
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16 rounded-2xl border-2 border-zinc-100 shadow-sm">
                  <AvatarImage src={appointment.customers?.avatar_url} alt={appointment.customers?.name} />
                  <AvatarFallback className="bg-zinc-100 text-zinc-400 font-bold text-xl rounded-2xl">
                    {appointment.customers?.name?.[0] || <User />}
                  </AvatarFallback>
                </Avatar>
                <div className="space-y-1">
                  <DialogTitle className="text-2xl font-black tracking-tight text-black">
                    {appointment.customers?.name || "Cliente Final"}
                  </DialogTitle>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(appointment.status)}
                    <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest bg-zinc-50 px-2 py-0.5 rounded border border-zinc-100">
                      ID: {appointment.id.slice(0, 8)}
                    </span>
                  </div>
                </div>
              </div>
              <Button variant="ghost" size="icon" className="rounded-full text-zinc-400 hover:text-black hover:bg-zinc-50" onClick={() => onOpenChange(false)}>
                <X size={20} />
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="p-8 space-y-8 max-h-[65vh] overflow-y-auto custom-scrollbar">
          {/* Main Details Grid */}
          <div className="grid grid-cols-2 gap-8">
            <div className="space-y-6">
              <div className="space-y-1.5">
                <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] flex items-center gap-2">
                  <Phone size={12} className="text-emerald-500" /> Contato
                </p>
                <p className="text-sm font-bold text-zinc-900">{appointment.customers?.phone || "Não informado"}</p>
              </div>

              <div className="space-y-1.5">
                <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] flex items-center gap-2">
                  <Scissors size={12} className="text-sky-500" /> Serviço
                </p>
                <p className="text-sm font-bold text-zinc-900">{appointment.services?.name}</p>
                <div className="flex items-center gap-4 mt-1">
                   <span className="flex items-center gap-1.5 text-[10px] font-bold text-zinc-400 uppercase">
                     <Timer size={10} /> {appointment.services?.duration_minutes || appointment.duration_minutes || 30} min
                   </span>
                   <span className="flex items-center gap-1.5 text-[10px] font-black text-emerald-600 uppercase">
                     R$ {(appointment.services?.price || appointment.total_price || 0).toFixed(2)}
                   </span>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="space-y-1.5">
                <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] flex items-center gap-2">
                  <Calendar size={12} className="text-purple-500" /> Agendado para
                </p>
                <p className="text-sm font-bold text-zinc-900">
                  {format(parseISO(appointment.start_time), "dd 'de' MMMM", { locale: ptBR })}
                </p>
                <p className="text-xs font-bold text-zinc-500 flex items-center gap-1.5">
                  <Clock size={12} /> {format(parseISO(appointment.start_time), "HH:mm")}
                </p>
              </div>

              <div className="space-y-1.5">
                <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] flex items-center gap-2">
                  <User size={12} className="text-amber-500" /> Profissional
                </p>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-bold text-zinc-900">{appointment.barbers?.name}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-8 pt-2">
             <div className="space-y-1.5">
                <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] flex items-center gap-2">
                  <CreditCard size={12} className="text-blue-500" /> Pagamento
                </p>
                <p className="text-sm font-bold text-zinc-900">{getPaymentMethodLabel(appointment.payment_method)}</p>
                {appointment.status !== 'cancelled' ? (
                  <Badge variant="outline" className={cn("text-[9px] font-black px-2 border-zinc-200 text-zinc-400 uppercase tracking-widest mt-1", appointment.payment_status === 'paid' ? "text-emerald-600 border-emerald-100 bg-emerald-50" : "")}>
                    {appointment.payment_status === 'paid' ? 'Pago' : 'Pendente'}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[9px] font-black px-2 border-zinc-200 text-zinc-400 uppercase tracking-widest mt-1">
                    Sem cobrança
                  </Badge>
                )}
              </div>

              <div className="space-y-1.5">
                <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] flex items-center gap-2">
                  <DollarSign size={12} className="text-zinc-900" /> Valor Total
                </p>
                <p className="text-xl font-black text-black">R$ {(appointment.total_price || 0).toFixed(2)}</p>
              </div>
          </div>

          {/* Products & Notes */}
          {(appointment.items?.length > 1 || appointment.notes) && (
            <div className="space-y-6 pt-4 border-t border-zinc-100">
              {appointment.items?.length > 1 && (
                <div className="space-y-3">
                  <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] flex items-center gap-2">
                    <Package size={14} className="text-orange-500" /> Produtos Vinculados
                  </p>
                  <div className="space-y-2">
                    {appointment.items.filter((i: any) => i.type !== 'service').map((item: any, idx: number) => (
                      <div key={idx} className="flex justify-between items-center text-sm py-2 px-4 bg-zinc-50 rounded-xl border border-zinc-100">
                        <span className="font-bold text-zinc-900">{item.name} <span className="text-zinc-400 ml-1">x{item.quantity}</span></span>
                        <span className="font-black text-black">R$ {(item.price * item.quantity).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {appointment.notes && (
                <div className="space-y-3">
                  <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] flex items-center gap-2">
                    <MessageSquare size={14} className="text-zinc-600" /> Observações do Cliente
                  </p>
                  <div className="p-4 rounded-[1.5rem] bg-zinc-50 border border-zinc-100 text-sm text-zinc-600 font-medium leading-relaxed italic">
                    "{appointment.notes}"
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-8 pt-4 border-t border-zinc-100 flex flex-wrap gap-3 items-center justify-end bg-zinc-50/50">
          <Button 
            variant="outline" 
            className="rounded-xl bg-white text-zinc-900 border-zinc-300 hover:bg-zinc-100 font-bold px-6 h-12"
            onClick={() => onOpenChange(false)}
          >
            Fechar
          </Button>

          {showCancel && (
            <Button 
              variant="default"
              className="rounded-xl bg-red-500 hover:bg-red-600 text-white font-bold px-6 h-12 transition-all active:scale-95"
              onClick={() => updateStatus('cancelled')}
              disabled={actionLoading}
            >
              Cancelar
            </Button>
          )}

          {showReschedule && (
            <Button 
              variant="default"
              className="rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold px-6 h-12 transition-all active:scale-95"
              onClick={() => {
                onReschedule?.(appointment);
                onOpenChange(false);
              }}
              disabled={actionLoading}
            >
              Reagendar
            </Button>
          )}

          {showConfirm && (
            <Button 
              className="rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold px-8 h-12 shadow-lg shadow-emerald-200 transition-all active:scale-95"
              onClick={() => updateStatus('confirmed')}
              disabled={actionLoading}
            >
              Confirmar
            </Button>
          )}

          {showComplete && (
            <Button 
              className="rounded-xl bg-sky-500 hover:bg-sky-600 text-white font-bold px-8 h-12 shadow-lg shadow-sky-200 transition-all active:scale-95"
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