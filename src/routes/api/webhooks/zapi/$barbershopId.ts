import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

// Initialize Supabase client lazily
const getSupabase = () => {
  const url = process.env.SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  return createClient(url, key);
};

/** Mantém apenas dígitos e ignora o DDI 55 para comparar telefones. */
function normalizePhone(raw: unknown): string {
  const digits = String(raw ?? "").replace(/\D/g, "");
  return digits.startsWith("55") ? digits.slice(2) : digits;
}

export const Route = createFileRoute("/api/webhooks/zapi/$barbershopId")({
  server: {
    handlers: {
      GET: async () => {
        return Response.json({
          success: true,
          message: 'Webhook online'
        });
      },
      POST: async ({ request, params }) => {
        const { barbershopId } = params;
        const supabase = getSupabase();

        try {
          // 0. Verificação de origem: exige o token da barbearia ANTES de logar
          //    ou processar qualquer coisa. Sem isso, qualquer POST anônimo com
          //    o ID da barbearia conseguiria confirmar agendamentos alheios.
          const url = new URL(request.url);
          const providedToken =
            request.headers.get("x-webhook-token") ??
            url.searchParams.get("token") ??
            "";

          const { data: instance } = await supabase
            .from("whatsapp_instances")
            .select("*")
            .eq("tenant_id", barbershopId)
            .maybeSingle();

          if (!instance?.webhook_token || providedToken !== instance.webhook_token) {
            console.warn(`[Z-API Webhook] Token inválido para ${barbershopId}`);
            return Response.json({ success: false, error: "unauthorized" }, { status: 401 });
          }

          const body = await request.json();

          // 1. Log (somente após validar a origem)
          await supabase.from("webhook_logs").insert({
            barbershop_id: barbershopId,
            payload: body,
            event_type: body.type || 'zapi_event',
            status: 'received'
          });

          // 2. Confirmação via botão do WhatsApp
          if (body.type === 'ReceivedCallback' && body.buttonsResponseMessage) {
            const buttonId = body.buttonsResponseMessage.buttonId;
            const phone = body.phone;
            const normalized = normalizePhone(phone);

            if (buttonId === 'main_confirm' && normalized.length >= 8) {
              // Só confirma agendamentos FUTUROS do telefone que respondeu.
              const { data: appts } = await supabase
                .from("appointments")
                .select("id, customer_phone, appointment_date")
                .eq("tenant_id", barbershopId)
                .in("status", ["scheduled", "awaiting_confirmation"])
                .gte("appointment_date", new Date().toISOString())
                .order("appointment_date", { ascending: true })
                .limit(50);

              const match = (appts ?? []).find(
                (a: any) => normalizePhone(a.customer_phone) === normalized,
              );

              if (match) {
                await supabase.rpc('update_appointment_status', {
                  p_appointment_id: match.id,
                  p_new_status: 'confirmed',
                  p_changed_by_type: 'customer',
                  p_source: 'whatsapp_webhook'
                });

                if (instance.connected) {
                  const baseUrl = instance.server_url || "https://api.z-api.io";
                  const sendUrl = `${baseUrl}/instances/${instance.instance_id}/token/${instance.token}/send-text`;

                  await fetch(sendUrl, {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                      ...(instance.client_token ? { "Client-Token": instance.client_token } : {})
                    },
                    body: JSON.stringify({
                      phone: phone,
                      message: "✅ Seu agendamento foi confirmado com sucesso! Te esperamos lá."
                    })
                  });
                }
              } else {
                console.log(`[Z-API Webhook] Nenhum agendamento futuro para o telefone informado`);
              }
            }
          }

          return Response.json({ success: true });

        } catch (error) {
          console.error('[Z-API Webhook] Critical Error:', error);
          return Response.json({ success: false }, { status: 500 });
        }
      },
    },
  },
});
