import { createServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";

export const getReceptionAppointments = createServerFn({ method: "GET" })
  .validator((d: { tenantId: string; day: string }) => d)
  .handler(async ({ data: { tenantId, day } }) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { appointments: [], error: "Unauthorized" };

    const start = `${day}T00:00:00`;
    const end = `${day}T23:59:59`;

    const { data, error } = await supabase
      .from("appointments")
      .select("*, customers(*), barbers(*), services(*)")
      .eq("tenant_id", tenantId)
      .gte("start_time", start)
      .lte("start_time", end);

    return { appointments: data || [], error };
  });
