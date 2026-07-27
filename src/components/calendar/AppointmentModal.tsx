import * as React from "react";
import { useEffect, useState } from "react";
import { format, parseISO, addMinutes, addDays } from "date-fns";
import { AlertTriangle, CalendarPlus, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { createNotification } from "@/utils/notifications";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { emitAutomationEvent } from "@/utils/emit-event";

import { AppointmentStepper } from "./appointment/AppointmentStepper";
import { ProfessionalServiceStep } from "./appointment/ProfessionalServiceStep";
import { DateTimeStep } from "./appointment/DateTimeStep";
import { CustomerStep } from "./appointment/CustomerStep";
import { AppointmentReviewStep } from "./appointment/AppointmentReviewStep";
import { AppointmentModalFooter } from "./appointment/AppointmentModalFooter";
import {
  computeAppointmentTotal,
  dayKeyFromDate,
  toMinutes,
  type Slot,
} from "./appointment/appointment-utils";
import { fetchAvailability, hasConflict, OVERLAP_MESSAGE } from "@/lib/availability";


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
  editingAppointmentId,
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
  const [shopName, setShopName] = useState<string | null>(null);
  const [bufferMinutes, setBufferMinutes] = useState(0);

  // Form State
  const [selectedCustomer, setSelectedCustomer] = useState("");
  const [newCustomer, setNewCustomer] = useState({ name: "", phone: "" });
  const [selectedService, setSelectedService] = useState("");
  const [selectedBarber, setSelectedBarber] = useState("");
  const [selectedDate, setSelectedDate] = useState(initialDate || format(new Date(), "yyyy-MM-dd"));
  const [selectedTime, setSelectedTime] = useState(initialTime || format(new Date(), "HH:mm"));
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [paymentStatus, setPaymentStatus] = useState("pending");
  const [originalStartTime, setOriginalStartTime] = useState<string | null>(null);

  // UI-only state
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [slots, setSlots] = useState<Slot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [nextAvailableDate, setNextAvailableDate] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (initialDate) setSelectedDate(initialDate);
      if (initialTime) setSelectedTime(initialTime);
      if (initialStep) setCurrentStep(initialStep);
    } else {
      setCurrentStep(1);
      setErrors({});
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
      setOriginalStartTime(data.start_time);
      if (data.payment_status) setPaymentStatus(data.payment_status);
      setPaymentMethod(data.payment_method === "credits" ? "wallet" : "cash");
    }
  }

  async function resolveTenantId() {
    if (!user) return null;
    let tenantId = user.id;
    if (role === "barber") {
      const { data: barberData } = await supabase
        .from("barbers")
        .select("user_id")
        .eq("id", user.id)
        .single();
      if (barberData) tenantId = barberData.user_id;
    }
    return tenantId;
  }

  async function fetchInitialData() {
    if (!user) return;

    const tenantId = await resolveTenantId();
    if (!tenantId) return;

    const [barbRes, custRes, servRes, barbServRes, profRes] = await Promise.all([
      supabase.from("barbers").select("*").eq("user_id", tenantId).order("name"),
      supabase.from("customers").select("*").eq("user_id", tenantId).order("name"),
      supabase.from("services").select("*").eq("user_id", tenantId).eq("active", true).order("name"),
      supabase.from("barber_services").select("*").eq("user_id", tenantId),
      supabase
        .from("profiles")
        .select("business_name, slot_buffer_minutes")
        .eq("id", tenantId)
        .maybeSingle(),
    ]);

    if (barbRes.data) {
      setBarbers(barbRes.data);
      if (barbRes.data.length > 0 && !selectedBarber) {
        setSelectedBarber(role === "barber" ? user.id : barbRes.data[0].id);
      }
    }
    if (custRes.data) setCustomers(custRes.data);
    if (servRes.data) setServices(servRes.data);
    if (barbServRes.data) setBarberServices(barbServRes.data);
    if (profRes.data) {
      setShopName((profRes.data as any).business_name ?? null);
      setBufferMinutes(Number((profRes.data as any).slot_buffer_minutes || 0));
    }
  }

  const filteredServices = React.useMemo(() => {
    if (!selectedBarber) return services;
    const linkedServiceIds = barberServices
      .filter((bs) => bs.barber_id === selectedBarber)
      .map((bs) => bs.service_id);
    if (linkedServiceIds.length === 0) return [];
    return services.filter((s) => linkedServiceIds.includes(s.id));
  }, [services, barberServices, selectedBarber]);

  const barberObj = barbers.find((b) => b.id === selectedBarber);
  const serviceObj = services.find((s) => s.id === selectedService);
  const customerObj = customers.find((c) => c.id === selectedCustomer);

  const workingHoursForDate = React.useMemo(() => {
    if (!barberObj?.working_hours || !selectedDate) return null;
    return (barberObj.working_hours as any)?.[dayKeyFromDate(selectedDate)] || null;
  }, [barberObj, selectedDate]);

  const isDayEnabled = React.useCallback(
    (date: Date) => {
      const wh = barberObj?.working_hours as any;
      if (!wh) return true;
      const key = dayKeyFromDate(format(date, "yyyy-MM-dd"));
      return !!wh?.[key]?.enabled;
    },
    [barberObj],
  );

  // Compute next available day (UI hint only)
  useEffect(() => {
    if (!barberObj?.working_hours) {
      setNextAvailableDate(null);
      return;
    }
    for (let i = 0; i < 30; i++) {
      const d = addDays(new Date(), i);
      if (isDayEnabled(d)) {
        setNextAvailableDate(format(d, "yyyy-MM-dd"));
        return;
      }
    }
    setNextAvailableDate(null);
  }, [barberObj, isDayEnabled]);

  // Motor único de disponibilidade (mesma lógica do online/walk-in)
  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!isOpen || currentStep !== 2 || !selectedBarber || !selectedDate) return;
      setSlotsLoading(true);
      const { slots: engineSlots } = await fetchAvailability({
        barberId: selectedBarber,
        date: selectedDate,
        durationMinutes: serviceObj?.duration_minutes || 30,
        excludeAppointmentId: editingAppointmentId || null,
      });
      if (cancelled) return;
      setSlots(engineSlots as unknown as Slot[]);
      setSlotsLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [
    isOpen,
    currentStep,
    selectedBarber,
    selectedDate,
    serviceObj,
    editingAppointmentId,
  ]);


  const breakdown = computeAppointmentTotal({
    servicePrice: Number(serviceObj?.price || 0),
    creditsUsed: Math.min(
      Number(customerObj?.credits || 0),
      Number(serviceObj?.price || 0),
    ),
  });

  const checkConflict = async (
    barberId: string,
    date: string,
    time: string,
    serviceId: string,
    customerId: string,
  ) => {
    const service = services.find((s) => s.id === serviceId);
    const timeWithSeconds = time.length === 5 ? `${time}:00` : time;
    const startTime = parseISO(`${date}T${timeWithSeconds}`);
    const endTime = addMinutes(startTime, service?.duration_minutes || 30);
    const startIso = startTime.toISOString();
    const endIso = endTime.toISOString();

    // Profissional: usa o motor central (considera buffer e todos os status ativos)
    const barberBusy = await hasConflict({
      barberId,
      startISO: startIso,
      endISO: endIso,
      excludeAppointmentId: editingAppointmentId || null,
      source: "manual",
    });
    if (barberBusy) return { conflict: true, type: "barber" };


    if (customerId) {
      let customerQuery = supabase
        .from("appointments")
        .select("id, start_time, end_time, status")
        .eq("customer_id", customerId)
        .in("status", ["scheduled", "confirmed", "in_progress"])
        .lt("start_time", endIso)
        .gt("end_time", startIso);

      if (editingAppointmentId) customerQuery = customerQuery.neq("id", editingAppointmentId);

      const { data: customerConflict, error: customerError } = await customerQuery.limit(1);
      if (customerError) {
        console.error("Customer conflict query error:", customerError);
        return { conflict: false };
      }
      if (customerConflict && customerConflict.length > 0)
        return { conflict: true, type: "customer" };
    }

    return { conflict: false };
  };

  const handleNextStep = async () => {
    if (currentStep === 1) {
      const next: Record<string, string | null> = {};
      if (!selectedBarber) next.barber = "Selecione o profissional para continuar.";
      if (!selectedService) next.service = "Selecione o serviço para continuar.";
      setErrors(next);
      if (Object.keys(next).length) return;
    }

    if (currentStep === 2) {
      const next: Record<string, string | null> = {};
      if (!selectedDate) next.date = "Escolha uma data.";
      if (!selectedTime) next.time = "Escolha um horário disponível.";
      setErrors(next);
      if (Object.keys(next).length) return;

      setIsLoading(true);
      const { conflict, type } = await checkConflict(
        selectedBarber,
        selectedDate,
        selectedTime,
        selectedService,
        selectedCustomer,
      );
      setIsLoading(false);

      if (conflict) {
        if (type === "barber") {
          toast.error(OVERLAP_MESSAGE);
        } else {
          toast.error("Este cliente já possui um agendamento conflitante neste horário.");
        }
        return;
      }
    }

    if (currentStep === 3) {
      const next: Record<string, string | null> = {};
      if (!selectedCustomer) next.customer = "Selecione ou cadastre um cliente.";
      setErrors(next);
      if (Object.keys(next).length) return;
    }

    setErrors({});
    setCurrentStep((prev) => prev + 1);
  };

  const handleCreateCustomer = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const tenantId = await resolveTenantId();

      const { data, error } = await supabase
        .from("customers")
        .insert([
          {
            user_id: tenantId,
            barber_id: selectedBarber,
            name: newCustomer.name,
            phone: newCustomer.phone,
          },
        ])
        .select()
        .single();

      if (error) throw error;

      toast.success("Cliente cadastrado com sucesso!");
      setCustomers((prev) => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
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
      const tenantId = await resolveTenantId();
      if (!tenantId) throw new Error("Não foi possível identificar a barbearia.");


      const service = services.find((s) => s.id === selectedService);
      const customer = customers.find((c) => c.id === selectedCustomer);
      const timeWithSeconds = selectedTime.length === 5 ? `${selectedTime}:00` : selectedTime;
      const startTime = parseISO(`${selectedDate}T${timeWithSeconds}`);
      const endTime = addMinutes(startTime, service?.duration_minutes || 30);

      const totalPrice = service?.price || 0;
      let finalAmount = totalPrice;
      let usedCredits = 0;

      if (paymentMethod === "wallet" || (customer?.credits && Number(customer.credits) > 0)) {
        const availableCredits = Number(customer?.credits || 0);
        usedCredits = Math.min(availableCredits, totalPrice);
        finalAmount = totalPrice - usedCredits;
      }

      const appointmentPayload: any = {
        user_id: tenantId,
        tenant_id: tenantId,
        customer_id: selectedCustomer,
        service_id: selectedService,
        barber_id: selectedBarber,
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
        total_price: totalPrice,
        original_total: totalPrice,
        status: "pending",
        payment_status:
          paymentStatus === "paid" ? "paid" : finalAmount === 0 && totalPrice > 0 ? "paid" : "pending",
        payment_method:
          usedCredits > 0 ? (finalAmount === 0 ? "wallet" : "mixed") : paymentMethod || "cash",
        credit_used: usedCredits,
        final_amount: finalAmount,
        source: "admin",
        confirmation_sent: false,
        items: [
          {
            id: selectedService,
            name: service?.name,
            type: "service",
            price: service?.price,
            quantity: 1,
          },
        ],
      };

      if (usedCredits > 0) {
        const { data: creditRes, error: creditErr } = await supabase.rpc("use_customer_credits", {
          p_customer_id: selectedCustomer,
          p_amount: usedCredits,
        });

        if (creditErr || !(creditRes as any)?.success) {
          throw new Error((creditRes as any)?.error || "Erro ao utilizar créditos");
        }
      }

      let appointmentData;
      if (editingAppointmentId) {
        const { data, error } = await supabase
          .from("appointments")
          .update(appointmentPayload)
          .eq("id", editingAppointmentId)
          .select()
          .single();
        if (error) {
          console.error("SUPABASE ERROR (update appointment admin):", error);
          throw error;
        }
        appointmentData = data;
      } else {
        const { data, error } = await supabase
          .from("appointments")
          .insert([appointmentPayload])
          .select()
          .single();
        if (error) {
          console.error("SUPABASE ERROR (insert appointment admin):", error);
          throw error;
        }
        appointmentData = data;
      }

      const notificationMessage = `${customer?.name} agendou ${service?.name} às ${selectedTime}`;

      if (appointmentData.payment_status === "paid" && Number(appointmentData.total_price || 0) > 0) {
        const { data: existingTrans } = await supabase
          .from("transactions")
          .select("id")
          .eq("appointment_id", appointmentData.id)
          .maybeSingle();

        if (!existingTrans) {
          const credits = Number(appointmentData.credit_used || 0);
          const cashback = Number(appointmentData.cashback_used || 0);
          const amount = Number(
            appointmentData.final_amount ??
              Number(appointmentData.total_price || 0) - credits - cashback,
          );

          if (amount > 0) {
            await supabase.from("transactions").insert([
              {
                amount,
                type: "income",
                description: `Agendamento Antecipado (${appointmentData.payment_method?.toUpperCase()}): ${service?.name || "Serviço"} - ${customer?.name || "Cliente"}`,
                category: "Serviço",
                barber_id: appointmentData.barber_id,
                appointment_id: appointmentData.id,
                tenant_id: tenantId,
                user_id: tenantId,
                date: new Date().toISOString().split("T")[0],
              },
            ]);
          }
        }
      }

      await Promise.all([
        createNotification({
          userId: tenantId as string,
          type: "appointment_created",
          title: editingAppointmentId ? "Agendamento Editado" : "Novo Agendamento",
          message: notificationMessage,
          barberId: selectedBarber,
          customerId: selectedCustomer,
          metadata: { appointmentId: appointmentData.id },
        }),
      ]);

      const actorIsBarber = role === "barber";
      const rescheduleEvent = actorIsBarber
        ? "appointment.rescheduled.by_barber"
        : "appointment.rescheduled.by_shop";
      const rescheduleExtra: Record<string, any> = {
        payment_method: appointmentData.payment_method || "",
      };
      if (editingAppointmentId && originalStartTime) {
        const oldStart = parseISO(originalStartTime);
        rescheduleExtra.old_date = format(oldStart, "dd/MM/yyyy");
        rescheduleExtra.old_time = format(oldStart, "HH:mm");
        const newStart = parseISO(`${selectedDate}T${selectedTime}:00`);
        rescheduleExtra.new_date = format(newStart, "dd/MM/yyyy");
        rescheduleExtra.new_time = format(newStart, "HH:mm");
      }
      emitAutomationEvent({
        tenantId: tenantId as string,
        event: editingAppointmentId ? (rescheduleEvent as any) : "appointment.created",
        appointmentId: appointmentData.id,
        customerId: selectedCustomer,
        extra: rescheduleExtra,
      });

      toast.success(
        editingAppointmentId
          ? "Agendamento atualizado com sucesso!"
          : "Agendamento criado com sucesso!",
      );
      setOpen(false);
      setCurrentStep(1);
      refreshLimits();
      if (onSuccess) onSuccess();

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

  const serviceWarning =
    selectedBarber && filteredServices.length === 0
      ? "Este profissional ainda não possui serviços vinculados. Cadastre em Profissionais > Serviços."
      : null;

  return (
    <>
      <Dialog
        open={isOpen}
        onOpenChange={(val) => {
          setOpen(val);
          if (!val) setCurrentStep(1);
        }}
      >
        {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
        <DialogContent
          className="flex max-h-[92vh] w-[calc(100vw-1.5rem)] max-w-3xl flex-col gap-0 overflow-hidden rounded-2xl border border-border bg-background p-0 text-foreground shadow-2xl"
          onOpenAutoFocus={(e) => e.preventDefault()}
          onPointerDownOutside={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
        >
          {canAddAppointment ? (
            <>
              <DialogHeader className="space-y-3 border-b border-border bg-card px-5 py-4 text-left sm:px-6">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                    {editingAppointmentId ? (
                      <Pencil className="h-5 w-5" />
                    ) : (
                      <CalendarPlus className="h-5 w-5" />
                    )}
                  </span>
                  <div className="min-w-0">
                    <DialogTitle className="truncate text-lg font-black tracking-tight">
                      {editingAppointmentId ? "Editar agendamento" : "Novo agendamento"}
                    </DialogTitle>
                    <p className="truncate text-xs text-muted-foreground">
                      {shopName || "Agendamento manual"}
                    </p>
                  </div>
                </div>
                <AppointmentStepper current={currentStep} />
              </DialogHeader>

              <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
                {currentStep === 1 && (
                  <ProfessionalServiceStep
                    barbers={barbers}
                    services={filteredServices}
                    selectedBarber={selectedBarber}
                    selectedService={selectedService}
                    onBarberChange={(id) => {
                      setSelectedBarber(id);
                      setSelectedService("");
                      setSelectedTime("");
                      setErrors((e) => ({ ...e, barber: null }));
                    }}
                    onServiceChange={(id) => {
                      setSelectedService(id);
                      setErrors((e) => ({ ...e, service: null }));
                    }}
                    errors={errors}
                    serviceWarning={serviceWarning}
                  />
                )}

                {currentStep === 2 && (
                  <DateTimeStep
                    barber={barberObj}
                    service={serviceObj}
                    selectedDate={selectedDate}
                    selectedTime={selectedTime}
                    onDateChange={(d) => {
                      setSelectedDate(d);
                      setSelectedTime("");
                      setErrors((e) => ({ ...e, date: null }));
                    }}
                    onTimeChange={(t) => {
                      setSelectedTime(t);
                      setErrors((e) => ({ ...e, time: null }));
                    }}
                    slots={slots}
                    slotsLoading={slotsLoading}
                    isDayEnabled={isDayEnabled}
                    nextAvailableDate={nextAvailableDate}
                    errors={errors}
                  />
                )}

                {currentStep === 3 && (
                  <CustomerStep
                    customers={customers}
                    selectedCustomer={selectedCustomer}
                    onCustomerChange={(id) => {
                      setSelectedCustomer(id);
                      setErrors((e) => ({ ...e, customer: null }));
                    }}
                    onCreateNew={() => setIsNewCustomerDialogOpen(true)}
                    errors={errors}
                  />
                )}

                {currentStep === 4 && (
                  <AppointmentReviewStep
                    barber={barberObj}
                    customer={customerObj}
                    service={serviceObj}
                    selectedDate={selectedDate}
                    selectedTime={selectedTime}
                    shopName={shopName}
                    breakdown={breakdown}
                    paymentStatus={paymentStatus}
                    paymentMethod={paymentMethod}
                    onPaymentStatusChange={setPaymentStatus}
                    onPaymentMethodChange={setPaymentMethod}
                    mixedCredits=""
                    mixedOther=""
                    onMixedCreditsChange={() => {}}
                    onMixedOtherChange={() => {}}
                    onEditStep={setCurrentStep}
                    errors={errors}
                  />
                )}
              </div>

              <DialogFooter className="border-t border-border bg-card px-5 py-4 sm:px-6">
                <AppointmentModalFooter
                  step={currentStep}
                  isLoading={isLoading}
                  isEditing={!!editingAppointmentId}
                  onBack={() => setCurrentStep((prev) => prev - 1)}
                  onNext={handleNextStep}
                  onConfirm={handleCreateAppointment}
                />
              </DialogFooter>
            </>
          ) : (
            <div className="space-y-4 p-6">
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Limite de Agendamentos Atingido</AlertTitle>
                <AlertDescription>
                  Seu plano atual permite apenas {limits.monthlyAppointments} agendamentos por mês.
                  Faça o upgrade para o plano Pro para agendamentos ilimitados.
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
          if (!open) setNewCustomer({ name: "", phone: "" });
        }}
      >
        <DialogContent className="rounded-2xl sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="text-lg font-black">Cadastrar novo cliente</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="new-customer-name">Nome completo</Label>
              <Input
                id="new-customer-name"
                placeholder="Nome do cliente"
                value={newCustomer.name}
                onChange={(e) => setNewCustomer((prev) => ({ ...prev, name: e.target.value }))}
                autoComplete="off"
                className="rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-customer-phone">Telefone</Label>
              <Input
                id="new-customer-phone"
                placeholder="(00) 00000-0000"
                value={newCustomer.phone}
                onChange={(e) => setNewCustomer((prev) => ({ ...prev, phone: e.target.value }))}
                autoComplete="off"
                className="rounded-xl"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="rounded-xl"
              onClick={() => {
                setIsNewCustomerDialogOpen(false);
                setNewCustomer({ name: "", phone: "" });
              }}
            >
              Cancelar
            </Button>
            <Button
              className="rounded-xl font-bold"
              onClick={handleCreateCustomer}
              disabled={isLoading || !newCustomer.name}
            >
              {isLoading ? "Salvando..." : "Cadastrar cliente"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
