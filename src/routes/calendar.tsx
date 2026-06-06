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
      className: 'bg-emerald-600/20 text-emerald-400 border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.1)]'
    };
  }

  if (['cancelled', 'canceled', 'cancelado'].includes(normalized)) {
    return {
      label: 'Cancelado',
      className: 'bg-red-600/20 text-red-400 border-red-500/30 shadow-[0_0_15px_rgba(239,68,68,0.1)]'
    };
  }

  if (['confirmed', 'confirmado'].includes(normalized)) {
    return {
      label: 'Confirmado',
      className: 'bg-yellow-600/20 text-yellow-400 border-yellow-500/30 shadow-[0_0_15px_rgba(234,179,8,0.1)]'
    };
  }

  if (['rescheduled', 'reagendado'].includes(normalized)) {
    return {
      label: 'Reagendado',
      className: 'bg-purple-600/20 text-purple-400 border-purple-500/30 shadow-[0_0_15px_rgba(168,85,247,0.1)]'
    };
  }

  if (['awaiting_payment'].includes(normalized)) {
    return {
      label: 'Pgto Pendente',
      className: 'bg-amber-600/20 text-amber-400 border-amber-500/30 shadow-[0_0_15px_rgba(245,158,11,0.1)]'
    };
  }

  return {
    label: 'Pendente',
    className: 'bg-blue-600/20 text-blue-400 border-blue-500/30 shadow-[0_0_15px_rgba(59,130,246,0.1)]'
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
      .select("*, customers(name, phone, avatar_url), services(name, duration_minutes), barbers(name)")
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
    return appointments.filter(app => {
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

  if (loading || !user) return null;

  return (
    <AppLayout>
      <div className="flex flex-col h-full space-y-6 bg-[#05070d] p-4 md:p-8 rounded-2xl min-h-screen text-white">
        {!canAddAppointment && (
          <Alert className="bg-amber-950/30 border-amber-900/50">
            <Crown className="h-4 w-4 text-[#D4AF37]" />
            <AlertTitle className="text-[#D4AF37]">Limite de Agendamentos</AlertTitle>
            <AlertDescription className="flex items-center justify-between text-gray-400">
              Você atingiu o limite mensal de {limits.monthlyAppointments} agendamentos.
              <Button variant="link" size="sm" asChild className="p-0 h-auto text-[#D4AF37] font-bold underline">
                <Link to="/subscription">Fazer Upgrade</Link>
              </Button>
            </AlertDescription>
          </Alert>
        )}

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 bg-[#0b0f17] p-8 rounded-2xl border border-[#D4AF37]/20 shadow-xl">
          <div>
            <h2 className="text-3xl font-black flex items-center gap-4 text-white tracking-tight">
              <CalendarIcon className="text-[#D4AF37] h-8 w-8" />
              Agenda
            </h2>
            <div className="flex items-center gap-4 mt-2">
               <p className="text-gray-400 text-sm font-medium">
                 {appointments.length} atendimentos hoje • <span className="text-[#D4AF37] font-black">R$ {appointments.reduce((acc, a) => acc + Number(a.total_price || 0), 0).toFixed(2)}</span>
               </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center bg-[#05070d] p-1.5 rounded-xl border border-[#D4AF37]/10">
              <Button 
                variant={view === "day" ? "default" : "ghost"} 
                size="sm" 
                onClick={() => setView("day")}
                className={cn(
                  "rounded-lg h-9 px-8 font-black text-xs uppercase tracking-wider transition-all", 
                  view === "day" ? "bg-[#D4AF37] text-black shadow-lg hover:bg-[#D4AF37]" : "text-gray-500 hover:text-white"
                )}
              >
                Dia
              </Button>
              <Button 
                variant={view === "week" ? "default" : "ghost"} 
                size="sm" 
                onClick={() => setView("week")}
                className={cn(
                  "rounded-lg h-9 px-8 font-black text-xs uppercase tracking-wider transition-all", 
                  view === "week" ? "bg-[#D4AF37] text-black shadow-lg hover:bg-[#D4AF37]" : "text-gray-500 hover:text-white"
                )}
              >
                Semana
              </Button>
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
                  className="gap-2 bg-[#D4AF37] text-black hover:bg-[#B8962E] font-black transition-all duration-300 hover:scale-[1.05] active:scale-[0.95] rounded-xl h-11 px-8 shadow-[0_0_20px_rgba(212,175,55,0.2)]" 
                  onClick={() => {
                    setModalInitialData({ editingId: undefined });
                    setIsDialogOpen(true);
                  }}
                >
                  <Plus size={20} /> <span className="uppercase text-xs tracking-widest">Novo Agendamento</span>
                </Button>
              }
            />
          </div>
        </div>

        <Card className="flex-1 overflow-hidden flex flex-col bg-[#0b0f17] border border-[#D4AF37]/20 rounded-2xl shadow-2xl">
          <div className="p-6 border-b border-[#D4AF37]/10 flex items-center justify-between bg-[#0b0f17]">
            <div className="flex items-center gap-8">
              <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" className="rounded-xl border-[#D4AF37]/20 hover:border-[#D4AF37] hover:bg-[#D4AF37]/10 transition-all h-10 w-10 text-[#D4AF37]" onClick={() => setCurrentDate(subDays(currentDate, view === 'day' ? 1 : 7))}>
                  <ChevronLeft size={20} />
                </Button>
                <Button variant="outline" size="icon" className="rounded-xl border-[#D4AF37]/20 hover:border-[#D4AF37] hover:bg-[#D4AF37]/10 transition-all h-10 w-10 text-[#D4AF37]" onClick={() => setCurrentDate(addDays(currentDate, view === 'day' ? 1 : 7))}>
                  <ChevronRight size={20} />
                </Button>
              </div>
              <h3 className="font-black text-xl min-w-[300px] text-center capitalize tracking-tight text-white">
                {format(currentDate, view === 'day' ? "EEEE, d 'de' MMMM" : "'Semana de' d 'de' MMMM", { locale: ptBR })}
              </h3>
            </div>
            <div className="flex items-center gap-3">
               <Button variant="ghost" size="sm" className="font-black text-[10px] uppercase tracking-widest text-[#D4AF37] hover:bg-[#D4AF37]/10 rounded-xl px-6" onClick={() => setCurrentDate(new Date())}>Hoje</Button>
            </div>
          </div>

          <ScrollArea className="flex-1 overflow-x-auto">
            <div className="min-w-full sm:min-w-[700px] lg:min-w-0">
              {view === 'day' ? (
                <div className="flex flex-col divide-y divide-[#D4AF37]/5">
                  {HOURS.map(hour => (
                    <div key={hour} className="flex group min-h-[120px]">
                      <div className="w-28 py-8 px-6 text-right text-sm text-gray-500 font-black border-r border-[#D4AF37]/10 bg-[#05070d]/30">
                        {hour.toString().padStart(2, '0')}:00
                      </div>
                      <div 
                        className="flex-1 p-4 relative gap-4 flex flex-row sm:flex-wrap overflow-x-auto sm:overflow-x-visible content-start bg-[#0b0f17] transition-all cursor-pointer hover:bg-[#05070d] snap-x snap-mandatory"
                        onClick={() => {
                          setModalInitialData({ time: `${hour.toString().padStart(2, '0')}:00`, date: format(currentDate, "yyyy-MM-dd"), step: 1, editingId: undefined });
                          setIsDialogOpen(true);
                        }}
                      >
                        {getAppointmentsForTime(currentDate, hour).map(app => {
                          const statusConfig = getCalendarStatusConfig(app.status);
                          
                          return (
                            <div 
                              key={app.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedAppointmentId(app.id);
                                setDetailsModalOpen(true);
                              }}
                              className={cn(
                                "px-5 py-4 rounded-2xl shadow-2xl border-2 cursor-pointer transition-all duration-300 hover:scale-[1.05] flex flex-col gap-2 min-w-[280px] sm:min-w-[220px] snap-center shrink-0",
                                statusConfig.className
                              )}
                            >
                              <div className="flex items-center justify-between gap-3">
                                <span className="font-black tracking-tight text-xs">
                                  {format(parseISO(app.start_time), "HH:mm")}
                                </span>
                                <Badge className="bg-white/10 hover:bg-white/20 text-white border-none text-[9px] font-black uppercase px-2 py-0.5 rounded-md">
                                  {statusConfig.label}
                                </Badge>
                              </div>
                              <span className="font-black truncate text-sm leading-tight text-white mt-1">{app.customers?.name || "Cliente"}</span>
                              <div className="flex items-center gap-2 opacity-80">
                                <Scissors size={12} />
                                <span className="text-[10px] truncate font-bold uppercase tracking-wider">{app.services?.name || "Serviço"}</span>
                              </div>
                              <div className="mt-2 pt-2 border-t border-white/10 flex items-center justify-between">
                                <span className="text-[10px] font-black uppercase text-white/60">{app.barbers?.name || "Barbeiro"}</span>
                                <span className="text-xs font-black text-white">R$ {Number(app.total_price || 0).toFixed(2)}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-7 divide-x divide-[#D4AF37]/5">
                  {weekDays.map(day => (
                    <div key={day.toString()} className="flex flex-col">
                      <div className="p-4 text-center border-b border-[#D4AF37]/10 bg-[#05070d]/50">
                        <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">{format(day, "EEE", { locale: ptBR })}</p>
                        <p className="text-xl font-black text-white">{format(day, "d")}</p>
                      </div>
                      <div className="flex-1 divide-y divide-[#D4AF37]/5 min-h-[700px]">
                        {HOURS.map(hour => (
                          <div 
                            key={hour} 
                            className="h-[80px] p-2 cursor-pointer hover:bg-[#D4AF37]/5 transition-all border-b border-[#D4AF37]/5"
                            onClick={() => {
                              setModalInitialData({ time: `${hour.toString().padStart(2, '0')}:00`, date: format(day, "yyyy-MM-dd"), step: 1, editingId: undefined });
                              setIsDialogOpen(true);
                            }}
                          >
                             {getAppointmentsForTime(day, hour).map(app => {
                              const statusConfig = getCalendarStatusConfig(app.status);

                              return (
                                <div 
                                  key={app.id}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedAppointmentId(app.id);
                                    setDetailsModalOpen(true);
                                  }}
                                  className={cn(
                                    "p-2 rounded-lg shadow-xl border-2 cursor-pointer transition-all duration-300 hover:scale-[1.05] flex flex-col gap-1 mb-1 overflow-hidden",
                                    statusConfig.className
                                  )}
                                >
                                  <span className="font-black text-[9px] leading-tight text-white">{app.customers?.name || "Cliente"}</span>
                                  <span className="opacity-80 text-[8px] truncate font-bold uppercase tracking-tighter">{app.services?.name || "Serviço"}</span>
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
          setModalInitialData({ 
            date: format(parseISO(app.start_time), "yyyy-MM-dd"), 
            time: format(parseISO(app.start_time), "HH:mm"), 
            step: 1, 
            editingId: app.id 
          });
          setIsDialogOpen(true);
        }}
      />
    </AppLayout>
  );
}
