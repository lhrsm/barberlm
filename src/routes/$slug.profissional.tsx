import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useProfessionalAuth } from "@/components/professional/ProfessionalAuthProvider";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/$slug/profissional")({
  component: ProfessionalDashboard,
});

function ProfessionalDashboard() {
  const { session, loading } = useProfessionalAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !session) {
      navigate({ to: "/auth" });
    }
  }, [session, loading, navigate]);

  if (loading) return <div>Carregando...</div>;
  if (!session) return null;

  return (
    <AppLayout>
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Olá, {session.name}</h1>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Atendimentos Hoje</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-bold">0</div></CardContent>
          </Card>
          {/* Add more cards for Billing, Received, Pending */}
        </div>
        {/* Add Agenda, Services, etc. */}
      </div>
    </AppLayout>
  );
}
