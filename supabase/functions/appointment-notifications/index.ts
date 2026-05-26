import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { appointmentId, type, updatedBy, previousData } = await req.json();

    console.log(`[Appointment Notification] Processing: ${type} for Appointment: ${appointmentId}`);

    // Fetch appointment details
    const { data: appointment, error: appError } = await supabase
      .from("appointments")
      .select("*, customers(*), barbers(*), services(*)")
      .eq("id", appointmentId)
      .single();

    if (appError || !appointment) throw new Error("Agendamento não encontrado");

    const tenantId = appointment.tenant_id;
    const customer = appointment.customers;
    const barber = appointment.barbers;
    const service = appointment.services;

    const { data: profile } = await supabase.from("profiles").select("whatsapp_enabled, business_name").eq("id", tenantId).single();

    const formatDate = (dateStr: string) => {
      const date = new Date(dateStr);
      return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' }).format(date);
    };

    const formatTime = (dateStr: string) => {
      const date = new Date(dateStr);
      return new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(date);
    };

    const placeholders = {
      cliente_nome: customer?.name || "Cliente",
      data: formatDate(appointment.start_time),
      horario: formatTime(appointment.start_time),
      servico: service?.name || "Serviço",
      barbeiro_nome: barber?.name || "Profissional",
      barbearia_nome: profile?.business_name || "Barbearia"
    };

    let notifications = [];

    if (type === "appointment_cancelled") {
      if (updatedBy.type === "customer") {
        // Notify Barber and Admin
        notifications.push({
          target: "barber",
          message: `O cliente ${placeholders.cliente_nome} cancelou o atendimento agendado para ${placeholders.data} às ${placeholders.horario}.`
        });
        notifications.push({
          target: "admin",
          message: `O cliente ${placeholders.cliente_nome} cancelou o agendamento de ${placeholders.data} às ${placeholders.horario}.`
        });
      } else if (updatedBy.type === "admin") {
        // Notify Customer and Barber
        notifications.push({
          target: "customer",
          phone: customer?.phone,
          message: `Olá ${placeholders.cliente_nome}, seu agendamento para o dia ${placeholders.data} às ${placeholders.horario} foi cancelado pela barbearia ${placeholders.barbearia_nome}.`
        });
        notifications.push({
          target: "barber",
          message: `A barbearia cancelou o atendimento de ${placeholders.cliente_nome} marcado para ${placeholders.data} às ${placeholders.horario}.`
        });
      } else if (updatedBy.type === "barber") {
        // Notify Customer and Admin
        notifications.push({
          target: "customer",
          phone: customer?.phone,
          message: `Olá ${placeholders.cliente_nome}, seu atendimento para o dia ${placeholders.data} às ${placeholders.horario} foi cancelado pelo profissional ${placeholders.barbeiro_nome}.`
        });
        notifications.push({
          target: "admin",
          message: `O barbeiro ${placeholders.barbeiro_nome} cancelou o atendimento de ${placeholders.cliente_nome} para ${placeholders.data} às ${placeholders.horario}.`
        });
      }
    } else if (type === "appointment_rescheduled") {
      const newTime = `${placeholders.data} às ${placeholders.horario}`;
      if (updatedBy.type === "customer") {
        notifications.push({
          target: "barber",
          message: `O cliente ${placeholders.cliente_nome} reagendou o atendimento para ${newTime}.`
        });
        notifications.push({
          target: "admin",
          message: `O cliente ${placeholders.cliente_nome} reagendou o atendimento para ${newTime}.`
        });
      } else {
        // Barber or Admin rescheduled, notify customer
        notifications.push({
          target: "customer",
          phone: customer?.phone,
          message: `Olá ${placeholders.cliente_nome}, seu atendimento foi reagendado para ${newTime} por ${updatedBy.type === 'barber' ? 'seu profissional' : 'nossa barbearia'}.`
        });
        // Also notify the other party (if barber rescheduled, notify admin, and vice-versa)
        notifications.push({
          target: updatedBy.type === 'barber' ? 'admin' : 'barber',
          message: `O atendimento de ${placeholders.cliente_nome} foi reagendado para ${newTime} por ${updatedBy.type === 'barber' ? placeholders.barbeiro_nome : 'administrador'}.`
        });
      }
    }

    // Send notifications
    for (const note of notifications) {
      // 1. Dashboard Notification
      await supabase.from("notifications").insert({
        user_id: tenantId,
        barber_id: note.target === "barber" ? barber?.id : null,
        title: type === "appointment_cancelled" ? "Agendamento Cancelado" : "Agendamento Reagendado",
        message: note.message,
        type: "appointment",
        link: "/calendar"
      });

      // 2. WhatsApp Notification (if enabled and target is customer)
      if (profile?.whatsapp_enabled && note.target === "customer" && note.phone) {
        // Trigger generic WhatsApp send (should implement a wrapper that uses z-api)
        // For now we'll call the existing whatsapp-send if available or directly handle
        console.log(`[Notification] Triggering WhatsApp for ${note.phone}: ${note.message}`);
        
        const { data: instance } = await supabase.from("whatsapp_instances").select("*").eq("tenant_id", tenantId).maybeSingle();
        if (instance?.connected) {
          const baseUrl = instance.server_url || "https://api.z-api.io";
          const url = `${baseUrl}/instances/${instance.instance_id}/token/${instance.token}/send-text`;
          const body = { phone: note.phone, message: note.message };
          const headers: any = { "Content-Type": "application/json" };
          if (instance.client_token) headers["Client-Token"] = instance.client_token;
          
          await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
        }
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    console.error("[Notification Error]:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
