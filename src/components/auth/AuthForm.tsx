import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";

import { toast } from "sonner";
import { Phone, Mail, Lock, Eye, EyeOff, Send, ArrowRight } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { useProfessionalAuth } from "@/components/professional/ProfessionalAuthProvider";

export function AuthForm() {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [loginMethod, setLoginMethod] = useState<"email" | "phone">("email");
  const [showPassword, setShowPassword] = useState(false);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  
  const navigate = useNavigate();
  const { login } = useProfessionalAuth();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log("[AUTH_LOGIN_CLICK]", {
      loginMethod,
      hasEmail: !!email,
      hasPhone: !!phone,
      hasPassword: !!password,
      isSubmitting: loading
    });

    if (loading) return;

    if (loginMethod === "email") {
      if (!email) {
        toast.error("Informe seu e-mail administrativo.");
        return;
      }
      if (!password) {
        toast.error("Informe sua senha.");
        return;
      }
    } else {
      if (!phone) {
        toast.error("Informe seu telefone profissional.");
        return;
      }
    }

    setLoading(true);
    try {
      if (loginMethod === "email") {
        console.log("[AUTH_LOGIN_ATTEMPT] Direct Supabase sign-in for:", email);
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) {
          console.error("[AUTH_LOGIN_ERROR] Supabase error:", error);
          if (error.message === "Invalid login credentials") {
            throw new Error("E-mail ou senha incorretos.");
          }
          throw error;
        }

        console.log("[AUTH_LOGIN_SUCCESS] Session established for user:", data.user?.id);
        
        // Brief settling time for auth state
        await new Promise(resolve => setTimeout(resolve, 100));

        // Let useAuth and router handle the rest, but we can trigger a manual check
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          throw new Error("Falha ao recuperar sessão após login.");
        }

        toast.success("Login realizado com sucesso!");
        navigate({ to: "/dashboard" as any });
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
          setLoading(false);
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
        
        const { data: profile } = await supabase
          .from("profiles")
          .select("slug")
          .eq("id", targetBarber.user_id)
          .single();

        const slug = profile?.slug || "general";

        setTimeout(() => {
          navigate({ to: `/${slug}/profissional` });
        }, 500);
      }
    } catch (error: any) {
      console.error("[AUTH_LOGIN_CRITICAL] Exception:", error);
      toast.error(error.message || "Não foi possível realizar o acesso administrativo.");
    } finally {
      setLoading(false);
    }
  };

  const handleResetPasswordRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail) {
      toast.error("Por favor, insira seu e-mail.");
      return;
    }
    
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      });
      if (error) throw error;
      toast.success("E-mail de recuperação enviado!");
      setIsResetModalOpen(false);
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
            background: "linear-gradient(135deg, #D4AF37, #B8860B)",
            transform: loginMethod === "email" ? "translateX(0)" : "translateX(calc(100% + 4px))",
          }}
        />
        <button
          type="button"
          onClick={() => setLoginMethod("email")}
          className={`relative z-10 h-10 rounded-xl text-[10px] font-black uppercase tracking-widest inline-flex items-center justify-center gap-2 transition-colors ${
            loginMethod === "email" ? "text-black" : "text-white/40 hover:text-white"
          }`}
        >
          <Mail size={14} /> E-mail
        </button>
        <button
          type="button"
          onClick={() => setLoginMethod("phone")}
          className={`relative z-10 h-10 rounded-xl text-[10px] font-black uppercase tracking-widest inline-flex items-center justify-center gap-2 transition-colors ${
            loginMethod === "phone" ? "text-black" : "text-white/40 hover:text-white"
          }`}
        >
          <Phone size={14} /> Telefone
        </button>
      </div>

      <form onSubmit={handleLogin} className="space-y-5" noValidate>
        {loginMethod === "email" ? (
          <div className="space-y-1.5">
            <Label htmlFor="login-email" className="text-[10px] font-black uppercase tracking-widest text-white/40 ml-1">
              E-mail Administrativo
            </Label>
            <div className="relative group">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-white/20 group-focus-within:text-gold transition-colors" />
              <Input
                id="login-email"
                type="email"
                autoComplete="email"
                className="pl-12 h-[56px] rounded-[16px] bg-white/[0.03] border-white/5 text-white placeholder:text-white/10 focus-visible:border-gold focus-visible:ring-1 focus-visible:ring-gold/20 transition-all autofill:bg-transparent"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
          </div>
        ) : (
          <div className="space-y-1.5">
            <Label htmlFor="login-phone" className="text-[10px] font-black uppercase tracking-widest text-white/40 ml-1">
              Telefone do Profissional
            </Label>
            <div className="relative group">
              <Phone className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-white/20 group-focus-within:text-gold transition-colors" />
              <Input
                id="login-phone"
                type="tel"
                autoComplete="tel"
                className="pl-12 h-[56px] rounded-[16px] bg-white/[0.03] border-white/5 text-white placeholder:text-white/10 focus-visible:border-gold focus-visible:ring-1 focus-visible:ring-gold/20 transition-all"
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
              <Label htmlFor="login-password" className="text-[10px] font-black uppercase tracking-widest text-white/40 ml-1">
                Senha
              </Label>
              <button
                type="button"
                onClick={() => setIsResetModalOpen(true)}
                className="text-[9px] text-gold font-black uppercase tracking-widest hover:text-gold/80 transition-colors"
              >
                Esqueci minha senha
              </button>
            </div>
            <div className="relative group">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-500 group-focus-within:text-gold transition-colors z-10" />
              <Input
                id="login-password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                className="pl-12 pr-12 h-[56px] rounded-[16px] bg-white border-zinc-200 text-[#111111] placeholder:text-[#6B7280] focus-visible:bg-white focus-visible:border-gold focus-visible:ring-1 focus-visible:ring-gold/20 transition-all [&:-webkit-autofill]:shadow-[0_0_0_1000px_white_inset] [&:-webkit-autofill]:text-[#111111]"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-black transition-colors p-1 z-20"
                aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>

            </div>
          </div>
        )}

        <Button
          type="submit"
          className="w-full h-[56px] rounded-[16px] text-black font-black uppercase tracking-widest text-xs transition-all duration-300 hover:brightness-110 active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100"
          style={{
            background: "linear-gradient(135deg, #D4AF37, #B8860B)",
            boxShadow: "0 10px 20px -10px rgba(212,175,55,0.3)",
          }}
          disabled={loading}
        >
          {loading ? (
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 border-2 border-black/20 border-t-black rounded-full animate-spin" />
              Processando
            </div>
          ) : (
            <div className="flex items-center gap-2">
              Acessar Painel <ArrowRight size={14} />
            </div>
          )}
        </Button>
      </form>

      {/* Recovery Modal */}
      <Dialog open={isResetModalOpen} onOpenChange={setIsResetModalOpen}>
        <DialogContent className="bg-[#0d0f14] border-white/5 rounded-[32px] sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="text-white font-black uppercase tracking-tighter text-2xl italic">
              Recuperar <span className="text-gold">Acesso</span>
            </DialogTitle>
            <DialogDescription className="text-zinc-500 font-medium text-sm leading-relaxed">
              Insira o e-mail cadastrado e enviaremos as instruções para criar uma nova senha.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleResetPasswordRequest} className="space-y-6 pt-4">
            <div className="space-y-2">
              <Label htmlFor="reset-email" className="text-[10px] font-black uppercase tracking-widest text-white/40 ml-1">
                Seu e-mail cadastrado
              </Label>
              <div className="relative group">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-white/20 group-focus-within:text-gold transition-colors" />
                <Input
                  id="reset-email"
                  type="email"
                  className="pl-12 h-[56px] rounded-[16px] bg-white border-zinc-200 text-[#111111] placeholder:text-[#6B7280] focus-visible:bg-white focus-visible:border-gold focus-visible:ring-1 focus-visible:ring-gold/20 transition-all"
                  placeholder="exemplo@barbex.shop"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            <DialogFooter className="sm:flex-col gap-3">
              <Button
                type="submit"
                disabled={loading}
                className="w-full h-[56px] rounded-[16px] text-black font-black uppercase tracking-widest text-xs transition-all duration-300"
                style={{
                  background: "linear-gradient(135deg, #D4AF37, #B8860B)",
                }}
              >
                {loading ? "Enviando..." : (
                  <div className="flex items-center gap-2">
                    Enviar Instruções <Send size={14} />
                  </div>
                )}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setIsResetModalOpen(false)}
                className="text-zinc-500 hover:text-white font-black uppercase tracking-widest text-[10px]"
              >
                Cancelar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
