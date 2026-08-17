import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { toast } from "sonner";
import { Phone, Mail, Lock, Eye, EyeOff } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { useProfessionalAuth } from "@/components/professional/ProfessionalAuthProvider";

export function AuthForm() {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [loginMethod, setLoginMethod] = useState<"email" | "phone">("email");
  const [showPassword, setShowPassword] = useState(false);
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
          role: 'barber',
          tenant_id: targetBarber.user_id
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
      console.error("[AuthForm] Login error details:", {
        message: error.message,
        name: error.name,
        stack: error.stack,
        status: error.status,
        code: error.code,
        url: import.meta.env.VITE_SUPABASE_URL
      });
      const errorMessage = error.message || "";
      if (errorMessage === "Failed to fetch" || errorMessage.includes("fetch")) {
        toast.error("Erro de conexão (Failed to fetch): O servidor de autenticação não respondeu a tempo. Tente novamente em alguns segundos.");
      } else if (errorMessage === "Invalid login credentials" || errorMessage.includes("invalid_credentials")) {
        toast.error("Credenciais inválidas");
      } else {
        toast.error(errorMessage);
      }
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
        redirectTo: `${window.location.origin}/auth/reset-password`,
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
    <div className="w-full">
      {/* Segmented control E-mail / Telefone */}
      <div className="relative grid grid-cols-2 p-1 rounded-2xl bg-white/[0.04] border border-white/10 mb-6">
        <div
          className="absolute top-1 bottom-1 w-[calc(50%-4px)] rounded-xl transition-transform duration-300 ease-out shadow-lg"
          style={{
            background: "linear-gradient(135deg, #F59E0B, #D97706)",
            transform: loginMethod === "email" ? "translateX(0)" : "translateX(calc(100% + 4px))",
          }}
        />
        <button
          type="button"
          onClick={() => setLoginMethod("email")}
          className={`relative z-10 h-10 rounded-xl text-sm font-bold inline-flex items-center justify-center gap-2 transition-colors ${
            loginMethod === "email" ? "text-black" : "text-white/70 hover:text-white"
          }`}
        >
          <Mail size={15} /> E-mail
        </button>
        <button
          type="button"
          onClick={() => setLoginMethod("phone")}
          className={`relative z-10 h-10 rounded-xl text-sm font-bold inline-flex items-center justify-center gap-2 transition-colors ${
            loginMethod === "phone" ? "text-black" : "text-white/70 hover:text-white"
          }`}
        >
          <Phone size={15} /> Telefone
        </button>
      </div>

      <form onSubmit={handleLogin} className="space-y-5">
        {loginMethod === "email" ? (
          <div className="space-y-1.5">
            <Label htmlFor="login-email" className="text-[11px] font-bold uppercase tracking-widest text-white/60 ml-1">
              E-mail
            </Label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-white/30" />
              <Input
                id="login-email"
                type="email"
                className="pl-12 h-[56px] rounded-[14px] bg-white/[0.06] border-white/10 text-white placeholder:text-white/20 focus-visible:border-gold focus-visible:ring-2 focus-visible:ring-gold/20 transition-all"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
          </div>
        ) : (
          <div className="space-y-1.5">
            <Label htmlFor="login-phone" className="text-[11px] font-bold uppercase tracking-widest text-white/60 ml-1">
              Telefone
            </Label>
            <div className="relative">
              <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
              <Input
                id="login-phone"
                type="tel"
                className="pl-11 h-[52px] rounded-[14px] bg-white/[0.04] border-white/10 text-white placeholder:text-white/30 focus-visible:border-[#F59E0B] focus-visible:ring-2 focus-visible:ring-[#F59E0B]/30 focus-visible:shadow-[0_0_0_4px_rgba(245,158,11,0.08)] transition-all"
                placeholder="(00) 00000-0000"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
              />
            </div>
          </div>
        )}

        {loginMethod === "email" && (
          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <Label htmlFor="login-password" className="text-[11px] font-bold uppercase tracking-widest text-white/60 ml-1">
                Senha
              </Label>
              <button
                type="button"
                onClick={handleResetPassword}
                className="text-[11px] text-[#F59E0B] font-bold hover:text-[#D97706] transition-colors"
              >
                Esqueci minha senha
              </button>
            </div>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-white/30" />
              <Input
                id="login-password"
                type={showPassword ? "text" : "password"}
                className="pl-12 pr-12 h-[56px] rounded-[14px] bg-white/[0.06] border-white/10 text-white placeholder:text-white/20 focus-visible:border-gold focus-visible:ring-2 focus-visible:ring-gold/20 transition-all"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white transition-colors p-1"
                aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>
        )}

        <Button
          type="submit"
          className="w-full h-[54px] rounded-[14px] text-black font-extrabold text-base tracking-tight transition-all duration-200 hover:brightness-105 hover:-translate-y-0.5 disabled:opacity-60 disabled:hover:translate-y-0 disabled:cursor-not-allowed"
          style={{
            background: "linear-gradient(135deg, #F59E0B, #D97706)",
            boxShadow: "0 12px 28px rgba(245,158,11,.28)",
          }}
          disabled={loading}
        >
          {loading ? "Processando..." : loginMethod === "email" ? "Entrar" : "Entrar com Telefone"}
        </Button>
      </form>
    </div>
  );
}

