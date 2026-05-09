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
    if (!loading && user) {
      console.log("Auth route check - User:", user.email, "Role:", role);
      
      // Se o usuário está logado mas o perfil ainda não carregou, esperamos um pouco
      // mas se demorar demais (role indefinido), redirecionamos para o default
      if (role === undefined) {
        console.log("User logged in but role is undefined. Waiting...");
        return;
      }

      const destination = 
        role === 'super_admin' ? "/admin/dashboard" :
        role === 'barber' ? "/barbers" :
        role === 'client' ? "/portal" : "/dashboard";

      console.log("Redirecting to:", destination);
      navigate({ to: destination });
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
