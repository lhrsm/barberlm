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
  DialogFooter,
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
import { ShoppingBag, Sparkles } from "lucide-react";

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
  const [showDebug, setShowDebug] = React.useState(false);
  const { getFinancialStatus, confirmSimpleCancellation, confirmCancellationWithCredit, confirmCancellationWithRefundRequest } = useCustomerCancellation();

  const handleCancelClick = async () => {
    if (!appointment) return;
    
    setLoading(true);
    try {
      const finStatus = await getFinancialStatus(appointment.id);
      setFinancialStatus(finStatus);
      
      console.log("AUDIT [Cancellation Flow]:", {
        function: "handleCancelClick",
        appointment_id: appointment.id,
        financialStatus: finStatus,
        mode
      });

      // REGRA: Modal simples só se NÃO houver nenhum valor envolvido
      const hasFinancialValues = 
        finStatus.has_paid_pix || 
        finStatus.has_used_credits || 
        finStatus.has_used_cashback || 
        finStatus.requires_financial_decision ||
        (finStatus.paid_pix_amount > 0) ||
        (finStatus.used_credit_amount > 0);

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
    
    // Trava de segurança robusta no frontend
    const finStatus = financialStatus || await getFinancialStatus(appointment.id);
    const hasFinancialValues = 
      finStatus.has_paid_pix || 
      finStatus.has_used_credits || 
      finStatus.has_used_cashback || 
      finStatus.requires_financial_decision ||
      (finStatus.paid_pix_amount > 0) ||
      (finStatus.used_credit_amount > 0);

    if (mode === 'customer' && hasFinancialValues) {
      console.warn("Bloqueio de segurança: Cancelamento simples impedido em agendamento com valores.");
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
        {status !== 'cancelled' && (() => {
          const isSubCovered = appointment.payment_method === 'subscription' || appointment.payment_status === 'covered_by_subscription';
          if (isSubCovered) {
            return (
              <Badge className="w-fit gap-1.5 font-black uppercase tracking-wider text-[10px] px-3 py-1 border rounded-lg bg-gold/10 border-gold/40 text-gold">
                <DollarSign size={12} /> Incluso no Plano
              </Badge>
            );
          }
          return (
            <Badge className={cn(
              "w-fit gap-1.5 font-black uppercase tracking-wider text-[10px] px-3 py-1 border rounded-lg",
              appointment.payment_status === 'paid' ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-500" : "bg-amber-500/10 border-amber-500/30 text-amber-500"
            )}>
              <DollarSign size={12} />
              {appointment.payment_status === 'paid' ? 'Pago' : 'Pagamento Pendente'}
            </Badge>
          );
        })()}
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
        <DialogContent className="sm:max-w-[500px] flex items-center justify-center min-h-[400px] bg-[#0b0f17] border-gold/20">
          <RefreshCcw className="animate-spin text-gold" size={32} />
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
      <DialogContent className="sm:max-w-[550px] p-0 overflow-hidden bg-[#0b0f17] border border-gold/20 rounded-3xl shadow-2xl text-white">
        <DialogHeader className="p-8 pb-6 border-b border-gold/10">
          <div className="flex flex-col gap-4">
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-5">
                <Avatar className="h-16 w-16 rounded-2xl border-2 border-gold/20 shadow-md">
                  <AvatarImage src={appointment.customers?.avatar_url} alt={appointment.customers?.name} />
                  <AvatarFallback className="bg-gold/5 text-gold font-black text-xl rounded-2xl">
                    {appointment.customers?.name?.[0] || <User />}
                  </AvatarFallback>
                </Avatar>
                <div className="space-y-1.5">
                  <DialogTitle className="text-2xl font-black tracking-tight text-white">
                    {appointment.customers?.name || "Cliente Final"}
                  </DialogTitle>
                  <div className="flex flex-col gap-2 mt-1">
                    {getStatusBadge(appointment.status)}
                    {appointment.status !== 'cancelled' && (() => {
                      const isSubCovered = appointment.payment_method === 'subscription' || appointment.payment_status === 'covered_by_subscription';
                      if (isSubCovered) {
                        return (
                          <Badge className="w-fit gap-1.5 font-black uppercase tracking-wider text-[10px] px-3 py-1 border rounded-lg bg-gold/10 border-gold/40 text-gold">
                            <DollarSign size={12} /> Incluso no Plano
                          </Badge>
                        );
                      }
                      return (
                        <Badge className={cn(
                          "w-fit gap-1.5 font-black uppercase tracking-wider text-[10px] px-3 py-1 border rounded-lg",
                          appointment.payment_status === 'paid' ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-500" : "bg-amber-500/10 border-amber-500/30 text-amber-500"
                        )}>
                          <DollarSign size={12} />
                          {appointment.payment_status === 'paid' ? 'Pago' : 'Pagamento Pendente'}
                        </Badge>
                      );
                    })()}
                    <span className="text-[10px] w-fit font-black text-gray-500 uppercase tracking-widest bg-[#05070d] px-2 py-0.5 rounded border border-gold/10">
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
                <p className="text-[10px] font-black text-gold uppercase tracking-[0.2em] flex items-center gap-2">
                  <Phone size={12} /> Contato
                </p>
                <p className="text-sm font-bold text-white">{appointment.customers?.phone || "Não informado"}</p>
              </div>

              <div className="space-y-2">
                <p className="text-[10px] font-black text-gold uppercase tracking-[0.2em] flex items-center gap-2">
                  <Scissors size={12} /> Serviço
                </p>
                <p className="text-sm font-bold text-white">{appointment.services?.name}</p>
                <div className="flex items-center gap-4 mt-2">
                   <span className="flex items-center gap-1.5 text-[10px] font-bold text-gray-400 uppercase">
                     <Timer size={10} /> {appointment.services?.duration_minutes || appointment.duration_minutes || 30} min
                   </span>
                   <span className="flex items-center gap-1.5 text-[10px] font-black text-gold uppercase">
                     R$ {(appointment.services?.price || appointment.total_price || 0).toFixed(2)}
                   </span>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="space-y-2">
                <p className="text-[10px] font-black text-gold uppercase tracking-[0.2em] flex items-center gap-2">
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
                <p className="text-[10px] font-black text-gold uppercase tracking-[0.2em] flex items-center gap-2">
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
                <p className="text-[10px] font-black text-gold uppercase tracking-[0.2em] flex items-center gap-2">
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
                <p className="text-[10px] font-black text-gold uppercase tracking-[0.2em] flex items-center gap-2">
                  <DollarSign size={12} /> Valor Total
                </p>
                <p className="text-2xl font-black text-gold">R$ {(appointment.total_price || 0).toFixed(2)}</p>
                {appointment.cashback_earned > 0 && (
                  <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mt-1">
                    + R$ {Number(appointment.cashback_earned).toFixed(2)} Cashback Gerado
                  </p>
                )}
              </div>
          </div>

          {appointment.notes && (
            <div className="space-y-3 pt-6 border-t border-gold/10">
              <p className="text-[10px] font-black text-gold uppercase tracking-[0.2em] flex items-center gap-2">
                <MessageSquare size={14} /> Observações
              </p>
              <div className="p-4 rounded-2xl bg-[#05070d] border border-gold/5 text-sm text-gray-300 font-medium leading-relaxed italic">
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

        <div className="p-8 pt-4 border-t border-gold/10 flex flex-wrap gap-3 items-center justify-end bg-[#05070d]/50">
          {(mode === 'admin' || mode === 'admin_read_only') && (
            <div className="w-full mb-4 p-4 rounded-2xl bg-zinc-900/50 border border-white/5 space-y-3">
              <div className="flex items-center gap-2 mb-2">
                <div className="h-1.5 w-1.5 rounded-full bg-emerald-500"></div>
                <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-500">Diagnóstico Financeiro</h4>
              </div>
              <div className="grid grid-cols-2 gap-4 text-[10px]">
                <div className="space-y-1">
                  <p className="text-gray-500 uppercase font-bold">Método Detectado:</p>
                  <p className="text-white font-black">{appointment.payment_method?.toUpperCase() || 'NÃO DEFINIDO'}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-gray-500 uppercase font-bold">Status Pagamento:</p>
                  <p className={cn("font-black", appointment.payment_status === 'paid' ? "text-emerald-500" : "text-amber-500")}>
                    {appointment.payment_status?.toUpperCase() || 'PENDENTE'}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-gray-500 uppercase font-bold">Valor Pix:</p>
                  <p className="text-white font-black">R$ {Number(appointment.pix_amount || 0).toFixed(2)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-gray-500 uppercase font-bold">Créditos Usados:</p>
                  <p className="text-white font-black">R$ {Number(appointment.credit_used || appointment.credits_used || 0).toFixed(2)}</p>
                </div>
              </div>
              {appointment.payment_breakdown && (
                <div className="mt-2 pt-2 border-t border-white/5">
                  <p className="text-gray-500 uppercase font-bold text-[9px] mb-1">Composição:</p>
                  <div className="flex flex-wrap gap-2">
                    {appointment.payment_breakdown.pix_amount > 0 && <Badge variant="outline" className="text-[8px] bg-emerald-500/10 text-emerald-500 border-emerald-500/20">Pix: R$ {appointment.payment_breakdown.pix_amount}</Badge>}
                    {appointment.payment_breakdown.credits_used > 0 && <Badge variant="outline" className="text-[8px] bg-violet-500/10 text-violet-500 border-violet-500/20">Crédito: R$ {appointment.payment_breakdown.credits_used}</Badge>}
                    {appointment.payment_breakdown.cashback_used > 0 && <Badge variant="outline" className="text-[8px] bg-primary/10 text-primary border-primary/20">Cashback: R$ {appointment.payment_breakdown.cashback_used}</Badge>}
                  </div>
                </div>
              )}
            </div>
          )}
          {/* Diagnostic Modal */}
          <Dialog open={showDebug} onOpenChange={setShowDebug}>
            <DialogContent className="bg-[#0b0f17] border-gold/20 text-white rounded-[2rem] sm:max-w-md p-8">
              <DialogHeader className="mb-4">
                <DialogTitle className="text-xl font-black uppercase italic text-gold">Diagnóstico de Cancelamento</DialogTitle>
                <DialogDescription className="text-gray-400 text-xs">
                  Evidência técnica da lógica financeira (Temporário)
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-2 text-[11px] font-mono bg-black/50 p-4 rounded-xl border border-white/5">
                <p><span className="text-gray-500">appointment_id:</span> {appointment.id}</p>
                <p><span className="text-gray-500">customer_id:</span> {appointment.customer_id}</p>
                <p><span className="text-gray-500">tenant_id:</span> {appointment.tenant_id}</p>
                <p><span className="text-gray-500">status:</span> {financialStatus?.status}</p>
                <p><span className="text-gray-500">payment_status:</span> {financialStatus?.payment_status}</p>
                <p><span className="text-gray-500">has_paid_pix:</span> <span className={financialStatus?.has_paid_pix ? "text-emerald-500" : "text-red-500"}>{String(financialStatus?.has_paid_pix)}</span></p>
                <p><span className="text-gray-500">paid_pix_amount:</span> R$ {financialStatus?.paid_pix_amount}</p>
                <p><span className="text-gray-500">has_used_credits:</span> <span className={financialStatus?.has_used_credits ? "text-emerald-500" : "text-red-500"}>{String(financialStatus?.has_used_credits)}</span></p>
                <p><span className="text-gray-500">used_credit_amount:</span> R$ {financialStatus?.used_credit_amount}</p>
                <p><span className="text-gray-500">has_used_cashback:</span> <span className={financialStatus?.has_used_cashback ? "text-emerald-500" : "text-red-500"}>{String(financialStatus?.has_used_cashback)}</span></p>
                <p><span className="text-gray-500">requires_financial_decision:</span> <span className={financialStatus?.requires_financial_decision ? "text-emerald-500" : "text-red-500"}>{String(financialStatus?.requires_financial_decision)}</span></p>
                <p><span className="text-gray-500">origem:</span> {mode === 'customer' ? 'customer_portal' : 'admin_panel'}</p>
              </div>

              <div className="mt-6 p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                 <p className="text-amber-500 text-xs font-bold mb-2">Bloqueio Temporário de Segurança:</p>
                 <p className="text-zinc-300 text-[10px]">Este agendamento possui pagamento ou crédito vinculado?</p>
              </div>

                <DialogFooter className="flex flex-col gap-2 mt-6">
                  <Button onClick={() => { setCancellationStep('financial_decision'); setShowDebug(false); }} className="w-full bg-gold text-black font-black uppercase text-xs">Sim, escolher estorno/crédito</Button>
                  <Button onClick={() => setShowDebug(false)} variant="ghost" className="w-full text-gray-500 uppercase text-[10px]">Voltar</Button>
                </DialogFooter>
            </DialogContent>
          </Dialog>

          <Button 
            variant="outline" 
            className="rounded-xl bg-transparent text-gray-400 border-white/10 hover:bg-white/5 font-black uppercase text-[10px] tracking-widest px-6 h-12"
            onClick={() => onOpenChange(false)}
          >
            {mode === 'customer' ? "Voltar" : "Fechar"}
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

          {/* Simple Confirmation Dialog */}
          <Dialog open={cancellationStep === 'simple_confirmation'} onOpenChange={(open) => !open && setCancellationStep('none')}>
            <DialogContent className="bg-[#0b0f17] border border-gold/20 text-white rounded-[2rem] max-w-sm w-[90%] p-8">
              <DialogHeader className="text-center">
                <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
                  <XCircle className="text-red-500 w-8 h-8" />
                </div>
                <DialogTitle className="text-2xl font-black tracking-tight mb-2 uppercase italic">Deseja cancelar este agendamento?</DialogTitle>
                <DialogDescription className="text-gray-400 text-sm font-medium leading-relaxed">
                  Confirme se deseja cancelar o seu horário. Esta ação não poderá ser desfeita.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-3 mt-6">
                <Button 
                  className="w-full h-14 bg-red-600 hover:bg-red-700 text-white font-black uppercase italic tracking-tighter rounded-2xl"
                  onClick={handleConfirmSimpleCancel}
                  disabled={actionLoading}
                >
                  Confirmar Cancelamento
                </Button>
                <Button 
                  variant="ghost"
                  className="w-full h-12 text-gray-500 font-bold uppercase text-[10px] tracking-widest hover:text-white"
                  onClick={() => setCancellationStep('none')}
                >
                  Manter Agendamento
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* Financial Decision Modal */}
          <Dialog open={cancellationStep === 'financial_decision'} onOpenChange={(open) => !open && setCancellationStep('none')}>
            <DialogContent className="bg-[#0b0f17] border border-gold/20 text-white rounded-[2rem] max-w-sm w-[90%] p-8">
              <DialogHeader className="text-center">
                <div className="w-16 h-16 bg-gold/10 rounded-full flex items-center justify-center mx-auto mb-6">
                  <DollarSign className="text-gold w-8 h-8" />
                </div>
                <DialogTitle className="text-2xl font-black tracking-tight mb-2 uppercase italic">
                  {financialStatus?.has_paid_pix && (financialStatus?.has_used_credits || financialStatus?.has_used_cashback)
                    ? "Este agendamento possui Pix e créditos vinculados"
                    : financialStatus?.has_used_credits || financialStatus?.has_used_cashback 
                    ? "Crédito utilizado neste agendamento" 
                    : "O que deseja fazer com o valor pago?"}
                </DialogTitle>
                <DialogDescription className="text-gray-400 text-sm font-medium leading-relaxed">
                  {financialStatus?.has_paid_pix && (financialStatus?.has_used_credits || financialStatus?.has_used_cashback)
                    ? "Os créditos serão devolvidos automaticamente ao seu saldo. Escolha o que deseja fazer com o valor pago via Pix."
                    : financialStatus?.has_used_credits || financialStatus?.has_used_cashback 
                    ? `Este agendamento utilizou R$ ${Number(financialStatus.used_credit_amount + financialStatus.used_cashback_amount).toFixed(2)} em créditos. Ao cancelar, esse valor será devolvido ao seu saldo.`
                    : "Este agendamento possui um pagamento Pix. Escolha como deseja tratar esse valor."}
                  
                  <div className="mt-4 space-y-1">
                    {financialStatus && financialStatus.paid_pix_amount > 0 && (
                      <p className="text-white font-bold">Valor Pix: R$ {Number(financialStatus.paid_pix_amount).toFixed(2)}</p>
                    )}
                    {financialStatus && financialStatus.used_credit_amount > 0 && (
                      <p className="text-emerald-500 font-bold">Créditos a devolver: R$ {Number(financialStatus.used_credit_amount).toFixed(2)}</p>
                    )}
                    {financialStatus && financialStatus.used_cashback_amount > 0 && (
                      <p className="text-emerald-500 font-bold">Cashback a devolver: R$ {Number(financialStatus.used_cashback_amount).toFixed(2)}</p>
                    )}
                  </div>
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-3 mt-6">
                <Button 
                  className="w-full h-14 bg-gold hover:bg-gold/90 text-black font-black uppercase italic tracking-tighter rounded-2xl"
                  onClick={handleConfirmCreditCancel}
                  disabled={actionLoading}
                >
                  {financialStatus?.has_paid_pix 
                    ? "Transformar Pix em Crédito" 
                    : "Confirmar cancelamento e devolver crédito"}
                </Button>
                
                {financialStatus?.has_paid_pix && (
                  <Button 
                    variant="outline"
                    className="w-full h-14 border-gold/20 hover:bg-gold/10 text-white font-black uppercase italic tracking-tighter rounded-2xl"
                    onClick={() => setCancellationStep('pix_refund_form')}
                    disabled={actionLoading}
                  >
                    Solicitar Estorno do Pix
                  </Button>
                )}
                
                <Button 
                  variant="ghost"
                  className="w-full h-12 text-gray-500 font-bold uppercase text-[10px] tracking-widest hover:text-white"
                  onClick={() => setCancellationStep('none')}
                >
                  Voltar
                </Button>
              </div>
            </DialogContent>
          </Dialog>


          {/* Pix Refund Form Dialog */}
          <Dialog open={cancellationStep === 'pix_refund_form'} onOpenChange={(open) => !open && setCancellationStep('financial_decision')}>
            <DialogContent className="bg-[#0b0f17] border border-gold/20 text-white rounded-[2rem] sm:max-w-md p-8">
              <DialogHeader className="text-center">
                <div className="w-16 h-16 bg-gold/10 rounded-full flex items-center justify-center mx-auto mb-6">
                  <DollarSign className="text-gold w-8 h-8" />
                </div>
                <DialogTitle className="text-2xl font-black tracking-tight mb-2 uppercase italic">Dados para Estorno Pix</DialogTitle>
                <DialogDescription className="text-gray-400 text-sm font-medium leading-relaxed">
                  Informe os dados da conta onde deseja receber o estorno do valor pago via Pix (R$ {financialStatus && Number(financialStatus.paid_pix_amount).toFixed(2)}).
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4 mt-6">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Nome do Titular</Label>
                  <Input 
                    placeholder="Nome completo"
                    className="h-12 bg-[#05070d] border-white/10 rounded-xl px-4 text-white text-sm focus:border-gold outline-none"
                    value={refundData.holderName}
                    onChange={(e) => setRefundData({...refundData, holderName: e.target.value})}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Tipo de Chave</Label>
                    <select 
                      className="w-full h-12 bg-[#05070d] border border-white/10 rounded-xl px-4 text-white text-sm outline-none"
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
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Chave Pix</Label>
                    <Input 
                      placeholder="Chave Pix"
                      className="h-12 bg-[#05070d] border-white/10 rounded-xl px-4 text-white text-sm focus:border-gold outline-none"
                      value={refundData.pixKey}
                      onChange={(e) => setRefundData({...refundData, pixKey: e.target.value})}
                    />
                  </div>
                </div>
                <Button 
                  onClick={handleConfirmRefundCancel}
                  disabled={actionLoading || !refundData.pixKey || !refundData.holderName}
                  className="w-full h-14 bg-gold text-black font-black uppercase italic tracking-tighter rounded-2xl shadow-lg mt-2"
                >
                  {actionLoading ? "Processando..." : "Confirmar Solicitação"}
                </Button>
                <Button 
                  variant="ghost"
                  onClick={() => setCancellationStep('financial_decision')}
                  className="w-full h-12 text-gray-500 font-bold uppercase text-[10px] tracking-widest hover:text-white"
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

          {mode === 'admin' && showConfirm && (
            <Button 
              className="rounded-xl bg-gold hover:bg-[#B8962E] text-black font-black uppercase text-[10px] tracking-widest px-8 h-12 shadow-[0_0_20px_rgba(212,175,55,0.2)] transition-all active:scale-95"
              onClick={() => updateStatus('confirmed')}
              disabled={actionLoading}
            >
              Confirmar
            </Button>
          )}

          {mode === 'admin' && ['confirmed', 'scheduled', 'in_progress', 'awaiting_payment'].includes(appointment.status) && (
            <Button
              variant="outline"
              className="rounded-xl bg-transparent hover:bg-gold/10 text-gold border border-gold/50 font-black uppercase text-[10px] tracking-widest px-6 h-12 transition-all active:scale-95"
              onClick={() => setComandaOpen(true)}
              disabled={actionLoading}
            >
              <ShoppingBag className="h-4 w-4 mr-2" /> Comanda
            </Button>
          )}

          {mode === 'admin' && showComplete && (
            <Button 
              className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase text-[10px] tracking-widest px-8 h-12 shadow-[0_0_20px_rgba(16,185,129,0.2)] transition-all active:scale-95"
              onClick={() => updateStatus('completed')}
              disabled={actionLoading}
            >
              Concluir
            </Button>
          )}

          {mode === 'admin' && appointment.status !== 'cancelled' && appointment.payment_status !== 'paid' && (
            <Button
              className="rounded-xl bg-transparent hover:bg-gold/10 text-gold border border-gold font-black uppercase text-[10px] tracking-widest px-6 h-12 transition-all active:scale-95"
              onClick={() => setSplitOpen(true)}
              disabled={actionLoading}
            >
              <Sparkles className="h-4 w-4 mr-2" /> Fechar (Split)
            </Button>
          )}

          {mode === 'admin' && appointment.status !== 'cancelled' && appointment.payment_status !== 'paid' && (
            <Button 
              className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black uppercase text-[10px] tracking-widest px-8 h-12 shadow-[0_0_20px_rgba(37,99,235,0.2)] transition-all active:scale-95"
              onClick={async () => {
                setActionLoading(true);
                const paymentStatusBefore = appointment.payment_status;
                
                try {
                  const { data, error, count } = await supabase
                    .from("appointments")
                    .update({ 
                      payment_status: 'paid',
                      paid_at: new Date().toISOString()
                    })
                    .eq("id", appointment.id)
                    .select('payment_status, paid_at');
                  
                  if (error) {
                    toast.error(`Erro ao marcar como pago: ${error.message || 'Erro desconhecido'}`);
                  } else {
                    toast.success("Pagamento marcado como pago");
                    
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

          {mode === 'admin' && appointment.refund_status === 'refund_requested' && (
            <Button 
              className="rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-black uppercase text-[10px] tracking-widest px-8 h-12 shadow-[0_0_20px_rgba(147,51,234,0.2)] transition-all active:scale-95"
              onClick={async () => {
                toast.info("Redirecionando para processar estorno no financeiro...");
                // Note: Em um ambiente real, poderíamos navegar para a aba de estornos
              }}
            >
              Processar Estorno
            </Button>
          )}
        </div>

      </DialogContent>

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