
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { z } from "zod";
import { useServerFn } from "@tanstack/react-start";
import { acceptTeamInvitation } from "@/lib/team.functions";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { BarbexLogo } from "@/components/ui/barbex-logo";
import { toast } from "sonner";
import { Loader2, ShieldCheck, Mail } from "lucide-react";

export const Route = createFileRoute("/invite/$token")({
  component: AcceptInvitationPage,
});

function AcceptInvitationPage() {
  const { token } = Route.useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [invitation, setInvitation] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const acceptFn = useServerFn(acceptTeamInvitation);
  
  // For Phase 4, we'll implement the real validation logic
  const { supabase } = useAuth();

  useEffect(() => {
    async function validateToken() {
      const { data, error } = await supabase
        .from('user_invitations')
        .select(`
          *,
          tenant:profiles!user_invitations_tenant_id_fkey(business_name)
        `)
        .eq('token_hash', token)
        .eq('status', 'pending')
        .single();
      
      if (error || !data) {
        setError("Convite inválido ou já utilizado.");
        return;
      }
      
      if (new Date(data.expires_at) < new Date()) {
        setError("Este convite expirou.");
        return;
      }

      setInvitation({
        barbershopName: data.tenant?.business_name || "Barbearia",
        role: data.role,
        email: data.email
      });
    }
    
    if (token) validateToken();
  }, [token, supabase]);

  const handleAccept = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast.error("As senhas não coincidem");
      return;
    }
    if (password.length < 6) {
      toast.error("A senha deve ter pelo menos 6 caracteres");
      return;
    }

    setLoading(true);
    try {
      await acceptFn({ data: { token, password } });
      toast.success("Convite aceito com sucesso!");
      navigate({ to: "/auth" });
    } catch (err: any) {
      toast.error(err.message || "Erro ao aceitar convite");
    } finally {
      setLoading(false);
    }
  };

  if (error) {
    return (
      <div className="min-h-screen bg-[#05070d] flex flex-col items-center justify-center p-4">
        <div className="mb-8">
          <BarbexLogo size="xl" />
        </div>
        <Card className="w-full max-w-md bg-[#0b0f17] border-red-500/20 shadow-2xl">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold text-white">Oops!</CardTitle>
            <CardDescription className="text-red-400">
              {error}
            </CardDescription>
          </CardHeader>
          <CardFooter className="flex justify-center">
            <Button onClick={() => navigate({ to: "/" })} className="bg-gold text-black">
              Voltar para o início
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  if (!invitation && !error) {
    return (
      <div className="min-h-screen bg-[#05070d] flex items-center justify-center p-4">
        <Loader2 className="h-8 w-8 text-gold animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#05070d] flex flex-col items-center justify-center p-4">
      <div className="mb-8">
        <BarbexLogo size="xl" />
      </div>
      
      <Card className="w-full max-w-md bg-[#0b0f17] border-gold/20 shadow-2xl">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="h-16 w-16 bg-gold/10 rounded-full flex items-center justify-center">
              <ShieldCheck className="h-8 w-8 text-gold" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold text-white">Você foi convidado!</CardTitle>
          <CardDescription className="text-zinc-400">
            <strong>{invitation?.barbershopName}</strong> convidou você para atuar como <strong>{invitation?.role}</strong>.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAccept} className="space-y-4">
            <div className="space-y-2">
              <Label className="text-zinc-400">E-mail</Label>
              <div className="flex items-center gap-2 p-3 bg-white/5 rounded-lg border border-white/10 text-zinc-300">
                <Mail size={16} />
                <span>{invitation?.email}</span>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password text-zinc-400">Crie sua senha</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-black/20 border-gold/20 text-white"
                placeholder="Mínimo 6 caracteres"
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="confirm-password text-zinc-400">Confirme sua senha</Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="bg-black/20 border-gold/20 text-white"
                required
              />
            </div>

            <Button 
              type="submit" 
              className="w-full bg-gold hover:bg-gold/90 text-black font-bold h-12 mt-4"
              disabled={loading}
            >
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "ATIVAR MEU ACESSO"}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex justify-center text-xs text-zinc-500">
          Ao ativar, você concorda com nossos termos de uso e privacidade.
        </CardFooter>
      </Card>
    </div>
  );
}
