import * as React from "react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
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
  DollarSign,
  Timer,
  AlertTriangle,
  ShoppingBag,
  Sparkles,
  RotateCcw
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { ComandaModal } from "./ComandaModal";
import { SplitPaymentModal } from "./SplitPaymentModal";
import { useQueryClient } from "@tanstack/react-query";
import { useAppointmentStatus } from "@/hooks/use-appointment-status";
import { useCustomerCancellation, type CancellationStep, type FinancialStatus } from "@/hooks/use-customer-cancellation";

interface AppointmentDetailsModalProps {
  appointmentId?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  onReschedule?: (appointment: any) => void;
  mode?: 'admin' | 'customer' | 'admin_read_only';
}

export function AppointmentDetailsModal({
  appointmentId,
  open,
  onOpenChange,
  onSuccess,
  onReschedule,
  mode = 'admin'
}: AppointmentDetailsModalProps) {
  const [appointment, setAppointment] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(false);
  const [actionLoading, setActionLoading] = React.useState(false);
  const [auditLogs, setAuditLogs] = React.useState<any[]>([]);
  const queryClient = useQueryClient();
  const { updateStatus: centralUpdateStatus } = useAppointmentStatus();
  const [comandaOpen, setComandaOpen] = React.useState(false);
  const [splitOpen, setSplitOpen] = React.useState(false);

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
          barbers!appointments_barber_id_fkey(id, name, avatar_url)
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

  const [cancellationStep, setCancellationStep] = React.useState<CancellationStep>('none');
  const [financialStatus, setFinancialStatus] = React.useState<FinancialStatus | null>(null);
  const { getFinancialStatus, confirmSimpleCancellation, confirmCancellationWithCredit, confirmCancellationWithRefundRequest } = useCustomerCancellation();

  const handleCancelClick = async () => {
    if (!appointment) return;

    setLoading(true);
    try {
      const finStatus = await getFinancialStatus(appointment.id);
      setFinancialStatus(finStatus);

      const hasFinancialValues =
        Boolean(finStatus.has_paid_pix) ||
        (Boolean(finStatus.has_used_credits) && Number(finStatus.used_credit_amount) > 0) ||
        (Boolean(finStatus.has_used_cashback) && Number(finStatus.used_cashback_amount) > 0);

      if (hasFinancialValues) {
        setCancellationStep('financial_decision');
      } else {
        setCancellationStep('simple_confirmation');
      }
    } catch (err: any) {
      console.error("Error checking financial status:", err);
      toast.error("Erro ao verificar status financeiro do agendamento");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmSimpleCancel = async () => {
    if (!appointment) return;

    const finStatus = financialStatus || await getFinancialStatus(appointment.id);
    const hasFinancialValues =
      Boolean(finStatus.has_paid_pix) ||
      (Boolean(finStatus.has_used_credits) && Number(finStatus.used_credit_amount) > 0) ||
      (Boolean(finStatus.has_used_cashback) && Number(finStatus.used_cashback_amount) > 0);

    if (mode === 'customer' && hasFinancialValues) {
      setFinancialStatus(finStatus);
      setCancellationStep('financial_decision');
      return;
    }

    setActionLoading(true);
    const result = await confirmSimpleCancellation(appointment.id, mode === 'customer' ? 'customer_portal' : 'admin_panel');
    if (result.success) {
      onSuccess?.();
      onOpenChange(false);
    }
    setActionLoading(false);
  };

  const handleConfirmCreditCancel = async () => {
    if (!appointment) return;
    setActionLoading(true);
    const result = await confirmCancellationWithCredit(appointment.id, mode === 'customer' ? 'customer_portal' : 'admin_panel');
    if (result.success) {
      onSuccess?.();
      onOpenChange(false);
    }
    setActionLoading(false);
  };

  const handleConfirmRefundCancel = async () => {
    if (!appointment) return;
    if (!refundData.pixKey || !refundData.holderName) {
      toast.error("Por favor, preencha os dados do Pix");
      return;
    }
    setActionLoading(true);
    const result = await confirmCancellationWithRefundRequest(appointment.id, refundData, mode === 'customer' ? 'customer_portal' : 'admin_panel');
    if (result.success) {
      onSuccess?.();
      onOpenChange(false);
    }
    setActionLoading(false);
  };

  const [refundData, setRefundData] = React.useState({
    holderName: '',
    pixKey: '',
    pixType: 'cpf',
    notes: ''
  });

  const updateStatus = async (newStatus: string, metadata: any = {}) => {
    if (!appointment) return;

    if (newStatus === 'completed') {
      const isProvenZeroAmount =
        (appointment.total_price !== null && appointment.total_price !== undefined && Number(appointment.total_price) === 0) ||
        (appointment.final_amount !== null && appointment.final_amount !== undefined && Number(appointment.final_amount) === 0);

      const isPaidOrSettled =
        appointment.payment_status === 'paid' ||
        appointment.payment_status === 'covered_by_subscription' ||
        isProvenZeroAmount;

      if (!isPaidOrSettled) {
        toast.error("Pagamento pendente. Registre ou confirme o pagamento antes de concluir o atendimento.");
        return;
      }
    }

    setActionLoading(true);

    const result = await centralUpdateStatus(
      appointment.id,
      newStatus,
      metadata,
      mode === 'customer' ? 'customer_portal' : 'admin_panel'
    );

    if (result.success) {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      queryClient.invalidateQueries({ queryKey: ['calendar'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['customer-appointments'] });
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
      confirmed: { color: "bg-emerald-500/10 border-emerald-500/30", textColor: "text-emerald-400", icon: CheckCircle2 },
      scheduled: { color: "bg-blue-500/10 border-blue-500/30", textColor: "text-blue-400", icon: Calendar },
      awaiting_payment: { color: "bg-amber-500/10 border-amber-500/30", textColor: "text-amber-400", icon: DollarSign },
      cancelled: { color: "bg-red-500/10 border-red-500/30", textColor: "text-red-400", icon: XCircle },
      completed: { color: "bg-emerald-500/10 border-emerald-500/30", textColor: "text-emerald-400", icon: CheckCircle2 },
      awaiting_confirmation: { color: "bg-amber-400/10 border-amber-400/30", textColor: "text-amber-400", icon: Clock },
      pending: { color: "bg-amber-400/10 border-amber-400/30", textColor: "text-amber-400", icon: Clock },
      in_progress: { color: "bg-indigo-500/10 border-indigo-500/30", textColor: "text-indigo-400", icon: RefreshCcw },
    };
    const config = configs[status] || { color: "bg-gray-500/10 border-gray-500/30", textColor: "text-gray-400", icon: Clock };
    const Icon = config.icon;

    return (
      <Badge className={cn("w-fit gap-1.5 font-bold uppercase tracking-wider text-[10px] px-2.5 py-1 border rounded-lg", config.color, config.textColor)}>
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
      card: "Cartão",
      money: "Dinheiro",
      subscription: "Plano / Assinatura"
    };
    return labels[method] || method || "Não informado";
  };

  if (loading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="w-[calc(100vw-24px)] sm:max-w-[480px] flex flex-col items-center justify-center min-h-[300px] bg-[#0b1220] border border-gold/20 rounded-3xl p-8">
          <RefreshCcw className="animate-spin text-gold mb-3" size={32} />
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Carregando detalhes...</p>
        </DialogContent>
      </Dialog>
    );
  }

  if (!appointment) return null;

  const showConfirm = ["awaiting_confirmation", "pending"].includes(appointment.status);
  const showComplete = ["confirmed", "scheduled", "pending", "awaiting_payment", "in_progress"].includes(appointment.status);
  const showCancel = ["scheduled", "pending", "awaiting_payment", "confirmed", "awaiting_confirmation"].includes(appointment.status);
  const showReschedule = ["scheduled", "pending", "awaiting_payment", "confirmed", "awaiting_confirmation"].includes(appointment.status);

  const isPaid = appointment.payment_status === 'paid';
  const isSubCovered = appointment.payment_method === 'subscription' || appointment.payment_status === 'covered_by_subscription';
  const isZeroAmount = (appointment.total_price === 0 || appointment.final_amount === 0);
  const canComplete = isPaid || isSubCovered || isZeroAmount;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-24px)] sm:max-w-[620px] max-h-[calc(100dvh-24px)] p-0 overflow-hidden flex flex-col bg-[#0b1220] border border-gold/20 rounded-3xl shadow-2xl text-white">
        {/* Header com Hierarquia Visual Clara */}
        <DialogHeader className="p-5 sm:p-6 pb-4 border-b border-white/5 shrink-0 bg-[#080d17]">
          <div className="flex items-start gap-4">
            <Avatar className="h-13 w-13 sm:h-14 sm:w-14 rounded-2xl border border-gold/30 shrink-0 bg-gold/5">
              <AvatarImage src={appointment.customers?.avatar_url} alt={appointment.customers?.name} />
              <AvatarFallback className="bg-gold/10 text-gold font-black text-lg rounded-2xl">
                {appointment.customers?.name?.[0] || <User size={20} />}
              </AvatarFallback>
            </Avatar>

            <div className="min-w-0 flex-1 space-y-1">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gold/80">Detalhes do Agendamento</p>
              <DialogTitle className="text-lg sm:text-xl font-black text-white truncate">
                {appointment.customers?.name || "Cliente Final"}
              </DialogTitle>
              <div className="flex items-center gap-2 text-xs text-gray-400 font-medium">
                <Phone size={12} className="text-gray-500 shrink-0" />
                <span>{appointment.customers?.phone || "Sem telefone"}</span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-3 mt-3 border-t border-white/5">
            {getStatusBadge(appointment.status)}

            {appointment.status !== 'cancelled' && (
              isSubCovered ? (
                <Badge className="w-fit gap-1.5 font-bold uppercase tracking-wider text-[10px] px-2.5 py-1 border rounded-lg bg-gold/10 border-gold/30 text-gold">
                  <DollarSign size={12} /> Incluso no Plano
                </Badge>
              ) : (
                <Badge className={cn(
                  "w-fit gap-1.5 font-bold uppercase tracking-wider text-[10px] px-2.5 py-1 border rounded-lg",
                  isPaid ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" : "bg-amber-500/10 border-amber-500/30 text-amber-400"
                )}>
                  <DollarSign size={12} />
                  {isPaid ? "Pago" : "Pagamento Pendente"}
                </Badge>
              )
            )}

            <span className="text-[10px] font-mono text-gray-500 bg-black/40 px-2 py-0.5 rounded border border-white/5 ml-auto">
              ID: {appointment.id.slice(0, 8)}
            </span>
          </div>
        </DialogHeader>

        {/* Corpo com Cards Modulares e Scroll Vertical */}
        <div className="p-4 sm:p-6 space-y-4 overflow-y-auto max-h-[58vh] bg-[#0b1220]">
          {/* Card de Serviço, Profissional, Data e Horário */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Serviço */}
            <div className="p-3.5 rounded-2xl bg-[#080d17] border border-white/5 space-y-1">
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-1.5">
                <Scissors size={12} className="text-gold" /> Serviço
              </span>
              <p className="text-sm font-bold text-white truncate">{appointment.services?.name || "Serviço"}</p>
              <div className="flex items-center gap-3 pt-1 text-xs text-gray-400">
                <span className="flex items-center gap-1 font-medium text-[11px]">
                  <Timer size={11} className="text-gray-500" /> {appointment.services?.duration_minutes || appointment.duration_minutes || 30} min
                </span>
                <span className="font-bold text-gold text-xs">
                  R$ {(appointment.services?.price || appointment.total_price || 0).toFixed(2)}
                </span>
              </div>
            </div>

            {/* Profissional */}
            <div className="p-3.5 rounded-2xl bg-[#080d17] border border-white/5 space-y-1">
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-1.5">
                <User size={12} className="text-gold" /> Profissional
              </span>
              <p className="text-sm font-bold text-white truncate">{appointment.barbers?.name || "Barbeiro"}</p>
              <p className="text-[11px] text-gray-400 font-medium pt-1">Atendimento individual</p>
            </div>

            {/* Data e Horário */}
            <div className="p-3.5 rounded-2xl bg-[#080d17] border border-white/5 space-y-1 sm:col-span-2">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-1.5">
                    <Calendar size={12} className="text-gold" /> Data
                  </span>
                  <p className="text-sm font-bold text-white mt-1 capitalize">
                    {format(parseISO(appointment.start_time), "EEEE, dd 'de' MMMM", { locale: ptBR })}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-1.5">
                    <Clock size={12} className="text-gold" /> Horário
                  </span>
                  <p className="text-sm font-bold text-white mt-1">
                    {format(parseISO(appointment.start_time), "HH:mm")}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Resumo Financeiro Estruturado */}
          <div className="p-4 rounded-2xl bg-[#080d17] border border-white/5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-widest text-gold flex items-center gap-1.5">
                <CreditCard size={13} /> Resumo Financeiro
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                {appointment.payment_method === 'misto' || appointment.payment_method === 'mixed' ? "Misto" : getPaymentMethodLabel(appointment.payment_method)}
              </span>
            </div>

            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between text-gray-400">
                <span>Valor do serviço</span>
                <span className="font-semibold text-white">R$ {(appointment.services?.price || appointment.total_price || 0).toFixed(2)}</span>
              </div>

              {Number(appointment.credits_used || appointment.credit_used || 0) > 0 && (
                <div className="flex justify-between text-gray-400">
                  <span>Créditos utilizados</span>
                  <span className="font-semibold text-purple-400">- R$ {Number(appointment.credits_used || appointment.credit_used).toFixed(2)}</span>
                </div>
              )}

              {Number(appointment.cashback_used || 0) > 0 && (
                <div className="flex justify-between text-gray-400">
                  <span>Cashback utilizado</span>
                  <span className="font-semibold text-emerald-400">- R$ {Number(appointment.cashback_used).toFixed(2)}</span>
                </div>
              )}

              {Number(appointment.pix_amount || 0) > 0 && (
                <div className="flex justify-between text-gray-400">
                  <span>Pix {isPaid ? "(Pago)" : "(Pendente)"}</span>
                  <span className={cn("font-semibold", isPaid ? "text-emerald-400" : "text-amber-400")}>
                    R$ {Number(appointment.pix_amount).toFixed(2)}
                  </span>
                </div>
              )}

              <div className="pt-2 border-t border-white/10 flex justify-between items-baseline">
                <span className="text-xs font-black uppercase tracking-wider text-white">Total</span>
                <span className="text-xl font-black text-gold">R$ {(appointment.total_price || 0).toFixed(2)}</span>
              </div>
            </div>

            {appointment.cashback_earned > 0 && (
              <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[11px] text-emerald-400 font-bold">
                <span>Cashback Gerado</span>
                <span>+ R$ {Number(appointment.cashback_earned).toFixed(2)}</span>
              </div>
            )}
          </div>

          {/* Observações */}
          {appointment.notes && (
            <div className="p-3.5 rounded-2xl bg-[#080d17] border border-white/5 space-y-1">
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-1.5">
                <MessageSquare size={12} className="text-gold" /> Observações
              </span>
              <p className="text-xs text-gray-300 italic pt-1 leading-relaxed">"{appointment.notes}"</p>
            </div>
          )}

          {/* Auditoria de Ajustes */}
          {auditLogs.length > 0 && (
            <div className="p-3.5 rounded-2xl bg-red-950/10 border border-red-900/20 space-y-2">
              <span className="text-[10px] font-bold text-red-400 uppercase tracking-widest flex items-center gap-1.5">
                <AlertTriangle size={12} /> Auditoria de Ajustes
              </span>
              <div className="space-y-2">
                {auditLogs.map((log) => (
                  <div key={log.id} className="p-2.5 rounded-xl bg-black/40 border border-red-900/20 text-[11px] text-gray-400 space-y-1">
                    <div className="flex justify-between">
                      <span className="font-bold text-white">{log.adjusted_by_user?.full_name || 'Sistema'}</span>
                      <span className="text-gray-500">{format(parseISO(log.adjusted_at), "dd/MM/yyyy HH:mm")}</span>
                    </div>
                    <p className="text-red-400 font-medium">Motivo: {log.reason}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer com Hierarquia Operacional e Ações Responsivas */}
        <div className="p-4 sm:p-6 pt-3 border-t border-white/5 flex flex-col gap-2.5 bg-[#080d17] shrink-0">
          <div className="flex flex-wrap items-center justify-between gap-2">
            {/* Ação Destrutiva: Cancelar */}
            {showCancel ? (
              <Button
                variant="ghost"
                className="h-11 px-4 rounded-xl text-red-400 hover:text-red-300 hover:bg-red-950/20 border border-red-900/30 font-bold uppercase text-[10px] tracking-wider transition-all"
                onClick={handleCancelClick}
                disabled={actionLoading}
              >
                Cancelar
              </Button>
            ) : <div />}

            <div className="flex flex-wrap items-center gap-2 ml-auto">
              {/* Apoio: Reagendar */}
              {showReschedule && (
                <Button
                  variant="outline"
                  className="h-11 px-4 rounded-xl bg-transparent hover:bg-white/5 text-gray-300 border-white/10 font-bold uppercase text-[10px] tracking-wider transition-all"
                  onClick={() => {
                    onReschedule?.(appointment);
                    onOpenChange(false);
                  }}
                  disabled={actionLoading}
                >
                  <RotateCcw size={13} className="mr-1.5 text-gray-400" /> Reagendar
                </Button>
              )}

              {/* Apoio: Comanda */}
              {mode === 'admin' && ['confirmed', 'scheduled', 'in_progress', 'awaiting_payment'].includes(appointment.status) && (
                <Button
                  variant="outline"
                  className="h-11 px-4 rounded-xl bg-transparent hover:bg-gold/10 text-gold border border-gold/30 font-bold uppercase text-[10px] tracking-wider transition-all"
                  onClick={() => setComandaOpen(true)}
                  disabled={actionLoading}
                >
                  <ShoppingBag size={13} className="mr-1.5" /> Comanda
                </Button>
              )}

              {/* Apoio: Split Payment */}
              {mode === 'admin' && appointment.status !== 'cancelled' && !isPaid && (
                <Button
                  variant="outline"
                  className="h-11 px-4 rounded-xl bg-transparent hover:bg-gold/10 text-gold border border-gold/40 font-bold uppercase text-[10px] tracking-wider transition-all"
                  onClick={() => setSplitOpen(true)}
                  disabled={actionLoading}
                >
                  <Sparkles size={13} className="mr-1.5" /> Split
                </Button>
              )}

              {/* Ação Primária: Confirmar (Apenas se status for pendente de confirmação) */}
              {mode === 'admin' && showConfirm && (
                <Button
                  className="h-11 px-6 rounded-xl bg-gold hover:bg-gold/90 text-black font-black uppercase text-xs tracking-wider shadow-lg transition-all"
                  onClick={() => updateStatus('confirmed')}
                  disabled={actionLoading}
                >
                  Confirmar Agendamento
                </Button>
              )}

              {/* Ação Primária: Marcar como Pago */}
              {mode === 'admin' && appointment.status !== 'cancelled' && !isPaid && (
                <Button
                  className="h-11 px-6 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black uppercase text-xs tracking-wider shadow-lg transition-all"
                  onClick={async () => {
                    setActionLoading(true);
                    try {
                      const { error } = await supabase
                        .from("appointments")
                        .update({
                          payment_status: 'paid',
                          paid_at: new Date().toISOString()
                        })
                        .eq("id", appointment.id);

                      if (error) {
                        toast.error(`Erro ao marcar como pago: ${error.message || 'Erro desconhecido'}`);
                      } else {
                        toast.success("Pagamento marcado como pago");
                        setAppointment((prev: any) => prev ? ({ ...prev, payment_status: 'paid', paid_at: new Date().toISOString() }) : prev);

                        queryClient.invalidateQueries({ queryKey: ['appointments'] });
                        queryClient.invalidateQueries({ queryKey: ['calendar'] });
                        queryClient.invalidateQueries({ queryKey: ['dashboard'] });
                        fetchAppointment();
                        if (onSuccess) onSuccess();
                      }
                    } catch (err: any) {
                      toast.error(`Erro crítico: ${err.message || 'Erro inesperado'}`);
                    } finally {
                      setActionLoading(false);
                    }
                  }}
                  disabled={actionLoading}
                >
                  <DollarSign size={14} className="mr-1" /> Marcar como Pago
                </Button>
              )}

              {/* Ação Primária: Concluir Atendimento */}
              {mode === 'admin' && showComplete && (
                canComplete ? (
                  <Button
                    className="h-11 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black uppercase text-xs tracking-wider shadow-[0_0_20px_rgba(16,185,129,0.25)] transition-all"
                    onClick={() => updateStatus('completed')}
                    disabled={actionLoading}
                  >
                    <CheckCircle2 size={14} className="mr-1.5" /> Concluir Atendimento
                  </Button>
                ) : (
                  <Button
                    disabled={true}
                    className="h-11 px-5 rounded-xl bg-emerald-950/30 text-emerald-500/40 border border-emerald-900/20 font-bold uppercase text-[10px] tracking-wider cursor-not-allowed"
                  >
                    Concluir Atendimento
                  </Button>
                )
              )}
            </div>
          </div>

          {/* Aviso Discreto quando pagamento é obrigatório para concluir */}
          {mode === 'admin' && showComplete && !canComplete && (
            <p className="text-[10px] font-medium text-amber-400/90 text-right">
              Confirme o pagamento para concluir o atendimento.
            </p>
          )}

          {/* Modal de Cancelamento Simples */}
          <Dialog open={cancellationStep === 'simple_confirmation'} onOpenChange={(open) => !open && setCancellationStep('none')}>
            <DialogContent className="bg-[#0b1220] border border-gold/20 text-white rounded-3xl w-[calc(100vw-24px)] max-w-sm p-6 overflow-x-hidden">
              <DialogHeader className="text-center space-y-3">
                <div className="w-13 h-13 bg-red-500/10 rounded-2xl flex items-center justify-center mx-auto border border-red-500/20">
                  <XCircle className="text-red-400 w-7 h-7" />
                </div>
                <DialogTitle className="text-lg font-black tracking-tight uppercase text-white">
                  Cancelar agendamento
                </DialogTitle>
                <DialogDescription className="text-gray-400 text-xs font-medium leading-relaxed">
                  Tem certeza de que deseja cancelar o atendimento de <strong className="text-white">{appointment.customers?.name || "Cliente Final"}</strong>? Esta ação atualizará o status do agendamento.
                </DialogDescription>
              </DialogHeader>

              <div className="flex flex-col gap-2.5 mt-5">
                <Button
                  className="w-full h-11 bg-red-600 hover:bg-red-500 text-white font-bold uppercase text-xs rounded-xl transition-all"
                  onClick={handleConfirmSimpleCancel}
                  disabled={actionLoading}
                >
                  Cancelar agendamento
                </Button>
                <Button
                  variant="ghost"
                  className="w-full h-10 text-gray-400 hover:text-white font-bold uppercase text-[10px] tracking-wider"
                  onClick={() => setCancellationStep('none')}
                >
                  Voltar
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* Modal de Decisão Financeira no Cancelamento */}
          <Dialog open={cancellationStep === 'financial_decision'} onOpenChange={(open) => !open && setCancellationStep('none')}>
            <DialogContent className="bg-[#0b1220] border border-gold/20 text-white rounded-3xl w-[calc(100vw-24px)] max-w-md p-6 overflow-x-hidden">
              <DialogHeader className="text-center space-y-2">
                <div className="w-13 h-13 bg-gold/10 rounded-2xl flex items-center justify-center mx-auto border border-gold/20">
                  <DollarSign className="text-gold w-7 h-7" />
                </div>
                <DialogTitle className="text-lg font-black uppercase text-white">
                  Como deseja tratar o pagamento?
                </DialogTitle>
                <DialogDescription className="text-gray-400 text-xs leading-relaxed">
                  Este agendamento possui valores liquidados. Escolha como proceder com a devolução.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3 mt-4">
                {/* Opção 1: Devolver em Créditos */}
                <div className="p-4 rounded-2xl border border-gold/30 bg-gold/5 space-y-2 text-left">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-black uppercase text-gold tracking-wider">Devolver como créditos</span>
                    <span className="text-sm font-black text-white">
                      R$ {Number(
                        (financialStatus?.has_paid_pix ? financialStatus?.paid_pix_amount : 0) +
                        (financialStatus?.used_credit_amount || 0) +
                        (financialStatus?.used_cashback_amount || 0)
                      ).toFixed(2)}
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-400">
                    O valor total efetivamente pago/utilizado será devolvido ao saldo de créditos do cliente.
                  </p>
                  <Button
                    className="w-full h-11 bg-gold hover:bg-gold/90 text-black font-black uppercase text-xs rounded-xl mt-1 tracking-wider"
                    onClick={handleConfirmCreditCancel}
                    disabled={actionLoading}
                  >
                    Devolver em Créditos
                  </Button>
                </div>

                {/* Opção 2: Estorno Pix (apenas se Pix pago > 0) */}
                {financialStatus?.has_paid_pix && Number(financialStatus.paid_pix_amount) > 0 && (
                  <div className="p-4 rounded-2xl border border-white/10 bg-white/5 space-y-2 text-left">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-black uppercase text-zinc-300 tracking-wider">Solicitar estorno Pix</span>
                      <span className="text-sm font-black text-white">R$ {Number(financialStatus.paid_pix_amount).toFixed(2)}</span>
                    </div>
                    <p className="text-[11px] text-gray-400">Registrar a devolução do valor pago via Pix para a conta bancária do titular.</p>
                    <Button
                      variant="outline"
                      className="w-full h-11 border-gold/40 hover:bg-gold/10 text-gold font-black uppercase text-xs rounded-xl mt-1 tracking-wider"
                      onClick={() => setCancellationStep('pix_refund_form')}
                      disabled={actionLoading}
                    >
                      Solicitar Estorno Pix
                    </Button>
                  </div>
                )}

                <Button
                  variant="ghost"
                  className="w-full h-10 text-gray-400 hover:text-white font-bold uppercase text-[10px] tracking-wider mt-1"
                  onClick={() => setCancellationStep('none')}
                >
                  Voltar
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* Formulário de Estorno Pix */}
          <Dialog open={cancellationStep === 'pix_refund_form'} onOpenChange={(open) => !open && setCancellationStep('financial_decision')}>
            <DialogContent className="bg-[#0b1220] border border-gold/20 text-white rounded-3xl w-[calc(100vw-24px)] max-w-md p-6 overflow-x-hidden">
              <DialogHeader className="text-center space-y-2">
                <div className="w-13 h-13 bg-gold/10 rounded-2xl flex items-center justify-center mx-auto border border-gold/20">
                  <DollarSign className="text-gold w-7 h-7" />
                </div>
                <DialogTitle className="text-lg font-black uppercase text-white">
                  Dados para Estorno Pix
                </DialogTitle>
                <DialogDescription className="text-gray-400 text-xs leading-relaxed">
                  Informe a chave Pix para registrar a devolução de <strong className="text-white">R$ {financialStatus && Number(financialStatus.paid_pix_amount).toFixed(2)}</strong>.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3 mt-3">
                <div className="space-y-1">
                  <Label className="text-[10px] font-bold uppercase text-gray-400 tracking-wider">Nome do Titular</Label>
                  <Input
                    placeholder="Nome completo"
                    className="h-11 bg-[#080d17] border-white/10 rounded-xl px-3 text-white text-xs focus:border-gold outline-none"
                    value={refundData.holderName}
                    onChange={(e) => setRefundData({...refundData, holderName: e.target.value})}
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-[10px] font-bold uppercase text-gray-400 tracking-wider">Tipo de Chave</Label>
                    <select
                      className="w-full h-11 bg-[#080d17] border border-white/10 rounded-xl px-3 text-white text-xs outline-none"
                      value={refundData.pixType}
                      onChange={(e) => setRefundData({...refundData, pixType: e.target.value})}
                    >
                      <option value="cpf">CPF</option>
                      <option value="cnpj">CNPJ</option>
                      <option value="email">E-mail</option>
                      <option value="phone">Celular</option>
                      <option value="random">Aleatória</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] font-bold uppercase text-gray-400 tracking-wider">Chave Pix</Label>
                    <Input
                      placeholder="Chave Pix"
                      className="h-11 bg-[#080d17] border-white/10 rounded-xl px-3 text-white text-xs focus:border-gold outline-none"
                      value={refundData.pixKey}
                      onChange={(e) => setRefundData({...refundData, pixKey: e.target.value})}
                    />
                  </div>
                </div>
                <Button
                  onClick={handleConfirmRefundCancel}
                  disabled={actionLoading || !refundData.pixKey || !refundData.holderName}
                  className="w-full h-11 bg-gold hover:bg-gold/90 text-black font-black uppercase text-xs rounded-xl shadow-lg mt-2 tracking-wider"
                >
                  {actionLoading ? "Processando..." : "Confirmar Solicitação de Estorno"}
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => setCancellationStep('financial_decision')}
                  className="w-full h-10 text-gray-400 hover:text-white font-bold uppercase text-[10px] tracking-wider"
                >
                  Voltar
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </DialogContent>

      {/* Modais de Comanda e Split */}
      {appointment?.id && appointment?.tenant_id && (
        <ComandaModal
          appointmentId={appointment.id}
          tenantId={appointment.tenant_id}
          open={comandaOpen}
          onOpenChange={setComandaOpen}
          onChanged={() => fetchAppointment()}
        />
      )}

      {appointment?.id && (
        <SplitPaymentModal
          appointment={appointment}
          open={splitOpen}
          onOpenChange={setSplitOpen}
          onSuccess={() => { fetchAppointment(); onSuccess?.(); }}
        />
      )}
    </Dialog>
  );
}