import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * AI Assistant for the Super Admin panel.
 * Builds a curated read-only snapshot of platform health and answers the
 * operator's question with Lovable AI. Never runs raw SQL from user input.
 */
export const askAdminAssistant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { question: string; history?: Array<{ role: "user" | "assistant"; content: string }> }) => data)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Authorize — super admin only
    const { data: isAdmin, error: roleErr } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "super_admin",
    });
    if (roleErr || !isAdmin) {
      return { error: "Forbidden" as const };
    }

    // Build snapshot in parallel
    const [
      kpisRes,
      alertsRes,
      healthRes,
      recentTenantsRes,
      subsRes,
    ] = await Promise.all([
      supabase.rpc("admin_executive_kpis"),
      supabase.rpc("admin_anomaly_alerts"),
      supabase.rpc("admin_tenant_health", { p_limit: 10 }),
      supabase
        .from("profiles")
        .select("id, business_name, plan, created_at")
        .order("created_at", { ascending: false })
        .limit(10),
      supabase
        .from("subscriptions")
        .select("status, plan_id, updated_at")
        .order("updated_at", { ascending: false })
        .limit(20),
    ]);

    const snapshot = {
      generated_at: new Date().toISOString(),
      executive_kpis: kpisRes.data ?? null,
      anomaly_alerts: alertsRes.data ?? null,
      worst_health_tenants: healthRes.data ?? null,
      recent_signups: recentTenantsRes.data ?? null,
      recent_subscription_events: subsRes.data ?? null,
    };

    const key = process.env.LOVABLE_API_KEY;
    if (!key) {
      return {
        answer:
          "⚠️ Lovable AI não configurado. Snapshot bruto abaixo:\n\n```json\n" +
          JSON.stringify(snapshot, null, 2) +
          "\n```",
      };
    }

    const systemPrompt = `Você é o Assistente do Super Admin do Barbex (SaaS de gestão para barbearias).
Você recebe um snapshot READ-ONLY do banco em JSON e responde perguntas do operador em PORTUGUÊS.

Regras:
- Responda de forma CONCISA e ACIONÁVEL. Use bullet points quando ajudar.
- Cite números específicos do snapshot (MRR, churn, quantidades).
- Se a pergunta pedir dado que NÃO está no snapshot, diga claramente "não tenho esse dado no snapshot atual" e sugira em qual página do admin ele pode ser encontrado.
- Não invente valores. Não invente nomes de barbearias.
- Quando identificar risco (churn alto, dormentes pagantes, WhatsApp off), recomende a ação prática.
- Formato Markdown simples. Sem HTML.`;

    const history = (data.history || []).slice(-6);

    try {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Lovable-API-Key": key,
        },
        body: JSON.stringify({
          model: "openai/gpt-5.5",
          messages: [
            { role: "system", content: systemPrompt },
            {
              role: "system",
              content: `Snapshot atual da plataforma (JSON):\n${JSON.stringify(snapshot)}`,
            },
            ...history,
            { role: "user", content: data.question },
          ],
        }),
      });

      if (!res.ok) {
        if (res.status === 429) {
          return { error: "Muitas requisições. Aguarde alguns segundos e tente novamente." };
        }
        if (res.status === 402) {
          return { error: "Créditos de IA esgotados. Adicione créditos em Configurações → Planos & créditos." };
        }
        const txt = await res.text().catch(() => "");
        return { error: `Gateway ${res.status}: ${txt.slice(0, 200)}` };
      }
      const json = await res.json();
      const answer: string = json.choices?.[0]?.message?.content ?? "";
      return { answer };
    } catch (e: any) {
      return { error: String(e?.message || e) };
    }
  });
