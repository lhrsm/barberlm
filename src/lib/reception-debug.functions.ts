import { createServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";

export const getReceptionAppointments = createServerFn({ method: "GET" })
  .handler(async ({ request }) => {
    // A implementação real dependerá da necessidade de bypassar RLS ou não.
    // Para diagnóstico, usaremos o cliente padrão que respeita RLS.
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { appointments: [], error: "Unauthorized" };

    const url = new URL(request.url);
    const tenantId = url.searchParams.get("tenantId");
    const day = url.searchParams.get("day");

    if (!tenantId || !day) return { appointments: [], error: "Missing parameters" };

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
