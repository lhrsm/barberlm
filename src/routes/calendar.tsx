import * as React from "react";
import { format, addMinutes, startOfHour, parseISO, isSameDay, startOfWeek, endOfWeek, eachDayOfInterval, addDays, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  Calendar as CalendarIcon,
  Clock,
  User,
  Scissors,
  X
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/hooks/use-auth";
import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { createFileRoute } from "@tanstack/react-router";

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
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<"day" | "week">("day");
  const [appointments, setAppointments] = useState<any[]>([]);
  const [barbers, setBarbers] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Form State
  const [selectedCustomer, setSelectedCustomer] = useState("");
  const [selectedService, setSelectedService] = useState("");
  const [selectedBarber, setSelectedBarber] = useState("");
  const [selectedDate, setSelectedDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [selectedTime, setSelectedTime] = useState("08:00");
  const [currentStep, setCurrentStep] = useState(1);

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

    const start = view === "day" ? currentDate : startOfWeek(currentDate, { weekStartsOn: 0 });
    const end = view === "day" ? currentDate : endOfWeek(currentDate, { weekStartsOn: 0 });

    const [appRes, barbRes, custRes, servRes] = await Promise.all([
      supabase
        .from("appointments")
        .select("*, customers(name), services(name, duration_minutes), barbers(name)")
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

  const handleCreateAppointment = async () => {
    if (!user) return;
    setIsLoading(true);

    try {
      const service = services.find(s => s.id === selectedService);
      const startTime = parseISO(`${selectedDate}T${selectedTime}:00`);
      const endTime = addMinutes(startTime, service?.duration_minutes || 30);

      const { error } = await supabase.from("appointments").insert({
        user_id: user.id,
        customer_id: selectedCustomer,
        service_id: selectedService,
        barber_id: selectedBarber,
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
        total_price: service?.price || 0,
        status: "scheduled",
      });

      if (error) throw error;

      toast.success("Agendamento criado com sucesso!");
      setIsDialogOpen(false);
      setCurrentStep(1);
      fetchData();
    } catch (error: any) {
      toast.error("Erro ao criar agendamento: " + error.message);
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

  const getBarberColor = (barberId: string) => {
    const index = barbers.findIndex(b => b.id === barberId);
    return PROFESSIONAL_COLORS[index % 6] || "bg-gray-500";
  };

  if (loading || !user) return null;

  return (
    <AppLayout>
      <div className="flex flex-col h-full space-y-4">
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
                <Button className="gap-2">
                  <Plus size={18} /> <span className="hidden md:inline">Novo Agendamento</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]" onOpenAutoFocus={(e) => e.preventDefault()}>
                <DialogHeader>
                  <DialogTitle>Novo Agendamento - Passo {currentStep} de 4</DialogTitle>
                </DialogHeader>
                
                <div className="py-4 space-y-4">
                  {/* Step Progress Bar */}
                  <div className="flex gap-1 h-1 w-full bg-muted rounded-full overflow-hidden">
                    <div className={cn("h-full bg-primary transition-all duration-300", 
                      currentStep === 1 ? "w-1/4" : currentStep === 2 ? "w-2/4" : currentStep === 3 ? "w-3/4" : "w-full"
                    )} />
                  </div>

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
                          <span className="text-muted-foreground">Data/Hora:</span>
                          <span className="font-medium">
                            {format(parseISO(selectedDate), "dd/MM/yyyy", { locale: ptBR })} às {selectedTime}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Cliente:</span>
                          <span className="font-medium">{customers.find(c => c.id === selectedCustomer)?.name}</span>
                        </div>
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
                    <Button onClick={handleCreateAppointment} disabled={isLoading}>
                      {isLoading ? "Salvando..." : "Confirmar"}
                    </Button>
                  )}
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
                              getBarberColor(app.barber_id)
                            )}
                          >
                            <span className="font-bold truncate">{app.customers?.name}</span>
                            <span className="opacity-90 flex items-center gap-1 text-[10px]">
                              <Scissors size={10} /> {app.services?.name}
                            </span>
                            <span className="opacity-90 flex items-center gap-1 text-[10px]">
                              <User size={10} /> {app.barbers?.name}
                            </span>
                            <div className="flex justify-between items-center mt-1">
                              <span className="font-mono text-[10px] bg-black/20 rounded px-1">
                                {format(parseISO(app.start_time), "HH:mm")}
                              </span>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-4 w-4 text-white hover:bg-white/20"
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  if (confirm("Deseja cancelar este agendamento?")) {
                                    await supabase.from("appointments").delete().eq("id", app.id);
                                    fetchData();
                                    toast.success("Agendamento removido");
                                  }
                                }}
                              >
                                <X size={10} />
                              </Button>
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
                                  getBarberColor(app.barber_id)
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