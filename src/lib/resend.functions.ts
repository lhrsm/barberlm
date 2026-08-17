import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Resend Transactional Email Templates and Subjects
 */
export const EMAIL_TEMPLATES = {
  email_verification_code: {
    subject: "Seu código de verificação do Barbex",
    title: "Verifique seu e-mail",
  },
  client_account_setup: {
    subject: "Bem-vindo ao Barbex!",
    title: "Configuração de Conta",
  },
  client_password_recovery: {
    subject: "Redefina sua senha do Barbex",
    title: "Recuperação de Senha",
  },
  internal_user_invitation: {
    subject: "Você foi convidado para acessar o Barbex",
    title: "Convite de Acesso",
  },
  professional_invitation: {
    subject: "Você foi convidado para o Barbex",
    title: "Convite Profissional",
  },
  email_change_verification: {
    subject: "Confirme a alteração do seu e-mail no Barbex",
    title: "Alteração de E-mail",
  },
  security_alert: {
    subject: "Alerta de Segurança - Barbex",
    title: "Alerta de Segurança",
  },
  mfa_enabled: {
    subject: "MFA Ativado com sucesso",
    title: "Segurança Reforçada",
  },
  mfa_disabled: {
    subject: "MFA Desativado",
    title: "Aviso de Segurança",
  },
  recovery_code_used: {
    subject: "Código de recuperação utilizado",
    title: "Alerta de Segurança",
  },
  test_email: {
    subject: "Teste de configuração do Barbex",
    title: "Teste de Integração",
  }
} as const;

export type TemplateKey = keyof typeof EMAIL_TEMPLATES;

const getAdmin = async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
};

/**
 * Legacy compatibility: sendVerificationCode
 */
export const sendVerificationCode = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({
    email: z.string().email(),
    code: z.string().length(6),
    userName: z.string().optional(),
  }).parse(data))
  .handler(async ({ data }) => {
    return sendTransactionalEmail({
      data: {
        recipient: data.email,
        templateKey: 'email_verification_code',
        templateData: { code: data.code, userName: data.userName }
      }
    });
  });

/**
 * Central Transactional Email Service
 * Handles template rendering, logging, and sending via Resend
 */
