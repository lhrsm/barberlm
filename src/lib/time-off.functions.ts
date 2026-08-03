import { supabase } from "@/integrations/supabase/client";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { Database } from "@/integrations/supabase/types";

export type TimeOffType = Database["public"]["Enums"]["time_off_type"];
export type TimeOffStatus = Database["public"]["Enums"]["time_off_status"];
export type ApprovalStatus = Database["public"]["Enums"]["approval_status"];

export interface TimeOff {
  id: string;
  professional_id: string;
  type: TimeOffType;
  title: string | null;
  description: string | null;
  starts_at: string;
  ends_at: string;
  all_day: boolean;
  status: TimeOffStatus;
  approval_status: ApprovalStatus;
  created_at: string;
}

export const getTimeOff = createServerFn({ method: "GET" })
  .inputValidator((data) => 
    z.object({ 
      professionalId: z.string(),
      startDate: z.string().optional(),
      endDate: z.string().optional()
    }).parse(data)
  )
  .handler(async ({ data }) => {
    let query = supabase
      .from("professional_time_off")
      .select("*")
      .eq("professional_id", data.professionalId)
      .order("starts_at", { ascending: true });

    if (data.startDate) {
      query = query.gte("starts_at", data.startDate);
    }
    if (data.endDate) {
      query = query.lte("ends_at", data.endDate);
    }

    const { data: timeOff, error } = await query;
    if (error) throw error;
    return timeOff as TimeOff[];
  });

export const createTimeOff = createServerFn({ method: "POST" })
  .inputValidator((data) => 
    z.object({
      professional_id: z.string(),
      type: z.enum([
        'day_off', 'personal_block', 'break', 'meeting', 'training', 
        'vacation', 'medical_leave', 'personal_leave', 'suspension', 'other'
      ]),
      title: z.string().optional(),
      description: z.string().optional(),
      starts_at: z.string(),
      ends_at: z.string(),
      all_day: z.boolean().default(false),
      approval_status: z.enum(['not_required', 'pending', 'approved', 'rejected']).default('approved')
    }).parse(data)
  )
  .handler(async ({ data }) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Unauthorized");

    // Get professional to find tenant_id
    const { data: professional } = await supabase
      .from("barbers")
      .select("tenant_id")
      .eq("id", data.professional_id)
      .single();

    if (!professional) throw new Error("Professional not found");

    const { data: timeOff, error } = await supabase
      .from("professional_time_off")
      .insert({
        ...data,
        tenant_id: professional.tenant_id,
        requested_by: user.id
      })
      .select()
      .single();

    if (error) throw error;
    return timeOff as TimeOff;
  });

export const updateTimeOff = createServerFn({ method: "POST" })
  .inputValidator((data) => 
    z.object({
      id: z.string(),
      updates: z.object({
        type: z.string().optional(),
        title: z.string().optional(),
        description: z.string().optional(),
        starts_at: z.string().optional(),
        ends_at: z.string().optional(),
        all_day: z.boolean().optional(),
        status: z.string().optional(),
        approval_status: z.string().optional()
      })
    }).parse(data)
  )
  .handler(async ({ data }) => {
    const { data: timeOff, error } = await supabase
      .from("professional_time_off")
      .update(data.updates)
      .eq("id", data.id)
      .select()
      .single();

    if (error) throw error;
    return timeOff as TimeOff;
  });

export const deleteTimeOff = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ id: z.string() }).parse(data))
  .handler(async ({ data }) => {
    const { error } = await supabase
      .from("professional_time_off")
      .delete()
      .eq("id", data.id);

    if (error) throw error;
    return { success: true };
  });

export const checkConflicts = createServerFn({ method: "GET" })
  .inputValidator((data) => 
    z.object({
      professionalId: z.string(),
      startsAt: z.string(),
      endsAt: z.string()
    }).parse(data)
  )
  .handler(async ({ data }) => {
    const { data: conflicts, error } = await supabase.rpc("check_time_off_conflicts", {
      p_professional_id: data.professionalId,
      p_starts_at: data.startsAt,
      p_ends_at: data.endsAt
    });

    if (error) throw error;
    return conflicts;
  });
