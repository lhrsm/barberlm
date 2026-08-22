import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";
import { sendTransactionalEmail } from "./resend.functions";

const contactRateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(key: string, limit: number = 5, windowMs: number = 10 * 60 * 1000): boolean {
  const now = Date.now();
  const entry = contactRateLimitMap.get(key);
  if (!entry || now > entry.resetAt) {
    contactRateLimitMap.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (entry.count >= limit) {
    return false;
  }
  entry.count++;
  return true;
}

export const submitPublicContactMessage = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({
    slug: z.string().min(1, "Slug da barbearia é obrigatório"),
    name: z.string().trim().min(2, "Por favor informe seu nome").max(100),
    email: z.string().trim().email("E-mail inválido").optional().or(z.literal("")),
    phone: z.string().trim().optional().or(z.literal("")),
    subject: z.string().trim().min(2, "Selecione ou informe um assunto").max(100),
    message: z.string().trim().min(5, "Mensagem deve ter pelo menos 5 caracteres").max(1000, "Mensagem não pode exceder 1000 caracteres"),
    honeypot: z.string().optional(),
  }).parse(data))
  .handler(async ({ data }) => {
    // 1. Honeypot check (anti-spam bot trap): return neutral success without processing
    if (data.honeypot && data.honeypot.trim().length > 0) {
      console.warn("[ContactForm] Bot trap triggered (honeypot filled), silently dropping payload for slug:", data.slug);
      return { success: true, message: "Mensagem enviada com sucesso! A barbearia entrará em contato com você." };
    }

    // 2. Validate at least one contact method
    const hasEmail = Boolean(data.email && data.email.trim().length > 0);
    const hasPhone = Boolean(data.phone && data.phone.trim().length > 0);
    if (!hasEmail && !hasPhone) {
      throw new Error("Por favor, informe pelo menos um meio de contato (E-mail ou WhatsApp/Telefone).");
    }

    // 3. Resolve tenant server-side via slug
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("id, business_name, contact_email, slug")
      .eq("slug", data.slug)
      .maybeSingle();

    if (!profile) {
      const { data: shop } = await supabaseAdmin
        .from("barbershops")
        .select("id, name, slug, owner_id")
        .eq("slug", data.slug)
        .maybeSingle();

      if (shop?.owner_id) {
        const { data: ownerProfile } = await supabaseAdmin
          .from("profiles")
          .select("id, business_name, contact_email, slug")
          .eq("id", shop.owner_id)
          .maybeSingle();

        if (ownerProfile) {
          profile = {
            ...ownerProfile,
            business_name: ownerProfile.business_name || shop.name,
          };
        }
      }
    }

    if (!profile) {
      throw new Error("Barbearia não encontrada.");
    }

    // 4. Validate explicit contact_email configured (NO fallback to profile.email)
    const targetEmail = (profile as any).contact_email;
    if (!targetEmail || typeof targetEmail !== "string" || !targetEmail.includes("@")) {
      console.warn("[ContactForm] Target barbershop does not have an explicit contact_email configured:", { slug: data.slug, tenantId: profile.id });
      throw new Error("Esta barbearia não possui um e-mail configurado para receber mensagens do site.");
    }

    // 5. Rate limiting with composite key (IP + Tenant) from server request headers
    const clientIp =
      getRequestHeader("cf-connecting-ip") ||
      (getRequestHeader("x-forwarded-for") || "").split(",")[0].trim() ||
      getRequestHeader("x-real-ip") ||
      "unknown";

    const ipTenantKey = `contact:${profile.id}:${clientIp}`;
    if (!checkRateLimit(ipTenantKey, 5, 10 * 60 * 1000)) {
      throw new Error("Limite de envios excedido para este endereço. Por favor, aguarde 10 minutos antes de tentar novamente.");
    }

    // Secondary ceiling per tenant (20 submissions / 10 min) to prevent abuse
    const tenantKey = `contact_tenant:${profile.id}`;
    if (!checkRateLimit(tenantKey, 20, 10 * 60 * 1000)) {
      throw new Error("Muitas mensagens recebidas recentemente no estabelecimento. Por favor, aguarde alguns minutos.");
    }

    const businessName = profile.business_name || "Barbearia";
    const timestamp = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });

    // 6. Send transactional email with reply-to set to visitor's email if provided
    await sendTransactionalEmail({
      data: {
        recipient: targetEmail.trim(),
        replyTo: hasEmail ? data.email!.trim() : undefined,
        templateKey: "contact_form_message",
        tenantId: profile.id,
        customSubject: `[Barbex] Nova mensagem pelo site — ${businessName}`,
        templateData: {
          businessName,
          visitorName: data.name,
          visitorEmail: hasEmail ? data.email : null,
          visitorPhone: hasPhone ? data.phone : null,
          subject: data.subject,
          message: data.message,
          slug: data.slug,
          timestamp,
        }
      }
    });

    return {
      success: true,
      message: "Mensagem enviada com sucesso! A barbearia entrará em contato com você."
    };
  });
