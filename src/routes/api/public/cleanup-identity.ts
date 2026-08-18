import { createFileRoute } from '@tanstack/react-router';
import { runIdentityCleanup } from '@/integrations/cleanup-identity.server';

export const Route = createFileRoute('/api/public/cleanup-identity')({
  server: {
    handlers: {
      GET: async () => {
        const result = await runIdentityCleanup();
        return new Response(JSON.stringify(result), {
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }
  }
});
