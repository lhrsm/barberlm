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

const PROFESSIONAL_COLORS: Record<string, string> = {
  0: "bg-blue-600 hover:bg-blue-700",
  1: "bg-purple-600 hover:bg-purple-700",
  2: "bg-emerald-600 hover:bg-emerald-700",
  3: "bg-orange-600 hover:bg-orange-700",
  4: "bg-pink-600 hover:bg-pink-700",
  5: "bg-cyan-600 hover:bg-cyan-700",
};

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

  const handleMarkAsPaid = async (appointment: any) => {
    if (!user) return;
    const canManage = role === 'admin' || role === 'tenant_admin' || role === 'super_admin' || appointment.barber_id === user.id;
    if (!canManage) {
      toast.error("Você não tem permissão para alterar este agendamento.");
      return;
    }

    setIsLoading(true);
    try {
      const { data: customerData } = await supabase
        .from("customers")
        .select("credits, name")
        .eq("id", appointment.customer_id)
        .single();
      
      const availableCredits = Number(customerData?.credits || 0);

      const { error: updateErr } = await supabase
        .from("appointments")
        .update({ payment_status: 'paid', status: 'completed' })
        .eq("id", appointment.id);

      if (updateErr) throw updateErr;

      await fetchData();

      let items = appointment.items || [];
      if (items.length === 0 && appointment.service_id) {
        items = [{
          id: appointment.service_id,
          name: appointment.services?.name || 'Serviço',
          type: 'service',
          price: appointment.total_price,
          quantity: 1
        }];
      }

      const serviceItem = items.find((i: any) => i.type === 'service');
      const productItems = items.filter((i: any) => i.type === 'product');

      if (serviceItem) {
        const totalPrice = serviceItem.price;
        const usedCredits = Math.min(availableCredits, totalPrice);
        const remainingToPay = totalPrice - usedCredits;

        if (usedCredits > 0) {
          await Promise.all([
            supabase.from("customers").update({ credits: availableCredits - usedCredits }).eq("id", appointment.customer_id),
            supabase.from("appointments").update({ credit_used: usedCredits, final_amount: remainingToPay, barbershop_amount: remainingToPay }).eq("id", appointment.id)
          ]);
        } else {
          await supabase.from("appointments").update({ final_amount: totalPrice, barbershop_amount: totalPrice }).eq("id", appointment.id);
        }

        const creditText = usedCredits > 0 ? ` (Abatimento Créditos: R$ ${usedCredits.toFixed(2)})` : "";
        await supabase.from("transactions").insert({
          user_id: user.id,
          barber_id: appointment.barber_id,
          appointment_id: appointment.id,
          type: "income",
          category: "Serviço",
          amount: remainingToPay,
          description: `Pagamento${creditText}: ${serviceItem.name} - Cliente: ${customerData?.name}`,
          date: format(parseISO(appointment.start_time), "yyyy-MM-dd"),
          time: format(parseISO(appointment.start_time), "HH:mm:ss")
        });
      }

      for (const item of productItems) {
        await supabase.from("transactions").insert({
          user_id: user.id,
          barber_id: appointment.barber_id,
          appointment_id: appointment.id,
          type: "income",
          category: "Produtos",
          amount: item.price * (item.quantity || 1),
          description: `Venda de Produto (Local): ${item.name} (x${item.quantity || 1}) - Cliente: ${customerData?.name}`,
          date: format(parseISO(appointment.start_time), "yyyy-MM-dd"),
          time: format(parseISO(appointment.start_time), "HH:mm:ss")
        });

        await supabase.from("product_sales").insert([{
          user_id: user.id,
          barber_id: appointment.barber_id,
          customer_id: appointment.customer_id,
          total_amount: item.price * (item.quantity || 1),
          status: 'completed' as "completed",
          items: [item]
        }]);
      }

      if (appointment.customer_id) {
        const { data: customerData } = await supabase.from("customers").select("loyalty_points").eq("id", appointment.customer_id).single();
        const currentPoints = customerData?.loyalty_points || 0;
        await supabase.from("customers").update({ loyalty_points: currentPoints + 1 }).eq("id", appointment.customer_id);
      }

      toast.success("Pagamento registrado e agendamento concluído!");
      fetchData();
      
      const queryClient = (window as any).queryClient;
      if (queryClient) {
        queryClient.invalidateQueries({ queryKey: ["appointments"] });
        queryClient.invalidateQueries({ queryKey: ["calendar-appointments"] });
      }
    } catch (error: any) {
      toast.error("Erro ao registrar pagamento: " + error.message);
    } finally {
      setIsLoading(false);
    }
  };

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

  const getStatusColor = (status: string, barberId: string) => {
    if (status === 'completed') return "bg-zinc-100 text-zinc-600 border-zinc-200";
    if (status === 'confirmed') return "bg-emerald-500 text-white border-emerald-600";
    if (status === 'cancelled') return "bg-red-500 text-white border-red-600";
    if (status === 'scheduled') return "bg-blue-500 text-white border-blue-600";
    if (status === 'awaiting_payment') return "bg-amber-500 text-white border-amber-600";
    return "bg-black text-white border-zinc-800";
  };

  if (loading || !user) return null;

  return (
    <AppLayout>
      <div className="flex flex-col h-full space-y-6">
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
            <h2 className="text-3xl font-black flex items-center gap-3 text-black">
              <CalendarIcon className="text-black h-8 w-8" />
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
                className={cn("rounded-lg h-9 px-6 font-bold", view === "day" ? "bg-black text-white shadow-md hover:bg-black/90" : "text-zinc-500 hover:text-black")}
              >
                Dia
              </Button>
              <Button 
                variant={view === "week" ? "default" : "ghost"} 
                size="sm" 
                onClick={() => setView("week")}
                className={cn("rounded-lg h-9 px-6 font-bold", view === "week" ? "bg-black text-white shadow-md hover:bg-black/90" : "text-zinc-500 hover:text-black")}
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
                  className="gap-2 bg-black text-white hover:scale-[1.05] transition-all duration-300 rounded-xl h-11 px-6 shadow-lg shadow-black/10" 
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

        <Card className="flex-1 overflow-hidden flex flex-col bg-white border border-zinc-200 rounded-2xl shadow-xl shadow-black/5 text-black">
          <div className="p-5 border-b flex items-center justify-between bg-zinc-50/50">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" className="rounded-full border-zinc-200 hover:border-black transition-all h-9 w-9" onClick={() => setCurrentDate(subDays(currentDate, view === 'day' ? 1 : 7))}>
                  <ChevronLeft size={18} />
                </Button>
                <Button variant="outline" size="icon" className="rounded-full border-zinc-200 hover:border-black transition-all h-9 w-9" onClick={() => setCurrentDate(addDays(currentDate, view === 'day' ? 1 : 7))}>
                  <ChevronRight size={18} />
                </Button>
              </div>
              <h3 className="font-bold text-xl min-w-[240px] text-center capitalize tracking-tight">
                {format(currentDate, view === 'day' ? "EEEE, d 'de' MMMM" : "'Semana de' d 'de' MMMM", { locale: ptBR })}
              </h3>
            </div>
            <Button variant="ghost" size="sm" className="font-bold text-zinc-500 hover:text-black" onClick={() => setCurrentDate(new Date())}>Hoje</Button>
          </div>

          <ScrollArea className="flex-1">
            <div className="min-w-[800px] md:min-w-0">
              {view === 'day' ? (
                <div className="flex flex-col divide-y divide-zinc-100">
                  {HOURS.map(hour => (
                    <div key={hour} className="flex group min-h-[100px]">
                      <div className="w-24 py-6 px-4 text-right text-xs text-zinc-400 font-bold border-r border-zinc-100 bg-zinc-50/20">
                        {hour.toString().padStart(2, '0')}:00
                      </div>
                      <div 
                        className="flex-1 p-3 relative gap-3 flex flex-wrap content-start bg-white group-hover:bg-zinc-50/5 transition-all cursor-pointer"
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
                              setModalInitialData({ date: format(parseISO(app.start_time), "yyyy-MM-dd"), time: format(parseISO(app.start_time), "HH:mm"), step: 1, editingId: app.id });
                              setIsDialogOpen(true);
                            }}
                            className={cn(
                              "flex flex-col p-3 rounded-xl text-xs shadow-md min-w-[200px] max-w-[300px] animate-in fade-in zoom-in duration-300 border cursor-pointer hover:scale-[1.02] transition-all",
                              getStatusColor(app.status, app.barber_id)
                            )}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                {app.customers?.avatar_url ? (
                                  <img src={app.customers.avatar_url} alt={app.customers?.name} className="h-6 w-6 rounded-full object-cover border border-white/20 shadow-sm" />
                                ) : (
                                  <div className="h-6 w-6 rounded-full bg-black/10 flex items-center justify-center text-[10px] font-bold">
                                    {app.customers?.name?.charAt(0)}
                                  </div>
                                )}
                                <span className="font-bold truncate text-[13px]">{app.customers?.name}</span>
                              </div>
                              {app.refund_requested_at && (
                                <Badge className={cn("text-[9px] h-4 px-1", app.refund_status === 'completed' ? 'bg-green-600' : 'bg-amber-500')}>
                                  {app.refund_type === 'refund' ? 'Estorno' : 'Crédito'} {app.refund_status === 'completed' ? 'C' : 'P'}
                                </Badge>
                              )}
                            </div>
                            <div className="space-y-1 opacity-90">
                              <span className="flex items-center gap-1.5 text-[11px] font-medium">
                                <Scissors size={12} /> {app.services?.name}
                              </span>
                              <span className="flex items-center gap-1.5 text-[11px] font-medium">
                                <User size={12} /> {app.barbers?.name}
                              </span>
                            </div>
                            <div className="flex justify-between items-center mt-3 pt-2 border-t border-black/5">
                              <span className="font-black text-[11px] bg-black/10 rounded px-1.5 py-0.5">
                                {format(parseISO(app.start_time), "HH:mm")}
                              </span>
                              <div className="flex items-center gap-1.5">
                                {app.payment_status === 'pending' && app.status !== 'cancelled' && (
                                  <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    className="h-7 px-3 text-white bg-emerald-600 hover:bg-emerald-700 text-[10px] font-bold rounded-lg shadow-sm"
                                    onClick={(e) => { e.stopPropagation(); handleMarkAsPaid(app); }}
                                  >
                                    <CheckCircle2 size={12} /> Pagar
                                  </Button>
                                )}
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-7 w-7 text-white bg-red-600/20 hover:bg-red-600 rounded-lg transition-colors"
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    if (confirm("Deseja cancelar este agendamento?")) {
                                      setIsLoading(true);
                                      try {
                                        const { error } = await supabase.from("appointments").update({ status: "cancelled", updated_by_type: role === 'barber' ? 'barber' : 'admin', updated_by_id: user.id }).eq("id", app.id);
                                        if (error) throw error;
                                        await supabase.functions.invoke('appointment-notifications', { body: { appointmentId: app.id, type: 'appointment_cancelled', updatedBy: { type: role === 'barber' ? 'barber' : 'admin', id: user.id } } });
                                        fetchData();
                                        toast.success("Agendamento cancelado");
                                      } catch (err: any) { toast.error("Erro ao cancelar: " + err.message); } finally { setIsLoading(false); }
                                    }
                                  }}
                                >
                                  <X size={14} />
                                </Button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-[100px_repeat(7,1fr)] divide-x divide-zinc-100 border-b border-zinc-100">
                  <div className="bg-zinc-50/30 border-r border-zinc-100" />
                  {weekDays.map(day => (
                    <div key={day.toString()} className={cn("p-4 text-center text-sm font-bold bg-zinc-50/10 capitalize border-b border-zinc-100", isSameDay(day, new Date()) && "text-black bg-zinc-100")}>
                      {format(day, "EEE, dd", { locale: ptBR })}
                    </div>
                  ))}
                  {HOURS.map(hour => (
                    <React.Fragment key={hour}>
                      <div className="py-6 px-4 text-right text-xs text-zinc-400 font-bold border-r border-zinc-100 bg-zinc-50/20">
                        {hour.toString().padStart(2, '0')}:00
                      </div>
                      {weekDays.map(day => (
                        <div key={`${day}-${hour}`} className="min-h-[120px] p-2 group hover:bg-zinc-50/50 transition-all cursor-pointer relative border-b border-zinc-100" onClick={() => { setModalInitialData({ time: `${hour.toString().padStart(2, '0')}:00`, date: format(day, "yyyy-MM-dd"), step: 2, editingId: undefined }); setIsDialogOpen(true); }}>
                          <div className="flex flex-col gap-2">
                            {getAppointmentsForTime(day, hour).map(app => (
                              <div key={app.id} onClick={(e) => { e.stopPropagation(); setModalInitialData({ date: format(parseISO(app.start_time), "yyyy-MM-dd"), time: format(parseISO(app.start_time), "HH:mm"), step: 1, editingId: app.id }); setIsDialogOpen(true); }} className={cn("p-2 rounded-lg text-[10px] shadow-sm truncate animate-in fade-in zoom-in duration-300 border font-bold", getStatusColor(app.status, app.barber_id))} title={`${app.customers?.name} - ${app.services?.name} (${app.barbers?.name})`}>
                                {app.customers?.name.split(' ')[0]}
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </React.Fragment>
                  ))}
                </div>
              )}
            </div>
          </ScrollArea>
        </Card>
      </div>
    </AppLayout>
  );
}
