
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
  Trash2,
  Check,
  CircleDollarSign
} from "lucide-react";

import { format, parseISO, addMinutes, isSameDay } from "date-fns";
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
import { Checkbox } from "@/components/ui/checkbox";

export const Route = createFileRoute("/agendamentos/grupo/$token")({
  component: AppointmentGroupPage,
});

function AppointmentGroupPage() {
  const { token } = Route.useParams();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const expectedTenantId = searchParams.get('tenant');
  
  const [loading, setLoading] = useState(true);
  const [group, setGroup] = useState<any>(null);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [isRescheduling, setIsRescheduling] = useState(false);
  const [rescheduleData, setRescheduleData] = useState<any>(null);
  const [selectedDate, setSelectedDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [selectedTime, setSelectedTime] = useState("");
  const [availableTimes, setAvailableTimes] = useState<string[]>([]);
  const [fetchingTimes, setFetchingTimes] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [selectedHistoryItem, setSelectedHistoryItem] = useState<any>(null);

  
  useEffect(() => {
    if (token) {
      fetchGroup();
      fetchHistory();
    }

  }, [token]);

  async function fetchGroup() {
    const currentToken = token || "";
    console.log("[GroupPage] 🟢 fetchGroup started", { token: currentToken, expectedTenantId });
    setLoading(true);
    setError(null);
    try {
      // 1. Fetch appointment group details
      console.log("[GroupPage] 🔍 Fetching appointment_group by group_token", currentToken);
      let groupQuery = supabase
        .from('appointment_groups')
        .select('*')
        .eq('group_token', currentToken);
      
      if (expectedTenantId) {
        groupQuery = groupQuery.eq('tenant_id', expectedTenantId);
      }
      
      const { data: groupData, error: groupError } = await groupQuery.maybeSingle();

      if (groupError) {
        console.error("[GroupPage] ❌ Error fetching group:", groupError);
        throw groupError;
      }
      
      if (!groupData) {
        console.warn("[GroupPage] ⚠️ Group not found", { token, expectedTenantId });
        setError("Agendamento não encontrado ou link inválido.");
        return;
      }

      console.log("[GroupPage] ✅ Group found", groupData.id);

      // 2. Fetch appointments for this group
      console.log("[GroupPage] 🔍 Fetching appointments for group", groupData.id);
      const { data: appointmentsData, error: apptsError } = await supabase
        .from('appointments')
        .select(`
          id,
          service_id,
          barber_id,
          start_time,
          end_time,
          status,
          service_amount,
          group_sequence,
          management_token,
          service:services(name),
          professional:barbers(name)
        `)
        .eq('appointment_group_id', groupData.id)
        .order('group_sequence', { ascending: true });

      if (apptsError) {
        console.error("[GroupPage] ❌ Error fetching appointments:", apptsError);
        throw apptsError;
      }

      if (!appointmentsData || appointmentsData.length === 0) {
        console.warn("[GroupPage] ⚠️ No appointments found for group", groupData.id);
        setError("Nenhum serviço encontrado para este agendamento.");
        return;
      }

      console.log("[GroupPage] ✅ Appointments found", appointmentsData.length);

      // 3. Fetch business profile
      console.log("[GroupPage] 🔍 Fetching business profile", groupData.tenant_id);
      const { data: profileData } = await supabase
        .from('profiles')
        .select('business_name, whatsapp_number')
        .eq('id', groupData.tenant_id)
        .maybeSingle();

      // 4. Fetch customer data
      let customerName = "Cliente";
      if (groupData.customer_id) {
        console.log("[GroupPage] 🔍 Fetching customer data", groupData.customer_id);
        const { data: customerData } = await supabase
          .from('customers')
          .select('name')
          .eq('id', groupData.customer_id)
          .maybeSingle();
        
        if (customerData?.name) {
          customerName = customerData.name;
        }
      }

      setGroup({
        id: groupData.id,
        tenant_id: groupData.tenant_id,
        customer_id: groupData.customer_id,
        customer_name: customerName,
        business_name: (profileData as any)?.business_name || "Barbearia",
        business_phone: (profileData as any)?.whatsapp_number || "",
        total_amount: groupData.total_amount,
        payment_status: groupData.payment_status,
        status: groupData.status
      });

      setAppointments(appointmentsData.map((item: any) => ({
        id: item.id,
        service_id: item.service_id,
        service_name: item.service?.name || "Serviço",
        professional_id: item.barber_id,
        professional_name: item.professional?.name || "Profissional",
        start_time: item.start_time,
        end_time: item.end_time,
        status: item.status,
        service_amount: item.service_amount,
        sequence: item.group_sequence,
        management_token: item.management_token
      })));

      console.log("[GroupPage] 🏁 group_page_rendered");

    } catch (err: any) {
      console.error("[GroupPage] ❌ group_page_failed:", err);
      setError("Erro ao carregar agendamentos. Por favor, tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  async function fetchHistory() {
    setLoadingHistory(true);
    try {
      // Usar uma query mais robusta que não dependa do relacionamento se ele falhar no TS
      const { data, error: histError } = await supabase
        .from('appointment_status_logs')
        .select('*')
        .order('created_at', { ascending: false });

      if (histError) throw histError;
      
      // Filtrar localmente por ID de agendamento se necessário, ou ajustar a query se o schema permitir
      // Por simplicidade e segurança, vamos filtrar no componente os logs que pertencem aos agendamentos carregados
      setHistory(data || []);
    } catch (err) {
      console.error("Error fetching history:", err);
    } finally {
      setLoadingHistory(false);
    }
  }


  const toggleSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    const selectable = appointments.filter(a => a.status !== 'cancelled' && a.status !== 'completed').map(a => a.id);
    if (selectedIds.length === selectable.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(selectable);
    }
  };

  const handleCancelSelected = async (preference: 'credit' | 'refund' = 'credit') => {
    if (selectedIds.length === 0) return;
    setCancelling(true);
    try {
      for (const id of selectedIds) {
        const appt = appointments.find(a => a.id === id);
        if (!appt) continue;

        const isPaid = group.payment_status === 'paid' && Number(appt.service_amount) > 0;
        
        let rpcName = 'cancel_appointment';
        let rpcParams: any = {
            p_appointment_id: id,
            p_cancelled_by: 'customer',
            p_source: 'public_link',
            p_refund_preference: 'none'
        };

        if (isPaid) {
            if (preference === 'refund') {
              rpcName = 'request_appointment_refund';
              rpcParams = {
                p_appointment_id: id,
                p_customer_id: group.customer_id,
                p_tenant_id: group.tenant_id,
                p_amount: Number(appt.service_amount),
                p_pix_key: 'Solicitado via Link de Grupo',
                p_pix_key_type: 'bulk_request',
                p_account_holder_name: group.customer_name,
                p_notes: 'Cancelamento parcial de grupo'
              };
            } else {
              rpcName = 'convert_appointment_to_credit';
              rpcParams = {
                  p_appointment_id: id,
                  p_customer_id: group.customer_id,
                  p_tenant_id: group.tenant_id,
                  p_amount: Number(appt.service_amount)
              };
            }
        }

        const { error: rpcError } = await supabase.rpc(rpcName as any, rpcParams);
        if (rpcError) throw rpcError;
        
        triggerAutomation({
          tenant_id: group.tenant_id,
          event_name: 'appointment.cancelled',
          appointment_id: id
        }).catch(console.error);
      }

      toast.success(`${selectedIds.length} agendamento(s) cancelado(s) com sucesso.`);
      setIsCancelModalOpen(false);
      setSelectedIds([]);
      fetchGroup();
      fetchHistory();
      
      // Enviar notificação individual para cada item cancelado
      for (const id of selectedIds) {
        const appt = appointments.find(a => a.id === id);
        if (appt) {
          await supabase.functions.invoke('appointment-notifications', {
            body: { 
              appointmentId: id, 
              type: 'appointment_cancelled',
              updatedBy: { type: 'customer' }
            }
          });
        }
      }

    } catch (err: any) {
      toast.error(err.message || "Erro ao cancelar agendamentos");
    } finally {
      setCancelling(false);
    }
  };

  useEffect(() => {
    if (isRescheduling && selectedDate && rescheduleData) {
      fetchAvailableTimes();
    }
  }, [isRescheduling, selectedDate, rescheduleData]);

  async function fetchAvailableTimes() {
    if (!rescheduleData) return;
    setFetchingTimes(true);
    try {
      const startDay = `${selectedDate}T00:00:00Z`;
      const endDay = `${selectedDate}T23:59:59Z`;
      
      const { data: dayAppts } = await supabase
        .from("appointments")
        .select("id, start_time, end_time, status")
        .eq("barber_id", rescheduleData.professional_id)
        .in("status", ["scheduled", "confirmed", "in_progress", "awaiting_payment"])
        .gte("start_time", startDay)
        .lte("start_time", endDay);
      
      const { data: barber } = await supabase
        .from("barbers")
        .select("working_hours")
        .eq("id", rescheduleData.professional_id)
        .single();

      if (!barber) return;

      const dayName = format(parseISO(selectedDate), "eeee", { locale: ptBR }).toLowerCase();
      const dayMap: Record<string, string> = {
        'segunda-feira': 'monday', 'terça-feira': 'tuesday', 'quarta-feira': 'wednesday',
        'quinta-feira': 'thursday', 'sexta-feira': 'friday', 'sábado': 'saturday', 'domingo': 'sunday'
      };
      const dayKey = dayMap[dayName] || dayName;
      const workingHours = (barber.working_hours as any)?.[dayKey];

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
            if (app.id === rescheduleData.id) return false;
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

  const handleRescheduleSubmit = async () => {
    if (!selectedTime || !rescheduleData) {
      toast.error("Por favor, selecione um horário.");
      return;
    }

    setSubmitting(true);
    try {
      const timeWithSeconds = selectedTime.length === 5 ? `${selectedTime}:00` : selectedTime;
      const startTime = parseISO(`${selectedDate}T${timeWithSeconds}`);
      const oldStart = parseISO(rescheduleData.start_time);
      const oldEnd = rescheduleData.end_time ? parseISO(rescheduleData.end_time) : addMinutes(oldStart, 30);
      const durationMinutes = Math.round((oldEnd.getTime() - oldStart.getTime()) / 60000) || 30;
      const endTime = addMinutes(startTime, durationMinutes);

      const { data, error: rpcError } = await supabase.rpc('reschedule_appointment', {
        p_appointment_id: rescheduleData.id,
        p_new_start_time: startTime.toISOString(),
        p_new_end_time: endTime.toISOString(),
        p_changed_by_type: 'customer',
        p_source: 'public_link'
      });

      const response = data as any;
      if (rpcError || !response || !response.success) throw new Error(rpcError?.message || response?.error || "Erro desconhecido");

      await createNotification({
        userId: group.tenant_id,
        type: 'appointment_rescheduled',
        title: "Agendamento Reagendado",
        message: `${group.customer_name} reagendou para ${format(startTime, "dd/MM 'às' HH:mm")}`,
        barberId: rescheduleData.professional_id,
        metadata: { appointmentId: rescheduleData.id }
      });

      triggerAutomation({
        tenant_id: group.tenant_id,
        event_name: 'appointment.rescheduled',
        appointment_id: rescheduleData.id
      }).catch(console.error);

      toast.success("Agendamento reagendado com sucesso!");
      setIsRescheduling(false);
      setRescheduleData(null);
      fetchGroup(); 
      fetchHistory();

      // Enviar notificação de reagendamento
      await supabase.functions.invoke('appointment-notifications', {
        body: { 
          appointmentId: rescheduleData.id, 
          type: 'appointment_rescheduled',
          updatedBy: { type: 'customer' }
        }
      });

    } catch (err: any) {
      toast.error(err.message || "Erro ao reagendar");
    } finally {
      setSubmitting(false);
    }
  };

  const openReschedule = () => {
    if (selectedIds.length !== 1) {
      toast.error("Selecione exatamente um agendamento para reagendar.");
      return;
    }
    const appt = appointments.find(a => a.id === selectedIds[0]);
    if (appt) {
      setRescheduleData(appt);
      setSelectedDate(format(parseISO(appt.start_time), "yyyy-MM-dd"));
      setIsRescheduling(true);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error || !group) {
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

  const selectableAppointments = appointments.filter(a => a.status !== 'cancelled' && a.status !== 'completed');

  return (
    <div className="min-h-screen bg-black text-white p-4 sm:p-8 flex flex-col items-center">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-2xl"
      >
        <div className="text-center mb-10 mt-6">
          <h1 className="text-3xl font-black text-primary uppercase italic tracking-tighter mb-1">
            {group.business_name}
          </h1>
          <p className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.3em]">Gerenciamento de Grupo de Agendamentos</p>
        </div>

        {/* Finance Summary Card */}
        <Card className="bg-[#0b0f17] border border-zinc-800/50 rounded-[2.5rem] shadow-2xl overflow-hidden mb-6">
          <CardHeader className="p-6 border-b border-zinc-800/50">
            <div className="flex items-center gap-3">
              <CircleDollarSign className="text-primary w-5 h-5" />
              <CardTitle className="text-white font-black uppercase text-xs tracking-widest">Resumo Financeiro</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-zinc-400 text-sm font-medium">Total Original</span>
              <span className="text-white font-bold">R$ {Number(group.total_amount).toFixed(2)}</span>
            </div>
            
            {appointments.some(a => a.status === 'cancelled') && (
              <div className="flex justify-between items-center">
                <span className="text-red-400 text-sm font-medium">Valor em Itens Cancelados</span>
                <span className="text-red-400 font-bold">
                  - R$ {appointments
                    .filter(a => a.status === 'cancelled')
                    .reduce((acc, a) => acc + Number(a.service_amount), 0)
                    .toFixed(2)}
                </span>
              </div>
            )}

            <div className="pt-4 border-t border-zinc-800/50 flex justify-between items-center">
              <span className="text-zinc-400 text-sm font-bold uppercase tracking-widest">Valor Ativo</span>
              <span className="text-primary text-xl font-black">
                R$ {appointments
                  .filter(a => a.status !== 'cancelled')
                  .reduce((acc, a) => acc + Number(a.service_amount), 0)
                  .toFixed(2)}
              </span>
            </div>

            {group.payment_status === 'paid' && appointments.some(a => a.status === 'cancelled') && (
              <div className="mt-4 p-4 bg-emerald-500/10 rounded-2xl border border-emerald-500/20">
                <p className="text-[10px] text-emerald-500 font-black uppercase tracking-widest mb-1">Status de Crédito/Estorno</p>
                <p className="text-xs text-emerald-400/80 leading-relaxed font-medium">
                  Os valores dos itens cancelados foram convertidos em crédito para sua próxima visita ou estão em processo de estorno, conforme sua solicitação.
                </p>
              </div>
            )}
          </CardContent>
        </Card>


        <Card className="bg-[#0b0f17] border border-zinc-800/50 rounded-[2.5rem] shadow-2xl overflow-hidden mb-6">
          <div className="p-6 bg-primary/10 flex items-center justify-between border-b border-zinc-800/50">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="text-primary w-5 h-5" />
              <span className="text-primary font-black uppercase text-xs tracking-widest">Olá, {group.customer_name}</span>
            </div>
            {selectableAppointments.length > 0 && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={toggleSelectAll}
                className="text-zinc-400 hover:text-white text-xs font-bold uppercase tracking-widest"
              >
                {selectedIds.length === selectableAppointments.length ? "Desmarcar Todos" : "Selecionar Todos"}
              </Button>
            )}
          </div>

          <CardContent className="p-0">
            <div className="divide-y divide-zinc-800/50">
              {appointments.map((appt) => {
                const isSelected = selectedIds.includes(appt.id);
                const isCancelled = appt.status === 'cancelled';
                const isCompleted = appt.status === 'completed';
                const canSelect = !isCancelled && !isCompleted;

                return (
                  <div 
                    key={appt.id} 
                    className={cn(
                      "p-6 transition-colors flex items-center gap-4",
                      isSelected ? "bg-primary/5" : "hover:bg-white/[0.02]",
                      !canSelect && "opacity-50"
                    )}
                  >
                    {canSelect && (
                      <Checkbox 
                        checked={isSelected}
                        onCheckedChange={() => toggleSelect(appt.id)}
                        className="border-zinc-700"
                      />
                    )}
                    
                    <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest mb-0.5">Serviço</p>
                        <p className="font-bold text-white leading-tight">{appt.service_name}</p>
                        <p className="text-[10px] text-zinc-400 font-medium">com {appt.professional_name}</p>
                      </div>
                      
                      <div>
                        <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest mb-0.5">Horário</p>
                        <div className="flex items-center gap-2 text-white font-bold text-sm">
                          <Calendar size={14} className="text-primary" />
                          {format(parseISO(appt.start_time), "dd/MM")}
                          <Clock size={14} className="text-primary ml-2" />
                          {format(parseISO(appt.start_time), "HH:mm")}
                        </div>
                      </div>

                      <div className="flex flex-col items-start md:items-end justify-center gap-1.5">
                        <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest">Status</p>
                        <Badge className={cn(
                          "uppercase text-[9px] font-black tracking-widest",
                          appt.status === 'cancelled' ? "bg-red-500/20 text-red-500 border-red-500/20" : 
                          appt.status === 'completed' ? "bg-blue-500/20 text-blue-500 border-blue-500/20" :
                          "bg-emerald-500/20 text-emerald-500 border-emerald-500/20"
                        )}>
                          {appt.status === 'cancelled' ? "Cancelado" : appt.status === 'completed' ? "Concluído" : "Confirmado"}
                        </Badge>
                        {appt.status !== 'cancelled' && group.payment_status === 'paid' && (
                          <Badge className="bg-emerald-500 text-white border-none font-black text-[8px] uppercase px-1.5 py-0">
                            PAGO
                          </Badge>
                        )}
                      </div>
                    </div>

                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="text-zinc-600 hover:text-white"
                      asChild
                    >
                      <a href={`/agendamento/${appt.management_token}?tenant=${group.tenant_id}`}>
                        <ChevronRight size={20} />
                      </a>
                    </Button>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {selectedIds.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col gap-3"
          >
            <div className="bg-primary/10 border border-primary/20 p-4 rounded-2xl flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-widest text-primary">
                {selectedIds.length} item(s) selecionado(s)
              </span>
              <div className="flex gap-2">
                <Button 
                  size="sm"
                  variant="outline"
                  onClick={openReschedule}
                  disabled={selectedIds.length !== 1}
                  className="rounded-xl h-10 font-bold uppercase tracking-widest text-[10px] bg-zinc-900 border-zinc-800 text-white"
                >
                  <RefreshCcw className="mr-2 h-3 w-3" /> Reagendar
                </Button>
                <Button 
                  size="sm"
                  variant="destructive"
                  onClick={() => setIsCancelModalOpen(true)}
                  className="rounded-xl h-10 font-bold uppercase tracking-widest text-[10px]"
                >
                  Cancelar Selecionados
                </Button>
              </div>
            </div>
          </motion.div>
        )}

        <div className="flex flex-col gap-3 mt-8">
          <Button 
            className="h-14 rounded-2xl bg-zinc-900 hover:bg-zinc-800 text-white border border-zinc-800 font-black uppercase tracking-widest shadow-xl"
            asChild
          >
            <a href={`https://wa.me/${group.business_phone?.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer">
              <Phone className="mr-2 h-4 w-4" /> Falar com a Barbearia
            </a>
          </Button>
        </div>

        <p className="text-center mt-12 text-zinc-700 text-[10px] font-bold uppercase tracking-widest">
          Powered by Barbex
        </p>
      </motion.div>

      <Dialog open={isCancelModalOpen} onOpenChange={setIsCancelModalOpen}>
        <DialogContent className="bg-[#0b0f17] border-zinc-800 text-white rounded-3xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-black uppercase italic tracking-tight flex items-center gap-2">
              <AlertCircle className="text-red-500 h-6 w-6" /> Cancelar Selecionados
            </DialogTitle>
            <DialogDescription className="text-zinc-400 font-medium pt-2">
              Deseja realmente cancelar os {selectedIds.length} agendamentos selecionados?
              {group.payment_status === 'paid' && " Escolha como deseja receber o valor pago."}
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="flex flex-col gap-3 pt-4">
            {group.payment_status === 'paid' ? (
              <>
                <Button 
                  onClick={() => handleCancelSelected('credit')}
                  disabled={cancelling}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl h-12 w-full font-bold uppercase tracking-widest text-[10px] shadow-lg shadow-emerald-600/20"
                >
                  {cancelling ? <RefreshCcw className="animate-spin h-4 w-4" /> : "Converter em Crédito"}
                </Button>
                <Button 
                  onClick={() => handleCancelSelected('refund')}
                  disabled={cancelling}
                  className="bg-red-600 hover:bg-red-700 text-white rounded-xl h-12 w-full font-bold uppercase tracking-widest text-[10px] shadow-lg shadow-red-600/20"
                >
                  {cancelling ? <RefreshCcw className="animate-spin h-4 w-4" /> : "Solicitar Estorno (Pix)"}
                </Button>
              </>
            ) : (
              <Button 
                onClick={() => handleCancelSelected('credit')}
                disabled={cancelling}
                className="bg-red-600 hover:bg-red-700 text-white rounded-xl h-12 w-full font-bold uppercase tracking-widest text-[10px] shadow-lg shadow-red-600/20"
              >
                {cancelling ? <RefreshCcw className="animate-spin h-4 w-4" /> : "Sim, Cancelar"}
              </Button>
            )}
            <Button 
              variant="outline" 
              onClick={() => setIsCancelModalOpen(false)}
              className="bg-transparent border-zinc-800 text-zinc-400 hover:bg-zinc-800 hover:text-white rounded-xl h-12 w-full font-bold uppercase tracking-widest text-[10px]"
            >
              Manter Agendamentos
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={isRescheduling} onOpenChange={setIsRescheduling}>
        <DialogContent className="bg-[#0b0f17] border-zinc-800 text-white rounded-3xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-black uppercase italic tracking-tight">Reagendar Agendamento</DialogTitle>
            <DialogDescription className="text-zinc-400">
              Escolha uma nova data e horário para {rescheduleData?.service_name}.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Nova Data</label>
              <input 
                type="date" 
                value={selectedDate}
                min={format(new Date(), "yyyy-MM-dd")}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-sm focus:ring-2 focus:ring-primary outline-none"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Horários Disponíveis</label>
              {fetchingTimes ? (
                <div className="flex justify-center p-4">
                  <RefreshCcw className="animate-spin text-primary" />
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
                  {availableTimes.length > 0 ? (
                    availableTimes.map(time => (
                      <Button
                        key={time}
                        variant={selectedTime === time ? "default" : "outline"}
                        onClick={() => setSelectedTime(time)}
                        className={cn(
                          "h-10 rounded-xl text-xs font-bold",
                          selectedTime === time ? "bg-primary text-black" : "bg-zinc-900 border-zinc-800 text-zinc-400"
                        )}
                      >
                        {time}
                      </Button>
                    ))
                  ) : (
                    <p className="col-span-3 text-center text-xs text-zinc-500 py-4 font-bold uppercase tracking-widest">Nenhum horário disponível</p>
                  )}
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="flex flex-col gap-3 pt-4">
            <Button 
              onClick={handleRescheduleSubmit}
              disabled={submitting || !selectedTime}
              className="bg-primary hover:bg-primary/90 text-black rounded-xl h-12 w-full font-black uppercase tracking-widest text-[10px] shadow-lg shadow-primary/20"
            >
              {submitting ? <RefreshCcw className="animate-spin h-4 w-4" /> : "Confirmar Reagendamento"}
            </Button>
            <Button 
              variant="outline" 
              onClick={() => setIsRescheduling(false)}
              className="bg-transparent border-zinc-800 text-zinc-400 hover:bg-zinc-800 hover:text-white rounded-xl h-12 w-full font-bold uppercase tracking-widest text-[10px]"
            >
              Manter Horário Atual
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* History Modal */}
      <Dialog open={showHistoryModal} onOpenChange={setShowHistoryModal}>
        <DialogContent className="bg-[#0b0f17] border-zinc-800 text-white rounded-[2rem] max-w-md overflow-hidden p-0">
          <DialogHeader className="p-8 border-b border-zinc-800/50">
            <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center mb-4">
              <RefreshCcw className="text-primary w-6 h-6" />
            </div>
            <DialogTitle className="text-2xl font-black uppercase italic tracking-tighter">Histórico do Item</DialogTitle>
            <DialogDescription className="text-zinc-500 font-medium">
              Acompanhe as alterações feitas no serviço {selectedHistoryItem?.service_name}.
            </DialogDescription>
          </DialogHeader>

          <div className="p-6 max-h-[400px] overflow-y-auto space-y-6">
            {loadingHistory ? (
              <div className="flex justify-center p-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : history.filter(h => h.appointment_id === selectedHistoryItem?.id).length > 0 ? (
              <div className="relative border-l-2 border-zinc-800/50 ml-3 pl-6 space-y-8">
                {history.filter(h => h.appointment_id === selectedHistoryItem?.id).map((log) => (
                  <div key={log.id} className="relative">
                    <div className="absolute -left-[33px] top-1 w-4 h-4 rounded-full bg-zinc-900 border-2 border-primary flex items-center justify-center">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-zinc-500 text-[10px] font-black uppercase tracking-widest">
                        {format(parseISO(log.created_at), "dd/MM/yyyy HH:mm")}
                      </span>
                      <p className="text-white font-bold text-sm">
                        {log.new_status === 'cancelled' ? 'Agendamento Cancelado' : 
                         log.metadata?.action === 'rescheduled' ? 'Agendamento Reagendado' : 
                         `Status alterado para ${log.new_status}`}
                      </p>
                      {log.metadata?.reason && (
                        <p className="text-zinc-400 text-xs mt-1 italic">"{log.metadata.reason}"</p>
                      )}
                      {log.metadata?.amount && (
                        <p className="text-primary text-xs font-bold mt-1">
                          Valor: R$ {Number(log.metadata.amount).toFixed(2)}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-10">
                <Clock className="w-10 h-10 text-zinc-800 mx-auto mb-3" />
                <p className="text-zinc-500 text-sm">Nenhuma alteração registrada até o momento.</p>
              </div>
            )}
          </div>

          <DialogFooter className="p-6 bg-zinc-900/30 border-t border-zinc-800/50">
            <Button 
              variant="outline" 
              className="w-full border-zinc-800 bg-transparent text-zinc-400 font-black uppercase tracking-[0.2em] text-[10px] h-12 rounded-2xl hover:bg-white/5 transition-all"
              onClick={() => setShowHistoryModal(false)}
            >
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}




export default AppointmentGroupPage;
