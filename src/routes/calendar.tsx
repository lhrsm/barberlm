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

  // Removed redundant local session effect

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
  const [modalInitialData, setModalInitialData] = useState<{date?: string, time?: string, step?: number}>({});
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

      // Realtime subscription (only if we have a real supabase user)
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
            // Also refresh limits
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
      .select("*, customers(name, phone), services(name, duration_minutes), barbers(name)")
      .eq("tenant_id", user.id) // Ensure we filter by tenant_id
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
      supabase.from("barbers").select("*").eq("user_id", user.id).eq("active", true).order("name"),
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
    
    // Check if user is the barber assigned or an admin
    const canManage = role === 'admin' || role === 'tenant_admin' || role === 'super_admin' || appointment.barber_id === user.id;
    
    if (!canManage) {
      toast.error("Você não tem permissão para alterar este agendamento.");
      return;
    }

    setIsLoading(true);
    try {
      // Get customer data for credits
      const { data: customerData } = await supabase
        .from("customers")
        .select("credits, name")
        .eq("id", appointment.customer_id)
        .single();
      
      const availableCredits = Number(customerData?.credits || 0);

      // 1. Update appointment status (Concluído + Pago)
      const { error: updateErr } = await supabase
        .from("appointments")
        .update({ 
          payment_status: 'paid', 
          status: 'completed' 
        })
        .eq("id", appointment.id);

      if (updateErr) throw updateErr;

      // Ensure realtime listeners are aware of the update by fetching fresh data
      await fetchData();

      // 2. Create transactions for items (Now that it's paid and completed)
      let items = appointment.items || [];
      
      // Fallback for old appointments without items
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
          // Atualizar créditos do cliente e agendamento
          await Promise.all([
            supabase
              .from("customers")
              .update({ credits: availableCredits - usedCredits })
              .eq("id", appointment.customer_id),
            supabase
              .from("appointments")
              .update({ 
                credit_used: usedCredits,
                final_amount: remainingToPay,
                barbershop_amount: remainingToPay
              })
              .eq("id", appointment.id)
          ]);
        } else {
          await supabase
            .from("appointments")
            .update({ 
              final_amount: totalPrice,
              barbershop_amount: totalPrice
            })
            .eq("id", appointment.id);
        }

        // Criar uma ÚNICA transação para registro financeiro (mesmo se valor for 0 para constar no operacional)
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

      // Atualizar pontos de fidelidade do cliente ao marcar como pago
      if (appointment.customer_id) {
        const { data: customerData } = await supabase
          .from("customers")
          .select("loyalty_points")
          .eq("id", appointment.customer_id)
          .single();
        
        const currentPoints = customerData?.loyalty_points || 0;
        
        await supabase
          .from("customers")
          .update({ loyalty_points: currentPoints + 1 })
          .eq("id", appointment.customer_id);
      }

      toast.success("Pagamento registrado e agendamento concluído!");
      fetchData();
      
      // Invalidate queries for other views
      const queryClient = (window as any).queryClient;
      if (queryClient) {
        queryClient.invalidateQueries({ queryKey: ["appointments"] });
        queryClient.invalidateQueries({ queryKey: ["dashboard-appointments"] });
        queryClient.invalidateQueries({ queryKey: ["admin-dashboard"] });
        queryClient.invalidateQueries({ queryKey: ["professional-dashboard"] });
        queryClient.invalidateQueries({ queryKey: ["professional-appointments"] });
        queryClient.invalidateQueries({ queryKey: ["calendar-appointments"] });
        queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
      }
    } catch (error: any) {
      toast.error("Erro ao registrar pagamento: " + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const weekDays = useMemo(() => {
    const start = startOfWeek(currentDate, { weekStartsOn: 0 });
    return eachDayOfInterval({
      start,
      end: addDays(start, 6),
    });
  }, [currentDate]);

  const getAppointmentsForTime = (date: Date, hour: number) => {
    return appointments.filter(app => {
      const appDate = parseISO(app.start_time);
      return isSameDay(appDate, date) && appDate.getHours() === hour;
    });
  };

  const getStatusColor = (status: string, barberId: string) => {
    if (status === 'completed') return "border-emerald-500 bg-white text-emerald-700";
    if (status === 'confirmed') return "border-blue-500 bg-white text-blue-700";
    if (status === 'cancelled') return "border-red-500 bg-white text-red-700";
    if (status === 'scheduled') return "border-amber-500 bg-white text-amber-700";
    
    const index = barbers.findIndex(b => b.id === barberId);
    const colors = ["border-blue-500", "border-purple-500", "border-emerald-500", "border-orange-500", "border-pink-500", "border-cyan-500"];
    const baseColor = colors[index % 6] || "border-blue-500";
    return `${baseColor} bg-white text-black`;
  };

  if (loading || !user) return null;

  return (
    <AppLayout>
      <div className="flex flex-col h-full space-y-4">
        {!canAddAppointment && (
          <Alert>
            <Crown className="h-4 w-4" />
            <AlertTitle>Limite de Agendamentos</AlertTitle>
            <AlertDescription className="flex items-center justify-between">
              Você atingiu o limite mensal de {limits.monthlyAppointments} agendamentos do plano gratuito.
              <Button variant="link" size="sm" asChild className="p-0 h-auto">
                <Link to="/subscription">Fazer Upgrade</Link>
              </Button>
            </AlertDescription>
          </Alert>
        )}

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <CalendarIcon className="text-primary" />
              Agenda
            </h2>
            <p className="text-muted-foreground">Gerencie seus atendimentos diários.</p>
          </div>

          <div className="flex items-center gap-2">
            <Tabs value={view} onValueChange={(v) => setView(v as "day" | "week")} className="w-full md:w-auto">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="day">Dia</TabsTrigger>
                <TabsTrigger value="week">Semana</TabsTrigger>
              </TabsList>
            </Tabs>

            <AppointmentModal
              open={isDialogOpen}
              onOpenChange={setIsDialogOpen}
              initialDate={modalInitialData.date}
              initialTime={modalInitialData.time}
              initialStep={modalInitialData.step}
              onSuccess={() => fetchData()}
              trigger={
                <Button className="gap-2 bg-black text-white hover:scale-110 transition-all duration-300" variant={canAddAppointment ? "default" : "secondary"}>
                  <Plus size={18} /> <span className="hidden md:inline">Novo Agendamento</span>

                </Button>
              }
            />
          </div>
        </div>

        <Card className="flex-1 overflow-hidden flex flex-col bg-white border-2 border-slate-100 shadow-sm text-black">
          <div className="p-4 border-b flex items-center justify-between bg-muted/30">
            <div className="flex items-center gap-4">
              <Button variant="outline" size="icon" onClick={() => setCurrentDate(subDays(currentDate, view === 'day' ? 1 : 7))}>
                <ChevronLeft size={18} />
              </Button>
              <h3 className="font-semibold text-lg min-w-[200px] text-center capitalize">
                {format(currentDate, view === 'day' ? "EEEE, d 'de' MMMM" : "'Semana de' d 'de' MMMM", { locale: ptBR })}
              </h3>
              <Button variant="outline" size="icon" onClick={() => setCurrentDate(addDays(currentDate, view === 'day' ? 1 : 7))}>
                <ChevronRight size={18} />
              </Button>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setCurrentDate(new Date())}>Hoje</Button>
          </div>

          <ScrollArea className="flex-1">
            <div className="min-w-[800px] md:min-w-0">
              {view === 'day' ? (
                <div className="flex flex-col divide-y">
                  {HOURS.map(hour => (
                    <div key={hour} className="flex group min-h-[80px]">
                      <div className="w-20 py-4 px-2 text-right text-sm text-muted-foreground font-medium border-r bg-muted/5">
                        {hour.toString().padStart(2, '0')}:00
                      </div>
                      <div 
                        className="flex-1 p-2 relative gap-2 flex flex-wrap content-start bg-background/50 group-hover:bg-muted/10 transition-colors cursor-pointer"
                        onClick={() => {
                          setModalInitialData({
                            time: `${hour.toString().padStart(2, '0')}:00`,
                            date: format(currentDate, "yyyy-MM-dd"),
                            step: 1
                          });
                          setIsDialogOpen(true);
                        }}
                      >
                        {getAppointmentsForTime(currentDate, hour).map(app => (
                          <div 
                            key={app.id}
                            onClick={(e) => e.stopPropagation()}
                            className={cn(
                              "flex flex-col p-2 rounded-md text-xs shadow-sm min-w-[150px] max-w-[250px] animate-in fade-in zoom-in duration-200 border-2",
                              getStatusColor(app.status, app.barber_id)
                            )}

                          >
                            <div className="flex items-center justify-between mb-1">
                              <div className="flex items-center gap-2">
                                {customers.find(c => c.id === app.customer_id)?.avatar_url && (
                                  <img 
                                    src={customers.find(c => c.id === app.customer_id)?.avatar_url} 
                                    alt={app.customers?.name} 
                                    className="h-5 w-5 rounded-full object-cover border border-white/20"
                                  />
                                )}
                                <span className="font-bold truncate">{app.customers?.name}</span>
                              </div>
                              {app.refund_requested_at && (
                                <Badge className={cn(
                                  "text-[8px] h-4 px-1",
                                  app.refund_status === 'completed' ? 'bg-green-600 hover:bg-green-700' : 'bg-amber-500 hover:bg-amber-600'
                                )}>
                                  {app.refund_type === 'refund' ? 'Estorno' : 'Crédito'} {app.refund_status === 'completed' ? 'Conc.' : 'Pend.'}
                                </Badge>
                              )}
                            </div>
                            <span className="opacity-90 flex items-center gap-1 text-[10px]">
                              <Scissors size={10} /> {app.services?.name}
                            </span>
                            <span className="opacity-90 flex items-center gap-1 text-[10px]">
                              <User size={10} /> {app.barbers?.name}
                            </span>
                            <div className="flex justify-between items-center mt-1 gap-1">
                              <span className="font-mono text-[10px] bg-black/20 rounded px-1">
                                {format(parseISO(app.start_time), "HH:mm")}
                              </span>
                              <div className="flex items-center gap-1">
                                {app.payment_status === 'pending' && app.status !== 'cancelled' && (
                                  <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    className="h-6 px-2 text-white bg-emerald-500/30 hover:bg-emerald-500/50 text-[10px] gap-1"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleMarkAsPaid(app);
                                    }}
                                  >
                                    <CheckCircle2 size={10} />
                                    <span>Pagar</span>
                                  </Button>
                                )}
                                
                                {app.refund_requested_at && app.refund_status === 'pending' && (
                                  <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    className="h-6 px-2 text-white bg-amber-500/30 hover:bg-amber-500/50 text-[10px] gap-1"
                                    onClick={async (e) => {
                                      e.stopPropagation();
                                      if (confirm(`Confirmar ${app.refund_type === 'refund' ? 'estorno' : 'créditos'} para este cliente?`)) {
                                        try {
                                          const now = new Date();
                                          const formattedDate = format(now, "yyyy-MM-dd");
                                          const formattedTime = format(now, "HH:mm:ss");

                                          if (app.refund_type === 'credits') {
                                            // Handle credits
                                            const { data: currentCust } = await supabase
                                              .from("customers")
                                              .select("credits")
                                              .eq("id", app.customer_id)
                                              .single();
                                            
                                            const newCredits = Number(currentCust?.credits || 0) + Number(app.total_price || 0);
                                            await supabase.from("customers").update({ credits: newCredits }).eq("id", app.customer_id);
                                            
                                            // Remove original income from transactions when converting to credits
                                            await supabase.from("transactions").insert({ 
                                              user_id: user.id, 
                                              barber_id: app.barber_id, 
                                              appointment_id: app.id, 
                                              type: "expense", 
                                              category: "Estorno (Créditos)", 
                                              amount: app.total_price, 
                                              description: `Conversão em Créditos: ${app.services?.name} - Cliente: ${app.customers?.name}`, 
                                              date: formattedDate, 
                                              time: formattedTime 
                                            });
                                          } else if (app.refund_type === 'refund') {
                                            // Estorno: cria uma SAÍDA equivalente à entrada original.
                                            await supabase.from("transactions").insert({
                                              user_id: user.id,
                                              barber_id: app.barber_id,
                                              appointment_id: app.id,
                                              type: "expense",
                                              category: "Estorno",
                                              amount: app.total_price,
                                              description: `Estorno de Pagamento: ${app.services?.name} - Cliente: ${app.customers?.name}`,
                                              date: formattedDate,
                                              time: formattedTime
                                            });
                                          }
                                          
                                          // Update status to cancelled and refund_status to completed
                                          await supabase.from("appointments").update({ 
                                            status: "cancelled",
                                            refund_status: "completed"
                                          }).eq("id", app.id);
                                          
                                          toast.success("Solicitação processada e agendamento cancelado");
                                          
                                          // Trigger re-fetch for all calendar and related data
                                          await fetchData();
                                        } catch (err) {
                                          console.error("Erro ao processar estorno:", err);
                                          toast.error("Erro ao processar solicitação");
                                        }
                                      }
                                    }}
                                  >
                                    <RefreshCcw size={10} />
                                    <span>Aprovar {app.refund_type === 'refund' ? 'Estorno' : 'Créditos'}</span>
                                  </Button>
                                )}

                                {app.status === 'scheduled' && (
                                  <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    className="h-6 px-2 text-white bg-blue-500/30 hover:bg-blue-500/50 text-[10px] gap-1"
                                    onClick={async (e) => {
                                      e.stopPropagation();
                                      if (confirm("Deseja confirmar este agendamento?")) {
                                        const { error } = await supabase
                                          .from("appointments")
                                          .update({ status: 'confirmed' })
                                          .eq("id", app.id);
                                        if (error) {
                                          toast.error("Erro ao confirmar agendamento");
                                        } else {
                                          fetchData();
                                          toast.success("Agendamento confirmado com sucesso");
                                        }
                                      }
                                    }}
                                  >
                                    <CheckCircle2 size={10} />
                                    <span>Confirmar</span>
                                  </Button>
                                )}

                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-5 w-5 text-white hover:bg-red-500/50"
                                   onClick={async (e) => {
                                     e.stopPropagation();
                                     if (confirm("Deseja cancelar este agendamento?")) {
                                       setIsLoading(true);
                                       try {
                                         const { error } = await supabase
                                           .from("appointments")
                                           .update({ 
                                             status: "cancelled",
                                             updated_by_type: role === 'barber' ? 'barber' : 'admin',
                                             updated_by_id: user.id
                                           })
                                           .eq("id", app.id);
                                         
                                         if (error) throw error;

                                         // Call notification edge function
                                         await supabase.functions.invoke('appointment-notifications', {
                                           body: {
                                             appointmentId: app.id,
                                             type: 'appointment_cancelled',
                                             updatedBy: { type: role === 'barber' ? 'barber' : 'admin', id: user.id }
                                           }
                                         });

                                         fetchData();
                                         toast.success("Agendamento cancelado");
                                       } catch (err: any) {
                                         toast.error("Erro ao cancelar: " + err.message);
                                       } finally {
                                         setIsLoading(false);
                                       }
                                     }
                                   }}
                                >
                                  <X size={12} />
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
                <div className="grid grid-cols-[80px_repeat(7,1fr)] divide-x divide-y border-b">
                  <div className="bg-muted/5 border-r" />
                  {weekDays.map(day => (
                    <div key={day.toString()} className={cn(
                      "p-2 text-center text-sm font-semibold bg-muted/30 capitalize",
                      isSameDay(day, new Date()) && "text-primary bg-primary/5"
                    )}>
                      {format(day, "EEE, dd", { locale: ptBR })}
                    </div>
                  ))}
                  
                  {HOURS.map(hour => (
                    <React.Fragment key={hour}>
                      <div className="py-4 px-2 text-right text-xs text-muted-foreground font-medium border-r bg-muted/5">
                        {hour.toString().padStart(2, '0')}:00
                      </div>
                      {weekDays.map(day => (
                        <div 
                          key={`${day}-${hour}`} 
                          className="min-h-[100px] p-1 group hover:bg-muted/10 transition-colors cursor-pointer relative"
                            onClick={() => {
                              setModalInitialData({
                                time: `${hour.toString().padStart(2, '0')}:00`,
                                date: format(day, "yyyy-MM-dd"),
                                step: 2
                              });
                              setIsDialogOpen(true);
                            }}
                        >
                          <div className="flex flex-col gap-1">
                            {getAppointmentsForTime(day, hour).map(app => (
                              <div 
                                key={app.id}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toast.info(`Agendamento: ${app.customers?.name} - ${app.services?.name}`);
                                }}
                                className={cn(
                                  "p-1 rounded text-[10px] shadow-sm truncate animate-in fade-in zoom-in duration-200 border",
                                  getStatusColor(app.status, app.barber_id)
                                )}

                                title={`${app.customers?.name} - ${app.services?.name} (${app.barbers?.name})`}
                              >
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
