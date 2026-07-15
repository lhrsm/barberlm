import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * AI-powered campaign suggestions for Fidelidade Premium.
 * Analyzes basic tenant data and returns 3 ready-to-create suggestions.
 */
export const suggestLoyaltyCampaigns = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    // Basic context for the model
    const [{ count: customersCount }, { data: recentAppts }, { count: subsCount }] =
      await Promise.all([
        supabase.from("customers").select("id", { count: "exact", head: true }).eq("tenant_id", userId),
        supabase
          .from("appointments")
          .select("status, total_amount, created_at")
          .eq("tenant_id", userId)
          .order("created_at", { ascending: false })
          .limit(100),
        supabase
          .from("customer_subscriptions")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", userId),
      ]);

    const completed = (recentAppts || []).filter((a: any) => a.status === "completed");
    const avgTicket =
      completed.length > 0
        ? completed.reduce((s: number, a: any) => s + Number(a.total_amount || 0), 0) / completed.length
        : 0;

    const key = process.env.LOVABLE_API_KEY;
    if (!key) {
      // Fallback: rule-based suggestions
      return {
        suggestions: [
          {
            template_slug: "clube-dos-10",
            reason: "Mecânica simples e comprovada para aumentar recorrência.",
            tweak: { target: 10 },
          },
          {
            template_slug: "cashback-progressivo",
            reason: `Ticket médio atual R$${avgTicket.toFixed(2)} — cashback escalonado incentiva alta de consumo.`,
            tweak: {},
          },
          {
            template_slug: subsCount && subsCount > 0 ? "assinante-premium" : "indique-um-amigo",
            reason:
              subsCount && subsCount > 0
                ? "Você possui assinantes ativos — recompensar tempo de assinatura reduz cancelamento."
                : "Crescimento orgânico via indicação dos clientes atuais.",
            tweak: {},
          },
        ],
      };
    }

    try {
      const prompt = `Você é um especialista em fidelização de barbearias. Com base nos dados:
- Clientes cadastrados: ${customersCount ?? 0}
- Atendimentos concluídos (últimos): ${completed.length}
- Ticket médio: R$ ${avgTicket.toFixed(2)}
- Assinantes ativos: ${subsCount ?? 0}

Sugira 3 campanhas de fidelidade escolhendo entre estes slugs:
clube-dos-10, cashback-progressivo, cliente-ouro, aniversariante-premium, indique-um-amigo, cliente-vip, desafio-mensal, clube-da-barba, clube-do-cabelo, combo-premiado, cliente-frequente, cliente-sem-falta, assinante-premium, compra-de-produtos, black-friday, natal, cliente-diamante, programa-corporativo, meta-anual.

Responda APENAS JSON no formato:
{"suggestions":[{"template_slug":"...","reason":"frase curta em português","tweak":{}}]}`;

      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Lovable-API-Key": key,
        },
        body: JSON.stringify({
          model: "openai/gpt-5.5",
          messages: [{ role: "user", content: prompt }],
          response_format: { type: "json_object" },
        }),
      });
      if (!res.ok) throw new Error(`Gateway ${res.status}`);
      const json = await res.json();
      const text = json.choices?.[0]?.message?.content ?? "{}";
      const parsed = JSON.parse(text);
      if (!parsed.suggestions) throw new Error("invalid");
      return parsed;
    } catch (e: any) {
      return {
        suggestions: [
          { template_slug: "clube-dos-10", reason: "Recorrência rápida.", tweak: {} },
          { template_slug: "cashback-progressivo", reason: "Aumenta ticket médio.", tweak: {} },
          { template_slug: "aniversariante-premium", reason: "Engajamento sazonal.", tweak: {} },
        ],
        error: String(e?.message || e),
      };
    }
  });
