import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";
import { sendTransactionalEmail } from "./resend.functions";

export interface PlatformPublicSettings {
  saas_name: string;
  main_url: string;
  saas_logo: string | null;
  public_email: string | null;
  phone: string | null;
  whatsapp_number: string | null;
  address: string | null;
  social_links: {
    instagram?: string;
    facebook?: string;
    tiktok?: string;
    linkedin?: string;
    youtube?: string;
    twitter?: string;
  } | null;
  has_contact_form: boolean;
}

const platformContactRateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(key: string, limit = 5, windowMs = 10 * 60 * 1000): boolean {
  const now = Date.now();
  const entry = platformContactRateLimitMap.get(key);

  if (!entry || now > entry.resetAt) {
    platformContactRateLimitMap.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (entry.count >= limit) {
    return false;
  }

  entry.count++;
  return true;
}

/**
 * Server Function: getPlatformPublicSettings
 * Fetches public platform information from system_settings without exposing secret keys
 */
export const getPlatformPublicSettings = createServerFn({ method: "GET" })
  .handler(async (): Promise<PlatformPublicSettings> => {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

      const { data, error } = await (supabaseAdmin as any)
        .from("system_settings")
        .select("saas_name, main_url, saas_logo, public_email, contact_email, phone, whatsapp_number, address, social_links")
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error("[PlatformSettings] Error loading system settings:", error);
      }

      const raw = data || {};
      const contactEmail = (raw.contact_email || "").trim();
      const hasContactForm = Boolean(contactEmail && contactEmail.includes("@"));

      return {
        saas_name: raw.saas_name || "Barbex",
        main_url: raw.main_url || "https://barbex.shop",
        saas_logo: raw.saas_logo || null,
        public_email: raw.public_email || null,
        phone: raw.phone || null,
        whatsapp_number: raw.whatsapp_number || null,
        address: raw.address || null,
        social_links: raw.social_links || {},
        has_contact_form: hasContactForm,
      };
    } catch (err) {
      console.error("[PlatformSettings] Failed to fetch settings:", err);
      return {
        saas_name: "Barbex",
        main_url: "https://barbex.shop",
        saas_logo: null,
        public_email: null,
        phone: null,
        whatsapp_number: null,
        address: null,
        social_links: {},
        has_contact_form: false,
      };
    }
  });

const platformContactSchema = z.object({
  name: z.string().trim().min(2, "Por favor informe seu nome").max(100, "Nome muito longo"),
  email: z.string().trim().email("E-mail corporativo inválido"),
  phone: z.string().trim().optional().or(z.literal("")),
  company: z.string().trim().max(100, "Nome da empresa muito longo").optional().or(z.literal("")),
  subject: z.string().trim().min(2, "Selecione ou informe um assunto").max(100),
  message: z.string().trim().min(5, "Mensagem deve ter pelo menos 5 caracteres").max(1000, "Mensagem não pode exceder 1000 caracteres"),
  honeypot: z.string().optional(),
});

/**
 * Server Function: submitPlatformContactMessage
 * Handles public submissions to Barbex platform via barbex.shop/#contato
 */
export const submitPlatformContactMessage = createServerFn({ method: "POST" })
  .inputValidator((data) => platformContactSchema.parse(data))
  .handler(async ({ data }) => {
    // 1. Silent Honeypot Trap
    if (data.honeypot && data.honeypot.trim().length > 0) {
      console.warn("[PlatformContact] Bot trap triggered via honeypot field. Discarding silently.");
      return { success: true, message: "Mensagem enviada com sucesso! Nossa equipe entrará em contato." };
    }

    // 2. Client IP Extraction via getRequestHeader
    const clientIp =
      getRequestHeader("cf-connecting-ip") ||
      (getRequestHeader("x-forwarded-for") || "").split(",")[0].trim() ||
      getRequestHeader("x-real-ip") ||
      "unknown_ip";

    // 3. Composite Rate Limiting (5 msgs per 10 min per IP, 50 msgs per 10 min platform-wide)
    const ipRateLimitKey = `platform_contact:${clientIp}`;
    if (!checkRateLimit(ipRateLimitKey, 5, 10 * 60 * 1000)) {
      throw new Error("Você atingiu o limite de mensagens institucionais temporariamente. Aguarde alguns minutos.");
    }

    const globalRateLimitKey = "platform_contact_global";
    if (!checkRateLimit(globalRateLimitKey, 50, 10 * 60 * 1000)) {
      throw new Error("Muitas mensagens estão sendo enviadas no momento. Por favor tente novamente mais tarde.");
    }

    // 4. Resolve Platform Settings Server-Side
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: settingsRow, error: settingsError } = await (supabaseAdmin as any)
      .from("system_settings")
      .select("id, saas_name, contact_email")
      .limit(1)
      .maybeSingle();

    if (settingsError || !settingsRow) {
      console.error("[PlatformContact] Failed to load system settings:", settingsError);
      throw new Error("Não foi possível carregar as configurações de contato da plataforma.");
    }

    const platformContactEmail = (settingsRow.contact_email || "").trim();

    // 5. Explicit check: DO NOT fallback to any login or superadmin email
    if (!platformContactEmail || !platformContactEmail.includes("@")) {
      console.warn("[PlatformContact] contact_email is not configured in system_settings. Submission blocked.");
      throw new Error("A plataforma Barbex ainda não configurou um e-mail para receber mensagens da landing institucional.");
    }

    // 6. Send transactional email via Resend
    const result = await sendTransactionalEmail({
      data: {
        recipient: platformContactEmail,
        replyTo: data.email,
        templateKey: "platform_contact_form_message",
        templateData: {
          platformName: settingsRow.saas_name || "Barbex Enterprise",
          visitorName: data.name,
          visitorEmail: data.email,
          visitorPhone: data.phone || "Não informado",
          company: data.company || "Não informado",
          subject: data.subject,
          message: data.message,
          timestamp: new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }),
        }
      }
    });

    return {
      success: true,
      message: "Mensagem enviada com sucesso! Nossa equipe entrará em contato.",
      messageId: result.messageId,
    };
  });
