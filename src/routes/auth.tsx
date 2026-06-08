import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { AuthForm } from "@/components/auth/AuthForm";
import { useAuth } from "@/hooks/use-auth";
import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

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
        role === 'barber' ? "/calendar" : "/dashboard" as any;

      console.log("Redirecting to:", destination);
      navigate({ to: destination, replace: true });
  }, [hydrated, user, loading, role, navigate]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-black px-4 relative">
      <div className="absolute top-8 left-8">
        <Button variant="ghost" asChild className="gap-2 text-white hover:text-white/80 hover:bg-white/10">
          <Link to="/">
            <ArrowLeft className="h-4 w-4" />
            Voltar para o início
          </Link>
        </Button>
      </div>

      <div className="mb-8 text-center">
        <h1 className="text-4xl font-bold text-[#D4AF37] mb-2">Barbe<span className="text-white">X</span></h1>
        <p className="text-white/90">O sistema definitivo para sua barbearia</p>
      </div>
      <AuthForm />
    </div>
  );
}
