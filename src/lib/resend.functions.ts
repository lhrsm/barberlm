import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const sendVerificationCode = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({
    email: z.string().email(),
    code: z.string().length(6),
    userName: z.string().optional(),
  }).parse(data))
  .handler(async ({ data }) => {
    const RESEND_API_KEY = process.env['RESEND_API_KEY'];
    if (!RESEND_API_KEY) {
      console.error("[Resend] API key not found");
      throw new Error("Resend API key is not configured.");
    }

    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: 'Barbex <noreply@barbex.shop>',
          to: [data.email],
          subject: 'Seu código de verificação do Barbex',
          html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
              <div style="text-align: center; margin-bottom: 30px;">
                <h1 style="color: #D4AF37; margin: 0;">BARBEX</h1>
              </div>
              <p>Olá${data.userName ? ', ' + data.userName : ''}.</p>
              <p>Use o código abaixo para confirmar seu e-mail:</p>
              <div style="background: #f4f4f4; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 5px; margin: 20px 0; border-radius: 8px; border: 1px solid #ddd;">
                ${data.code}
              </div>
              <p style="color: #666; font-size: 14px;">Este código expira em 10 minutos.</p>
              <p style="color: #666; font-size: 14px;">Se você não solicitou esta confirmação, ignore este e-mail.</p>
              <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;" />
              <p style="text-align: center; color: #999; font-size: 12px;">© 2026 Barbex. Todos os direitos reservados.</p>
            </div>
          `,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error("[Resend] API Error:", errorData);
        throw new Error("Failed to send email");
      }

      return { success: true };
    } catch (error) {
      console.error("[Resend] Send failed:", error);
      throw error;
    }
  });
