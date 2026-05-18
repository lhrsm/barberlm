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
  const [isNewCustomerDialogOpen, setIsNewCustomerDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);

  const canAddAppointment = checkLimit("monthlyAppointments");

  // Form State
  const [selectedCustomer, setSelectedCustomer] = useState("");
  const [newCustomer, setNewCustomer] = useState({ name: "", phone: "" });
  const [selectedService, setSelectedService] = useState("");
  const [selectedBarber, setSelectedBarber] = useState("");
  const [selectedDate, setSelectedDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [selectedTime, setSelectedTime] = useState("08:00");
  const [paymentMethod, setPaymentMethod] = useState("cash");

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
      .select("*, customers(name), services(name, duration_minutes), barbers(name)")
      .gte("start_time", start.toISOString())
      .lte("start_time", end.toISOString());
    
    if (role === 'barber') {
      const targetId = user?.id || session?.barber_id;
      if (targetId) {
        appQuery = appQuery.eq('barber_id', targetId);
      }
    }

    const [appRes, barbRes, custRes, servRes] = await Promise.all([
      appQuery.order("start_time", { ascending: true }),
      supabase.from("barbers").select("*").eq("active", true).order("name"),
      supabase.from("customers").select("*").order("name"),
      supabase.from("services").select("*").eq("active", true).order("name"),
    ]);

    if (appRes.data) setAppointments(appRes.data);
    if (barbRes.data) {
      setBarbers(barbRes.data);
      if (barbRes.data.length > 0 && !selectedBarber) {
        const initialBarber = role === 'barber' ? user.id : barbRes.data[0].id;
        setSelectedBarber(initialBarber);
      }
    }
    if (custRes.data) {
      setCustomers(custRes.data);
      if (custRes.data.length > 0 && !selectedCustomer) {
        setSelectedCustomer(custRes.data[0].id);
      }
    }
    if (servRes.data) {
      setServices(servRes.data);
      if (servRes.data.length > 0 && !selectedService) {
        setSelectedService(servRes.data[0].id);
      }
    }
  }

  const checkConflict = async (barberId: string, date: string, time: string, serviceId: string) => {
    const service = services.find(s => s.id === serviceId);
    
    // Ensure time has seconds for correct parsing
    const timeWithSeconds = time.length === 5 ? `${time}:00` : time;
    const startTime = parseISO(`${date}T${timeWithSeconds}`);
    const endTime = addMinutes(startTime, service?.duration_minutes || 30);

    const { data, error } = await supabase
      .from("appointments")
      .select("id")
      .eq("barber_id", barberId)
      .neq("status", "cancelled")
      .or(`start_time.lte.${startTime.toISOString()},end_time.gte.${startTime.toISOString()}`)
      .or(`start_time.lt.${endTime.toISOString()},end_time.gt.${endTime.toISOString()}`)
      .limit(1);

    if (error) {
      console.error("Erro ao verificar conflitos:", error);
      return false;
    }

    return data && data.length > 0;
  };

  const handleNextStep = async () => {
    if (currentStep === 2) {
      setIsLoading(true);
      const hasConflict = await checkConflict(selectedBarber, selectedDate, selectedTime, selectedService);
      setIsLoading(false);
      
      if (hasConflict) {
        toast.error("Este profissional já possui um agendamento neste horário.");
        return;
      }
    }
    setCurrentStep(prev => prev + 1);
  };

  const handleCreateCustomer = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase.from("customers").insert({
        user_id: user.id,
        name: newCustomer.name,
        phone: newCustomer.phone,
      }).select().single();

      if (error) throw error;

      toast.success("Cliente cadastrado com sucesso!");
      setCustomers(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
      setSelectedCustomer(data.id);
      setIsNewCustomerDialogOpen(false);
      setNewCustomer({ name: "", phone: "" });
    } catch (error: any) {
      toast.error("Erro ao cadastrar cliente: " + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateAppointment = async (paymentStatus: string = "pending") => {
    if (!user) return;
    setIsLoading(true);

    try {
      const service = services.find(s => s.id === selectedService);
      const timeWithSeconds = selectedTime.length === 5 ? `${selectedTime}:00` : selectedTime;
      const startTime = parseISO(`${selectedDate}T${timeWithSeconds}`);
      const endTime = addMinutes(startTime, service?.duration_minutes || 30);

      const { data: appointmentData, error } = await supabase.from("appointments").insert({
        user_id: user.id,
        customer_id: selectedCustomer,
        service_id: selectedService,
        barber_id: selectedBarber,
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
        total_price: service?.price || 0,
        original_total: service?.price || 0,
        status: "scheduled",
        payment_status: paymentStatus,
        payment_method: paymentMethod === 'wallet' ? 'credits' : 'barbershop',
        items: [{
          id: selectedService,
          name: service?.name,
          type: 'service',
          price: service?.price,
          quantity: 1
        }]
      }).select().single();

      if (error) throw error;

      // Create notifications
      const customer = customers.find(c => c.id === selectedCustomer);
      const barber = barbers.find(b => b.id === selectedBarber);
      const notificationMessage = `Agendamento manual: ${service?.name} para ${customer?.name} às ${selectedTime}`;
      
      // Admin notification
      await supabase.from("notifications").insert({
        user_id: user.id,
        title: "Novo Agendamento (Manual)",
        message: notificationMessage,
        type: "appointment",
        link: "/calendar"
      });

      // Barber notification
      await supabase.from("notifications").insert({
        user_id: user.id,
        barber_id: selectedBarber,
        title: "Novo Agendamento Manual",
        message: notificationMessage,
        type: "appointment",
        link: "/calendar"
      });

      // We check if notifications are enabled in profile
      const { data: profile } = await supabase.from("profiles").select("whatsapp_enabled").eq("id", user.id).single();

      if (profile?.whatsapp_enabled && customer?.phone) {
        triggerWhatsAppMessage({
          userId: user.id,
          eventType: 'appointment_confirmation',
          phone: customer.phone,
          placeholders: {
            cliente: customer.name,
            horario: `${format(startTime, "HH:mm")} do dia ${format(startTime, "dd/MM")}`,
            barbeiro: barber?.name || "Barbeiro",
            valor: (service?.price || 0).toFixed(2),
            customer_id: selectedCustomer
          },
          appointmentId: appointmentData.id
        });
      }

      // Transações financeiras só devem ser criadas na conclusão (completeAppointment)
      // Se for pagamento imediato, marcamos apenas como pago
      if (paymentStatus === 'paid') {
        toast.info("Pagamento marcado como concluído. A transação financeira será gerada ao finalizar o atendimento.");
      }


      toast.success("Agendamento criado com sucesso!");
      setIsDialogOpen(false);
      setCurrentStep(1);
      fetchData();
      refreshLimits();
      
      // Realtime Invalidation for other tabs/dashboards
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
      toast.error("Erro ao criar agendamento: " + error.message);
    } finally {
      setIsLoading(false);
    }
  };

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

        await supabase.from("product_sales").insert({
          user_id: user.id,
          total_amount: item.price * (item.quantity || 1),
          status: 'completed',
          items: [item]
        });
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
    if (status === 'completed') return "bg-emerald-600 hover:bg-emerald-700";
    if (status === 'confirmed') return "bg-blue-600 hover:bg-blue-700";
    if (status === 'cancelled') return "bg-red-600 hover:bg-red-700";
    if (status === 'scheduled') return "bg-amber-600 hover:bg-amber-700";
    
    // Default to barber color (scheduled is blue/purple/etc as before)
    const index = barbers.findIndex(b => b.id === barberId);
    return PROFESSIONAL_COLORS[index % 6] || "bg-blue-600 hover:bg-blue-700";
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

            <Dialog open={isDialogOpen} onOpenChange={(open) => {
              setIsDialogOpen(open);
              if (!open) setCurrentStep(1);
            }}>
              <DialogTrigger asChild>
                <Button className="gap-2" variant={canAddAppointment ? "default" : "secondary"}>
                  <Plus size={18} /> <span className="hidden md:inline">Novo Agendamento</span>
                </Button>
              </DialogTrigger>
              <DialogContent 
                className="sm:max-w-[425px]" 
                onOpenAutoFocus={(e) => e.preventDefault()}
                onPointerDownOutside={(e) => e.preventDefault()}
                onInteractOutside={(e) => e.preventDefault()}
              >
                {canAddAppointment ? (
                  <>
                    <DialogHeader>
                      <DialogTitle>Novo Agendamento - Passo {currentStep} de 4</DialogTitle>
                    </DialogHeader>
                    
                    <div className="py-4 space-y-4">
                      {/* Step Progress Bar */}
                      <Progress value={(currentStep / 4) * 100} className="h-1" />

                      {currentStep === 1 && (
                        <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                          <div className="space-y-2">
                            <Label>Profissional</Label>
                            <Select value={selectedBarber} onValueChange={setSelectedBarber} required>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione o profissional" />
                              </SelectTrigger>
                              <SelectContent>
                                {barbers.map((b) => (
                                  <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label>Serviço</Label>
                            <Select value={selectedService} onValueChange={setSelectedService} required>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione o serviço" />
                              </SelectTrigger>
                              <SelectContent>
                                {services.map((s) => (
                                  <SelectItem key={s.id} value={s.id}>{s.name} - R$ {s.price}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      )}

                      {currentStep === 2 && (
                        <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                          <div className="space-y-2">
                            <Label>Data</Label>
                            <Input 
                              type="date" 
                              value={selectedDate} 
                              onChange={(e) => setSelectedDate(e.target.value)}
                              required 
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Horário</Label>
                            <Input 
                              type="time" 
                              value={selectedTime} 
                              onChange={(e) => setSelectedTime(e.target.value)}
                              required 
                            />
                          </div>
                        </div>
                      )}

                      {currentStep === 3 && (
                        <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                          <div className="space-y-2">
                            <Label>Cliente</Label>
                            <div className="flex gap-2">
                              <Select 
                                value={selectedCustomer} 
                                onValueChange={setSelectedCustomer} 
                                required
                              >
                                <SelectTrigger className="flex-1">
                                  <SelectValue placeholder="Selecione um cliente" />
                                </SelectTrigger>
                                <SelectContent>
                                  {customers.map((c) => (
                                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <Button 
                                type="button" 
                                variant="outline" 
                                size="icon"
                                onClick={() => setIsNewCustomerDialogOpen(true)}
                                title="Cadastrar Novo Cliente"
                              >
                                <Plus className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      )}



                      {currentStep === 4 && (
                        <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                          <div className="bg-muted/50 p-4 rounded-lg space-y-3">
                            <div className="flex justify-between border-b pb-2">
                              <span className="text-muted-foreground">Profissional:</span>
                              <span className="font-medium">{barbers.find(b => b.id === selectedBarber)?.name}</span>
                            </div>
                            <div className="flex justify-between border-b pb-2">
                              <span className="text-muted-foreground">Serviço:</span>
                              <span className="font-medium">{services.find(s => s.id === selectedService)?.name}</span>
                            </div>
                            <div className="flex justify-between border-b pb-2">
                              <span className="text-muted-foreground">Data:</span>
                              <span className="font-medium">{format(parseISO(selectedDate), "dd/MM/yyyy")}</span>
                            </div>
                            <div className="flex justify-between border-b pb-2">
                              <span className="text-muted-foreground">Hora:</span>
                              <span className="font-medium">{selectedTime}</span>
                            </div>
                            <div className="flex justify-between border-b pb-2">
                              <span className="text-muted-foreground">Cliente:</span>
                              <span className="font-medium">{customers.find(c => c.id === selectedCustomer)?.name}</span>
                            </div>
                            <div className="flex justify-between pt-2">
                              <span className="font-bold">Total:</span>
                              <span className="font-bold text-primary">R$ {services.find(s => s.id === selectedService)?.price}</span>
                            </div>
                          </div>
                          
                          <div className="space-y-2 mt-4">
                            <Label>Status do Pagamento</Label>
                            <Select 
                              defaultValue="pending" 
                              onValueChange={(val) => {
                                (window as any)._calendar_payment_status = val;
                              }}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione o status" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="pending">Pendente (Pagar na Barbearia)</SelectItem>
                                <SelectItem value="paid">Pago (PIX/Cartão/Dinheiro)</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      )}
                    </div>
                    
                    <DialogFooter className="flex gap-2 sm:justify-between">
                      {currentStep > 1 ? (
                        <Button variant="outline" onClick={() => setCurrentStep(prev => prev - 1)} disabled={isLoading}>
                          Voltar
                        </Button>
                      ) : <div />}
                      
                      {currentStep < 4 ? (
                        <Button onClick={handleNextStep} disabled={isLoading}>
                          {isLoading ? "Validando..." : "Próximo"}
                        </Button>
                      ) : (
                        <Button onClick={() => {
                          const status = (window as any)._calendar_payment_status || 'pending';
                          handleCreateAppointment(status);
                        }} disabled={isLoading}>
                          {isLoading ? "Salvando..." : "Confirmar"}
                        </Button>
                      )}
                    </DialogFooter>
                  </>
                ) : (
                  <div className="space-y-4 py-4">
                    <Alert variant="destructive">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertTitle>Limite de Agendamentos Atingido</AlertTitle>
                      <AlertDescription>
                        Seu plano atual permite apenas {limits.monthlyAppointments} agendamentos por mês. Faça o upgrade para o plano Pro para agendamentos ilimitados.
                      </AlertDescription>
                    </Alert>
                    <Button className="w-full" asChild>
                      <Link to="/subscription">Ver Planos</Link>
                    </Button>
                  </div>
                )}
              </DialogContent>
            </Dialog>

            <Dialog
              open={isNewCustomerDialogOpen}
              onOpenChange={(open) => {
                setIsNewCustomerDialogOpen(open);
                if (!open) {
                  setNewCustomer({ name: "", phone: "" });
                }
              }}
            >
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>Cadastrar Novo Cliente</DialogTitle>
                </DialogHeader>
                <div className="py-4 space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="new-customer-name">Nome Completo</Label>
                    <Input
                      id="new-customer-name"
                      placeholder="Nome do cliente"
                      value={newCustomer.name}
                      onChange={(e) =>
                        setNewCustomer((prev) => ({ ...prev, name: e.target.value }))
                      }
                      autoComplete="off"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="new-customer-phone">Telefone</Label>
                    <Input
                      id="new-customer-phone"
                      placeholder="(00) 00000-0000"
                      value={newCustomer.phone}
                      onChange={(e) =>
                        setNewCustomer((prev) => ({ ...prev, phone: e.target.value }))
                      }
                      autoComplete="off"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsNewCustomerDialogOpen(false);
                      setNewCustomer({ name: "", phone: "" });
                    }}
                  >
                    Cancelar
                  </Button>
                  <Button onClick={handleCreateCustomer} disabled={isLoading || !newCustomer.name}>
                    {isLoading ? "Salvando..." : "Cadastrar Cliente"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <Card className="flex-1 overflow-hidden flex flex-col">
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
                          setSelectedTime(`${hour.toString().padStart(2, '0')}:00`);
                          setSelectedDate(format(currentDate, "yyyy-MM-dd"));
                          setCurrentStep(1); // Start from professional selection step
                          setIsDialogOpen(true);
                        }}
                      >
                        {getAppointmentsForTime(currentDate, hour).map(app => (
                          <div 
                            key={app.id}
                            onClick={(e) => e.stopPropagation()}
                            className={cn(
                              "flex flex-col p-2 rounded-md text-white text-xs shadow-sm min-w-[150px] max-w-[250px] animate-in fade-in zoom-in duration-200",
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
                                      const { error } = await supabase
                                        .from("appointments")
                                        .update({ status: "cancelled" })
                                        .eq("id", app.id);
                                      if (error) {
                                        toast.error("Erro ao cancelar agendamento");
                                      } else {
                                        fetchData();
                                        toast.success("Agendamento cancelado");
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
                            setSelectedTime(`${hour.toString().padStart(2, '0')}:00`);
                            setSelectedDate(format(day, "yyyy-MM-dd"));
                            setCurrentStep(2); // Jump to date/time step as they are already set
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
                                  "p-1 rounded text-[10px] text-white shadow-sm truncate animate-in fade-in zoom-in duration-200",
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
