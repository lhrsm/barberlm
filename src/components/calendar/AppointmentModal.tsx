import * as React from "react";
import { useEffect, useState } from "react";
import { format, parseISO, addMinutes } from "date-fns";
import { Plus, AlertTriangle, Crown, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/hooks/use-auth";
import { usePlanLimits } from "@/hooks/use-plan-limits";
import { supabase } from "@/integrations/supabase/client";
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
import { triggerWhatsAppMessage } from "@/utils/whatsapp";
import { createNotification } from "@/utils/notifications";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { triggerAutomation } from "@/utils/automation";


interface AppointmentModalProps {
  trigger?: React.ReactNode;
  onSuccess?: () => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  initialDate?: string;
  initialTime?: string;
  initialStep?: number;
  editingAppointmentId?: string;
}

export function AppointmentModal({ 
  trigger, 
  onSuccess, 
  open: externalOpen, 
  onOpenChange,
  initialDate,
  initialTime,
  initialStep = 1,
  editingAppointmentId
}: AppointmentModalProps) {
  const { user, role } = useAuth();
  const { checkLimit, limits, refresh: refreshLimits } = usePlanLimits();
  const queryClient = useQueryClient();
  
  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = externalOpen !== undefined ? externalOpen : internalOpen;
  const setOpen = onOpenChange || setInternalOpen;

  const [isLoading, setIsLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [barbers, setBarbers] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [barberServices, setBarberServices] = useState<any[]>([]);
  const [isNewCustomerDialogOpen, setIsNewCustomerDialogOpen] = useState(false);

  // Form State
  const [selectedCustomer, setSelectedCustomer] = useState("");
  const [newCustomer, setNewCustomer] = useState({ name: "", phone: "" });
  const [selectedService, setSelectedService] = useState("");
  const [selectedBarber, setSelectedBarber] = useState("");
  const [selectedDate, setSelectedDate] = useState(initialDate || format(new Date(), "yyyy-MM-dd"));
  const [selectedTime, setSelectedTime] = useState(initialTime || format(new Date(), "HH:mm"));
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [paymentStatus, setPaymentStatus] = useState("pending");

  useEffect(() => {
    if (isOpen) {
      if (initialDate) setSelectedDate(initialDate);
      if (initialTime) setSelectedTime(initialTime);
      if (initialStep) setCurrentStep(initialStep);
    } else {
      // Reset when closing
      setCurrentStep(1);
    }
  }, [isOpen, initialDate, initialTime, initialStep]);

  const canAddAppointment = checkLimit("monthlyAppointments");

  useEffect(() => {
    if (isOpen && user) {
      fetchInitialData();
      if (editingAppointmentId) {
        fetchEditingData();
      }
    }
  }, [isOpen, user, editingAppointmentId]);

  async function fetchEditingData() {
    if (!editingAppointmentId) return;
    const { data, error } = await supabase
      .from("appointments")
      .select("*")
      .eq("id", editingAppointmentId)
      .single();
    
    if (data && !error) {
      if (data.barber_id) setSelectedBarber(data.barber_id);
      if (data.service_id) setSelectedService(data.service_id);
      if (data.customer_id) setSelectedCustomer(data.customer_id);
      const start = parseISO(data.start_time);
      setSelectedDate(format(start, "yyyy-MM-dd"));
      setSelectedTime(format(start, "HH:mm"));
      if (data.payment_status) setPaymentStatus(data.payment_status);
      setPaymentMethod(data.payment_method === 'credits' ? 'wallet' : 'cash');
    }
  }

  async function fetchInitialData() {
    if (!user) return;
    
    // Determine the real user_id (tenant_id)
    let tenantId = user.id;
    if (role === 'barber') {
      const { data: barberData } = await supabase.from('barbers').select('user_id').eq('id', user.id).single();
      if (barberData) tenantId = barberData.user_id;
    }

    const [barbRes, custRes, servRes, barbServRes] = await Promise.all([
      supabase.from("barbers").select("*").eq("user_id", tenantId).order("name"),
      supabase.from("customers").select("*").eq("user_id", tenantId).order("name"),
      supabase.from("services").select("*").eq("user_id", tenantId).eq("active", true).order("name"),
      supabase.from("barber_services").select("*").eq("user_id", tenantId)
    ]);

    if (barbRes.data) {
      setBarbers(barbRes.data);
      if (barbRes.data.length > 0 && !selectedBarber) {
        setSelectedBarber(role === 'barber' ? user.id : barbRes.data[0].id);
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
    if (barbServRes.data) {
      setBarberServices(barbServRes.data);
    }
  }

  const filteredServices = React.useMemo(() => {
    if (!selectedBarber) return services;
    
    // Get IDs of services linked to the selected barber
    const linkedServiceIds = barberServices
      .filter(bs => bs.barber_id === selectedBarber)
      .map(bs => bs.service_id);
    
    // If no services are linked to the barber, show all (fallback) or show none?
    // Usually, if a barber has NO services linked in barber_services, they might not be set up yet.
    // However, to follow the request strictly: "only show services they provide"
    if (linkedServiceIds.length === 0) return [];

    return services.filter(s => linkedServiceIds.includes(s.id));
  }, [services, barberServices, selectedBarber]);

  const checkConflict = async (barberId: string, date: string, time: string, serviceId: string, customerId: string) => {
    const service = services.find(s => s.id === serviceId);
    const timeWithSeconds = time.length === 5 ? `${time}:00` : time;
    const startTime = parseISO(`${date}T${timeWithSeconds}`);
    const endTime = addMinutes(startTime, service?.duration_minutes || 30);
    const startIso = startTime.toISOString();
    const endIso = endTime.toISOString();

    console.log('DEBUG: checkConflict (Admin)', { barberId, startIso, endIso, customerId, editingAppointmentId });

    // 1. Check Barber Conflict
    let barberQuery = supabase
      .from("appointments")
      .select("id, start_time, end_time, status")
      .eq("barber_id", barberId)
      .in("status", ["scheduled", "confirmed", "in_progress", "awaiting_payment"])
      .lt("start_time", endIso)
      .gt("end_time", startIso);

    if (editingAppointmentId) {
      barberQuery = barberQuery.neq("id", editingAppointmentId);
    }

    const { data: barberConflict, error: barberError } = await barberQuery.limit(1);

    if (barberError) {
      console.error("Barber conflict query error:", barberError);
      return { conflict: false };
    }
    
    if (barberConflict && barberConflict.length > 0) {
      console.log('BARBER CONFLICT DETECTED:', barberConflict[0]);
      return { conflict: true, type: 'barber' };
    }

    // 2. Check Customer Conflict
    if (customerId) {
      let customerQuery = supabase
        .from("appointments")
        .select("id, start_time, end_time, status")
        .eq("customer_id", customerId)
        .in("status", ["scheduled", "confirmed", "in_progress"])
        .lt("start_time", endIso)
        .gt("end_time", startIso);

      if (editingAppointmentId) {
        customerQuery = customerQuery.neq("id", editingAppointmentId);
      }

      const { data: customerConflict, error: customerError } = await customerQuery.limit(1);

      if (customerError) {
        console.error("Customer conflict query error:", customerError);
        return { conflict: false };
      }
      
      if (customerConflict && customerConflict.length > 0) {
        console.log('CUSTOMER CONFLICT DETECTED:', customerConflict[0]);
        return { conflict: true, type: 'customer' };
      }
    }

    return { conflict: false };
  };

  const handleNextStep = async () => {
    if (currentStep === 2) {
      setIsLoading(true);
      const { conflict, type } = await checkConflict(selectedBarber, selectedDate, selectedTime, selectedService, selectedCustomer);
      setIsLoading(false);
      
      if (conflict) {
        if (type === 'barber') {
          toast.error("Este profissional já possui um agendamento neste horário.");
        } else {
          toast.error("Este cliente já possui um agendamento conflitante neste horário.");
        }
        return;
      }
    }
    setCurrentStep(prev => prev + 1);
  };

  const handleCreateCustomer = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      let tenantId = user.id;
      if (role === 'barber') {
        const { data: barberData } = await supabase.from('barbers').select('user_id').eq('id', user.id).single();
        if (barberData) tenantId = barberData.user_id;
      }

      const { data, error } = await supabase.from("customers").insert([{
        user_id: tenantId,
        barber_id: selectedBarber,
        name: newCustomer.name,
        phone: newCustomer.phone,
      }]).select().single();

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

  const handleCreateAppointment = async () => {
    if (!user) return;
    setIsLoading(true);

    try {
      let tenantId = user.id;
      if (role === 'barber') {
        const { data: barberData } = await supabase.from('barbers').select('user_id').eq('id', user.id).single();
        if (barberData) tenantId = barberData.user_id;
      }

      const service = services.find(s => s.id === selectedService);
      const timeWithSeconds = selectedTime.length === 5 ? `${selectedTime}:00` : selectedTime;
      const startTime = parseISO(`${selectedDate}T${timeWithSeconds}`);
      const endTime = addMinutes(startTime, service?.duration_minutes || 30);

      const appointmentPayload: any = {
        user_id: tenantId,
        tenant_id: tenantId,
        customer_id: selectedCustomer,
        service_id: selectedService,
        barber_id: selectedBarber,
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
        total_price: service?.price || 0,
        original_total: service?.price || 0,
        status: "scheduled",
        payment_status: paymentStatus,
        payment_method: paymentMethod === 'wallet' ? 'credits' : (paymentMethod || 'cash'),
        credit_used: paymentMethod === 'wallet' ? (service?.price || 0) : 0,
        final_amount: paymentMethod === 'wallet' ? 0 : (paymentStatus === 'paid' ? 0 : (service?.price || 0)),
        source: 'admin',
        items: [{
          id: selectedService,
          name: service?.name,
          type: 'service',
          price: service?.price,
          quantity: 1
        }]
      };

      let appointmentData;
      if (editingAppointmentId) {
        console.log('TABLE:', 'appointments');
        console.log('ACTION:', 'update');
        console.log('PAYLOAD:', appointmentPayload);
        const { data, error } = await supabase
          .from("appointments")
          .update(appointmentPayload)
          .eq("id", editingAppointmentId)
          .select()
          .single();
        if (error) {
          console.error('SUPABASE ERROR (update appointment admin):', error);
          throw error;
        }
        appointmentData = data;
      } else {
        console.log('TABLE:', 'appointments');
        console.log('ACTION:', 'insert');
        console.log('PAYLOAD:', appointmentPayload);
        const { data, error } = await supabase.from("appointments").insert([appointmentPayload]).select().single();
        if (error) {
          console.error('SUPABASE ERROR (insert appointment admin):', error);
          throw error;
        }
        appointmentData = data;
      }

      // Notifications
      const customer = customers.find(c => c.id === selectedCustomer);
      const barber = barbers.find(b => b.id === selectedBarber);
      const notificationMessage = `${customer?.name} agendou ${service?.name} às ${selectedTime}`;

      // 2.5 Finance is now handled by complete_appointment RPC
      // If we mark as paid here during creation, it should eventually be captured when completed
      // However, if it's already paid AND we are not completing it yet, we might need a transaction
      if (appointmentData.payment_status === 'paid' && Number(appointmentData.total_price || 0) > 0) {
        // If it's paid but not completed, we still register the income
        const { data: existingTrans } = await supabase
          .from("transactions")
          .select("id")
          .eq("appointment_id", appointmentData.id)
          .maybeSingle();

        if (!existingTrans) {
          const usedCredits = Number(appointmentData.credit_used || 0);
          const usedCashback = Number(appointmentData.cashback_used || 0);
          const finalAmount = Number(appointmentData.final_amount || (Number(appointmentData.total_price || 0) - usedCredits - usedCashback));
          
          if (finalAmount > 0) {
            await supabase.from("transactions").insert([{
              amount: finalAmount,
              type: "income",
              description: `Agendamento Antecipado (${appointmentData.payment_method?.toUpperCase()}): ${service?.name || 'Serviço'} - ${customer?.name || 'Cliente'}`,
              category: "Serviço",
              barber_id: appointmentData.barber_id,
              appointment_id: appointmentData.id,
              tenant_id: tenantId,
              user_id: tenantId,
              date: new Date().toISOString().split('T')[0]
            }]);
          }
        }
      }
      
      // Centralized notification for Barbershop and Barber
      await Promise.all([
        createNotification({
          userId: tenantId,
          type: 'appointment_created',
          title: editingAppointmentId ? "Agendamento Editado" : "Novo Agendamento",
          message: notificationMessage,
          barberId: selectedBarber,
          customerId: selectedCustomer,
          metadata: { appointmentId: appointmentData.id }
        })
      ]);

      const { data: profile } = await supabase.from("profiles").select("whatsapp_enabled, business_name").eq("id", tenantId).single();

      if (profile?.whatsapp_enabled) {
        console.log("Triggering functional WhatsApp confirmation...");
        triggerAutomation({
          tenant_id: tenantId,
          event_name: 'appointment.created',
          appointment_id: appointmentData.id
        });
      }



      toast.success(editingAppointmentId ? "Agendamento atualizado com sucesso!" : "Agendamento criado com sucesso!");
      setOpen(false);
      setCurrentStep(1);
      refreshLimits();
      if (onSuccess) onSuccess();

      // Invalidate queries
      console.log('STATUS UPDATED', appointmentData.id, appointmentData.status);
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      queryClient.invalidateQueries({ queryKey: ["calendar"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["customerAppointments"] });
      queryClient.invalidateQueries({ queryKey: ["calendar-appointments"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-appointments"] });
      queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
    } catch (error: any) {
      toast.error("Erro ao criar agendamento: " + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(val) => {
        setOpen(val);
        if (!val) setCurrentStep(1);
      }}>
        {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
        <DialogContent 
          className="sm:max-w-[425px] bg-white text-zinc-900 border border-zinc-200 rounded-2xl shadow-xl" 
          onOpenAutoFocus={(e) => e.preventDefault()}
          onPointerDownOutside={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
        >
          {canAddAppointment ? (
            <>
              <DialogHeader>
                <DialogTitle className="text-zinc-900 font-bold">{editingAppointmentId ? "Editar Agendamento" : "Novo Agendamento"} - Passo {currentStep} de 4</DialogTitle>
              </DialogHeader>
              
              <div className="py-4 space-y-4">
                <Progress value={(currentStep / 4) * 100} className="h-1" />

                {currentStep === 1 && (
                  <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                    <div className="space-y-2">
                      <Label>Profissional</Label>
                      <Select 
                        value={selectedBarber} 
                        onValueChange={(val) => {
                          setSelectedBarber(val);
                          setSelectedService(""); // Reset service when barber changes
                        }} 
                        required
                      >
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
                          <SelectValue placeholder={filteredServices.length > 0 ? "Selecione o serviço" : "Nenhum serviço disponível para este profissional"} />
                        </SelectTrigger>
                        <SelectContent>
                          {filteredServices.map((s) => (
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
                        value={paymentStatus} 
                        onValueChange={setPaymentStatus}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">Pendente (Pagar na Barbearia)</SelectItem>
                          <SelectItem value="paid">Pago (Já recebido)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Forma de Pagamento</Label>
                      <Select 
                        value={paymentMethod} 
                        onValueChange={setPaymentMethod}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione a forma" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="cash">Dinheiro</SelectItem>
                          <SelectItem value="card">Cartão</SelectItem>
                          <SelectItem value="pix">PIX</SelectItem>
                          <SelectItem value="wallet">Créditos do Cliente</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
              </div>
              
              <DialogFooter className="flex gap-2 sm:justify-between pt-4 border-t border-zinc-100">
                {currentStep > 1 ? (
                  <Button 
                    variant="outline" 
                    onClick={() => setCurrentStep(prev => prev - 1)} 
                    disabled={isLoading}
                    className="rounded-xl border-zinc-200 text-zinc-600 hover:bg-zinc-50"
                  >
                    Voltar
                  </Button>
                ) : <div />}
                
                {currentStep < 4 ? (
                  <Button 
                    onClick={handleNextStep} 
                    disabled={isLoading}
                    className="rounded-xl bg-primary hover:opacity-90 text-primary-foreground font-semibold shadow-sm transition-all duration-200"
                  >
                    {isLoading ? "Validando..." : "Próximo"}
                  </Button>
                ) : (
                  <Button 
                    onClick={handleCreateAppointment} 
                    disabled={isLoading}
                    className="rounded-xl bg-primary hover:opacity-90 text-primary-foreground font-semibold shadow-sm transition-all duration-200"
                  >
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
    </>
  );
}
