import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion, AnimatePresence } from "framer-motion";
import { User, Lock, Eye, EyeOff, Loader2, Mail, Phone, ArrowRight, ShieldCheck, AlertCircle, Shield, MailCheck, CheckCircle2 } from "lucide-react";
import { MFAVerificationGuard } from "@/components/security/MFAVerificationGuard";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { requestPasswordReset } from "@/lib/auth-client.functions";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { normalizeIdentifier } from "@/utils/auth-identifier";

const loginSchema = z.object({
  identifier: z.string().min(1, "Informe seu e-mail ou telefone"),
  password: z.string().min(6, "A senha deve ter pelo menos 6 caracteres"),
  remember: z.boolean(),
});

type LoginFormValues = z.infer<typeof loginSchema>;

interface ClientLoginFormProps {
  onMigrationRequired?: (data: { userId: string; phone: string | null }) => void;
  barbershopSlug?: string;
}

export function ClientLoginForm({ onMigrationRequired, barbershopSlug }: ClientLoginFormProps) {
  const search = useSearch({ strict: false }) as { redirect?: string };
  const redirect = search.redirect;
  const [showPassword, setShowPassword] = useState(false);
  const [view, setView] = useState<'login' | 'forgot-password' | 'success' | 'mfa'>('login');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  
  // Removido loginFn (serverFn) para simplificação
  const resetFn = useServerFn(requestPasswordReset);

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      identifier: "",
      password: "",
      remember: true,
    },
  });
  
  // Trace form state for debugging
  useEffect(() => {
    console.log("[ClientLoginForm] Form state updated:", {
      values: form.getValues(),
      errors: form.formState.errors,
      isSubmitting: form.formState.isSubmitting
    });
  }, [form.watch(), form.formState.isSubmitting]);

  const onSubmit = async (values: LoginFormValues) => {
    console.log("[ClientLoginForm] onSubmit (Direct Supabase Auth) called for:", values.identifier);
    setLoading(true);
    try {
      const { type, value } = normalizeIdentifier(values.identifier);
      
      console.log(`[ClientLoginForm] Direct login attempt via Supabase: ${value} (${type})`);
      
      let authResult;
      if (type === 'email') {
        authResult = await supabase.auth.signInWithPassword({
          email: value,
          password: values.password,
        });
      } else {
        // Telefone desabilitado temporariamente conforme PRD (Task 14)
        toast.error("Login por telefone temporariamente indisponível. Utilize seu e-mail.");
        setLoading(false);
        return;
      }

      if (authResult.error) {
        console.error("[ClientLoginForm] Supabase Auth error:", authResult.error);
        throw new Error(authResult.error.message);
      }

      console.log("[ClientLoginForm] Auth success, resolving identity...");
      const { data: { user } } = authResult;
      
      if (!user) throw new Error("Usuário não encontrado após login");

      // Resolve profile/identity AFTER successful auth
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, role, tenant_id, identity_status, slug')
        .eq('id', user.id)
        .maybeSingle();

      if (profileError || !profile) {
        console.error("[ClientLoginForm] Identity resolution failed:", profileError);
        throw new Error("Perfil não encontrado. Sua conta pode estar em migração.");
      }

      handleSuccess({ status: 'success', user: { ...user, slug: profile.slug } });
    } catch (error: any) {
      console.error("[ClientLoginForm] Login workflow error:", error);
      const message = error.message === "Invalid login credentials" 
        ? "E-mail ou senha inválidos." 
        : error.message || "Credenciais inválidas.";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleSuccess = async (result?: any) => {
    console.log("[ClientLoginForm] Login process successful.");
    
    // Validamos a sessão imediatamente via getSession para garantir persistência
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      console.warn("[ClientLoginForm] Session not found in storage immediately. Retrying...");
      await new Promise(resolve => setTimeout(resolve, 300));
      const { data: { session: retrySession } } = await supabase.auth.getSession();
      if (!retrySession) {
        toast.error("Erro ao persistir sessão. Tente novamente.");
        return;
      }
    }

    toast.success("Login realizado com sucesso!");
    
    // Gatilho para componentes que dependem do perfil
    window.dispatchEvent(new CustomEvent('profile-updated'));

    const targetPath = redirect || (barbershopSlug ? `/${barbershopSlug}/portal` : "/");
    
    console.log("[ClientLoginForm] Navigating via router to:", targetPath);
    
    // Usamos window.location.href para forçar uma recarga limpa e evitar estados residuais de auth
    window.location.href = targetPath;
  };





  const handleForgotPassword = async () => {
    const identifier = form.getValues("identifier");
    if (!identifier) {
      toast.error("Informe seu e-mail ou telefone para recuperar a senha");
      return;
    }

    setLoading(true);
    try {
      await resetFn({
        data: {
          identifier,
          redirectTo: `${window.location.origin}/auth/reset-password`
        }
      });
      setView('success');
    } catch (error: any) {
      toast.error(error.message || "Erro ao solicitar recuperação");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-[min(480px,calc(100vw-48px))] mx-auto relative">
      <AnimatePresence mode="wait">
        {view === 'login' && (
          <motion.div
            key="login"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            <div className="text-center space-y-1 mb-2">
              <h2 className="text-2xl md:text-3xl font-black text-white tracking-tight uppercase italic">Acesse sua conta</h2>
              <p className="text-gold text-xs font-bold tracking-widest uppercase">Portal do Cliente Barbex</p>
            </div>

            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="identifier" className="text-[10px] font-black uppercase tracking-[0.1em] text-zinc-400 ml-1">Telefone ou E-mail</Label>
                <div className="relative">
                  <User className="absolute left-5 top-1/2 -translate-y-1/2 text-gold/60 group-focus-within:text-gold transition-colors" size={20} />
                  <Input
                    id="identifier"
                    placeholder="+55 (71) 99999-9999 ou e-mail"
                    {...form.register("identifier")}
                    autoComplete="username"
                    className="h-[52px] md:h-[56px] pl-14 bg-[#151D2C] border-white/10 rounded-2xl text-white placeholder:text-zinc-500 caret-gold [color-scheme:dark] focus:text-white focus-visible:text-white focus-visible:bg-[#151D2C] focus-visible:ring-1 focus-visible:ring-gold/30 focus-visible:border-gold autofill:[-webkit-text-fill-color:#ffffff] autofill:[box-shadow:0_0_0_1000px_#151D2C_inset] transition-all"
                  />
                </div>
                {form.formState.errors.identifier && (
                  <p className="text-[10px] text-red-500 font-bold ml-1">{form.formState.errors.identifier.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center px-1">
                  <Label htmlFor="password" className="text-[10px] font-black uppercase tracking-[0.1em] text-zinc-400">Senha</Label>
                  <button 
                    type="button" 
                    onClick={() => setView('forgot-password')}
                    className="text-[10px] font-black uppercase tracking-widest text-gold hover:text-gold-dark transition-colors"
                  >
                    Esqueci minha senha
                  </button>
                </div>
                <div className="relative group">
                  <Lock className="absolute left-5 top-1/2 -translate-y-1/2 text-gold/60 group-focus-within:text-gold transition-colors" size={20} />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    style={{ ["WebkitTextSecurity" as any]: showPassword ? "none" : "disc" }}
                    placeholder="••••••••"
                    {...form.register("password")}
                    autoComplete="current-password"
                    className="h-[52px] md:h-[56px] pl-14 pr-14 bg-[#151D2C] border-white/10 rounded-2xl text-white placeholder:text-zinc-500 caret-gold [color-scheme:dark] focus:text-white focus-visible:text-white focus-visible:bg-[#151D2C] focus-visible:ring-1 focus-visible:ring-gold/30 focus-visible:border-gold autofill:[-webkit-text-fill-color:#ffffff] autofill:[box-shadow:0_0_0_1000px_#151D2C_inset] transition-all"
                  />

                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white transition-colors"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {form.formState.errors.password && (
                  <p className="text-[10px] text-red-500 font-bold ml-1">{form.formState.errors.password.message}</p>
                )}
              </div>

              <div className="flex items-center gap-2 px-1">
                <input
                  type="checkbox"
                  id="remember"
                  {...form.register("remember")}
                  className="w-4 h-4 rounded border-zinc-700 bg-[#151D2C] text-gold focus:ring-gold"
                />
                <Label htmlFor="remember" className="text-[10px] font-black uppercase tracking-widest text-zinc-400 cursor-pointer">Manter conectado</Label>
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full h-[52px] rounded-2xl bg-gold text-black font-black uppercase tracking-widest hover:bg-gold/90 transition-all shadow-lg shadow-gold/10 active:scale-[0.98]"
              >
                {loading ? <Loader2 className="animate-spin" /> : "Entrar"}
              </Button>

              <div className="pt-2 text-center">
                <p className="text-[11px] text-zinc-400 font-bold uppercase tracking-tight">
                  Ainda não configurou seu acesso? <br/>
                  <span className="text-gold">Utilize o fluxo de agendamento para localizar seu cadastro.</span>
                </p>
              </div>
            </form>
          </motion.div>
        )}

        {view === 'forgot-password' && (
          <motion.div
            key="forgot"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            <div className="space-y-2">
              <button 
                onClick={() => setView('login')}
                className="text-[10px] font-black uppercase tracking-widest text-zinc-400 hover:text-gold flex items-center gap-1 transition-colors"
              >
                <ArrowRight className="rotate-180" size={12} /> Voltar ao login
              </button>
              <h2 className="text-2xl md:text-3xl font-black text-white tracking-tight uppercase italic">Recuperar acesso</h2>
              <p className="text-zinc-400 text-sm font-medium">Enviaremos instruções para o seu e-mail.</p>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1">Telefone ou E-mail</Label>
                <Input
                  placeholder="+55 (71) 99999-9999 ou e-mail"
                  value={form.watch("identifier")}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (!/[a-zA-Z@]/.test(val)) {
                      const digits = val.replace(/\D/g, "");
                      let formatted = val;
                      
                      if (digits.length >= 2) {
                        if (digits.startsWith('55')) {
                          const withoutDDI = digits.substring(2);
                          if (withoutDDI.length === 0) formatted = `+55`;
                          else if (withoutDDI.length <= 2) formatted = `+55 (${withoutDDI}`;
                          else if (withoutDDI.length <= 6) formatted = `+55 (${withoutDDI.slice(0, 2)}) ${withoutDDI.slice(2)}`;
                          else if (withoutDDI.length <= 10) formatted = `+55 (${withoutDDI.slice(0, 2)}) ${withoutDDI.slice(2, 6)}-${withoutDDI.slice(6)}`;
                          else formatted = `+55 (${withoutDDI.slice(0, 2)}) ${withoutDDI.slice(2, 7)}-${withoutDDI.slice(7, 11)}`;
                        } else {
                          if (digits.length <= 2) formatted = `(${digits}`;
                          else if (digits.length <= 6) formatted = `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
                          else if (digits.length <= 10) formatted = `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
                          else formatted = `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
                        }
                        form.setValue("identifier", formatted);
                      } else {
                        form.setValue("identifier", val);
                      }
                    } else {
                      form.setValue("identifier", val);
                    }
                  }}
                  className="h-[52px] bg-[#151D2C] border-white/10 rounded-2xl text-white placeholder:text-zinc-500 caret-gold [color-scheme:dark] focus:text-white focus-visible:text-white focus-visible:bg-[#151D2C] focus-visible:ring-1 focus-visible:ring-gold/30 focus-visible:border-gold autofill:[-webkit-text-fill-color:#ffffff] autofill:[box-shadow:0_0_0_1000px_#151D2C_inset] transition-all"
                />
              </div>

              <Button
                onClick={handleForgotPassword}
                disabled={loading || !form.watch("identifier")}
                className="w-full h-[52px] rounded-2xl bg-gold text-black font-black uppercase tracking-widest hover:bg-gold/90 transition-all"
              >
                {loading ? <Loader2 className="animate-spin" /> : "Enviar instruções"}
              </Button>
            </div>
          </motion.div>
        )}

        {view === 'success' && (
          <motion.div
            key="success"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center justify-center py-6 text-center"
          >
            <div className="mb-6 relative">
              <div className="absolute inset-0 bg-emerald-500/20 rounded-full blur-xl opacity-50 animate-pulse" />
              <div className="relative w-20 h-20 bg-[#151D2C] rounded-full flex items-center justify-center text-emerald-400 border border-emerald-500/30 shadow-xl shadow-emerald-500/10">
                <CheckCircle2 size={40} strokeWidth={1.5} />
              </div>
            </div>
            
            <div className="space-y-3 mb-8 px-4">
              <h2 className="text-2xl md:text-3xl font-black text-white tracking-tight uppercase italic leading-none">E-mail Enviado</h2>
              <div className="space-y-2">
                <p className="text-gold text-xs font-bold uppercase tracking-widest">
                  Instruções encaminhadas com sucesso
                </p>
                <div className="h-px w-12 bg-gold/30 mx-auto" />
                <p className="text-zinc-400 text-xs font-medium leading-relaxed max-w-[280px] mx-auto">
                  Enviamos o link de recuperação para o seu e-mail cadastrado. Por favor, verifique também sua pasta de spam.
                </p>
              </div>
            </div>

            <div className="w-full space-y-4 px-6">
              <Button
                onClick={() => setView('login')}
                className="h-[52px] w-full bg-gold text-black font-black uppercase tracking-widest rounded-2xl hover:bg-gold/90 transition-all shadow-lg shadow-gold/10 active:scale-[0.98]"
              >
                Entendi
              </Button>
              
              <div className="pt-2">
                <button 
                  onClick={handleForgotPassword}
                  disabled={loading}
                  className="group flex items-center justify-center gap-2 mx-auto"
                >
                  <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400 group-hover:text-gold transition-colors">
                    Não recebeu?
                  </span>
                  <span className="text-[10px] font-black uppercase tracking-widest text-gold group-hover:text-gold-light transition-colors border-b border-gold/30 group-hover:border-gold pb-0.5">
                    {loading ? "Enviando..." : "Reenviar link"}
                  </span>
                </button>
              </div>
            </div>
          </motion.div>
        )}
        {view === 'mfa' && (

          <motion.div
            key="mfa"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="py-4"
          >
            <MFAVerificationGuard 
              onSuccess={handleSuccess}
              onCancel={() => setView('login')}
              title="Autenticação Forte"
              description="Sua conta possui MFA ativado. Insira o código do seu app autenticador."
            />
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
