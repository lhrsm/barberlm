import { supabase } from "@/integrations/supabase/client";

export type SlotState = "available" | "busy" | "past" | "overflow";

export interface AvailabilitySlot {
  time: string;
  end_time: string;
  iso: string;
  state: SlotState;
  period: "morning" | "afternoon" | "evening";
}

export interface AvailabilityResult {
  slots: AvailabilitySlot[];
  bufferMinutes: number;
  durationMinutes: number;
  open?: string;
  close?: string;
  closed?: boolean;
}

function periodOf(time: string): AvailabilitySlot["period"] {
  const h = Number(time.split(":")[0] || 0);
  return h < 12 ? "morning" : h < 18 ? "afternoon" : "evening";
}

/**
 * Motor único de disponibilidade do Barbex.
 * Toda a lógica de interseção de intervalos, buffer, expediente e
 * atendimentos existentes (online, manual e walk-in) vive no banco,
 * na função `get_availability_slots`.
 */
export async function fetchAvailability(params: {
  barberId: string;
  date: string;
  durationMinutes: number;
  excludeAppointmentId?: string | null;
  stepMinutes?: number;
}): Promise<AvailabilityResult> {
  const { barberId, date, durationMinutes, excludeAppointmentId, stepMinutes } = params;
  if (!barberId || !date) {
    return { slots: [], bufferMinutes: 0, durationMinutes: durationMinutes || 30 };
  }

  const { data, error } = await supabase.rpc("get_availability_slots" as any, {
    p_barber_id: barberId,
    p_date: date,
    p_duration_minutes: Math.max(Number(durationMinutes) || 30, 5),
    p_exclude_appointment_id: excludeAppointmentId || null,
    p_step_minutes: stepMinutes ?? 30,
  });

  if (error) {
    console.error("AVAILABILITY_ENGINE_ERROR", error);
    return { slots: [], bufferMinutes: 0, durationMinutes: durationMinutes || 30 };
  }

  const payload = (data || {}) as any;
  const slots: AvailabilitySlot[] = (payload.slots || []).map((s: any) => ({
    time: s.time,
    end_time: s.end_time,
    iso: s.iso,
    state: s.state as SlotState,
    period: periodOf(s.time),
  }));

  return {
    slots,
    bufferMinutes: Number(payload.buffer_minutes || 0),
    durationMinutes: Number(payload.duration_minutes || durationMinutes || 30),
    open: payload.open,
    close: payload.close,
    closed: !!payload.closed,
  };
}

/** Apenas os horários realmente livres (usado nas telas públicas). */
export async function fetchAvailableTimes(params: {
  barberId: string;
  date: string;
  durationMinutes: number;
  excludeAppointmentId?: string | null;
}): Promise<string[]> {
  const { slots } = await fetchAvailability(params);
  return slots.filter((s) => s.state === "available").map((s) => s.time);
}

/** Validação final antes de gravar (backend também bloqueia via trigger). */
export async function hasConflict(params: {
  barberId: string;
  startISO: string;
  endISO: string;
  excludeAppointmentId?: string | null;
  source?: "online" | "manual" | "walkin" | "reschedule" | "unknown";
}): Promise<boolean> {
  const { data, error } = await supabase.rpc("check_appointment_conflict" as any, {
    p_barber_id: params.barberId,
    p_start: params.startISO,
    p_end: params.endISO,
    p_exclude_appointment_id: params.excludeAppointmentId || null,
  });
  if (error) {
    console.error("AVAILABILITY_CONFLICT_CHECK_ERROR", error);
    return false;
  }

  const conflict = !!data;
  if (conflict) {
    // Auditoria da tentativa de conflito (fire-and-forget)
    supabase
      .rpc("log_availability_conflict" as any, {
        p_barber_id: params.barberId,
        p_start: params.startISO,
        p_end: params.endISO,
        p_source: params.source || "unknown",
        p_result: "conflict",
      })
      .then(({ error: logError }) => {
        if (logError) console.warn("AVAILABILITY_CONFLICT_LOG_FAILED", logError);
      });
  }
  return conflict;
}


export const OVERLAP_MESSAGE =
  "Este profissional já possui um atendimento nesse intervalo. Escolha outro horário.";
