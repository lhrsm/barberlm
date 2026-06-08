
import { createFileRoute, useLocation, useNavigate } from "@tanstack/react-router";
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
  const navigate = useNavigate();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const expectedTenantId = searchParams.get('tenant');
  
  const [loading, setLoading] = useState(true);
  const [appointment, setAppointment] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRescheduling, setIsRescheduling] = useState(false);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [showRefundForm, setShowRefundForm] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  
  const [refundData, setRefundData] = useState({
    holderName: '',
    pixKey: '',
    pixType: 'cpf',
    notes: ''
  });

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
    console.log("AUDIT [ManagementLink]: Accessing route with token:", token);
    try {
      // Tentar buscar por token de gerenciamento via RPC
      const { data, error: rpcError } = await supabase.rpc('get_appointment_by_management_token', {
        p_token: token
      });

      if (rpcError) {
        console.error("AUDIT [ManagementLink]: RPC Error:", rpcError);
        throw rpcError;
      }
      
      if (!data || data.length === 0) {
        console.log("AUDIT [ManagementLink]: No appointment found for token:", token);
        setError("Agendamento não encontrado ou link expirado.");
        return;
      }

      const appt = data[0];
      console.log("AUDIT [ManagementLink]: Appointment found:", appt.id, "Tenant:", appt.tenant_id);

      if (expectedTenantId && appt.tenant_id !== expectedTenantId) {
        console.warn("AUDIT [ManagementLink]: Tenant mismatch. Expected:", expectedTenantId, "Found:", appt.tenant_id);
        setError("Este agendamento pertence a outra barbearia ou o link está incorreto.");
        return;
      }

      setAppointment(appt);
      
      if (appt.professional_id || appt.barber_id) {
        const profId = appt.professional_id || appt.barber_id;
        const { data: barbData } = await supabase
          .from("barbers")
          .select("*")
          .eq("id", profId)
          .single();
        setBarber(barbData);
      }
    } catch (err: any) {
      console.error("AUDIT [ManagementLink]: Critical Error:", err);
      setError(`Erro ao carregar agendamento: ${err.message || 'Erro desconhecido'}`);
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
      if (rpcError || !response || !response.success) throw new Error(rpcError?.message || response?.error || "Erro ao reagendar");

      await createNotification({
        userId: appointment.tenant_id,
        type: 'appointment_rescheduled',
        title: "Agendamento Reagendado",
        message: `${appointment.customer_name} reagendou para ${format(startTime, "dd/MM 'às' HH:mm")}`,
        barberId: appointment.professional_id || appointment.barber_id,
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

  const handleCancel = async (preference: 'credit' | 'refund' | 'none' = 'credit') => {
    setCancelling(true);
    try {
      const { data, error: rpcError } = await supabase.rpc('cancel_appointment', {
        p_appointment_id: appointment.id,
        p_cancelled_by: 'customer',
        p_source: 'public_link',
        p_refund_preference: preference
      });

      if (rpcError) throw rpcError;
      const response = data as any;
      if (response && response.success === false) throw new Error(response.error || "Erro ao processar");

      await createNotification({
        userId: appointment.tenant_id,
        type: 'appointment_cancelled',
        title: "Agendamento Cancelado",
        message: `${appointment.customer_name} cancelou o agendamento.`,
        barberId: appointment.professional_id || appointment.barber_id,
        metadata: { appointmentId: appointment.id }
      });

      triggerAutomation({
        tenant_id: appointment.tenant_id,
        event_name: 'appointment.cancelled',
        appointment_id: appointment.id
      }).catch(console.error);

      toast.success("Agendamento cancelado com sucesso.");
      setIsCancelModalOpen(false);
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
  
  const isWithinCancellationWindow = (() => {
    if (!appointment?.start_time) return false;
    const startTime = parseISO(appointment.start_time);
    const now = new Date();
    const windowHours = appointment.cancellation_window_hours ?? 2;
    const diffInMs = startTime.getTime() - now.getTime();
    const diffInHours = diffInMs / (1000 * 60 * 60);
    return diffInHours >= windowHours;
  })();

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
          {!isRescheduling ? (
            <motion.div
              key="details"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
            >
              <Card className="bg-[#0b0f17] border border-zinc-800/50 rounded-[2.5rem] shadow-2xl overflow-hidden mb-6">
                <div className={cn(
                  "p-6 flex flex-col items-center justify-center gap-2",
                  isConfirmed ? "bg-emerald-500/10" : (isCancelled ? "bg-red-500/10" : (isCompleted ? "bg-emerald-500/10" : "bg-primary/10"))
                )}>
                  <div className="flex items-center gap-3">
                    {appointment.status === 'confirmed' || appointment.status === 'scheduled' ? (
                      <>
                        <CheckCircle2 className="text-emerald-500 w-5 h-5" />
                        <span className="text-emerald-500 font-black uppercase text-xs tracking-widest">Agendamento Confirmado</span>
                      </>
                    ) : appointment.status === 'cancelled' ? (
                      <>
                        <XCircle className="text-red-500 w-5 h-5" />
                        <span className="text-red-500 font-black uppercase text-xs tracking-widest">Agendamento Cancelado</span>
                      </>
                    ) : appointment.status === 'completed' ? (
                      <>
                        <CheckCircle2 className="text-emerald-500 w-5 h-5" />
                        <span className="text-emerald-500 font-black uppercase text-xs tracking-widest">Atendimento Finalizado</span>
                      </>
                    ) : (
                      <>
                        <AlertCircle className="text-primary w-5 h-5" />
                        <span className="text-primary font-black uppercase text-xs tracking-widest">{appointment.status}</span>
                      </>
                    )}
                  </div>
                  {!isCancelled && appointment.payment_status === 'paid' && (
                    <Badge className="bg-emerald-500/20 text-emerald-500 border-none font-black text-[10px] uppercase px-3 py-1">
                      Pagamento Confirmado
                    </Badge>
                  )}
                </div>

                <CardContent className="p-8 space-y-8">
                  <div className="flex flex-col gap-1">
                    <span className="text-zinc-500 text-[10px] font-black uppercase tracking-widest">Olá,</span>
                    <h2 className="text-2xl font-black tracking-tight">{appointment.customer_name}</h2>
                  </div>

                  <div className="grid gap-6">
                    <div className="flex items-start gap-4">
                      <Scissors className="text-primary w-5 h-5 mt-1" />
                      <div>
                        <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest mb-0.5">Serviço</p>
                        <p className="font-bold text-white leading-tight">{appointment.service_name}</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-4">
                      <User className="text-primary w-5 h-5 mt-1" />
                      <div>
                        <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest mb-0.5">Profissional</p>
                        <p className="font-bold text-white leading-tight">{appointment.professional_name}</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-4">
                      <Calendar className="text-primary w-5 h-5 mt-1" />
                      <div>
                        <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest mb-0.5">Data e Horário</p>
                        <p className="font-bold text-white leading-tight">
                          {format(parseISO(appointment.start_time), "dd 'de' MMMM 'às' HH:mm", { locale: ptBR })}
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
                  <span className="text-primary font-black uppercase text-xs tracking-widest">Novo Horário</span>
                  <Button variant="ghost" size="sm" onClick={() => setIsRescheduling(false)} className="text-zinc-500 hover:text-white">
                    Cancelar
                  </Button>
                </div>
                <CardContent className="p-8 space-y-6">
                  <input 
                    type="date" 
                    min={format(new Date(), "yyyy-MM-dd")}
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="w-full h-12 bg-zinc-900 border border-zinc-800 rounded-xl px-4 text-white"
                  />
                  <div className="grid grid-cols-3 gap-2">
                    {availableTimes.map((time) => (
                      <button
                        key={time}
                        onClick={() => setSelectedTime(time)}
                        className={cn(
                          "h-10 rounded-lg text-xs font-bold border",
                          selectedTime === time ? "bg-primary text-black border-primary" : "border-zinc-800 text-zinc-400"
                        )}
                      >
                        {time}
                      </button>
                    ))}
                  </div>
                  <Button 
                    onClick={handleReschedule}
                    disabled={submitting || !selectedTime}
                    className="w-full h-14 rounded-2xl bg-primary text-black font-black uppercase tracking-widest"
                  >
                    {submitting ? "Processando..." : "Confirmar Novo Horário"}
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex flex-col gap-3">
          {appointment.business_phone && (
            <Button 
              className="h-14 rounded-2xl bg-zinc-900 hover:bg-zinc-800 text-white font-black uppercase tracking-widest shadow-xl"
              asChild
            >
              <a href={`https://wa.me/${appointment.business_phone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer">
                <Phone className="mr-2 h-4 w-4" /> Falar com a Barbearia
              </a>
            </Button>
          )}
        </div>
      </motion.div>

      <Dialog open={isCancelModalOpen} onOpenChange={setIsCancelModalOpen}>
        <DialogContent className="bg-[#0b0f17] border-zinc-800 text-white rounded-3xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-black uppercase italic tracking-tight">Cancelar Agendamento</DialogTitle>
            <DialogDescription className="text-zinc-400">Esta ação não poderá ser desfeita.</DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex flex-col sm:flex-row gap-3">
            <Button variant="outline" onClick={() => setIsCancelModalOpen(false)} className="rounded-xl flex-1 uppercase text-[10px]">Manter</Button>
            <Button onClick={() => handleCancel()} disabled={cancelling} className="bg-red-600 rounded-xl flex-1 uppercase text-[10px]">Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default AppointmentManagementPage;
