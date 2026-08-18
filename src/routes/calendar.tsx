import * as React from "react";
import { memo } from "react";
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
  RefreshCcw,
  UserPlus,
  HelpCircle
} from "lucide-react";
import { AppointmentModal } from "@/components/calendar/AppointmentModal";
import { AppointmentDetailsModal } from "@/components/calendar/AppointmentDetailsModal";
import { WalkinModal } from "@/components/calendar/WalkinModal";
import { WalkinQueuePanel } from "@/components/calendar/WalkinQueuePanel";
import { RescheduleWizard } from "@/components/reschedule/RescheduleWizard";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/hooks/use-auth";
import { useTenant } from "@/hooks/use-tenant";
import { useProfessionalAuth } from "@/components/professional/ProfessionalAuthProvider";
import { usePlanLimits } from "@/hooks/use-plan-limits";
import { useEffect, useState, useMemo } from "react";
import { useNavigate, Link, createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { HelpDrawer } from "@/components/help-center/HelpDrawer";
import { GuidedTour } from "@/components/help-center/GuidedTour";
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

const calendarHelpConfig = {
  moduleKey: 'calendar',
  routePath: '/calendar',
  title: 'Gestão da Agenda',
  summary: 'Visualize e gerencie todos os agendamentos da sua barbearia em tempo real.',
  videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
  faqs: [
    { question: 'Como marcar um Walk-in?', answer: 'Clique no botão "+" no topo e escolha "Adicionar Fila de Espera".' },
    { question: 'Posso bloquear horários?', answer: 'Sim, clique no horário desejado e selecione "Bloquear Horário" para folgas ou manutenções.' }
  ],
  commonIssues: [
    { issue: 'Horário indisponível mas aparece livre', solution: 'Verifique se o profissional vinculado ao serviço possui escala definida para este dia.' }
  ]
};

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
  return {
    label: 'Agendado',
    badge: 'bg-orange-500/20 text-orange-300 border-orange-500/40',
    ring: 'border-orange-500/30',
    dot: 'bg-orange-500',
  };
}


const calendarTourConfig = {
  key: 'calendar-tour',
  version: '1.0.0',
  steps: [
    {
      target: '[data-tour="calendar-view"]',
      title: 'A Agenda Principal',
      description: 'Aqui você vê todos os agendamentos organizados por profissional e horário.',
      position: 'bottom' as const
    },
    {
      target: '[data-tour="calendar-actions"]',
      title: 'Ações Rápidas',
      description: 'Use estes botões para criar agendamentos, check-ins ou gerenciar a fila de espera.',
      position: 'bottom' as const
    }
  ]
};

