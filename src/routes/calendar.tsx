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

const HOURS = Array.from({ length: 13 }, (_, i) => i + 8); // 8:00 to 20:00

function CalendarComponent() {
  const { user: authUser, loading: authLoading, role: authRole } = useAuth();
  const { session, loading: profLoading } = useProfessionalAuth();
  const navigate = useNavigate();

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

      let channel: any;
      if (user) {
        channel = supabase
          .channel('calendar-realtime')
          .on('postgres_changes', { 
            event: '*', 
            schema: 'public', 
            table: 'appointments',
            filter: role === 'barber' ? `barber_id=eq.${user.id}` : undefined
          }, () => {
            fetchData();
            refreshLimits();
          })
          .subscribe();
      }
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

    if (appRes.data) setAppointments(appRes.data);
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
      <div className="flex flex-col h-full space-y-6 bg-white p-4 md:p-8 rounded-2xl">
        {!canAddAppointment && (
          <Alert className="bg-amber-50 border-amber-200">
            <Crown className="h-4 w-4 text-amber-600" />
            <AlertTitle className="text-amber-800">Limite de Agendamentos</AlertTitle>
            <AlertDescription className="flex items-center justify-between text-amber-700">
              Você atingiu o limite mensal de {limits.monthlyAppointments} agendamentos.
              <Button variant="link" size="sm" asChild className="p-0 h-auto text-amber-900 font-bold underline">
                <Link to="/subscription">Fazer Upgrade</Link>
              </Button>
            </AlertDescription>
          </Alert>
        )}

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h2 className="text-3xl font-black flex items-center gap-3 text-zinc-900">
              <CalendarIcon className="text-sky-500 h-8 w-8" />
              Agenda
            </h2>
            <p className="text-zinc-500 font-medium mt-1">Gerencie os agendamentos da barbearia</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center bg-zinc-100 p-1 rounded-xl border border-zinc-200">
              <Button 
                variant={view === "day" ? "default" : "ghost"} 
                size="sm" 
                onClick={() => setView("day")}
                className={cn("rounded-lg h-9 px-6 font-bold transition-all", view === "day" ? "bg-white text-sky-600 shadow-sm hover:bg-white" : "text-zinc-500 hover:text-zinc-900")}
              >
                Dia
              </Button>
              <Button 
                variant={view === "week" ? "default" : "ghost"} 
                size="sm" 
                onClick={() => setView("week")}
                className={cn("rounded-lg h-9 px-6 font-bold transition-all", view === "week" ? "bg-white text-sky-600 shadow-sm hover:bg-white" : "text-zinc-500 hover:text-zinc-900")}
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
                  className="gap-2 bg-sky-500 text-white hover:bg-sky-600 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 rounded-xl h-11 px-6 shadow-md shadow-sky-200" 
                  variant={canAddAppointment ? "default" : "secondary"}
                  onClick={() => {
                    setModalInitialData({ editingId: undefined });
                    setIsDialogOpen(true);
                  }}
                >
                  <Plus size={20} /> <span className="font-bold">Novo Agendamento</span>
                </Button>
              }
            />
          </div>
        </div>

        <Card className="flex-1 overflow-hidden flex flex-col bg-white border border-zinc-200 rounded-2xl shadow-md shadow-zinc-200/70 text-zinc-900">
          <div className="p-5 border-b border-zinc-100 flex items-center justify-between bg-white">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" className="rounded-xl border-zinc-200 hover:border-sky-300 hover:bg-sky-50 transition-all h-9 w-9" onClick={() => setCurrentDate(subDays(currentDate, view === 'day' ? 1 : 7))}>
                  <ChevronLeft size={18} />
                </Button>
                <Button variant="outline" size="icon" className="rounded-xl border-zinc-200 hover:border-sky-300 hover:bg-sky-50 transition-all h-9 w-9" onClick={() => setCurrentDate(addDays(currentDate, view === 'day' ? 1 : 7))}>
                  <ChevronRight size={18} />
                </Button>
              </div>
              <h3 className="font-bold text-lg min-w-[240px] text-center capitalize tracking-tight text-zinc-900">
                {format(currentDate, view === 'day' ? "EEEE, d 'de' MMMM" : "'Semana de' d 'de' MMMM", { locale: ptBR })}
              </h3>
            </div>
            <Button variant="ghost" size="sm" className="font-semibold text-sky-600 hover:bg-sky-50 rounded-xl" onClick={() => setCurrentDate(new Date())}>Hoje</Button>
          </div>

          <ScrollArea className="flex-1">
            <div className="min-w-[800px] md:min-w-0">
              {view === 'day' ? (
                <div className="flex flex-col divide-y divide-zinc-100">
                  {HOURS.map(hour => (
                    <div key={hour} className="flex group min-h-[100px]">
                      <div className="w-24 py-6 px-4 text-right text-xs text-zinc-400 font-semibold border-r border-zinc-100 bg-zinc-50/50">
                        {hour.toString().padStart(2, '0')}:00
                      </div>
                      <div 
                        className="flex-1 p-3 relative gap-3 flex flex-wrap content-start bg-white transition-all cursor-pointer hover:bg-zinc-50"
                        onClick={() => {
                          setModalInitialData({ time: `${hour.toString().padStart(2, '0')}:00`, date: format(currentDate, "yyyy-MM-dd"), step: 1, editingId: undefined });
                          setIsDialogOpen(true);
                        }}
                      >
                        {getAppointmentsForTime(currentDate, hour).map(app => (
                          <div 
                            key={app.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedAppointmentId(app.id);
                              setDetailsModalOpen(true);
                            }}
                            className={cn(
                              "px-3 py-2 rounded-xl shadow-lg border-2 cursor-pointer transition-all duration-300 hover:scale-[1.05] hover:shadow-xl flex flex-col gap-1 min-w-[180px]",
                              app.status === 'confirmed' ? "bg-emerald-500 border-emerald-400 text-white" :
                              app.status === 'scheduled' ? "bg-blue-500 border-blue-400 text-white" :
                              app.status === 'awaiting_payment' ? "bg-amber-500 border-amber-400 text-white" :
                              app.status === 'cancelled' ? "bg-red-500 border-red-400 text-white" :
                              app.status === 'completed' ? "bg-sky-500 border-sky-400 text-white" :
                              "bg-blue-600 border-blue-500 text-white"
                            )}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-black tracking-tight text-[11px]">
                                {format(parseISO(app.start_time), "HH:mm")}
                              </span>
                              <Badge className="bg-white/20 hover:bg-white/30 text-white border-none text-[8px] font-black uppercase px-1.5 py-0">
                                {app.status === 'confirmed' ? 'Confirmado' : app.status === 'scheduled' ? 'Agendado' : 'Pendente'}
                              </Badge>
                            </div>
                            <span className="font-bold truncate text-[12px] leading-none mt-0.5">{app.customers?.name || "Cliente"}</span>
                            <span className="opacity-90 text-[10px] truncate font-medium">{app.services?.name || "Serviço"}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-7 divide-x divide-zinc-100">
                  {weekDays.map(day => (
                    <div key={day.toString()} className="flex flex-col">
                      <div className="p-3 text-center border-b border-zinc-100 bg-zinc-50/50">
                        <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">{format(day, "EEE", { locale: ptBR })}</p>
                        <p className="text-lg font-bold text-zinc-900">{format(day, "d")}</p>
                      </div>
                      <div className="flex-1 divide-y divide-zinc-100 min-h-[600px]">
                        {HOURS.map(hour => (
                          <div 
                            key={hour} 
                            className="h-[60px] p-1 cursor-pointer hover:bg-zinc-50 transition-colors border-b border-zinc-100"
                            onClick={() => {
                              setModalInitialData({ time: `${hour.toString().padStart(2, '0')}:00`, date: format(day, "yyyy-MM-dd"), step: 1, editingId: undefined });
                              setIsDialogOpen(true);
                            }}
                          >
                             {getAppointmentsForTime(day, hour).map(app => (
                              <div 
                                key={app.id}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedAppointmentId(app.id);
                                  setDetailsModalOpen(true);
                                }}
                                className={cn(
                                  "h-full p-2 rounded-lg shadow-md border-2 text-[10px] flex flex-col justify-center gap-0.5 transition-all duration-300 hover:scale-[1.05] hover:z-10 hover:shadow-lg",
                                  app.status === 'confirmed' ? "bg-emerald-500 border-emerald-400 text-white" :
                                  app.status === 'scheduled' ? "bg-blue-500 border-blue-400 text-white" :
                                  app.status === 'awaiting_payment' ? "bg-amber-500 border-amber-400 text-white" :
                                  app.status === 'cancelled' ? "bg-red-500 border-red-400 text-white" :
                                  app.status === 'completed' ? "bg-sky-500 border-sky-400 text-white" :
                                  "bg-blue-600 border-blue-500 text-white"
                                )}
                              >
                                <div className="font-black text-[8px] opacity-80">{format(parseISO(app.start_time), "HH:mm")}</div>
                                <div className="font-bold truncate leading-none">{app.customers?.name}</div>
                              </div>
                             ))}
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
      </div>
    </AppLayout>
  );
}
