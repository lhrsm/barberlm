import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format, parseISO, addMinutes } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { emitAutomationEvent } from "@/utils/emit-event";
import { createNotification } from "@/utils/notifications";
import { Check, ChevronLeft, ChevronRight, Scissors, User, Calendar as CalIcon, Clock, Sparkles } from "lucide-react";

export interface RescheduleWizardAppointment {
  id: string;
  tenant_id: string;
  customer_id?: string | null;
  customer_name?: string | null;
  service_id: string;
  service_name?: string | null;
  barber_id: string;
  barber_name?: string | null;
  start_time: string;
  end_time?: string | null;
  appointment_group_id?: string | null;
}

export interface RescheduleWizardProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  appointment: RescheduleWizardAppointment | null;
  actor: "customer" | "barber" | "shop";
  source: string;
  allowProfessionalChange?: boolean;
  onSuccess?: () => void;
}

interface BarberOption {
  id: string;
  name: string;
  avatar_url?: string | null;
  specialties?: string[] | null;
  category?: string | null;
  working_hours?: any;
  is_active?: boolean;
}

type Step = 1 | 2 | 3 | 4 | 5;

export function RescheduleWizard({
  open,
  onOpenChange,
  appointment,
  actor,
  source,
  allowProfessionalChange = true,
  onSuccess,
}: RescheduleWizardProps) {
  const [step, setStep] = useState<Step>(1);
  const [barbers, setBarbers] = useState<BarberOption[]>([]);
  const [loadingBarbers, setLoadingBarbers] = useState(false);
  const [selectedBarberId, setSelectedBarberId] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [selectedTime, setSelectedTime] = useState<string>("");
  const [times, setTimes] = useState<string[]>([]);
  const [fetchingTimes, setFetchingTimes] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [durationMinutes, setDurationMinutes] = useState<number>(30);

  const isGroup = !!appointment?.appointment_group_id;
  const canChangeProfessional = allowProfessionalChange && !isGroup;

  // Reset wizard on open
  useEffect(() => {
    if (open && appointment) {
      setStep(1);
      setSelectedBarberId(appointment.barber_id);
      setSelectedDate(format(new Date(), "yyyy-MM-dd"));
      setSelectedTime("");
      setTimes([]);
    }
  }, [open, appointment?.id]);

  // Load eligible barbers
  useEffect(() => {
    if (!open || !appointment) return;
    (async () => {
      setLoadingBarbers(true);
      try {
        const { data, error } = await supabase.rpc("get_reschedule_options" as any, {
          p_appointment_id: appointment.id,
        } as any);
        if (error) throw error;

        const payload = data as any;
        if (!payload?.success) throw new Error(payload?.error || "Falha ao carregar profissionais");

        const list = ((payload.barbers || []) as any[]).map((b) => ({
          id: b.id,
          name: b.name,
          avatar_url: b.avatar_url,
          specialties: Array.isArray(b.specialties) ? b.specialties : [],
          category: b.category,
          working_hours: b.working_hours,
          is_active: b.is_active,
        }));
        setBarbers(list);
        if (payload.durationMinutes) setDurationMinutes(Number(payload.durationMinutes));
        else if (appointment.end_time) {
          const s = parseISO(appointment.start_time).getTime();
          const e = parseISO(appointment.end_time).getTime();
          setDurationMinutes(Math.max(15, Math.round((e - s) / 60000)));
        }
        console.log("[RescheduleWizard] barbers loaded", { count: list.length });
      } catch (err) {
        console.warn("[RescheduleWizard] failed to load barbers", err);
        setBarbers([]);
      } finally {
        setLoadingBarbers(false);
      }
    })();
  }, [open, appointment?.service_id, appointment?.barber_id, appointment?.tenant_id]);


  // Load times whenever barber+date at step 4
  useEffect(() => {
    if (step !== 4 || !selectedBarberId || !selectedDate || !appointment) return;
    (async () => {
      setFetchingTimes(true);
      setTimes([]);
      try {
        const { data, error } = await supabase.rpc("get_reschedule_options" as any, {
          p_appointment_id: appointment.id,
          p_barber_id: selectedBarberId,
          p_date: selectedDate,
        } as any);
        if (error) throw error;

        const payload = data as any;
        if (!payload?.success) throw new Error(payload?.error || "Falha ao carregar horários");
        setTimes(Array.isArray(payload.times) ? payload.times : []);
        if (payload.durationMinutes) setDurationMinutes(Number(payload.durationMinutes));
      } catch (err) {
        console.warn("[RescheduleWizard] failed to load times", err);
        setTimes([]);
      } finally {
        setFetchingTimes(false);
      }
    })();
  }, [step, selectedBarberId, selectedDate, appointment?.id]);

  const originalBarberName = useMemo(
    () => barbers.find((b) => b.id === appointment?.barber_id)?.name || appointment?.barber_name || "",
    [barbers, appointment],
  );
  const selectedBarber = useMemo(() => barbers.find((b) => b.id === selectedBarberId), [barbers, selectedBarberId]);
  const barberChanged = !!appointment && selectedBarberId !== appointment.barber_id;

  const goNext = () => {
    if (step === 1) setStep(canChangeProfessional ? 2 : 3);
    else if (step === 2) {
      if (!selectedBarberId) return toast.error("Selecione um profissional.");
      setStep(3);
      // Reset time if barber changed
      setSelectedTime("");
    } else if (step === 3) {
      if (!selectedDate) return toast.error("Escolha uma data.");
      setStep(4);
      setSelectedTime("");
    } else if (step === 4) {
      if (!selectedTime) return toast.error("Escolha um horário.");
      setStep(5);
    }
  };
  const goBack = () => {
    if (step === 5) setStep(4);
    else if (step === 4) setStep(3);
    else if (step === 3) setStep(canChangeProfessional ? 2 : 1);
    else if (step === 2) setStep(1);
  };

  const handleConfirm = async () => {
    if (!appointment || !selectedTime) return;
    setSubmitting(true);
    try {
      const timeWithSec = selectedTime.length === 5 ? `${selectedTime}:00` : selectedTime;
      const startTime = parseISO(`${selectedDate}T${timeWithSec}`);
      const endTime = addMinutes(startTime, durationMinutes);
      const oldStart = parseISO(appointment.start_time);

      const rpcArgs: any = {
        p_appointment_id: appointment.id,
        p_new_start_time: startTime.toISOString(),
        p_new_end_time: endTime.toISOString(),
        p_changed_by_type: actor,
        p_source: source,
      };
      if (barberChanged) rpcArgs.p_new_barber_id = selectedBarberId;

      const { data, error } = await supabase.rpc("reschedule_appointment", rpcArgs);
      const resp = data as any;
      if (error || !resp?.success) {
        throw new Error(error?.message || resp?.error || "Falha ao reagendar");
      }

      // Internal notification for shop
      try {
        await createNotification({
          userId: appointment.tenant_id,
          type: "appointment_rescheduled",
          title: barberChanged ? "Profissional Alterado" : "Agendamento Reagendado",
          message: `${appointment.customer_name || "Cliente"} • ${format(startTime, "dd/MM 'às' HH:mm")}`,
          barberId: selectedBarberId,
          metadata: { appointmentId: appointment.id, previous_barber_id: appointment.barber_id, new_barber_id: selectedBarberId },
        });
      } catch (e) {
        console.warn("[RescheduleWizard] createNotification failed", e);
      }

      // Automation event fan-out
      const baseExtra: Record<string, any> = {
        old_date: format(oldStart, "dd/MM/yyyy"),
        old_time: format(oldStart, "HH:mm"),
        new_date: format(startTime, "dd/MM/yyyy"),
        new_time: format(startTime, "HH:mm"),
      };
      if (barberChanged) {
        baseExtra.old_professional_name = originalBarberName;
        baseExtra.new_professional_name = selectedBarber?.name || "";
        baseExtra.previous_barber_id = appointment.barber_id;
        baseExtra.new_barber_id = selectedBarberId;
        baseExtra.actor_label =
          actor === "customer" ? "cliente" : actor === "barber" ? "profissional" : "barbearia";

        emitAutomationEvent({
          tenantId: appointment.tenant_id,
          event: "appointment.professional_changed" as any,
          appointmentId: appointment.id,
          customerId: appointment.customer_id || undefined,
          extra: baseExtra,
        });
      } else {
        const event = `appointment.rescheduled.by_${actor}` as any;
        emitAutomationEvent({
          tenantId: appointment.tenant_id,
          event,
          appointmentId: appointment.id,
          customerId: appointment.customer_id || undefined,
          extra: baseExtra,
        });
      }

      toast.success(barberChanged ? "Agendamento atualizado com novo profissional!" : "Agendamento reagendado!");
      onOpenChange(false);
      onSuccess?.();
    } catch (err: any) {
      toast.error(err?.message || "Erro ao reagendar");
    } finally {
      setSubmitting(false);
    }
  };

  if (!appointment) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px] bg-gradient-to-br from-[#0F0F14] via-[#0A0A0A] to-black border border-[#D4AF37]/30 shadow-[0_20px_60px_-15px_rgba(212,175,55,0.35)] text-white max-h-[92vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-white text-xl font-black tracking-tight flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-[#D4AF37]" /> Reagendar atendimento
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            Etapa {step} de {canChangeProfessional ? 5 : 4}
          </DialogDescription>
        </DialogHeader>

        {/* Stepper */}
        <div className="flex items-center gap-1 mb-2">
          {Array.from({ length: canChangeProfessional ? 5 : 4 }).map((_, i) => (
            <div
              key={i}
              className={cn(
                "h-1.5 flex-1 rounded-full transition-all",
                i + 1 <= step ? "bg-gradient-to-r from-[#D4AF37] to-[#F5D061]" : "bg-white/10",
              )}
            />
          ))}
        </div>

        <div className="flex-1 overflow-y-auto pr-1">
          {/* Step 1: Serviço */}
          {step === 1 && (
            <div className="space-y-4 py-3">
              <p className="text-[10px] uppercase tracking-[0.3em] font-black text-[#D4AF37]">Serviço</p>
              <div className="rounded-2xl bg-white/5 border border-white/10 p-4 flex items-center gap-3">
                <Scissors className="h-5 w-5 text-[#D4AF37]" />
                <div>
                  <p className="font-bold text-white">{appointment.service_name || "Serviço"}</p>
                  <p className="text-xs text-gray-400">Duração: {durationMinutes} min</p>
                </div>
              </div>
              <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
                <p className="text-[10px] uppercase tracking-widest text-gray-500 mb-1">Agendamento atual</p>
                <p className="text-sm font-semibold">
                  {format(parseISO(appointment.start_time), "dd 'de' MMMM 'às' HH:mm", { locale: ptBR })}
                </p>
                <p className="text-xs text-gray-400 mt-1">com {originalBarberName || "profissional"}</p>
              </div>
              {isGroup && (
                <p className="text-xs text-amber-400/80">
                  Este é um agendamento em grupo — a troca de profissional não está disponível.
                </p>
              )}
            </div>
          )}

          {/* Step 2: Profissional */}
          {step === 2 && canChangeProfessional && (
            <div className="space-y-3 py-3">
              <p className="text-[10px] uppercase tracking-[0.3em] font-black text-[#D4AF37]">Escolha o profissional</p>
              {loadingBarbers ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#D4AF37]" />
                </div>
              ) : barbers.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-white/5 p-5 text-center space-y-2">
                  <p className="text-sm text-white/80 font-semibold">Nenhum profissional está vinculado a este serviço.</p>
                  <p className="text-xs text-gray-400">Entre em contato com a barbearia.</p>
                </div>
              ) : (
                <div className="grid gap-2 max-h-[340px] overflow-y-auto p-1">
                  {barbers.map((b) => {
                    const isCurrent = b.id === appointment.barber_id;
                    const isSelected = selectedBarberId === b.id;
                    const specialtyText = [b.category, ...(b.specialties || [])].filter(Boolean).join(" • ");
                    return (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() => {
                          if (b.id !== selectedBarberId) {
                            setSelectedBarberId(b.id);
                            setSelectedTime("");
                          }
                        }}
                        className={cn(
                          "w-full text-left rounded-2xl border p-3 flex items-center gap-3 transition-all",
                          isSelected
                            ? "bg-gradient-to-r from-[#D4AF37]/20 to-transparent border-[#D4AF37]"
                            : "bg-white/5 border-white/10 hover:border-[#D4AF37]/40",
                        )}
                      >
                        {b.avatar_url ? (
                          <img src={b.avatar_url} alt={b.name} className="h-11 w-11 rounded-full object-cover shrink-0" />
                        ) : (
                          <div className="h-11 w-11 shrink-0 rounded-full bg-white/10 flex items-center justify-center">
                            <User className="h-5 w-5 text-white/70" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-bold text-white truncate">{b.name}</p>
                            {isCurrent && (
                              <Badge className="bg-[#D4AF37]/20 text-[#D4AF37] border border-[#D4AF37]/40 text-[10px] uppercase">
                                Profissional atual
                              </Badge>
                            )}
                          </div>
                          {specialtyText && (
                            <p className="text-xs text-gray-400 truncate">{specialtyText}</p>
                          )}
                        </div>
                        {isSelected && <Check className="h-5 w-5 text-[#D4AF37] shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              )}

            </div>
          )}

          {/* Step 3: Data */}
          {step === 3 && (
            <div className="space-y-3 py-3">
              <p className="text-[10px] uppercase tracking-[0.3em] font-black text-[#D4AF37]">Nova data</p>
              <input
                type="date"
                min={format(new Date(), "yyyy-MM-dd")}
                value={selectedDate}
                onChange={(e) => {
                  setSelectedDate(e.target.value);
                  setSelectedTime("");
                }}
                className="w-full h-12 bg-white/5 border border-white/10 rounded-xl px-4 text-white focus:border-[#D4AF37] outline-none [color-scheme:dark]"
              />
              {selectedBarber && (
                <p className="text-xs text-gray-500 flex items-center gap-2">
                  <User className="h-3.5 w-3.5" /> Com {selectedBarber.name}
                </p>
              )}
            </div>
          )}

          {/* Step 4: Horário */}
          {step === 4 && (
            <div className="space-y-3 py-3">
              <p className="text-[10px] uppercase tracking-[0.3em] font-black text-[#D4AF37]">Novo horário</p>
              {fetchingTimes ? (
                <div className="flex flex-col items-center gap-2 py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#D4AF37]" />
                  <p className="text-xs text-gray-500">Buscando horários disponíveis...</p>
                </div>
              ) : times.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-white/5 p-5 text-center space-y-3">
                  <p className="text-sm text-white/80 font-semibold">Nenhum horário disponível para este profissional nesta data.</p>
                  <div className="flex flex-col sm:flex-row gap-2 justify-center">
                    <Button
                      variant="outline"
                      onClick={() => setStep(3)}
                      className="border-[#D4AF37]/40 text-[#D4AF37] hover:bg-[#D4AF37]/10 hover:text-[#D4AF37]"
                    >
                      Escolher outra data
                    </Button>
                    {canChangeProfessional && (
                      <Button
                        variant="outline"
                        onClick={() => setStep(2)}
                        className="border-[#D4AF37]/40 text-[#D4AF37] hover:bg-[#D4AF37]/10 hover:text-[#D4AF37]"
                      >
                        Trocar profissional
                      </Button>
                    )}
                  </div>
                </div>

              ) : (
                <div className="grid grid-cols-3 gap-2 max-h-[280px] overflow-y-auto p-1">
                  {times.map((t) => {
                    const active = selectedTime === t;
                    return (
                      <button
                        key={t}
                        onClick={() => setSelectedTime(t)}
                        className={cn(
                          "h-11 rounded-xl text-sm font-bold border transition-all",
                          active
                            ? "bg-gradient-to-r from-[#D4AF37] to-[#F5D061] text-black border-transparent shadow-[0_8px_20px_rgba(212,175,55,0.35)]"
                            : "bg-white/5 border-white/10 text-white hover:border-[#D4AF37]/40",
                        )}
                      >
                        {t}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Step 5: Resumo */}
          {step === 5 && (
            <div className="space-y-3 py-3">
              <p className="text-[10px] uppercase tracking-[0.3em] font-black text-[#D4AF37]">Confirme a alteração</p>
              <div className="rounded-2xl bg-white/5 border border-white/10 p-4 space-y-3">
                <SummaryRow icon={<Scissors className="h-4 w-4" />} label="Serviço" value={appointment.service_name || "—"} />
                <SummaryRow
                  icon={<User className="h-4 w-4" />}
                  label="Profissional"
                  value={selectedBarber?.name || originalBarberName}
                  hint={barberChanged ? `Antes: ${originalBarberName}` : undefined}
                />
                <SummaryRow
                  icon={<CalIcon className="h-4 w-4" />}
                  label="Data"
                  value={format(parseISO(selectedDate), "dd 'de' MMMM", { locale: ptBR })}
                  hint={`Antes: ${format(parseISO(appointment.start_time), "dd 'de' MMMM", { locale: ptBR })}`}
                />
                <SummaryRow
                  icon={<Clock className="h-4 w-4" />}
                  label="Horário"
                  value={selectedTime}
                  hint={`Antes: ${format(parseISO(appointment.start_time), "HH:mm")}`}
                />
              </div>
              {barberChanged && (
                <p className="text-xs text-[#D4AF37]/90">
                  ✨ O novo profissional será notificado e as comissões futuras serão atribuídas a ele.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {(() => {
          const nextDisabled =
            (step === 2 && !selectedBarberId) ||
            (step === 3 && !selectedDate) ||
            (step === 4 && !selectedTime);
          const hint =
            step === 2 && !selectedBarberId
              ? "Escolha um profissional para continuar."
              : step === 3 && !selectedDate
                ? "Escolha uma data para continuar."
                : step === 4 && !selectedTime
                  ? "Escolha um horário para continuar."
                  : "";
          return (
            <div className="pt-3 border-t border-white/5 mt-2 space-y-2">
              {hint && step < 5 && (
                <p className="text-[11px] text-amber-300/70 text-center sm:text-right">{hint}</p>
              )}
              <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3">
                <Button
                  variant="ghost"
                  onClick={step === 1 ? () => onOpenChange(false) : goBack}
                  disabled={submitting}
                  className="w-full sm:w-auto h-12 rounded-xl text-gray-300 hover:text-white hover:bg-white/5"
                >
                  <ChevronLeft className="h-4 w-4 mr-1" /> {step === 1 ? "Fechar" : "Voltar"}
                </Button>
                {step < 5 ? (
                  <Button
                    onClick={goNext}
                    disabled={nextDisabled}
                    className="w-full sm:w-auto h-12 rounded-[14px] px-6 bg-gradient-to-r from-[#D4AF37] to-[#F5D061] text-black font-semibold shadow-[0_10px_28px_rgba(212,175,55,0.4)] hover:brightness-110 hover:-translate-y-[1px] transition-all disabled:opacity-40 disabled:pointer-events-none"
                  >
                    Continuar <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                ) : (
                  <Button
                    onClick={handleConfirm}
                    disabled={submitting}
                    className="w-full sm:w-auto h-12 rounded-[14px] px-6 bg-gradient-to-r from-[#D4AF37] to-[#F5D061] text-black font-semibold shadow-[0_10px_28px_rgba(212,175,55,0.4)] hover:brightness-110 hover:-translate-y-[1px] transition-all disabled:opacity-50"
                  >
                    {submitting ? "Salvando..." : "Confirmar reagendamento"}
                  </Button>
                )}
              </div>
            </div>
          );
        })()}
      </DialogContent>
    </Dialog>
  );
}



function SummaryRow({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 text-[#D4AF37]">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] uppercase tracking-widest text-gray-500">{label}</p>
        <p className="font-bold text-white truncate">{value}</p>
        {hint && <p className="text-[11px] text-gray-500 mt-0.5">{hint}</p>}
      </div>
    </div>
  );
}
