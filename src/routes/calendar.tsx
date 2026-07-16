import * as React from "react";
import { format, addMinutes, startOfHour, parseISO, isSameDay, startOfWeek, endOfWeek, eachDayOfInterval, addDays, subDays, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  Calendar as CalendarIcon,
  Clock,
  User,
  Scissors,
  X,
  AlertTriangle,
  Crown,
  CheckCircle2,
  RefreshCcw
} from "lucide-react";
import { AppointmentModal } from "@/components/calendar/AppointmentModal";
import { AppointmentDetailsModal } from "@/components/calendar/AppointmentDetailsModal";
import { RescheduleWizard } from "@/components/reschedule/RescheduleWizard";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/hooks/use-auth";
import { useProfessionalAuth } from "@/components/professional/ProfessionalAuthProvider";
import { usePlanLimits } from "@/hooks/use-plan-limits";
import { useEffect, useState, useMemo } from "react";
import { useNavigate, Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { triggerWhatsAppMessage } from "@/utils/whatsapp";

export const Route = createFileRoute("/calendar")({
  component: CalendarComponent,
});

function getCalendarStatusConfig(status: string) {
  const normalized = String(status || '').toLowerCase();

  if (['completed', 'concluido', 'concluído', 'done'].includes(normalized)) {
    return {
      label: 'Concluído',
      badge: 'bg-emerald-700/25 text-emerald-300 border-emerald-600/40',
      ring: 'border-emerald-600/30',
      dot: 'bg-emerald-500',
    };
  }
  if (['paid', 'pago'].includes(normalized)) {
    return {
      label: 'Pago',
      badge: 'bg-emerald-400/15 text-emerald-300 border-emerald-400/40',
      ring: 'border-emerald-400/30',
      dot: 'bg-emerald-400',
    };
  }
  if (['cancelled', 'canceled', 'cancelado'].includes(normalized)) {
    return {
      label: 'Cancelado',
      badge: 'bg-red-600/20 text-red-300 border-red-500/40',
      ring: 'border-red-500/30',
      dot: 'bg-red-500',
    };
  }
  if (['no_show', 'faltou', 'missed'].includes(normalized)) {
    return {
      label: 'Faltou',
      badge: 'bg-slate-500/20 text-slate-300 border-slate-400/30',
      ring: 'border-slate-400/20',
      dot: 'bg-slate-400',
    };
  }
  if (['confirmed', 'confirmado'].includes(normalized)) {
    return {
      label: 'Confirmado',
      badge: 'bg-blue-600/20 text-blue-300 border-blue-500/40',
      ring: 'border-blue-500/30',
      dot: 'bg-blue-500',
    };
  }
  if (['rescheduled', 'reagendado'].includes(normalized)) {
    return {
      label: 'Reagendado',
      badge: 'bg-purple-600/20 text-purple-300 border-purple-500/40',
      ring: 'border-purple-500/30',
      dot: 'bg-purple-500',
    };
  }
  if (['awaiting_payment'].includes(normalized)) {
    return {
      label: 'Pgto Pendente',
      badge: 'bg-amber-600/20 text-amber-300 border-amber-500/40',
      ring: 'border-amber-500/30',
      dot: 'bg-amber-500',
    };
  }
  // Agendado / pending default
  return {
    label: 'Agendado',
    badge: 'bg-orange-500/20 text-orange-300 border-orange-500/40',
    ring: 'border-orange-500/30',
    dot: 'bg-orange-500',
  };
}


const HOURS = Array.from({ length: 13 }, (_, i) => i + 8); // 8:00 to 20:00

function CalendarComponent() {
  const { user: authUser, loading: authLoading, role: authRole } = useAuth();
  const { session, loading: profLoading } = useProfessionalAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const user = authUser || (session ? { id: session.barber_id, email: session.phone } : null);
  const role = authRole || (session ? 'barber' : null);
  const loading = authLoading || profLoading;

  const { checkLimit, limits, usage, refresh: refreshLimits } = usePlanLimits();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<"day" | "week">("day");
  const [appointments, setAppointments] = useState<any[]>([]);
  const [barbers, setBarbers] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [modalInitialData, setModalInitialData] = useState<{date?: string, time?: string, step?: number, editingId?: string}>({});
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [rescheduleAppt, setRescheduleAppt] = useState<any>(null);
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(false);

  const canAddAppointment = checkLimit("monthlyAppointments");

  useEffect(() => {
    if (!loading && !user) {
      navigate({ to: "/auth" });
      return;
    }

    if (!loading && user && role === 'super_admin') {
      navigate({ to: "/admin" });
      return;
    }
  }, [user, loading, role, navigate]);

  useEffect(() => {
    if (user && role !== 'super_admin') {
      fetchData();

      const tenantId = user.id;
      
      const channel = supabase
        .channel(`appointments-calendar-${tenantId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'appointments',
            filter: `tenant_id=eq.${tenantId}`
          },
          (payload: any) => {
            console.log('REALTIME APPOINTMENT CHANGE', payload);
            
            fetchData();
            refreshLimits();
            
            // Invalida todas as queries relacionadas
            queryClient.invalidateQueries({ queryKey: ['appointments'] });
            queryClient.invalidateQueries({ queryKey: ['calendar'] });
            queryClient.invalidateQueries({ queryKey: ['dashboard'] });
            queryClient.invalidateQueries({ queryKey: ['customerAppointments'] });
            queryClient.invalidateQueries({ queryKey: ['calendar-appointments'] });
            queryClient.invalidateQueries({ queryKey: ['dashboard-appointments'] });
            queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user, currentDate, view]);

  async function fetchData() {
    if (!user) return;

    const start = startOfDay(view === "day" ? currentDate : startOfWeek(currentDate, { weekStartsOn: 0 }));
    const end = endOfDay(view === "day" ? currentDate : endOfWeek(currentDate, { weekStartsOn: 0 }));

    let appQuery = supabase
      .from("appointments")
      .select("*, customers(name, phone, avatar_url), services(name, duration_minutes), barbers!appointments_barber_id_fkey(name)")
      .eq("tenant_id", user.id)
      .gte("start_time", start.toISOString())
      .lte("start_time", end.toISOString());
    
    if (role === 'barber') {
      const targetId = user?.id || session?.barber_id;
      if (targetId) {
        appQuery = appQuery.eq('barber_id', targetId);
      }
    }

    const [appRes, barbRes, custRes, servRes] = await Promise.all([
      appQuery.order("start_time", { ascending: false }),
      supabase.from("barbers").select("*").eq("user_id", user.id).order("name"),
      supabase.from("customers").select("*").eq("user_id", user.id).order("name"),
      supabase.from("services").select("*").eq("user_id", user.id).eq("active", true).order("name"),
    ]);

    if (appRes.data) {
      console.log('CALENDAR APPOINTMENTS', appRes.data);
      setAppointments(appRes.data);
    }
    if (barbRes.data) setBarbers(barbRes.data);
    if (custRes.data) setCustomers(custRes.data);
    if (servRes.data) setServices(servRes.data);
  }

  const weekDays = useMemo(() => {
    const start = startOfWeek(currentDate, { weekStartsOn: 0 });
    return eachDayOfInterval({ start, end: addDays(start, 6) });
  }, [currentDate]);

  const getAppointmentsForTime = (date: Date, hour: number) => {
    return appointments.filter((app: any) => {
      const appDate = new Date(app.start_time);
      const startOfHourDate = new Date(date);
      startOfHourDate.setHours(hour, 0, 0, 0);
      const endOfHourDate = new Date(date);
      endOfHourDate.setHours(hour + 1, 0, 0, 0);
      const appStartMs = appDate.getTime();
      const appEndMs = new Date(app.end_time).getTime();
      const slotStartMs = startOfHourDate.getTime();
      const slotEndMs = endOfHourDate.getTime();
      return appStartMs < slotEndMs && appEndMs > slotStartMs;
    });
  };

  const todayApps = useMemo(() => appointments.filter(a => isSameDay(new Date(a.start_time), currentDate)), [appointments, currentDate]);
  const todayRevenue = useMemo(() => todayApps.reduce((acc, a) => acc + Number(a.total_price || 0), 0), [todayApps]);
  const isToday = isSameDay(currentDate, new Date());

  if (loading || !user) return null;

  const openNewAppointment = (date?: Date, hour?: number) => {
    setModalInitialData({
      time: hour !== undefined ? `${hour.toString().padStart(2, '0')}:00` : undefined,
      date: date ? format(date, "yyyy-MM-dd") : undefined,
      step: 1,
      editingId: undefined,
    });
    setIsDialogOpen(true);
  };

  const openDetails = (id: string) => {
    setSelectedAppointmentId(id);
    setDetailsModalOpen(true);
  };

  return (
    <AppLayout>
      <div className="flex flex-col h-full space-y-4 sm:space-y-5 bg-[#05070d] p-3 sm:p-4 md:p-8 min-h-screen text-white max-w-full overflow-x-hidden">
        {!canAddAppointment && (
          <Alert className="bg-amber-950/30 border-amber-900/50 rounded-2xl">
            <Crown className="h-4 w-4 text-[#F5C542]" />
            <AlertTitle className="text-[#F5C542]">Limite de Agendamentos</AlertTitle>
            <AlertDescription className="flex items-center justify-between text-gray-400">
              Você atingiu o limite mensal de {limits.monthlyAppointments} agendamentos.
              <Button variant="link" size="sm" asChild className="p-0 h-auto text-[#F5C542] font-bold underline">
                <Link to="/subscription">Fazer Upgrade</Link>
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* ============ HEADER CARD ============ */}
        <div
          className="relative overflow-hidden rounded-3xl border border-[#F59E0B]/15 bg-[#0B1220] p-5 sm:p-6 shadow-[0_10px_40px_-10px_rgba(245,158,11,0.25)]"
        >
          <div className="absolute -top-20 -right-20 w-60 h-60 rounded-full bg-[#F5C542]/10 blur-3xl pointer-events-none" />
          <div className="relative flex items-start gap-4">
            <div className="grid h-12 w-12 sm:h-14 sm:w-14 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-[#F5C542] to-[#D4A017] text-black shadow-[0_0_20px_rgba(245,197,66,0.35)]">
              <CalendarIcon className="h-6 w-6 sm:h-7 sm:w-7" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight leading-none">Agenda</h2>
              <p className="text-gray-400 text-xs sm:text-sm font-medium mt-2">
                <span className="text-white font-bold">{todayApps.length}</span> atendimentos hoje
                <span className="mx-2 text-[#F59E0B]/40">•</span>
                <span className="text-[#F5C542] font-black">R$ {todayRevenue.toFixed(2)}</span>
                <span className="hidden sm:inline"> em serviços</span>
              </p>
            </div>
          </div>
        </div>

        {/* ============ DAY / WEEK SELECTOR + CTA ============ */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
          <div className="flex items-center bg-[#05070D] p-1 rounded-[18px] h-14 border border-white/5 w-full sm:w-auto">
            {(["day", "week"] as const).map(v => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={cn(
                  "flex-1 sm:flex-initial sm:px-10 h-full rounded-[14px] text-xs font-black uppercase tracking-widest transition-all",
                  view === v
                    ? "bg-gradient-to-b from-[#F5C542] to-[#D4A017] text-black shadow-[0_0_20px_rgba(245,197,66,0.25)]"
                    : "text-slate-400 hover:bg-white/5 hover:text-white"
                )}
              >
                {v === "day" ? "Dia" : "Semana"}
              </button>
            ))}
          </div>

          <AppointmentModal
            open={isDialogOpen}
            onOpenChange={(open) => {
              setIsDialogOpen(open);
              if (!open) setModalInitialData({});
            }}
            initialDate={modalInitialData.date}
            initialTime={modalInitialData.time}
            initialStep={modalInitialData.step}
            editingAppointmentId={modalInitialData.editingId}
            onSuccess={() => fetchData()}
            trigger={
              <Button
                onClick={() => openNewAppointment()}
                className="gap-2 w-full sm:w-auto sm:px-8 h-[60px] rounded-[18px] bg-gradient-to-b from-[#F5C542] to-[#D4A017] text-black font-black text-base sm:text-lg shadow-[0_10px_30px_rgba(245,197,66,0.25)] hover:brightness-110 hover:-translate-y-0.5 active:translate-y-0 transition-all"
              >
                <Plus size={22} strokeWidth={3} /> Novo Agendamento
              </Button>
            }
          />
        </div>

        {/* ============ CALENDAR HEADER ============ */}
        <div className="rounded-3xl border border-[#F59E0B]/15 bg-[#0B1220] p-4 sm:p-6">
          <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 sm:gap-6">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setCurrentDate(subDays(currentDate, view === 'day' ? 1 : 7))}
              className="rounded-2xl border-white/10 bg-[#05070D] text-[#F5C542] hover:bg-[#F5C542]/10 hover:border-[#F5C542]/40 h-11 w-11 shrink-0"
            >
              <ChevronLeft size={22} />
            </Button>

            <div className="min-w-0 text-center">
              <div className="flex items-center justify-center gap-2 text-white">
                <CalendarIcon className="h-4 w-4 sm:h-5 sm:w-5 text-[#F5C542] shrink-0" />
                <h3 className="font-black capitalize tracking-tight text-[17px] sm:text-[22px] leading-tight break-words">
                  {format(currentDate, view === 'day' ? "EEEE, d 'de' MMMM" : "'Semana de' d 'de' MMMM", { locale: ptBR })}
                </h3>
              </div>
              <div className="mt-2 flex justify-center">
                {isToday ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-[#F5C542]/50 bg-transparent px-3 py-1 text-[10px] font-black uppercase tracking-widest text-[#F5C542]">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#F5C542] animate-pulse" /> Hoje
                  </span>
                ) : (
                  <button
                    onClick={() => setCurrentDate(new Date())}
                    className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-[#F5C542] transition-colors"
                  >
                    Voltar para hoje
                  </button>
                )}
              </div>
            </div>

            <Button
              variant="outline"
              size="icon"
              onClick={() => setCurrentDate(addDays(currentDate, view === 'day' ? 1 : 7))}
              className="rounded-2xl border-white/10 bg-[#05070D] text-[#F5C542] hover:bg-[#F5C542]/10 hover:border-[#F5C542]/40 h-11 w-11 shrink-0"
            >
              <ChevronRight size={22} />
            </Button>
          </div>
        </div>

        {/* ============ MOBILE LIST (DAY) ============ */}
        {view === 'day' && (
          <div className="md:hidden flex flex-col gap-3 animate-fade-in">
            {HOURS.map(hour => {
              const slotApps = getAppointmentsForTime(currentDate, hour);
              return (
                <div key={hour} className="flex gap-3">
                  <div className="w-14 shrink-0 pt-3 text-right">
                    <span className="text-[#F5C542] font-black text-base tracking-tight">
                      {hour.toString().padStart(2, '0')}:00
                    </span>
                  </div>
                  <div className="flex-1 min-w-0 flex flex-col gap-2">
                    {slotApps.length === 0 ? (
                      <button
                        onClick={() => openNewAppointment(currentDate, hour)}
                        className="flex items-center gap-2 text-left text-xs text-slate-500 italic py-4 px-4 rounded-2xl border border-dashed border-white/8 bg-white/[0.02] hover:border-[#F5C542]/30 hover:bg-[#F5C542]/[0.03] transition-all"
                      >
                        <CalendarIcon size={14} className="opacity-60" />
                        Nenhum atendimento
                      </button>
                    ) : (
                      slotApps.map(app => {
                        const sc = getCalendarStatusConfig(app.status);
                        return (
                          <div
                            key={app.id}
                            onClick={() => openDetails(app.id)}
                            className={cn(
                              "relative p-4 rounded-2xl border bg-[#0B1220] cursor-pointer flex flex-col gap-3 active:scale-[0.98] hover:-translate-y-0.5 transition-all shadow-lg overflow-hidden",
                              sc.ring
                            )}
                          >
                            <span className={cn("absolute left-0 top-3 bottom-3 w-1 rounded-r-full", sc.dot)} />
                            <div className="flex items-start justify-between gap-2 pl-2">
                              <div className="min-w-0">
                                <p className="font-black text-base text-white truncate">{app.customers?.name || "Cliente"}</p>
                                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 truncate mt-0.5">
                                  {app.services?.name || "Serviço"}
                                </p>
                              </div>
                              <span className={cn("shrink-0 rounded-full border px-2.5 py-1 text-[9px] font-black uppercase tracking-wider", sc.badge)}>
                                {sc.label}
                              </span>
                            </div>
                            <div className="flex items-center justify-between gap-2 pl-2 pt-2 border-t border-white/5">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <User size={12} className="text-[#F5C542] shrink-0" />
                                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300 truncate">
                                  {app.barbers?.name || "Barbeiro"}
                                </span>
                              </div>
                              <span className="text-sm font-black text-[#F5C542] shrink-0">
                                R$ {Number(app.total_price || 0).toFixed(2)}
                              </span>
                            </div>
                            {app.payment_method && (
                              <div className="pl-2 -mt-1">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                  {app.payment_method}
                                </span>
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ============ MOBILE LIST (WEEK) ============ */}
        {view === 'week' && (
          <div className="md:hidden flex flex-col gap-5 animate-fade-in">
            {weekDays.map(day => {
              const dayApps = appointments.filter(a => isSameDay(new Date(a.start_time), day));
              const dayIsToday = isSameDay(day, new Date());
              return (
                <div key={day.toString()} className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <p className={cn("font-black text-sm capitalize", dayIsToday ? "text-[#F5C542]" : "text-white")}>
                      {format(day, "EEEE, d 'de' MMM", { locale: ptBR })}
                    </p>
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                      {dayApps.length} agend.
                    </span>
                  </div>
                  {dayApps.length === 0 ? (
                    <div className="flex items-center gap-2 text-xs text-slate-500 italic py-3 px-4 rounded-2xl border border-dashed border-white/8 bg-white/[0.02]">
                      <CalendarIcon size={14} className="opacity-60" />
                      Nenhum atendimento
                    </div>
                  ) : (
                    dayApps.map(app => {
                      const sc = getCalendarStatusConfig(app.status);
                      return (
                        <div
                          key={app.id}
                          onClick={() => openDetails(app.id)}
                          className={cn("relative p-3 pl-4 rounded-2xl border bg-[#0B1220] cursor-pointer flex items-center justify-between gap-3 active:scale-[0.98] transition-all overflow-hidden", sc.ring)}
                        >
                          <span className={cn("absolute left-0 top-2 bottom-2 w-1 rounded-r-full", sc.dot)} />
                          <div className="min-w-0">
                            <p className="font-black text-sm text-white truncate">{format(parseISO(app.start_time), "HH:mm")} • {app.customers?.name || "Cliente"}</p>
                            <p className="text-[10px] uppercase tracking-wider text-slate-400 truncate">{app.services?.name || "Serviço"}</p>
                          </div>
                          <span className="text-sm font-black text-[#F5C542] shrink-0">R$ {Number(app.total_price || 0).toFixed(2)}</span>
                        </div>
                      );
                    })
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ============ DESKTOP VIEW ============ */}
        <Card className="hidden md:flex flex-1 overflow-hidden flex-col bg-[#0B1220] border border-[#F59E0B]/15 rounded-3xl shadow-2xl">
          <ScrollArea className="flex-1 overflow-x-auto">
            <div className="min-w-full">
              {view === 'day' ? (
                <div className="flex flex-col divide-y divide-white/5">
                  {HOURS.map(hour => {
                    const slotApps = getAppointmentsForTime(currentDate, hour);
                    return (
                      <div key={hour} className="flex group min-h-[110px]">
                        <div className="w-24 py-6 px-4 text-right text-sm text-slate-500 font-black border-r border-white/5 bg-[#05070D]/40">
                          {hour.toString().padStart(2, '0')}:00
                        </div>
                        <div
                          className="flex-1 p-3 relative flex flex-wrap gap-3 content-start bg-transparent transition-all cursor-pointer hover:bg-white/[0.02]"
                          onClick={() => openNewAppointment(currentDate, hour)}
                        >
                          {slotApps.length === 0 && (
                            <span className="text-xs text-slate-600 italic self-center">Clique para criar agendamento</span>
                          )}
                          {slotApps.map(app => {
                            const sc = getCalendarStatusConfig(app.status);
                            return (
                              <div
                                key={app.id}
                                onClick={(e) => { e.stopPropagation(); openDetails(app.id); }}
                                className={cn(
                                  "relative px-4 py-3 rounded-2xl border bg-[#0B1220] cursor-pointer transition-all duration-300 hover:scale-[1.03] hover:-translate-y-0.5 flex flex-col gap-2 min-w-[220px] shadow-lg overflow-hidden",
                                  sc.ring
                                )}
                              >
                                <span className={cn("absolute left-0 top-2 bottom-2 w-1 rounded-r-full", sc.dot)} />
                                <div className="flex items-center justify-between gap-2 pl-2">
                                  <span className="font-black tracking-tight text-xs text-white">
                                    {format(parseISO(app.start_time), "HH:mm")}
                                  </span>
                                  <span className={cn("rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-wider", sc.badge)}>
                                    {sc.label}
                                  </span>
                                </div>
                                <span className="font-black truncate text-sm leading-tight text-white pl-2">{app.customers?.name || "Cliente"}</span>
                                <div className="flex items-center gap-2 pl-2 text-slate-400">
                                  <Scissors size={12} />
                                  <span className="text-[10px] truncate font-bold uppercase tracking-wider">{app.services?.name || "Serviço"}</span>
                                </div>
                                <div className="mt-1 pt-2 pl-2 border-t border-white/5 flex items-center justify-between">
                                  <span className="text-[10px] font-black uppercase text-slate-400 truncate">{app.barbers?.name || "Barbeiro"}</span>
                                  <span className="text-xs font-black text-[#F5C542]">R$ {Number(app.total_price || 0).toFixed(2)}</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="grid grid-cols-7 divide-x divide-white/5">
                  {weekDays.map(day => (
                    <div key={day.toString()} className="flex flex-col">
                      <div className={cn("p-4 text-center border-b border-white/5", isSameDay(day, new Date()) ? "bg-[#F5C542]/10" : "bg-[#05070D]/40")}>
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">{format(day, "EEE", { locale: ptBR })}</p>
                        <p className={cn("text-xl font-black", isSameDay(day, new Date()) ? "text-[#F5C542]" : "text-white")}>{format(day, "d")}</p>
                      </div>
                      <div className="flex-1 divide-y divide-white/5 min-h-[700px]">
                        {HOURS.map(hour => (
                          <div
                            key={hour}
                            className="h-[80px] p-1.5 cursor-pointer hover:bg-[#F5C542]/5 transition-all"
                            onClick={() => openNewAppointment(day, hour)}
                          >
                            {getAppointmentsForTime(day, hour).map(app => {
                              const sc = getCalendarStatusConfig(app.status);
                              return (
                                <div
                                  key={app.id}
                                  onClick={(e) => { e.stopPropagation(); openDetails(app.id); }}
                                  className={cn(
                                    "relative p-2 pl-3 rounded-lg border bg-[#0B1220] cursor-pointer transition-all duration-300 hover:scale-[1.05] flex flex-col gap-0.5 mb-1 overflow-hidden",
                                    sc.ring
                                  )}
                                >
                                  <span className={cn("absolute left-0 top-1 bottom-1 w-0.5 rounded-r-full", sc.dot)} />
                                  <span className="font-black text-[10px] leading-tight text-white truncate">{app.customers?.name || "Cliente"}</span>
                                  <span className="opacity-70 text-[9px] truncate font-bold uppercase tracking-tighter text-slate-400">{app.services?.name || "Serviço"}</span>
                                </div>
                              );
                            })}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </ScrollArea>
        </Card>
      </div>

      <AppointmentDetailsModal
        open={detailsModalOpen}
        onOpenChange={setDetailsModalOpen}
        appointmentId={selectedAppointmentId}
        onSuccess={() => fetchData()}
        onReschedule={(app) => {
          setRescheduleAppt(app);
          setRescheduleOpen(true);
        }}
      />

      <RescheduleWizard
        open={rescheduleOpen}
        onOpenChange={setRescheduleOpen}
        appointment={
          rescheduleAppt
            ? {
                id: rescheduleAppt.id,
                tenant_id: rescheduleAppt.tenant_id || rescheduleAppt.user_id,
                customer_id: rescheduleAppt.customer_id,
                customer_name: rescheduleAppt.customer_name || rescheduleAppt.customers?.name,
                customer_phone: rescheduleAppt.customer_phone || rescheduleAppt.customers?.phone,
                service_id: rescheduleAppt.service_id,
                service_name: rescheduleAppt.service_name || rescheduleAppt.services?.name,
                service_price: rescheduleAppt.total_price || rescheduleAppt.services?.price,
                payment_method: rescheduleAppt.payment_method,
                barber_id: rescheduleAppt.barber_id,
                barber_name: rescheduleAppt.barber_name || rescheduleAppt.barbers?.name,
                start_time: rescheduleAppt.start_time,
                end_time: rescheduleAppt.end_time,
                management_token: rescheduleAppt.management_token,
                appointment_group_id: rescheduleAppt.appointment_group_id,
              }
            : null
        }
        actor={role === "barber" ? "barber" : role === "reception" ? "reception" : role === "manager" ? "manager" : "admin"}
        actorId={user?.id}
        source="admin_calendar"
        onSuccess={() => fetchData()}
      />
    </AppLayout>
  );
}
