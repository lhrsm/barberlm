import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/hooks/use-auth";
import { useTenant } from "@/hooks/use-tenant";
import { useEffect, useState } from "react";
import { AIComingSoonState } from "@/components/ai-assistant/AIComingSoonState";
import { resolveAIContext } from "@/lib/ai/context.functions";

export const Route = createFileRoute("/dashboard/assistente")({
  component: AIAssistantPage,
});

function AIAssistantPage() {
  const { role, user, loading: authLoading } = useAuth();
  const { tenantId, isLoading: tenantLoading } = useTenant();
  const navigate = useNavigate();
  const [config, setConfig] = useState<any>(null);
  const [loadingConfig, setLoadingConfig] = useState(true);

  useEffect(() => {
    if (authLoading || tenantLoading) return;

    if (!user) {
      navigate({ to: "/auth", replace: true });
      return;
    }

    // Role check - AI is initially restricted to Admin/Manager/SuperAdmin
    const allowedRoles = ['admin', 'manager', 'super_admin'];
    if (!allowedRoles.includes(role || "")) {
      navigate({ to: "/dashboard", replace: true });
      return;
    }

    // Fetch server configuration
    const fetchConfig = async () => {
      try {
        const data = await resolveAIContext();
        setConfig(data);
      } catch (err) {
        console.error("Error resolving AI context:", err);
      } finally {
        setLoadingConfig(false);
      }
    };

    fetchConfig();
  }, [user, role, authLoading, tenantLoading, navigate]);

  if (authLoading || tenantLoading || loadingConfig) {
    return (
      <AppLayout>
        <div className="flex h-[80vh] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-gold border-t-transparent" />
        </div>
      </AppLayout>
    );
  }

  // Feature Flag Protection (Mocked for now)
  const isInternalTenant = tenantId === "00000000-0000-0000-0000-000000000000"; // Placeholder for internal test tenant
  const isSuperAdmin = role === 'super_admin';
  const canView = isSuperAdmin || (config?.ai_assistant_enabled !== 'disabled');

  if (!canView) {
    return (
      <AppLayout>
        <div className="flex h-[80vh] flex-col items-center justify-center text-center space-y-4">
           <h2 className="text-2xl font-black text-white">Acesso Restrito</h2>
           <p className="text-white/40 font-medium">Este módulo está em fase de testes internos.</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="min-h-screen bg-[#05070d] pb-20 pt-4">
        <AIComingSoonState />
      </div>
    </AppLayout>
  );
}
