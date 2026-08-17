import { createFileRoute } from '@tanstack/react-router'
import { createHmac, timingSafeEqual } from 'crypto'

export const Route = createFileRoute('/api/public/resend-webhook')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // In a real environment with Resend, you'd use their signature verification
        // For now, we'll log the event and update the database
        
        try {
          const body = await request.json();
          const { type, data } = body;
          
          const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
          
          if (!data || !data.id) {
            return new Response('Invalid payload', { status: 400 });
          }

          let status = 'sent';
          let updateData: any = { provider_event_id: body.id };

          switch (type) {
            case 'email.delivered':
              status = 'delivered';
              updateData.delivered_at = new Date().toISOString();
              break;
            case 'email.bounced':
              status = 'bounced';
              updateData.failed_at = new Date().toISOString();
              updateData.error_code = 'bounce';
              break;
            case 'email.complained':
              status = 'complained';
              break;
            case 'email.failed':
              status = 'failed';
              updateData.failed_at = new Date().toISOString();
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
