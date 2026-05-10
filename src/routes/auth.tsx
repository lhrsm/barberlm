import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AuthForm } from "@/components/auth/AuthForm";
import { useAuth } from "@/hooks/use-auth";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/auth")({
  component: AuthPageComponent,
});

function AuthPageComponent() {
  const { user, loading, role } = useAuth();
  const navigate = useNavigate();
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated || loading || !user) return;

      console.log("Auth route check - User:", user.email, "Role:", role);
      
      if (role === undefined) {
        console.log("User logged in but role is undefined. Waiting...");
        return;
      }

      const destination = 
        role === 'super_admin' ? "/admin/dashboard" :
        role === 'barber' ? "/calendar" :
        role === 'client' ? "/portal" : "/dashboard";

      console.log("Redirecting to:", destination);
      navigate({ to: destination, replace: true });
  }, [hydrated, user, loading, role, navigate]);

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
