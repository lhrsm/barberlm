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
  Timer,
  AlertTriangle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
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
  const [auditLogs, setAuditLogs] = React.useState<any[]>([]);
  const queryClient = useQueryClient();
  const { updateStatus: centralUpdateStatus } = useAppointmentStatus();

  React.useEffect(() => {
    if (open && appointmentId) {
      fetchAppointment();
    } else {
      setAppointment(null);
      setAuditLogs([]);
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

      const { data: logs } = await supabase
        .from("financial_adjustment_logs")
        .select(`
          *,
          adjusted_by_user:profiles(full_name)
        `)
        .eq("appointment_id", appointmentId!)
        .order("adjusted_at", { ascending: false });
      
      setAuditLogs(logs || []);
    } catch (error: any) {
      console.error("Error fetching appointment details:", error);
      toast.error("Erro ao carregar detalhes do agendamento");
    } finally {
      setLoading(false);
    }
  }

  const [isPixCancelModalOpen, setIsPixCancelModalOpen] = React.useState(false);

  const handleCancelClick = () => {
    if (!appointment) return;
    const isPixPaid = (['pix', 'PIX', 'Pix', 'mixed', 'misto'].includes(appointment.payment_method) || (appointment.pix_amount && Number(appointment.pix_amount) > 0)) && 
                      ['paid', 'confirmed', 'completed', 'pago', 'aprovado'].includes(appointment.payment_status);
    
    const hasCreditsOrCashback = (appointment.credits_used && Number(appointment.credits_used) > 0) || 
                                 (appointment.cashback_used && Number(appointment.cashback_used) > 0);

    if (isPixPaid) {
      if (!confirm("Tem certeza que deseja cancelar este agendamento?")) return;
      setIsPixCancelModalOpen(true);
    } else if (hasCreditsOrCashback) {
      if (!confirm("Este agendamento foi pago com créditos/cashback. O valor será devolvido ao saldo do cliente para uso futuro. Confirmar cancelamento?")) return;
      updateStatus('cancelled');
    } else {
      if (!confirm("Tem certeza que deseja cancelar este agendamento?")) return;
      updateStatus('cancelled');
    }
  };

  const updateStatus = async (newStatus: string, metadata: any = {}) => {
    if (!appointment) return;
    setActionLoading(true);
    
    const result = await centralUpdateStatus(
      appointment.id, 
      newStatus, 
      metadata, 
      'admin_panel'
    );

    if (result.success) {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      queryClient.invalidateQueries({ queryKey: ['calendar'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
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
    const configs: Record<string, { color: string, textColor: string, icon: any }> = {
      confirmed: { color: "bg-yellow-500/10 border-yellow-500/30", textColor: "text-yellow-500", icon: CheckCircle2 },
      scheduled: { color: "bg-blue-500/10 border-blue-500/30", textColor: "text-blue-500", icon: Calendar },
      awaiting_payment: { color: "bg-amber-500/10 border-amber-500/30", textColor: "text-amber-500", icon: DollarSign },
      cancelled: { color: "bg-red-500/10 border-red-500/30", textColor: "text-red-500", icon: XCircle },
      completed: { color: "bg-emerald-500/10 border-emerald-500/30", textColor: "text-emerald-500", icon: CheckCircle2 },
      awaiting_confirmation: { color: "bg-amber-400/10 border-amber-400/30", textColor: "text-amber-400", icon: Clock },
      pending: { color: "bg-amber-400/10 border-amber-400/30", textColor: "text-amber-400", icon: Clock },
      in_progress: { color: "bg-indigo-500/10 border-indigo-500/30", textColor: "text-indigo-500", icon: RefreshCcw },
    };
    const config = configs[status] || { color: "bg-gray-500/10 border-gray-500/30", textColor: "text-gray-400", icon: Clock };
    const Icon = config.icon;

    return (
      <div className="flex flex-col gap-2">
        <Badge className={cn("w-fit gap-1.5 font-black uppercase tracking-wider text-[10px] px-3 py-1 border rounded-lg", config.color, config.textColor)}>
          <Icon size={12} />
          {getStatusLabel(status)}
        </Badge>
        {status !== 'cancelled' && (
          <Badge className={cn(
            "w-fit gap-1.5 font-black uppercase tracking-wider text-[10px] px-3 py-1 border rounded-lg",
            appointment.payment_status === 'paid' ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-500" : "bg-amber-500/10 border-amber-500/30 text-amber-500"
          )}>
            <DollarSign size={12} />
            {appointment.payment_status === 'paid' ? 'Pago' : 'Pagamento Pendente'}
          </Badge>
        )}
      </div>
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
        <DialogContent className="sm:max-w-[500px] flex items-center justify-center min-h-[400px] bg-[#0b0f17] border-[#D4AF37]/20">
          <RefreshCcw className="animate-spin text-[#D4AF37]" size={32} />
        </DialogContent>
      </Dialog>
    );
  }

  if (!appointment) return null;

  const showConfirm = ["awaiting_confirmation", "scheduled", "awaiting_payment", "pending", "confirmed"].includes(appointment.status);
  const showComplete = ["confirmed", "scheduled", "pending", "awaiting_payment"].includes(appointment.status);
  const showCancel = ["scheduled", "pending", "awaiting_payment", "confirmed", "awaiting_confirmation"].includes(appointment.status);
  const showReschedule = ["scheduled", "pending", "awaiting_payment", "confirmed", "awaiting_confirmation"].includes(appointment.status);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px] p-0 overflow-hidden bg-[#0b0f17] border border-[#D4AF37]/20 rounded-3xl shadow-2xl text-white">
        <DialogHeader className="p-8 pb-6 border-b border-[#D4AF37]/10">
          <div className="flex flex-col gap-4">
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-5">
                <Avatar className="h-16 w-16 rounded-2xl border-2 border-[#D4AF37]/20 shadow-md">
                  <AvatarImage src={appointment.customers?.avatar_url} alt={appointment.customers?.name} />
                  <AvatarFallback className="bg-[#D4AF37]/5 text-[#D4AF37] font-black text-xl rounded-2xl">
                    {appointment.customers?.name?.[0] || <User />}
                  </AvatarFallback>
                </Avatar>
                <div className="space-y-1.5">
                  <DialogTitle className="text-2xl font-black tracking-tight text-white">
                    {appointment.customers?.name || "Cliente Final"}
                  </DialogTitle>
                  <div className="flex flex-col gap-2 mt-1">
                    {getStatusBadge(appointment.status)}
                    {appointment.status !== 'cancelled' && (
                      <Badge className={cn(
                        "w-fit gap-1.5 font-black uppercase tracking-wider text-[10px] px-3 py-1 border rounded-lg",
                        appointment.payment_status === 'paid' ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-500" : "bg-amber-500/10 border-amber-500/30 text-amber-500"
                      )}>
                        <DollarSign size={12} />
                        {appointment.payment_status === 'paid' ? 'Pago' : 'Pagamento Pendente'}
                      </Badge>
                    )}
                    <span className="text-[10px] w-fit font-black text-gray-500 uppercase tracking-widest bg-[#05070d] px-2 py-0.5 rounded border border-[#D4AF37]/10">
                      ID: {appointment.id.slice(0, 8)}
                    </span>
                  </div>
                </div>
              </div>
              <Button variant="ghost" size="icon" className="rounded-full text-gray-500 hover:text-white hover:bg-white/5" onClick={() => onOpenChange(false)}>
                <X size={20} />
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="p-8 space-y-8 max-h-[65vh] overflow-y-auto custom-scrollbar bg-[#0b0f17]">
          <div className="grid grid-cols-2 gap-8">
            <div className="space-y-6">
              <div className="space-y-2">
                <p className="text-[10px] font-black text-[#D4AF37] uppercase tracking-[0.2em] flex items-center gap-2">
                  <Phone size={12} /> Contato
                </p>
                <p className="text-sm font-bold text-white">{appointment.customers?.phone || "Não informado"}</p>
              </div>

              <div className="space-y-2">
                <p className="text-[10px] font-black text-[#D4AF37] uppercase tracking-[0.2em] flex items-center gap-2">
                  <Scissors size={12} /> Serviço
                </p>
                <p className="text-sm font-bold text-white">{appointment.services?.name}</p>
                <div className="flex items-center gap-4 mt-2">
                   <span className="flex items-center gap-1.5 text-[10px] font-bold text-gray-400 uppercase">
                     <Timer size={10} /> {appointment.services?.duration_minutes || appointment.duration_minutes || 30} min
                   </span>
                   <span className="flex items-center gap-1.5 text-[10px] font-black text-[#D4AF37] uppercase">
                     R$ {(appointment.services?.price || appointment.total_price || 0).toFixed(2)}
                   </span>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="space-y-2">
                <p className="text-[10px] font-black text-[#D4AF37] uppercase tracking-[0.2em] flex items-center gap-2">
                  <Calendar size={12} /> Agendado para
                </p>
                <p className="text-sm font-bold text-white">
                  {format(parseISO(appointment.start_time), "dd 'de' MMMM", { locale: ptBR })}
                </p>
                <p className="text-xs font-bold text-gray-400 flex items-center gap-1.5 mt-1">
                  <Clock size={12} /> {format(parseISO(appointment.start_time), "HH:mm")}
                </p>
              </div>

              <div className="space-y-2">
                <p className="text-[10px] font-black text-[#D4AF37] uppercase tracking-[0.2em] flex items-center gap-2">
                  <User size={12} /> Profissional
                </p>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-bold text-white">{appointment.barbers?.name}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-8 pt-2">
             <div className="space-y-2">
                <p className="text-[10px] font-black text-[#D4AF37] uppercase tracking-[0.2em] flex items-center gap-2">
                  <CreditCard size={12} /> Pagamento
                </p>
                <div className="space-y-1">
                  <p className="text-sm font-bold text-white">
                    {appointment.payment_method === 'misto' || appointment.payment_method === 'mixed' ? "Misto" : getPaymentMethodLabel(appointment.payment_method)}
                  </p>
                  {(appointment.payment_method === 'misto' || appointment.payment_method === 'mixed') && (
                    <div className="text-[10px] font-medium text-gray-500 space-y-0.5">
                      {appointment.pix_amount > 0 && <p>PIX: R$ {Number(appointment.pix_amount).toFixed(2)}</p>}
                      {appointment.cash_amount > 0 && <p>Dinheiro: R$ {Number(appointment.cash_amount).toFixed(2)}</p>}
                      {appointment.credit_card_amount > 0 && <p>Cartão: R$ {Number(appointment.credit_card_amount).toFixed(2)}</p>}
                      {appointment.debit_card_amount > 0 && <p>Débito: R$ {Number(appointment.debit_card_amount).toFixed(2)}</p>}
                      {appointment.credits_used > 0 && <p>Créditos: R$ {Number(appointment.credits_used).toFixed(2)}</p>}
                      {appointment.cashback_used > 0 && <p>Cashback: R$ {Number(appointment.cashback_used).toFixed(2)}</p>}
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-[10px] font-black text-[#D4AF37] uppercase tracking-[0.2em] flex items-center gap-2">
                  <DollarSign size={12} /> Valor Total
                </p>
                <p className="text-2xl font-black text-[#D4AF37]">R$ {(appointment.total_price || 0).toFixed(2)}</p>
                {appointment.cashback_earned > 0 && (
                  <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mt-1">
                    + R$ {Number(appointment.cashback_earned).toFixed(2)} Cashback Gerado
                  </p>
                )}
              </div>
          </div>

          {appointment.notes && (
            <div className="space-y-3 pt-6 border-t border-[#D4AF37]/10">
              <p className="text-[10px] font-black text-[#D4AF37] uppercase tracking-[0.2em] flex items-center gap-2">
                <MessageSquare size={14} /> Observações
              </p>
              <div className="p-4 rounded-2xl bg-[#05070d] border border-[#D4AF37]/5 text-sm text-gray-300 font-medium leading-relaxed italic">
                "{appointment.notes}"
              </div>
            </div>
          )}

          {auditLogs.length > 0 && (
            <div className="space-y-4 pt-6 border-t border-red-900/20">
              <p className="text-[10px] font-black text-red-500 uppercase tracking-[0.2em] flex items-center gap-2">
                <AlertTriangle size={14} /> Auditoria de Ajustes
              </p>
              <div className="space-y-3">
                {auditLogs.map((log) => (
                  <div key={log.id} className="p-4 rounded-xl bg-red-950/20 border border-red-900/20 text-xs text-gray-400">
                    <div className="flex justify-between mb-1">
                      <span className="font-bold text-white">Ajustado por: {log.adjusted_by_user?.full_name || 'Sistema'}</span>
                      <span className="text-gray-500">{format(parseISO(log.adjusted_at), "dd/MM/yyyy HH:mm")}</span>
                    </div>
                    <p className="italic text-red-400 font-medium mb-1">Motivo: {log.reason}</p>
                    <div className="text-[10px] bg-[#05070d] p-2 rounded border border-red-900/10 flex flex-col gap-0.5 mt-2">
                      <span className="font-bold uppercase text-gray-500">Mudanças:</span>
                      {log.new_values?.amount !== log.old_values?.amount && (
                        <span>Valor: R$ {log.old_values?.amount} → R$ {log.new_values?.amount}</span>
                      )}
                      {log.new_values?.payment_method !== log.old_values?.payment_method && (
                        <span>Método: {log.old_values?.payment_method} → {log.new_values?.payment_method}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="p-8 pt-4 border-t border-[#D4AF37]/10 flex flex-wrap gap-3 items-center justify-end bg-[#05070d]/50">
          <Button 
            variant="outline" 
            className="rounded-xl bg-transparent text-gray-400 border-white/10 hover:bg-white/5 font-black uppercase text-[10px] tracking-widest px-6 h-12"
            onClick={() => onOpenChange(false)}
          >
            Fechar
          </Button>

          {showCancel && (
            <Button 
              variant="default"
              className="rounded-xl bg-transparent hover:bg-red-950/20 text-red-500 border border-red-900/50 font-black uppercase text-[10px] tracking-widest px-6 h-12 transition-all active:scale-95"
              onClick={handleCancelClick}
              disabled={actionLoading}
            >
              Cancelar
            </Button>
          )}

          <Dialog open={isPixCancelModalOpen} onOpenChange={setIsPixCancelModalOpen}>
            <DialogContent className="bg-[#0b0f17] border border-[#D4AF37]/20 text-white rounded-[2rem] max-w-sm w-[90%] p-8">
              <DialogHeader className="text-center">
                <div className="w-16 h-16 bg-[#D4AF37]/10 rounded-full flex items-center justify-center mx-auto mb-6">
                  <DollarSign className="text-[#D4AF37] w-8 h-8" />
                </div>
                <DialogTitle className="text-2xl font-black tracking-tight mb-2 uppercase italic">Estorno ou Crédito?</DialogTitle>
                <DialogDescription className="text-gray-400 text-sm font-medium leading-relaxed">
                  Este agendamento foi pago via Pix. Escolha se deseja transformar o valor em crédito para usar em outro atendimento ou solicitar estorno.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-3 mt-6">
                <Button 
                  className="w-full h-14 bg-[#D4AF37] hover:bg-[#D4AF37]/90 text-black font-black uppercase italic tracking-tighter rounded-2xl"
                  onClick={() => {
                    setIsPixCancelModalOpen(false);
                    updateStatus('cancelled', { refund_preference: 'credits' });
                  }}
                  disabled={actionLoading}
                >
                  Transformar em Crédito
                </Button>
                <Button 
                  variant="outline"
                  className="w-full h-14 border-[#D4AF37]/20 hover:bg-[#D4AF37]/10 text-white font-black uppercase italic tracking-tighter rounded-2xl"
                  onClick={() => {
                    setIsPixCancelModalOpen(false);
                    updateStatus('cancelled', { refund_preference: 'refund' });
                  }}
                  disabled={actionLoading}
                >
                  Solicitar Estorno
                </Button>
                <Button 
                  variant="ghost"
                  className="w-full h-12 text-gray-500 font-bold uppercase text-[10px] tracking-widest hover:text-white"
                  onClick={() => setIsPixCancelModalOpen(false)}
                >
                  Voltar
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          {showReschedule && (
            <Button 
              variant="default"
              className="rounded-xl bg-transparent hover:bg-yellow-950/20 text-yellow-500 border border-yellow-900/50 font-black uppercase text-[10px] tracking-widest px-6 h-12 transition-all active:scale-95"
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
              className="rounded-xl bg-[#D4AF37] hover:bg-[#B8962E] text-black font-black uppercase text-[10px] tracking-widest px-8 h-12 shadow-[0_0_20px_rgba(212,175,55,0.2)] transition-all active:scale-95"
              onClick={() => updateStatus('confirmed')}
              disabled={actionLoading}
            >
              Confirmar
            </Button>
          )}

          {showComplete && (
            <Button 
              className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase text-[10px] tracking-widest px-8 h-12 shadow-[0_0_20px_rgba(16,185,129,0.2)] transition-all active:scale-95"
              onClick={() => updateStatus('completed')}
              disabled={actionLoading}
            >
              Concluir
            </Button>
          )}

          {appointment.status !== 'cancelled' && appointment.payment_status !== 'paid' && (
            <Button 
              className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black uppercase text-[10px] tracking-widest px-8 h-12 shadow-[0_0_20px_rgba(37,99,235,0.2)] transition-all active:scale-95"
              onClick={async () => {
                setActionLoading(true);
                const paymentStatusBefore = appointment.payment_status;
                
                try {
                  console.log('Marking appointment as paid:', { 
                    appointment_id: appointment.id,
                    payment_status_before: paymentStatusBefore
                  });

                  const { data, error, count } = await supabase
                    .from("appointments")
                    .update({ 
                      payment_status: 'paid',
                      paid_at: new Date().toISOString()
                    })
                    .eq("id", appointment.id)
                    .select('payment_status, paid_at');
                  
                  if (error) {
                    console.error('Error marking as paid:', error);
                    toast.error(`Erro ao marcar como pago: ${error.message || 'Erro desconhecido'}`);
                    
                    // Log mandatory details on error
                    console.log('PAYMENT_UPDATE_ERROR_LOG', {
                      appointment_id: appointment.id,
                      payment_status_before: paymentStatusBefore,
                      error: error.message,
                      schema_columns_checked: ['payment_status', 'paid_at']
                    });
                  } else {
                    console.log('PAYMENT_UPDATE_SUCCESS_LOG', {
                      appointment_id: appointment.id,
                      payment_status_before: paymentStatusBefore,
                      payment_status_after: data?.[0]?.payment_status,
                      rows_updated: count,
                      schema_columns_checked: ['payment_status', 'paid_at']
                    });

                    toast.success("Pagamento marcado como pago");
                    
                    // Invalidar caches centralizados
                    const queryKeys = [
                      ['appointments'], ['calendar'], ['dashboard'], ['customerAppointments'],
                      ['calendar-appointments'], ['dashboard-appointments'], ['admin-stats'],
                      ['admin-dashboard'], ['professional-dashboard'], ['professional-appointments'],
                      ['credits'], ['finances'], ['financial-dashboard'], ['customer-portal'],
                      ['barber-dashboard'], ['customer-appointments']
                    ];

                    queryKeys.forEach(key => {
                      queryClient.invalidateQueries({ queryKey: key });
                    });

                    fetchAppointment();
                    if (onSuccess) onSuccess();
                  }
                } catch (err: any) {
                  console.error('Fatal error in markAsPaid:', err);
                  toast.error(`Erro crítico: ${err.message || 'Erro inesperado'}`);
                } finally {
                  setActionLoading(false);
                }
              }}
              disabled={actionLoading}
            >
              Marcar Pago
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}