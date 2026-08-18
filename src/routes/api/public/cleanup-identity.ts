import { createFileRoute } from '@tanstack/react-router';
import { runIdentityCleanup } from '@/integrations/cleanup-identity.server';

export const Route = createFileRoute('/api/public/cleanup-identity')({
  server: {
    handlers: {
      GET: async () => {
        try {
          const result = await runIdentityCleanup();
          return new Response(JSON.stringify(result), {
            headers: { 
              'Content-Type': 'application/json',
              'Cache-Control': 'no-store'
            }
          });
        } catch (err: any) {
          return new Response(JSON.stringify({ success: false, error: err.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
          });
        }
      }
    }
  }
});
