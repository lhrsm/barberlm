import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { toast } from "sonner";
import { Phone, Mail, Lock } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { useProfessionalAuth } from "@/components/professional/ProfessionalAuthProvider";

export function AuthForm() {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [loginMethod, setLoginMethod] = useState<"email" | "phone">("email");
  const navigate = useNavigate();
  const { login } = useProfessionalAuth();


  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (loginMethod === "email") {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
      } else {
        const cleanPhone = phone.replace(/\D/g, '');
        const { data: barber, error: barberError } = await supabase
          .from("barbers")
          .select("id, name, user_id")
          .eq("phone", phone)
          .maybeSingle();

        let targetBarber = barber;

        if (!targetBarber && cleanPhone) {
          const { data: barberByCleanPhone } = await supabase
            .from("barbers")
            .select("id, name, user_id")
            .ilike("phone", `%${cleanPhone}%`)
            .maybeSingle();
          targetBarber = barberByCleanPhone;
        }

        if (!targetBarber) {
          toast.error("Telefone não encontrado entre os barbeiros cadastrados.");
          return;
        }

        const sessionData: any = {
          phone: phone,
          barber_id: targetBarber.id,
          name: targetBarber.name,
          role: 'barber'
        };

        login(sessionData);
        toast.success(`Bem-vindo, ${targetBarber.name}!`);
        
        // Obter o slug da barbearia para redirecionar corretamente
        const { data: profile } = await supabase
          .from("profiles")
          .select("slug")
          .eq("id", targetBarber.user_id)
          .single();

        const slug = profile?.slug || "general";

        // Garantindo o redirecionamento
        setTimeout(() => {
          navigate({ to: `/${slug}/profissional` });
        }, 500);
      }
    } catch (error: any) {
      toast.error(error.message === "Invalid login credentials" ? "Credenciais inválidas" : error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!email) {
      toast.error("Por favor, insira seu e-mail para recuperar a senha.");
      return;
    }
    
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth?type=recovery`,
      });
      if (error) throw error;
      toast.success("E-mail de recuperação enviado com sucesso.");
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md p-8 bg-white rounded-2xl shadow-2xl border-2 border-[#D4AF37]">
      <div className="mb-8">
        <div className="flex justify-center gap-4">
          <Button 
            type="button"
            variant="ghost" 
            className={`flex-1 gap-2 transition-all duration-300 hover:scale-105 ${
              loginMethod === "email" 
                ? "bg-black text-white hover:bg-black/90 hover:text-white" 
                : "bg-gray-100 text-gray-600 hover:bg-black hover:text-white"
            }`}
            onClick={() => setLoginMethod("email")}
          >
            <Mail size={16} /> E-mail
          </Button>
          <Button 
            type="button"
            variant="ghost" 
            className={`flex-1 gap-2 transition-all duration-300 hover:scale-105 ${
              loginMethod === "phone" 
                ? "bg-black text-white hover:bg-black/90 hover:text-white" 
                : "bg-gray-100 text-gray-600 hover:bg-black hover:text-white"
            }`}
            onClick={() => setLoginMethod("phone")}
          >
            <Phone size={16} /> Telefone
          </Button>
        </div>
      </div>
      
      <form onSubmit={handleLogin} className="space-y-6">
        {loginMethod === "email" ? (
          <div className="space-y-2">
            <Label htmlFor="login-email">Email</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="login-email"
                type="email"
                className="pl-10 h-11 border-gray-200 focus:border-[#D4AF37] focus:ring-[#D4AF37] text-black placeholder:text-black/60"
                placeholder="exemplo@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <Label htmlFor="login-phone">Telefone</Label>
            <div className="relative">
              <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="login-phone"
                type="tel"
                className="pl-10 h-11 border-gray-200 focus:border-[#D4AF37] focus:ring-[#D4AF37] text-black"
                placeholder="(00) 00000-0000"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
              />
            </div>
          </div>
        )}

        {loginMethod === "email" && (
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <Label htmlFor="login-password">Senha</Label>
              <button 
                type="button"
                onClick={handleResetPassword}
                className="text-xs text-[#D4AF37] font-semibold hover:underline"
              >
                Esqueci minha senha
              </button>
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="login-password"
                type="password"
                className="pl-10 h-11 border-gray-200 focus:border-[#D4AF37] focus:ring-[#D4AF37] text-black"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          </div>
        )}
        
        <Button 
          type="submit" 
          className="w-full h-11 bg-black text-white hover:bg-black/90 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] font-bold text-lg" 
          disabled={loading}
        >
          {loading ? "Processando..." : (
            loginMethod === "email" ? "Entrar" : "Entrar com Telefone"
          )}
        </Button>
      </form>
    </div>
  );
}
