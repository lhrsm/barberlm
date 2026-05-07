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
  CheckCircle2
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/hooks/use-auth";
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
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { checkLimit, limits, usage, refresh: refreshLimits } = usePlanLimits();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<"day" | "week">("day");
  const [appointments, setAppointments] = useState<any[]>([]);
  const [barbers, setBarbers] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);

  const canAddAppointment = checkLimit("monthlyAppointments");

  // Form State
  const [selectedCustomer, setSelectedCustomer] = useState("");
  const [selectedService, setSelectedService] = useState("");
  const [selectedBarber, setSelectedBarber] = useState("");
  const [selectedDate, setSelectedDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [selectedTime, setSelectedTime] = useState("08:00");

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user, currentDate, view]);

  async function fetchData() {
    if (!user) return;

    const start = startOfDay(view === "day" ? currentDate : startOfWeek(currentDate, { weekStartsOn: 0 }));
    const end = endOfDay(view === "day" ? currentDate : endOfWeek(currentDate, { weekStartsOn: 0 }));

    const [appRes, barbRes, custRes, servRes] = await Promise.all([
      supabase
        .from("appointments")
        .select("*, customers(name), services(name, duration_minutes), barbers(name)")
        .neq("status", "cancelled")
        .gte("start_time", start.toISOString())
        .lte("start_time", end.toISOString()),
      supabase.from("barbers").select("*").eq("active", true).order("name"),
      supabase.from("customers").select("*").order("name"),
      supabase.from("services").select("*").eq("active", true).order("name"),
    ]);

    if (appRes.data) setAppointments(appRes.data);
    if (barbRes.data) {
      setBarbers(barbRes.data);
      if (barbRes.data.length > 0 && !selectedBarber) {
        setSelectedBarber(barbRes.data[0].id);
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
    const startTime = parseISO(`${date}T${time}:00`);
    const endTime = addMinutes(startTime, service?.duration_minutes || 30);

    const { data, error } = await supabase
      .from("appointments")
      .select("id")
      .eq("barber_id", barberId)
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

  const handleCreateAppointment = async (paymentStatus: string = "pending") => {
    if (!user) return;
    setIsLoading(true);

    try {
      const service = services.find(s => s.id === selectedService);
      const startTime = parseISO(`${selectedDate}T${selectedTime}:00`);
      const endTime = addMinutes(startTime, service?.duration_minutes || 30);

      const { data: appointmentData, error } = await supabase.from("appointments").insert({
        user_id: user.id,
        customer_id: selectedCustomer,
        service_id: selectedService,
        barber_id: selectedBarber,
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
        total_price: service?.price || 0,
        status: "scheduled",
        payment_status: paymentStatus,
        items: [{
          id: selectedService,
          name: service?.name,
          type: 'service',
          price: service?.price,
          quantity: 1
        }]
      }).select().single();

      if (error) throw error;

      // Only create transaction and sales records if paid
      if (paymentStatus === 'paid') {
        // Create finance transaction for the schedule
        await supabase.from("transactions").insert({
          user_id: user.id,
          barber_id: selectedBarber,
          appointment_id: appointmentData.id,
          type: "income",
          category: "Serviço",
          amount: service?.price || 0,
          description: `Agendamento: ${service?.name} - Cliente: ${customers.find(c => c.id === selectedCustomer)?.name}`,
          date: new Date().toISOString().split('T')[0]
        });

        // Registrar também no faturamento de produtos (como um item de serviço)
        await supabase.from("product_sales").insert({
          user_id: user.id,
          items: [{ id: selectedService, name: service?.name, quantity: 1, price: service?.price }],
          total_amount: service?.price || 0,
          status: 'completed'
        });

        // Atualizar pontos de fidelidade do cliente
        if (selectedCustomer) {
          const currentCustomer = customers.find(c => c.id === selectedCustomer);
          const currentPoints = currentCustomer?.loyalty_points || 0;
          
          await supabase
            .from("customers")
            .update({ loyalty_points: currentPoints + 1 })
            .eq("id", selectedCustomer);
        }
      }


      toast.success("Agendamento criado com sucesso!");
      setIsDialogOpen(false);
      setCurrentStep(1);
      fetchData();
      refreshLimits();
    } catch (error: any) {
      toast.error("Erro ao criar agendamento: " + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleMarkAsPaid = async (appointment: any) => {
    if (!user) return;
    setIsLoading(true);
    try {
      // 1. Update appointment status
      const { error: updateErr } = await supabase
        .from("appointments")
        .update({ payment_status: 'paid', status: 'completed' })
        .eq("id", appointment.id);

      if (updateErr) throw updateErr;

      // 2. Create transactions for items
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
        await supabase.from("transactions").insert({
          user_id: user.id,
          barber_id: appointment.barber_id,
          appointment_id: appointment.id,
          type: "income",
          category: "Serviço",
          amount: serviceItem.price,
          description: `Pagamento (Local): ${serviceItem.name} - Cliente: ${appointment.customers?.name}`,
          date: new Date().toISOString().split('T')[0]
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
          description: `Venda de Produto (Local): ${item.name} (x${item.quantity || 1}) - Cliente: ${appointment.customers?.name}`,
          date: new Date().toISOString().split('T')[0]
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

      toast.success("Pagamento registrado com sucesso!");
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
    if (status === 'completed') return "bg-green-600 hover:bg-green-700";
    if (status === 'cancelled') return "bg-red-600 hover:bg-red-700";
    
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
              <DialogContent className="sm:max-w-[425px]" onOpenAutoFocus={(e) => e.preventDefault()}>
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
                            <Select value={selectedCustomer} onValueChange={setSelectedCustomer} required>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione um cliente" />
                              </SelectTrigger>
                              <SelectContent>
                                {customers.map((c) => (
                                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
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
                          setCurrentStep(2); // Jump to date/time step as they are already set
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
                            <span className="font-bold truncate">{app.customers?.name}</span>
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
                                    className="h-6 px-2 text-white bg-green-500/30 hover:bg-green-500/50 text-[10px] gap-1"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleMarkAsPaid(app);
                                    }}
                                  >
                                    <CheckCircle2 size={10} />
                                    <span>Pagar</span>
                                  </Button>
                                )}
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-5 w-5 text-white hover:bg-red-500/50"
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    if (confirm("Deseja cancelar este agendamento?")) {
                                      await supabase.from("appointments").update({ status: 'cancelled' }).eq("id", app.id);
                                      fetchData();
                                      toast.success("Agendamento cancelado");
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
