import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { formatBrazilDate, formatBrazilTime } from "../_shared/utils.ts";
import { sendAutomationMessageV2 } from "../_shared/automation-v2-engine.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

serve(async (req) => {
  console.log('EDGE FUNCTION STARTED: appointment-notifications');
  console.log('REQUEST METHOD:', req.method);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const body = await req.json();
    console.log('REQUEST BODY:', body);
    const { appointmentId, type, updatedBy, previousData } = body;

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

    const placeholders = {
      cliente_nome: customer?.name || "Cliente",
      data: formatBrazilDate(appointment.start_time),
      horario: formatBrazilTime(appointment.start_time),
      servico: service?.name || "Serviço",
      barbeiro_nome: barber?.name || "Profissional",
      barbearia_nome: profile?.business_name || "Barbearia"
    };

    let notifications = [];

    if (type === "appointment_cancelled") {
      if (updatedBy.type === "customer") {
        notifications.push({
          target: "barber",
          message: `O cliente ${placeholders.cliente_nome} cancelou o atendimento agendado para ${placeholders.data} às ${placeholders.horario}.`
        });
        notifications.push({
          target: "admin",
          message: `O cliente ${placeholders.cliente_nome} cancelou o agendamento de ${placeholders.data} às ${placeholders.horario}.`
        });
      } else if (updatedBy.type === "admin") {
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
        notifications.push({
          target: "customer",
          phone: customer?.phone,
          message: `Olá ${placeholders.cliente_nome}, seu atendimento foi reagendado para ${newTime} por ${updatedBy.type === 'barber' ? 'seu profissional' : 'nossa barbearia'}.`
        });
        notifications.push({
          target: updatedBy.type === 'barber' ? 'admin' : 'barber',
          message: `O atendimento de ${placeholders.cliente_nome} foi reagendado para ${newTime} por ${updatedBy.type === 'barber' ? placeholders.barbeiro_nome : 'administrador'}.`
        });
      }
    } else if (type === "refund_requested") {
      const amount = body.amount || 0;
      notifications.push({
        target: "admin",
        message: `Solicitação de Estorno: O cliente ${placeholders.cliente_nome} solicitou o estorno de R$ ${amount.toFixed(2)} referente ao agendamento de ${placeholders.data}.`
      });
      notifications.push({
        target: "customer",
        phone: customer?.phone,
        message: `Olá ${placeholders.cliente_nome}, sua solicitação de estorno no valor de R$ ${amount.toFixed(2)} foi recebida e será analisada pela barbearia ${placeholders.barbearia_nome}.`
      });
    } else if (type === "refund_updated") {
      const amount = body.amount || 0;
      const status = body.status;
      let statusText = status === 'approved' ? 'aprovada' : status === 'completed' ? 'concluída' : 'rejeitada';
      
      notifications.push({
        target: "customer",
        phone: customer?.phone,
        message: `Olá ${placeholders.cliente_nome}, sua solicitação de estorno no valor de R$ ${amount.toFixed(2)} foi ${statusText} pela barbearia ${placeholders.barbearia_nome}.`
      });
    }

    // Send notifications
    for (const note of notifications) {
      await supabase.from("notifications").insert({
        user_id: tenantId,
        barber_id: note.target === "barber" ? barber?.id : null,
        title: type === "appointment_cancelled" ? "Agendamento Cancelado" : "Agendamento Reagendado",
        message: note.message,
        type: "appointment",
        link: "/calendar"
      });

      if (profile?.whatsapp_enabled && note.target === "customer" && note.phone) {
        const { data: instance } = await supabase.from("whatsapp_instances").select("*").eq("tenant_id", tenantId).maybeSingle();
        if (instance?.connected) {
          await sendAutomationMessageV2(supabase, {
            tenant_id: tenantId,
            workflow_key: type, // appointment_cancelled or appointment_rescheduled
            customer_phone: note.phone,
            appointment_id: appointmentId,
            customer_id: customer?.id,
            customer_name: customer?.name,
            message: note.message,
            instance: instance
          });
        }
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error: any) {
    console.error("[Notification Error]:", error.message);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
