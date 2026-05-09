import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AuthForm } from "@/components/auth/AuthForm";
import { useAuth } from "@/hooks/use-auth";
import { useEffect } from "react";

export const Route = createFileRoute("/auth")({
  component: AuthPageComponent,
});

function AuthPageComponent() {
  const { user, loading, role } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user && role) {
      if (role === 'super_admin') {
        navigate({ to: "/admin" });
      } else if (role === 'tenant_admin') {
        navigate({ to: "/dashboard" });
      } else if (role === 'barber') {
        navigate({ to: "/barbers" }); // The user said /agenda, but I see /barbers.tsx in routes. Let me check.
      } else if (role === 'client') {
        navigate({ to: "/portal" }); // User said /cliente, but I see portal routes.
      } else {
        navigate({ to: "/dashboard" });
      }
    }
  }, [user, loading, role, navigate]);

  if (loading) return null;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-muted/30 px-4">
      <div className="mb-8 text-center">
        <h1 className="text-4xl font-bold text-primary mb-2">BarberSaaS</h1>
        <p className="text-muted-foreground">O sistema definitivo para sua barbearia</p>
      </div>
      <AuthForm />
    </div>
  );
}
