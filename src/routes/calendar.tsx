import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/hooks/use-auth";
import { useEffect } from "react";
import { Calendar as CalendarIcon } from "lucide-react";

export const Route = createFileRoute("/calendar")({
  component: CalendarComponent,
});

function CalendarComponent() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [user, loading, navigate]);

  if (loading || !user) return null;

  return (
    <AppLayout>
      <div className="flex flex-col items-center justify-center h-[60vh] text-center space-y-4">
        <div className="p-6 bg-primary/10 rounded-full">
          <CalendarIcon size={48} className="text-primary" />
        </div>
        <h2 className="text-2xl font-bold">Agenda em Construção</h2>
        <p className="text-muted-foreground max-w-sm">
          A visualização diária e semanal de agendamentos estará disponível em breve na sua versão final.
        </p>
      </div>
    </AppLayout>
  );
}
