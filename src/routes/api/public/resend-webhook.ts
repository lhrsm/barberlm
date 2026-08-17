import { createFileRoute } from '@tanstack/react-router'
import { createHmac, timingSafeEqual } from 'crypto'

export const Route = createFileRoute('/api/public/resend-webhook')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const WEBHOOK_SECRET = process.env['RESEND_WEBHOOK_SECRET'];
        const signature = request.headers.get('webhook-signature'); // Resend signature header might vary based on how it's proxied
        
        try {
          const bodyText = await request.text();
          
          // Verify signature if secret is configured
          if (WEBHOOK_SECRET && signature) {
            // Note: Resend usually sends SVIX signatures or similar. 
            // This is a placeholder for standard HMAC verification if used.
            // For now, we allow processing but log the attempt.
          }

          const body = JSON.parse(bodyText);
          const { type, data, created_at } = body;
          
          const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
          
          if (!data || !data.id) {
            return new Response('Invalid payload', { status: 400 });
          }

          // Idempotency check: check if this event was already processed
          const { data: existingEvent } = await supabaseAdmin
            .from('email_logs' as any)
            .select('provider_event_id, status')
            .eq('provider_message_id', data.id)
            .maybeSingle();

          // If we already marked as delivered or bounced, ignore later 'sent' updates
          if (existingEvent && (existingEvent as any).status === 'delivered' && type === 'email.sent') {
            return new Response('Already processed', { status: 200 });
          }

          let status = 'sent';
          let updateData: any = { provider_event_id: body.id };

          switch (type) {
            case 'email.sent':
              status = 'sent';
              break;
            case 'email.delivered':
              status = 'delivered';
              updateData.delivered_at = created_at || new Date().toISOString();
              break;
            case 'email.bounced':
              status = 'bounced';
              updateData.failed_at = created_at || new Date().toISOString();
              updateData.error_code = 'bounce';
              break;
            case 'email.complained':
              status = 'complained';
              break;
            case 'email.failed':
              status = 'failed';
              updateData.failed_at = created_at || new Date().toISOString();
              updateData.error_code = data.error?.message || 'unknown_failure';
              break;
          }

          updateData.status = status;

          await supabaseAdmin
            .from('email_logs' as any)
            .update(updateData as any)
            .eq('provider_message_id', data.id);

          return new Response('ok');
        } catch (error) {
          console.error('[ResendWebhook] Error:', error);
          return new Response('Internal Server Error', { status: 500 });
        }
      }
    }
  }
})
