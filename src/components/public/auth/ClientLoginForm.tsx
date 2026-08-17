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
import { clientLogin, requestPasswordReset } from "@/lib/auth-client.functions";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

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
  const { redirect } = useSearch({ from: '/auth' }) as { redirect?: string };
  const [showPassword, setShowPassword] = useState(false);
  const [view, setView] = useState<'login' | 'forgot-password' | 'success' | 'mfa'>('login');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  
  const loginFn = useServerFn(clientLogin);
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
    console.log("[ClientLoginForm] onSubmit called with:", { identifier: values.identifier });
    setLoading(true);
    try {
      console.log("[ClientLoginForm] Invoking loginFn...");
      // Manual try-catch around the server function call to handle TanStack Start internal errors
      let result;
      try {
        result = await loginFn({
          data: {
            identifier: values.identifier,
            password: values.password,
            barbershopSlug,
          }
        });
      } catch (err: any) {
        console.error("[ClientLoginForm] loginFn threw directly:", err);
        throw new Error(err.message || "Erro de conexão com o servidor. Tente novamente.");
      }
      console.log("[ClientLoginForm] loginFn result:", result);

      if (result.status === 'migration_required') {
        console.log("[ClientLoginForm] Migration required");
        if (onMigrationRequired) {
          onMigrationRequired({ userId: result.userId, phone: result.phone });
        } else {
          toast.error("Atualização de conta necessária. Entre em contato com a barbearia.");
        }
        return;
      }

      if (result.status === 'mfa_required') {
        console.log("[ClientLoginForm] MFA required");
        setView('mfa');
        return;
      }

      if (result.status === 'success') {
        console.log("[ClientLoginForm] Success, calling handleSuccess");
        handleSuccess();
      }
    } catch (error: any) {
      console.error("[ClientLoginForm] Login error caught:", error);
      toast.error(error.message || "Telefone/e-mail ou senha inválidos.");
    } finally {
      console.log("[ClientLoginForm] onSubmit finished");
      setLoading(false);
    }
  };

  const handleSuccess = async () => {
    console.log("[ClientLoginForm] Login successful. Awaiting session hydration...");
    
    // Force a small wait and manual session check to ensure AuthProvider picks it up
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      console.error("[ClientLoginForm] Session not found immediately after login success.");
      toast.error("Erro na sincronização da sessão. Tente novamente.");
      return;
    }

    toast.success("Login realizado com sucesso!");
    
    // Dispatch custom event to trigger useAuth refresh if needed
    window.dispatchEvent(new CustomEvent('profile-updated'));

    if (redirect) {
      console.log("[ClientLoginForm] Redirecting to intended path via window.location.href:", redirect);
      window.location.href = redirect;
    } else if (barbershopSlug) {
      const target = `/${barbershopSlug}/portal`;
      console.log("[ClientLoginForm] Redirecting to tenant portal via window.location.href:", target);
      window.location.href = target;
    } else {
      console.log("[ClientLoginForm] Redirecting to default portal via window.location.href: /portal");
      window.location.href = "/portal";
    }
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
              <h2 className="text-2xl md:text-3xl font-black text-black tracking-tight uppercase italic">Acesse sua conta</h2>
              <p className="text-zinc-500 text-sm font-bold tracking-widest uppercase">Portal do Cliente Barbex</p>
            </div>

            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="identifier" className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Telefone ou E-mail</Label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-gold transition-colors" size={18} />
                  <Input
                    id="identifier"
                    placeholder="+55 (71) 99999-9999 ou e-mail"
                    {...form.register("identifier")}
                    autoComplete="username"
                    onChange={(e) => {
                      const val = e.target.value;
                      
                      // 1. If it contains @ or letters (except '+' for DDI at start), treat as email immediately.
                      if (/[a-zA-Z@]/.test(val) || (val.includes('+') && val.indexOf('+') > 0)) {
                        form.setValue("identifier", val);
                      } else {
                        // Phone normalization
                        const digits = val.replace(/\D/g, "");
                        let formatted = val;
                        
                        if (digits.length > 0) {
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
                      }
                    }}
                    className="h-14 pl-12 bg-white border-zinc-200 rounded-2xl text-black focus-visible:ring-gold/10 focus-visible:border-gold/60 transition-all [&:-webkit-autofill]:shadow-[0_0_0_1000px_white_inset] [&:-webkit-autofill]:text-black"
                  />
                </div>
                {form.formState.errors.identifier && (
                  <p className="text-[10px] text-red-500 font-bold ml-1">{form.formState.errors.identifier.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center px-1">
                  <Label htmlFor="password" className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Senha</Label>
                  <button 
                    type="button" 
                    onClick={() => setView('forgot-password')}
                    className="text-[10px] font-black uppercase tracking-widest text-gold hover:text-gold-dark transition-colors"
                  >
                    Esqueci minha senha
                  </button>
                </div>
                <div className="relative group">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-gold transition-colors" size={18} />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    {...form.register("password")}
                    autoComplete="current-password"
                    className="h-14 pl-12 pr-12 bg-white border-zinc-200 rounded-2xl text-black focus-visible:ring-gold/10 focus-visible:border-gold/60 transition-all [&:-webkit-autofill]:shadow-[0_0_0_1000px_white_inset] [&:-webkit-autofill]:text-black"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-black transition-colors"
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
                  className="w-4 h-4 rounded border-zinc-300 text-gold focus:ring-gold"
                />
                <Label htmlFor="remember" className="text-[10px] font-black uppercase tracking-widest text-zinc-500 cursor-pointer">Manter conectado</Label>
              </div>

              <Button
                type="submit"
                disabled={loading}
                onClick={(e) => {
                  console.log("[ClientLoginForm] Submit button clicked");
                  form.handleSubmit(onSubmit)(e);
                }}
                className="w-full h-14 rounded-2xl bg-black text-white font-black uppercase tracking-widest hover:bg-zinc-800 transition-all shadow-lg shadow-black/10 active:scale-[0.98]"
              >
                {loading ? <Loader2 className="animate-spin" /> : "Entrar"}
              </Button>

              <div className="pt-2 text-center">
                <p className="text-[11px] text-zinc-400 font-bold uppercase tracking-tight">
                  Ainda não configurou seu acesso? <br/>
                  <span className="text-black">Utilize o fluxo de agendamento para localizar seu cadastro.</span>
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
                className="text-[10px] font-black uppercase tracking-widest text-zinc-400 hover:text-black flex items-center gap-1 transition-colors"
              >
                <ArrowRight className="rotate-180" size={12} /> Voltar ao login
              </button>
              <h2 className="text-3xl font-black text-black tracking-tight">Recuperar acesso</h2>
              <p className="text-zinc-500 text-sm font-medium">Enviaremos instruções para o seu e-mail.</p>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Telefone ou E-mail</Label>
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
                  className="h-14 bg-white border-zinc-200 rounded-2xl text-black focus-visible:ring-gold/10 focus-visible:border-gold/60 transition-all [&:-webkit-autofill]:shadow-[0_0_0_1000px_white_inset] [&:-webkit-autofill]:text-black"
                />
              </div>

              <Button
                onClick={handleForgotPassword}
                disabled={loading || !form.watch("identifier")}
                className="w-full h-14 rounded-2xl bg-black text-white font-black uppercase tracking-widest hover:bg-zinc-800 transition-all"
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
              <div className="absolute inset-0 bg-emerald-100 rounded-full blur-xl opacity-50 animate-pulse" />
              <div className="relative w-24 h-24 bg-white rounded-full flex items-center justify-center text-emerald-500 border border-emerald-100 shadow-xl shadow-emerald-500/10">
                <CheckCircle2 size={48} strokeWidth={1.5} />
              </div>
            </div>
            
            <div className="space-y-3 mb-8 px-4">
              <h2 className="text-3xl font-black text-black tracking-tight uppercase italic leading-none">E-mail Enviado</h2>
              <div className="space-y-2">
                <p className="text-zinc-500 text-sm font-bold uppercase tracking-widest opacity-80">
                  Instruções encaminhadas com sucesso
                </p>
                <div className="h-px w-12 bg-gold/30 mx-auto" />
                <p className="text-zinc-400 text-xs font-medium leading-relaxed max-w-[280px] mx-auto">
                  Enviamos o link de recuperação para o seu e-mail cadastrado. Por favor, verifique também sua pasta de <span className="text-zinc-600 font-bold uppercase">spam</span>.
                </p>
              </div>
            </div>

            <div className="w-full space-y-4 px-6">
              <Button
                onClick={() => setView('login')}
                className="h-14 w-full bg-black text-white font-black uppercase tracking-widest rounded-2xl hover:bg-zinc-800 transition-all shadow-lg shadow-black/10 active:scale-[0.98] border border-white/10"
              >
                Entendi
              </Button>
              
              <div className="pt-2">
                <button 
                  onClick={handleForgotPassword}
                  disabled={loading}
                  className="group flex items-center justify-center gap-2 mx-auto"
                >
                  <span className="text-[10px] font-black uppercase tracking-widest text-gold group-hover:text-gold-dark transition-colors">
                    Não recebeu?
                  </span>
                  <span className="text-[10px] font-black uppercase tracking-widest text-black/40 group-hover:text-gold transition-colors border-b border-black/10 group-hover:border-gold pb-0.5">
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