const CalendarComponent = memo(() => {
  const { user: authUser, loading: authLoading, role: authRole } = useAuth();
  const { tenantId } = useTenant();
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
  const [isWalkinOpen, setIsWalkinOpen] = useState(false);
  const [modalInitialData, setModalInitialData] = useState<{date?: string, time?: string, step?: number, editingId?: string}>({});
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [rescheduleAppt, setRescheduleAppt] = useState<any>(null);
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(false);

  const canAddAppointment = checkLimit("monthlyAppointments");

  useEffect(() => {
    if (!loading && !user) {
      console.warn('[AUTH_REDIRECT_TRACE]', 'No user found in CalendarComponent, redirecting to /auth', {
        pathname: window.location.pathname,
        timestamp: Date.now()
      });
      window.location.href = "/auth";
      return;
    }

    if (!loading && user && role === 'super_admin') {
      navigate({ to: "/admin" });
      return;
    }
  }, [user, loading, role, navigate]);

  async function fetchData() {
    if (!user) return;

    const start = startOfDay(view === "day" ? currentDate : startOfWeek(currentDate, { weekStartsOn: 0 }));
    const end = endOfDay(view === "day" ? currentDate : endOfWeek(currentDate, { weekStartsOn: 0 }));

    let appQuery = supabase
      .from("appointments")
      .select("*, customers(*), services(*), barbers(*)")
      .eq("tenant_id", tenantId)
      .in("status", ["scheduled", "confirmed", "completed", "cancelled", "no_show", "pending", "in_progress"])
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
      supabase.from("barbers").select("*").eq("tenant_id", tenantId).order("name"),
      supabase.from("customers").select("*").eq("tenant_id", tenantId).order("name"),
      supabase.from("services").select("*").eq("tenant_id", tenantId).eq("active", true).order("name"),
    ]);

    if (appRes.error) {
      console.error("[Calendar] Fetch appointments error:", appRes.error);
    }

    if (appRes.data) setAppointments(appRes.data);
    if (barbRes.data) setBarbers(barbRes.data);
    if (custRes.data) setCustomers(custRes.data);
    if (servRes.data) setServices(servRes.data);
  }

  useEffect(() => {
    if (!user || role === 'super_admin') return;

    fetchData();

    const channelTenantId = tenantId || user.id;
    const channel = supabase
      .channel(`appointments-calendar-${channelTenantId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'appointments', filter: `tenant_id=eq.${channelTenantId}` },
        () => {
          fetchData();
          refreshLimits();
          queryClient.invalidateQueries({ queryKey: ['appointments'] });
          queryClient.invalidateQueries({ queryKey: ['calendar'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, currentDate, view]);

  const isToday = isSameDay(currentDate, new Date());
  const todayApps = useMemo(() => appointments.filter(a => isSameDay(new Date(a.start_time), currentDate)), [appointments, currentDate]);
  const todayRevenue = useMemo(() => todayApps.reduce((acc, a) => acc + Number(a.total_price || 0), 0), [todayApps]);

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

  return (
    <AppLayout>
      <GuidedTour config={calendarTourConfig} />
      <div className="flex flex-col h-full space-y-4 bg-[#05070d] p-3 md:p-8 min-h-screen text-white max-w-full overflow-x-hidden">
        <div className="flex justify-between items-center mb-2">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-gold">Agenda</h1>
          </div>
          <HelpDrawer config={calendarHelpConfig} />
        </div>

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

        <div className="relative overflow-hidden rounded-3xl border border-[#F59E0B]/15 bg-[#0B1220] p-5 shadow-[0_10px_40px_-10px_rgba(245,158,11,0.25)]">
          <div className="relative flex items-start gap-4">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-[#F5C542] to-[#D4A017] text-black shadow-[0_0_20px_rgba(245,197,66,0.35)]">
              <CalendarIcon className="h-6 w-6" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-2xl font-black text-white tracking-tight">Agenda</h2>
              <p className="text-gray-400 text-xs font-medium mt-2">
                <span className="text-white font-bold">{todayApps.length}</span> atendimentos • R$ {todayRevenue.toFixed(2)}
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex items-center bg-[#05070D] p-1 rounded-[18px] h-14 border border-white/5 w-full sm:w-auto">
            {(["day", "week"] as const).map(v => (
              <button key={v} onClick={() => setView(v)} className={cn("flex-1 sm:px-10 h-full rounded-[14px] text-xs font-black uppercase tracking-widest transition-all", view === v ? "bg-gold text-black shadow-lg" : "text-slate-400")}>
                {v === "day" ? "Dia" : "Semana"}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <Button onClick={() => openNewAppointment()} className="flex-1 h-[60px] rounded-[18px] bg-gold text-black font-black">
              <Plus className="mr-2" /> Novo Agendamento
            </Button>
            <Button onClick={() => setIsWalkinOpen(true)} className="flex-1 h-[60px] rounded-[18px] bg-emerald-600 text-white font-black">
              <UserPlus className="mr-2" /> Walk-in
            </Button>
          </div>
        </div>

        {isToday && view === 'day' && <WalkinQueuePanel tenantId={user.id} date={currentDate} refreshKey={appointments.length} onChange={() => fetchData()} />}

        <div className="rounded-3xl border border-[#F59E0B]/15 bg-[#0B1220] p-4">
          <div className="flex items-center justify-between gap-3">
            <Button variant="outline" size="icon" onClick={() => setCurrentDate(subDays(currentDate, view === 'day' ? 1 : 7))} className="rounded-2xl border-white/10 text-gold h-11 w-11"><ChevronLeft /></Button>
            <h3 className="font-black capitalize tracking-tight text-lg">{format(currentDate, view === 'day' ? "EEEE, d 'de' MMMM" : "'Semana de' d 'de' MMMM", { locale: ptBR })}</h3>
            <Button variant="outline" size="icon" onClick={() => setCurrentDate(addDays(currentDate, view === 'day' ? 1 : 7))} className="rounded-2xl border-white/10 text-gold h-11 w-11"><ChevronRight /></Button>
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="space-y-4 pb-10">
            {appointments.length === 0 ? (
              <Card className="glass border-white/5 bg-[#0B1220] rounded-[32px] overflow-hidden">
                <CardContent className="flex flex-col items-center justify-center py-20">
                  <CalendarIcon className="h-16 w-16 text-[#F59E0B]/20 mb-4" />
                  <p className="text-slate-500 font-bold uppercase tracking-[0.2em] text-xs">Nenhum atendimento</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {appointments.map(appt => (
                  <div key={appt.id} onClick={() => { setSelectedAppointmentId(appt.id); setDetailsModalOpen(true); }} className="group relative flex items-center gap-4 p-4 rounded-3xl border border-white/5 bg-[#0B1220] hover:bg-white/[0.04] transition-all cursor-pointer">
                    <div className="w-16 flex flex-col items-center">
                      <span className="text-sm font-black text-white">{format(new Date(appt.start_time), 'HH:mm')}</span>
                      <span className="text-[10px] text-slate-500 font-bold">{format(new Date(appt.end_time), 'HH:mm')}</span>
                    </div>
                    <div className="flex-1">
                      <p className="font-black text-white italic uppercase tracking-tight">{appt.customers?.name || 'Cliente Final'}</p>
                      <p className="text-xs text-slate-400 font-bold">{appt.services?.name} • {appt.barbers?.name}</p>
                    </div>
                    <Badge className={cn("font-black uppercase text-[9px]", getCalendarStatusConfig(appt.status).badge)}>{getCalendarStatusConfig(appt.status).label}</Badge>
                  </div>
                ))}
              </div>
            )}
          </div>
        </ScrollArea>
        <AppointmentModal open={isDialogOpen} onOpenChange={setIsDialogOpen} initialDate={modalInitialData.date} initialTime={modalInitialData.time} onSuccess={fetchData} />
        <AppointmentDetailsModal open={detailsModalOpen} onOpenChange={setDetailsModalOpen} appointmentId={selectedAppointmentId} onSuccess={fetchData} onReschedule={(appt) => { setRescheduleAppt(appt); setRescheduleOpen(true); }} />
        <WalkinModal open={isWalkinOpen} onOpenChange={setIsWalkinOpen} onSuccess={fetchData} />
        <RescheduleWizard open={rescheduleOpen} onOpenChange={setRescheduleOpen} appointment={rescheduleAppt} onSuccess={fetchData} actor={role === "barber" ? "barber" : "admin"} actorId={user?.id} source="admin_calendar" />
      </div>
    </AppLayout>
  );
});

export const Route = createFileRoute("/calendar")({
  component: () => <CalendarComponent />,
});