export const sendTransactionalEmail = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({
    recipient: z.string().email(),
    templateKey: z.string(),
    templateData: z.record(z.any()).optional(),
    tenantId: z.string().optional(),
    userId: z.string().optional(),
    correlationId: z.string().optional(),
  }).parse(data))
  .handler(async ({ data }) => {
    const adminClient = await getAdmin();
    
    // Fetch global settings from database
    const { data: settings } = await adminClient
      .from("resend_settings" as any)
      .select("*")
      .maybeSingle();

    const RESEND_API_KEY = process.env['RESEND_API_KEY'];
    const FROM_EMAIL = (settings as any)?.from_email || process.env['RESEND_FROM_EMAIL'] || 'noreply@notify.barbex.shop';
    const FROM_NAME = (settings as any)?.from_name || process.env['RESEND_FROM_NAME'] || 'Barbex';

    if (!RESEND_API_KEY) {
      console.error("[Resend] API key not found");
      throw new Error("Resend API key is not configured.");
    }

    const template = EMAIL_TEMPLATES[data.templateKey as TemplateKey];
    if (!template) {
      throw new Error(`Template ${data.templateKey} not found`);
    }
    
    // Create initial log
    const { data: logEntry } = await adminClient
      .from("email_logs" as any)
      .insert({
        tenant_id: data.tenantId,
        user_id: data.userId,
        recipient: data.recipient,
        template_key: data.templateKey,
        correlation_id: data.correlationId,
        status: 'processing'
      } as any)
      .select('id')
      .single();

    const logId = (logEntry as any)?.id;

    try {
      // Basic branding HTML structure
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background-color: #f9f9f9; color: #1a1a1a; margin: 0; padding: 0; }
            .container { max-width: 600px; margin: 20px auto; background: white; border-radius: 12px; overflow: hidden; border: 1px solid #e5e7eb; }
            .header { background: #000; padding: 40px 20px; text-align: center; }
            .logo { color: #D4AF37; font-size: 28px; font-weight: 800; font-style: italic; letter-spacing: -0.05em; text-transform: uppercase; margin: 0; }
            .content { padding: 40px; line-height: 1.6; }
            .title { font-size: 24px; font-weight: 700; margin-bottom: 24px; color: #111; text-align: center; }
            .button { display: inline-block; padding: 14px 28px; background-color: #D4AF37; color: #000 !important; text-decoration: none; border-radius: 8px; font-weight: 700; text-transform: uppercase; font-size: 14px; letter-spacing: 0.05em; margin: 24px 0; }
            .footer { padding: 20px; text-align: center; font-size: 12px; color: #6b7280; border-top: 1px solid #f3f4f6; }
            .code-box { background: #f3f4f6; padding: 24px; text-align: center; font-size: 32px; font-weight: 800; letter-spacing: 6px; margin: 24px 0; border-radius: 12px; color: #000; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 class="logo">BARBEX</h1>
            </div>
            <div class="content">
              <h2 class="title">${template.title}</h2>
              ${renderTemplateContent(data.templateKey as TemplateKey, data.templateData)}
            </div>
            <div class="footer">
              © 2026 Barbex - Gestão Premium de Barbearias<br>
              Enviado por Barbex Enterprise
            </div>
          </div>
        </body>
        </html>
      `;

      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: `${FROM_NAME} <${FROM_EMAIL}>`,
          to: [data.recipient],
          subject: template.subject,
          html: html,
          tags: [
            { name: 'template_key', value: data.templateKey },
            { name: 'log_id', value: String(logId || '') }
          ]
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Resend API Error");
      }

      const resendData = await response.json();
      
      if (logId) {
        await adminClient
          .from("email_logs" as any)
          .update({
            status: 'sent',
            sent_at: new Date().toISOString(),
            provider_message_id: resendData.id
          } as any)
          .eq("id", logId);
      }

      return { success: true, messageId: resendData.id };
    } catch (error: any) {
      console.error("[Resend] Send failed:", error);
      
      if (logId) {
        await adminClient
          .from("email_logs" as any)
          .update({
            status: 'failed',
            failed_at: new Date().toISOString(),
            error_code: error.message
          } as any)
          .eq("id", logId);
      }
      
      throw error;
    }
  });

function renderTemplateContent(key: TemplateKey, data: any = {}) {
  switch (key) {
    case 'email_verification_code':
      return `
        <p>Olá, utilize o código abaixo para confirmar sua identidade no Barbex:</p>
        <div class="code-box">${data.code}</div>
        <p style="text-align: center; color: #666; font-size: 14px;">Este código expira em 10 minutos.</p>
      `;
    case 'internal_user_invitation':
    case 'professional_invitation':
      return `
        <p>Olá! Você foi convidado para acessar o Barbex.</p>
        <p><strong>Barbearia:</strong> ${data.barbershopName || 'Barbex'}</p>
        <p><strong>Função:</strong> ${data.role || 'Membro'}</p>
        <div style="text-align: center;">
          <a href="${data.inviteUrl}" class="button">CRIAR MEU ACESSO</a>
        </div>
        <p style="text-align: center; color: #666; font-size: 14px;">Este convite expira em 72 horas.</p>
      `;
    case 'client_password_recovery':
      return `
        <p>Recebemos uma solicitação para redefinir sua senha.</p>
        <div style="text-align: center;">
          <a href="${data.recoveryUrl}" class="button">REDEFINIR MINHA SENHA</a>
        </div>
        <p style="text-align: center; color: #666; font-size: 14px;">Se você não solicitou, ignore este e-mail.</p>
      `;
    case 'test_email':
      return `
        <p>Este é um e-mail de teste para validar a configuração do Resend no Barbex.</p>
        <p><strong>Status:</strong> Conectado</p>
        <p><strong>Horário:</strong> ${new Date().toLocaleString('pt-BR')}</p>
      `;
    case 'security_alert':
    case 'mfa_enabled':
    case 'mfa_disabled':
    case 'recovery_code_used':
      return `
        <p>Aviso importante sobre sua conta:</p>
        <div style="background: #fff8e1; border-left: 4px solid #D4AF37; padding: 15px; margin: 20px 0;">
          ${data.message || 'Houve uma alteração nas configurações de segurança da sua conta.'}
        </div>
        <p>Se você reconhece esta ação, nenhuma medida adicional é necessária.</p>
      `;
    default:
      return `<p>${data.message || 'Este é um e-mail automático do sistema Barbex.'}</p>`;
  }
}
