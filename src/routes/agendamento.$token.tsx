
import { createFileRoute, useLocation } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import React, { useEffect, useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Calendar, 
  Clock, 
  User, 
  Scissors, 
  CheckCircle2, 
  XCircle,
  AlertCircle,
  MapPin,
  Phone,
  ArrowLeft,
  RefreshCcw,
  ChevronRight,
  ChevronLeft,
  CalendarDays,
  Trash2
} from "lucide-react";
import { format, parseISO, addMinutes, isSameDay, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { createNotification } from "@/utils/notifications";
import { triggerAutomation } from "@/utils/automation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/agendamento/$token")({
  component: AppointmentManagementPage,
});

function AppointmentManagementPage() {
  const { token } = Route.useParams();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const expectedTenantId = searchParams.get('tenant');
  
  const [loading, setLoading] = useState(true);
  const [appointment, setAppointment] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRescheduling, setIsRescheduling] = useState(false);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [showCreditModal, setShowCreditModal] = useState(false);
  const [showRefundForm, setShowRefundForm] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  
  // Refund Form State
  const [refundData, setRefundData] = useState({
    holderName: '',
    pixKey: '',
    pixType: 'cpf',
    notes: ''
  });

  // Reschedule state
  const [selectedDate, setSelectedDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [selectedTime, setSelectedTime] = useState("");
  const [availableTimes, setAvailableTimes] = useState<string[]>([]);
  const [fetchingTimes, setFetchingTimes] = useState(false);
  const [barber, setBarber] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (token) {
      fetchAppointment();
    }
  }, [token]);

  async function fetchAppointment() {
    setLoading(true);
    try {
      console.log('AUDIT [ManagementLink]: Fetching appointment with token:', token);
      console.log('AUDIT [ManagementLink]: Tenant Context:', expectedTenantId);

      const { data, error: rpcError } = await supabase.rpc('get_appointment_by_management_token', {
        p_token: token
      });

      if (rpcError) {
        console.error('AUDIT [ManagementLink]: RPC Error:', rpcError);
        throw rpcError;
      }
      
      console.log('AUDIT [ManagementLink]: RPC Results:', data);

      if (!data || data.length === 0) {
        console.warn('AUDIT [ManagementLink]: No appointment found for token:', token);
        setError("Agendamento não encontrado ou link expirado.");
        return;
      }

      const appt = data[0];
      console.log('AUDIT [ManagementLink]: Appointment data:', {
        id: appt.id,
        tenant_id: appt.tenant_id,
        customer_id: appt.customer_id,
        status: appt.status,
        payment_status: appt.payment_status
      });

      if (expectedTenantId && appt.tenant_id !== expectedTenantId) {
        console.warn('AUDIT [ManagementLink]: Tenant mismatch. Expected:', expectedTenantId, 'Found:', appt.tenant_id);
        setError("Este agendamento pertence a outra barbearia ou o link está incorreto.");
        return;
      }

      if (appt.tenant_status === 'blocked' || appt.tenant_status === 'suspended') {
        setError("Esta barbearia está temporariamente indisponível.");
        return;
      }

      setAppointment(appt);
      
      // Load barber working hours for rescheduling
      if (appt.professional_id) {
        const { data: barbData } = await supabase
          .from("barbers")
          .select("*")
          .eq("id", appt.professional_id)
          .single();
        setBarber(barbData);
      }
    } catch (err: any) {
      console.error("AUDIT [ManagementLink]: Critical Error:", err);
      setError("Erro ao carregar agendamento.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (isRescheduling && selectedDate && appointment) {
      fetchAvailableTimes();
    }
  }, [isRescheduling, selectedDate, appointment]);

  async function fetchAvailableTimes() {
    if (!appointment || !barber) return;
    setFetchingTimes(true);
    try {
      const startDay = `${selectedDate}T00:00:00Z`;
      const endDay = `${selectedDate}T23:59:59Z`;
      
      const { data: dayAppts } = await supabase
        .from("appointments")
        .select("id, start_time, end_time, status")
        .eq("barber_id", barber.id)
        .in("status", ["scheduled", "confirmed", "in_progress", "awaiting_payment"])
        .gte("start_time", startDay)
        .lte("start_time", endDay);
      
      const dayName = format(parseISO(selectedDate), "eeee", { locale: ptBR }).toLowerCase();
      const dayMap: Record<string, string> = {
        'segunda-feira': 'monday', 'terça-feira': 'tuesday', 'quarta-feira': 'wednesday',
        'quinta-feira': 'thursday', 'sexta-feira': 'friday', 'sábado': 'saturday', 'domingo': 'sunday'
      };
      const dayKey = dayMap[dayName] || dayName;
      const workingHours = barber.working_hours?.[dayKey];

      if (!workingHours || !workingHours.enabled) {
        setAvailableTimes([]);
        return;
      }

      const times = [];
      const [startHour, startMin] = workingHours.start.split(':').map(Number);
      const [endHour, endMin] = workingHours.end.split(':').map(Number);
      const [y, m, d] = selectedDate.split('-').map(Number);

      for (let hour = startHour; hour <= endHour; hour++) {
        for (let min = (hour === startHour ? startMin : 0); min < 60; min += 30) {
          if (hour === endHour && min >= endMin) break;
          
          const timeStr = `${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;
          const checkTime = new Date(y, m - 1, d, hour, min, 0);
          
          if (isSameDay(checkTime, new Date()) && checkTime < new Date()) continue;

          const checkTimeMs = checkTime.getTime();
          const duration = 30; 
          const serviceEndMs = checkTimeMs + duration * 60 * 1000;

          const isBusy = dayAppts?.some(app => {
            if (app.id === appointment.id) return false;
            const appStart = new Date(app.start_time).getTime();
            const appEnd = new Date(app.end_time).getTime();
            return checkTimeMs < appEnd && serviceEndMs > appStart;
          });

          if (!isBusy) times.push(timeStr);
        }
      }
      setAvailableTimes(times);
    } catch (err) {
      console.error("Error fetching times:", err);
    } finally {
      setFetchingTimes(false);
    }
  }

  const handleReschedule = async () => {
    if (!selectedTime) {
      toast.error("Por favor, selecione um horário.");
      return;
    }

    setSubmitting(true);
    try {
      const timeWithSeconds = selectedTime.length === 5 ? `${selectedTime}:00` : selectedTime;
      const startTime = parseISO(`${selectedDate}T${timeWithSeconds}`);
      const oldStart = parseISO(appointment.start_time);
      const oldEnd = appointment.end_time ? parseISO(appointment.end_time) : addMinutes(oldStart, 30);
      const durationMinutes = Math.round((oldEnd.getTime() - oldStart.getTime()) / 60000) || 30;
      const endTime = addMinutes(startTime, durationMinutes);

      const { data, error: rpcError } = await supabase.rpc('reschedule_appointment', {
        p_appointment_id: appointment.id,
        p_new_start_time: startTime.toISOString(),
        p_new_end_time: endTime.toISOString(),
        p_changed_by_type: 'customer',
        p_source: 'public_link'
      });

      const response = data as any;
      if (rpcError || !response || !response.success) throw new Error(rpcError?.message || response?.error || "Erro desconhecido");

      await createNotification({
        userId: appointment.tenant_id,
        type: 'appointment_rescheduled',
        title: "Agendamento Reagendado",
        message: `${appointment.customer_name} reagendou para ${format(startTime, "dd/MM 'às' HH:mm")}`,
        barberId: appointment.professional_id,
        metadata: { appointmentId: appointment.id }
      });

      triggerAutomation({
        tenant_id: appointment.tenant_id,
        event_name: 'appointment.rescheduled',
        appointment_id: appointment.id
      }).catch(console.error);

      toast.success("Seu agendamento foi reagendado com sucesso!");
      setIsRescheduling(false);
      fetchAppointment(); 
    } catch (err: any) {
      toast.error(err.message || "Erro ao reagendar");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async (preference: 'credit' | 'refund' = 'credit') => {
    setCancelling(true);
    try {
      const isPaid = appointment.payment_status === 'paid' && Number(appointment.final_amount ?? appointment.total_price) > 0;
      const amount = Number(appointment.final_amount ?? appointment.total_price);
      
      let rpcName = 'cancel_appointment';
      let rpcParams: any = {
        p_appointment_id: appointment.id,
        p_cancelled_by: 'customer',
        p_source: 'public_link',
        p_refund_preference: preference === 'refund' ? 'refund' : (preference === 'credit' ? 'credit' : 'none')
      };

      if (isPaid) {
        if (preference === 'refund') {
          rpcName = 'request_appointment_refund';
          rpcParams = {
            p_appointment_id: appointment.id,
            p_customer_id: appointment.customer_id,
            p_tenant_id: appointment.tenant_id,
            p_amount: amount,
            p_pix_key: refundData.pixKey,
            p_pix_key_type: refundData.pixType,
            p_account_holder_name: refundData.holderName,
            p_notes: refundData.notes
          };
        } else {
          rpcName = 'convert_appointment_to_credit';
          rpcParams = {
            p_appointment_id: appointment.id,
            p_customer_id: appointment.customer_id,
            p_tenant_id: appointment.tenant_id,
            p_amount: amount
          };
        }
      }

      const { data, error: rpcError } = await supabase.rpc(rpcName as any, rpcParams);

      if (rpcError) throw rpcError;
      
      const response = data as any;
      if (response && response.success === false) throw new Error(response.error || "Erro ao processar");

      // Trigger notification if it was a refund request
      if (preference === 'refund' && isPaid) {
        await supabase.functions.invoke('appointment-notifications', {
          body: { 
            appointmentId: appointment.id, 
            type: 'refund_requested',
            amount: amount,
            updatedBy: { type: 'customer' }
          }
        });
      }

      await createNotification({
        userId: appointment.tenant_id,
        type: 'appointment_cancelled',
        title: isPaid ? (preference === 'refund' ? "Solicitação de Estorno" : "Cancelamento com Crédito") : "Agendamento Cancelado",
        message: `${appointment.customer_name} cancelou o agendamento e ${isPaid ? (preference === 'refund' ? 'solicitou estorno via Pix' : 'converteu em crédito') : 'não solicitou estorno'}.`,
        barberId: appointment.professional_id,
        metadata: { appointmentId: appointment.id }
      });

      triggerAutomation({
        tenant_id: appointment.tenant_id,
        event_name: 'appointment.cancelled',
        appointment_id: appointment.id
      }).catch(console.error);

      toast.success(isPaid 
        ? (preference === 'refund' ? "Solicitação de estorno enviada com sucesso!" : "Agendamento cancelado e valor convertido em crédito!") 
        : "Agendamento cancelado com sucesso.");
      
      setIsCancelModalOpen(false);
      setShowRefundForm(false);
      fetchAppointment();
    } catch (err: any) {
      toast.error(err.message || "Erro ao cancelar agendamento");
    } finally {
      setCancelling(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error || !appointment) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center p-6 text-center">
        <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mb-6">
          <XCircle className="text-red-500 w-10 h-10" />
        </div>
        <h1 className="text-2xl font-black text-white mb-2 uppercase tracking-tighter italic">Ops! Algo deu errado</h1>
        <p className="text-zinc-400 mb-8 max-w-xs">{error}</p>
        <Button variant="outline" className="border-zinc-800 text-zinc-400" onClick={() => window.history.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
        </Button>
      </div>
    );
  }

  const isConfirmed = appointment.status === 'confirmed' || appointment.status === 'scheduled';
  const isCancelled = appointment.status === 'cancelled';
  const isCompleted = appointment.status === 'completed';
  const canReschedule = (isConfirmed || appointment.status === 'awaiting_payment') && !isCompleted && !isCancelled;
  
  // Janela de cancelamento
  const isWithinCancellationWindow = useMemo(() => {
    if (!appointment?.start_time) return false;
    const startTime = parseISO(appointment.start_time);
    const now = new Date();
    const windowHours = appointment.cancellation_window_hours ?? 2;
    const diffInMs = startTime.getTime() - now.getTime();
    const diffInHours = diffInMs / (1000 * 60 * 60);
    return diffInHours >= windowHours;
  }, [appointment]);

  const canCancel = (isConfirmed || appointment.status === 'awaiting_payment') && !isCompleted && !isCancelled && isWithinCancellationWindow;

  return (
    <div className="min-h-screen bg-black text-white p-4 sm:p-8 flex flex-col items-center">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-10 mt-6">
          <h1 className="text-3xl font-black text-primary uppercase italic tracking-tighter mb-1">
            {appointment.business_name}
          </h1>
          <p className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.3em]">Gerenciamento de Agendamento</p>
        </div>

        <AnimatePresence mode="wait">
          {appointment.appointment_group_id && (
            <div className="mb-4">
              <Button 
                variant="link" 
                className="text-primary font-black uppercase tracking-widest text-[10px] p-0 h-auto"
                asChild
              >
                <a href={`/agendamentos/grupo/${appointment.group_token}?tenant=${appointment.tenant_id}`}>
                  <ArrowLeft className="mr-1 h-3 w-3" /> Ver Todos os Meus Agendamentos
                </a>
              </Button>
            </div>
          )}
          {!isRescheduling ? (
            <motion.div
              key="details"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
            >
              <Card className="bg-[#0b0f17] border border-zinc-800/50 rounded-[2.5rem] shadow-2xl overflow-hidden mb-6">
                <div className={cn(
                  "p-6 flex items-center justify-center gap-3",
                  isConfirmed ? "bg-emerald-500/10" : (isCancelled ? "bg-red-500/10" : "bg-primary/10")
                )}>
                  {isConfirmed ? (
                    <>
                      <CheckCircle2 className="text-emerald-500 w-5 h-5" />
                      <span className="text-emerald-500 font-black uppercase text-xs tracking-widest">Seu agendamento já está confirmado.</span>
                    </>
                  ) : isCancelled ? (
                    <>
                      <XCircle className="text-red-500 w-5 h-5" />
                      <span className="text-red-500 font-black uppercase text-xs tracking-widest">Agendamento Cancelado</span>
                    </>
                  ) : isCompleted ? (
                    <>
                      <CheckCircle2 className="text-primary w-5 h-5" />
                      <span className="text-primary font-black uppercase text-xs tracking-widest">Atendimento Finalizado</span>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="text-primary w-5 h-5" />
                      <span className="text-primary font-black uppercase text-xs tracking-widest">{appointment.status}</span>
                    </>
                  )}
                </div>

                <CardContent className="p-8 space-y-8">
                  <div className="flex flex-col gap-1">
                    <span className="text-zinc-500 text-[10px] font-black uppercase tracking-widest">Olá,</span>
                    <h2 className="text-2xl font-black tracking-tight">{appointment.customer_name}</h2>
                  </div>

                  <div className="grid gap-6">
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center shrink-0">
                        <Scissors className="text-primary w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest mb-0.5">Serviço</p>
                        <p className="font-bold text-white leading-tight">{appointment.service_name}</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center shrink-0">
                        <User className="text-primary w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest mb-0.5">Profissional</p>
                        <p className="font-bold text-white leading-tight">{appointment.professional_name}</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center shrink-0">
                        <Calendar className="text-primary w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest mb-0.5">Data</p>
                        <p className="font-bold text-white leading-tight">
                          {format(parseISO(appointment.start_time), "dd 'de' MMMM", { locale: ptBR })}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center shrink-0">
                        <Clock className="text-primary w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest mb-0.5">Horário</p>
                        <p className="font-bold text-white leading-tight">
                          {format(parseISO(appointment.start_time), "HH:mm", { locale: ptBR })}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="pt-6 border-t border-zinc-800/50 space-y-3">
                    {canReschedule && (
                      <Button 
                        onClick={() => setIsRescheduling(true)}
                        className="w-full h-12 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-bold uppercase tracking-widest text-xs"
                      >
                        <RefreshCcw className="mr-2 h-4 w-4" /> Reagendar Atendimento
                      </Button>
                    )}
                    
                    {isConfirmed && !isCompleted && !isCancelled && !isWithinCancellationWindow && (
                      <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-xl flex gap-3 mb-3">
                        <AlertCircle className="h-4 w-4 text-amber-500 shrink-0" />
                        <p className="text-[10px] text-amber-500 font-bold uppercase leading-tight tracking-tight">
                          O cancelamento online não está mais disponível para este agendamento (limite de {appointment.cancellation_window_hours ?? 2}h excedido). Entre em contato com a barbearia.
                        </p>
                      </div>
                    )}

                    {canCancel && (
                      <Button 
                        variant="ghost"
                        onClick={() => setIsCancelModalOpen(true)}
                        className="w-full h-12 rounded-xl text-red-500 hover:text-red-400 hover:bg-red-500/5 font-bold uppercase tracking-widest text-xs"
                      >
                        <Trash2 className="mr-2 h-4 w-4" /> Cancelar Agendamento
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ) : (
            <motion.div
              key="reschedule"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <Card className="bg-[#0b0f17] border border-zinc-800/50 rounded-[2.5rem] shadow-2xl overflow-hidden mb-6">
                <div className="p-6 bg-primary/10 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CalendarDays className="text-primary w-5 h-5" />
                    <span className="text-primary font-black uppercase text-xs tracking-widest">Novo Horário</span>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setIsRescheduling(false)} className="text-zinc-500 hover:text-white">
                    Cancelar
                  </Button>
                </div>

                <CardContent className="p-8 space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Selecione a Data</label>
                    <input 
                      type="date" 
                      min={format(new Date(), "yyyy-MM-dd")}
                      value={selectedDate}
                      onChange={(e) => setSelectedDate(e.target.value)}
                      className="w-full h-12 bg-zinc-900 border border-zinc-800 rounded-xl px-4 text-white focus:outline-none focus:border-primary transition-colors"
                    />
                  </div>

                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Horários Disponíveis</label>
                    {fetchingTimes ? (
                      <div className="flex justify-center py-8">
                        <RefreshCcw className="animate-spin text-primary h-6 w-6" />
                      </div>
                    ) : availableTimes.length > 0 ? (
                      <div className="grid grid-cols-3 gap-2">
                        {availableTimes.map((time) => (
                          <button
                            key={time}
                            onClick={() => setSelectedTime(time)}
                            className={cn(
                              "h-10 rounded-lg text-xs font-bold border transition-all",
                              selectedTime === time 
                                ? "bg-primary border-primary text-black" 
                                : "bg-transparent border-zinc-800 text-zinc-400 hover:border-zinc-600"
                            )}
                          >
                            {time}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="text-center py-8 text-zinc-500 text-xs italic">Nenhum horário disponível para esta data.</p>
                    )}
                  </div>

                  <Button 
                    onClick={handleReschedule}
                    disabled={submitting || !selectedTime}
                    className="w-full h-14 rounded-2xl bg-primary hover:bg-primary/90 text-primary-foreground font-black uppercase tracking-widest shadow-xl shadow-primary/20 mt-4"
                  >
                    {submitting ? <RefreshCcw className="animate-spin mr-2 h-4 w-4" /> : "Confirmar Novo Horário"}
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex flex-col gap-3">
          <Button 
            className="h-14 rounded-2xl bg-zinc-900 hover:bg-zinc-800 text-white border border-zinc-800 font-black uppercase tracking-widest shadow-xl"
            asChild
          >
            <a href={`https://wa.me/${appointment.business_phone?.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer">
              <Phone className="mr-2 h-4 w-4" /> Falar com a Barbearia
            </a>
          </Button>
          
          <Button 
            variant="ghost" 
            className="text-zinc-500 hover:text-white hover:bg-white/5 font-bold"
            onClick={() => window.print()}
          >
            Salvar Comprovante
          </Button>
        </div>

        <p className="text-center mt-12 text-zinc-700 text-[10px] font-bold uppercase tracking-widest">
          Powered by Barbex
        </p>
      </motion.div>

      {/* Cancel Confirmation Modal */}
      <Dialog open={isCancelModalOpen} onOpenChange={setIsCancelModalOpen}>
        <DialogContent className="bg-[#0b0f17] border-zinc-800 text-white rounded-3xl sm:max-w-md">
          {!showRefundForm ? (
            <>
              <DialogHeader>
                <DialogTitle className="text-xl font-black uppercase italic tracking-tight flex items-center gap-2">
                  <AlertCircle className="text-red-500 h-6 w-6" /> Cancelar Agendamento
                </DialogTitle>
                <DialogDescription className="text-zinc-400 font-medium pt-2">
                  Deseja realmente cancelar este agendamento? Esta ação não poderá ser desfeita.
                </DialogDescription>
              </DialogHeader>

              <div className="bg-zinc-900/50 p-4 rounded-2xl border border-zinc-800/50 my-4">
                 <div className="flex flex-col gap-1">
                    <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Resumo do Cancelamento</p>
                    <p className="text-sm font-bold text-white">{appointment.service_name}</p>
                    <p className="text-xs text-zinc-400">
                      {format(parseISO(appointment.start_time), "dd 'de' MMMM 'às' HH:mm", { locale: ptBR })}
                    </p>
                 </div>
              </div>

              {appointment.payment_status === 'paid' && Number(appointment.final_amount ?? appointment.total_price) > 0 && (
                <div className="bg-primary/5 p-4 rounded-2xl border border-primary/20 mb-4">
                  <p className="text-[10px] font-black text-primary uppercase tracking-widest mb-2">Opções de Reembolso</p>
                  <p className="text-xs text-zinc-300 mb-4 font-medium">Como você deseja receber o valor pago (R$ {Number(appointment.final_amount ?? appointment.total_price).toFixed(2)})?</p>
                  
                  <div className="grid grid-cols-1 gap-2">
                    <Button 
                      onClick={() => handleCancel('credit')}
                      disabled={cancelling}
                      className="bg-primary hover:bg-primary/90 text-black rounded-xl h-12 font-bold uppercase tracking-widest text-[10px]"
                    >
                      Converter em Crédito (Imediato)
                    </Button>
                    <Button 
                      variant="outline"
                      onClick={() => setShowRefundForm(true)}
                      className="border-zinc-800 text-zinc-400 hover:bg-zinc-800 rounded-xl h-12 font-bold uppercase tracking-widest text-[10px]"
                    >
                      Solicitar Estorno via Pix
                    </Button>
                  </div>
                </div>
              )}

              <DialogFooter className="flex flex-col sm:flex-row gap-3">
                <Button 
                  variant="outline" 
                  onClick={() => setIsCancelModalOpen(false)}
                  className="bg-transparent border-zinc-800 text-zinc-400 hover:bg-zinc-800 hover:text-white rounded-xl h-12 flex-1 font-bold uppercase tracking-widest text-[10px]"
                >
                  Manter Agendamento
                </Button>
                {!(appointment.payment_status === 'paid' && Number(appointment.final_amount ?? appointment.total_price) > 0) && (
                  <Button 
                    onClick={() => handleCancel()}
                    disabled={cancelling}
                    className="bg-red-600 hover:bg-red-700 text-white rounded-xl h-12 flex-1 font-bold uppercase tracking-widest text-[10px] shadow-lg shadow-red-600/20"
                  >
                    {cancelling ? <RefreshCcw className="animate-spin h-4 w-4" /> : "Sim, Cancelar"}
                  </Button>
                )}
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle className="text-xl font-black uppercase italic tracking-tight flex items-center gap-2">
                  <RefreshCcw className="text-primary h-6 w-6" /> Dados para Estorno
                </DialogTitle>
                <DialogDescription className="text-zinc-400 font-medium pt-2">
                  Informe os dados da conta Pix para onde devemos enviar o reembolso.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 my-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Nome do Titular</label>
                  <input 
                    type="text"
                    placeholder="Nome completo"
                    value={refundData.holderName}
                    onChange={(e) => setRefundData(prev => ({ ...prev, holderName: e.target.value }))}
                    className="w-full h-12 bg-zinc-900 border border-zinc-800 rounded-xl px-4 text-white focus:outline-none focus:border-primary transition-colors text-sm"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Tipo de Chave</label>
                    <select 
                      value={refundData.pixType}
                      onChange={(e) => setRefundData(prev => ({ ...prev, pixType: e.target.value }))}
                      className="w-full h-12 bg-zinc-900 border border-zinc-800 rounded-xl px-4 text-white focus:outline-none focus:border-primary transition-colors text-sm"
                    >
                      <option value="cpf">CPF</option>
                      <option value="email">E-mail</option>
                      <option value="phone">Telefone</option>
                      <option value="random">Chave Aleatória</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Chave Pix</label>
                    <input 
                      type="text"
                      placeholder="Sua chave pix"
                      value={refundData.pixKey}
                      onChange={(e) => setRefundData(prev => ({ ...prev, pixKey: e.target.value }))}
                      className="w-full h-12 bg-zinc-900 border border-zinc-800 rounded-xl px-4 text-white focus:outline-none focus:border-primary transition-colors text-sm"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Observações (Opcional)</label>
                  <textarea 
                    placeholder="Alguma informação adicional?"
                    value={refundData.notes}
                    onChange={(e) => setRefundData(prev => ({ ...prev, notes: e.target.value }))}
                    className="w-full h-20 bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-white focus:outline-none focus:border-primary transition-colors text-sm resize-none"
                  />
                </div>
              </div>

              <DialogFooter className="flex flex-col sm:flex-row gap-3">
                <Button 
                  variant="outline" 
                  onClick={() => setShowRefundForm(false)}
                  className="bg-transparent border-zinc-800 text-zinc-400 hover:bg-zinc-800 hover:text-white rounded-xl h-12 flex-1 font-bold uppercase tracking-widest text-[10px]"
                >
                  Voltar
                </Button>
                <Button 
                  onClick={() => handleCancel('refund')}
                  disabled={cancelling || !refundData.holderName || !refundData.pixKey}
                  className="bg-primary hover:bg-primary/90 text-black rounded-xl h-12 flex-1 font-bold uppercase tracking-widest text-[10px] shadow-lg shadow-primary/20"
                >
                  {cancelling ? <RefreshCcw className="animate-spin h-4 w-4" /> : "Solicitar Estorno"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
