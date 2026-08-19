import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const getAdminAppointmentDetails = createServerFn({ method: "GET" })
  .inputValidator((id: string) => id)
  .handler(async ({ data: id }) => {
    const { data, error } = await supabaseAdmin
      .from("appointments")
      .select("*, customers(*), services(*), barbers:barbers!appointments_barber_id_fkey(*)")
      .eq("id", id)
      .single();

    if (error) throw error;
    return data;
  });
