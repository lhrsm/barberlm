import { createStart } from "@tanstack/react-start";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";
import { correlationMiddleware } from "@/lib/observability";

export const startInstance = createStart(() => ({
  functionMiddleware: [correlationMiddleware, attachSupabaseAuth],
}));
