import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion, AnimatePresence } from "framer-motion";
import { User, Lock, Eye, EyeOff, Loader2, Mail, Phone, ArrowRight, ShieldCheck, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { clientLogin, requestPasswordReset } from "@/lib/auth-client.functions";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
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
  const [showPassword, setShowPassword] = useState(false);
  const [view, setView] = useState<'login' | 'forgot-password' | 'success'>('login');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  
  const loginFn = useServerFn(clientLogin);
  const resetFn = useServerFn(requestPasswordReset);

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      identifier: "",
      password: "",
      remember: false,
    },
  });

  const onSubmit = async (values: LoginFormValues) => {
    setLoading(true);
    try {
      const result = await loginFn({
        data: {
          identifier: values.identifier,
          password: values.password,
          barbershopSlug,
        }
      });

      if (result.status === 'migration_required') {
        if (onMigrationRequired) {
          onMigrationRequired({ userId: result.userId, phone: result.phone });
        } else {
          toast.error("Atualização de conta necessária. Entre em contato com a barbearia.");
        }
        return;
      }

      if (result.status === 'success') {
        // Force session refresh client-side to ensure profile data is fetched
        await supabase.auth.getSession();
        toast.success("Login realizado com sucesso!");
        
        // Redirect based on role or context
        if (barbershopSlug) {
          navigate({ to: `/${barbershopSlug}/portal` as any });
        } else {
          navigate({ to: "/portal" as any });
        }
      }
    } catch (error: any) {
      toast.error(error.message || "Telefone/e-mail ou senha inválidos.");
    } finally {
      setLoading(false);
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
    <div className="w-full max-w-md mx-auto">
      <AnimatePresence mode="wait">
        {view === 'login' && (
          <motion.div
            key="login"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            <div className="text-center space-y-2">
              <h2 className="text-3xl font-black text-black tracking-tight">Acesse sua conta</h2>
              <p className="text-zinc-500 text-sm font-medium">Portal do Cliente Barbex</p>
            </div>

            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="identifier" className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Telefone ou E-mail</Label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                  <Input
                    id="identifier"
                    placeholder="71999999999 ou seu@email.com"
                    {...form.register("identifier")}
                    autoComplete="username"
                    className="h-14 pl-12 bg-zinc-50 border-zinc-200 rounded-2xl text-black focus-visible:ring-gold/30 transition-all"
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
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    {...form.register("password")}
                    autoComplete="current-password"
                    className="h-14 pl-12 pr-12 bg-zinc-50 border-zinc-200 rounded-2xl text-black focus-visible:ring-gold/30 transition-all"
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

              <Button
                type="submit"
                disabled={loading}
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
                  placeholder="71999999999 ou seu@email.com"
                  value={form.watch("identifier")}
                  onChange={(e) => form.setValue("identifier", e.target.value)}
                  className="h-14 bg-zinc-50 border-zinc-200 rounded-2xl text-black focus-visible:ring-gold/30 transition-all"
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
            className="text-center space-y-6 py-8"
          >
            <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mx-auto text-emerald-500">
              <ShieldCheck size={40} />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-black text-black tracking-tight">Instruções enviadas</h2>
              <p className="text-zinc-500 text-sm font-medium px-4">
                Se encontrarmos uma conta compatível, enviaremos as instruções de recuperação para o e-mail cadastrado.
              </p>
            </div>
            <Button
              onClick={() => setView('login')}
              variant="outline"
              className="h-12 border-zinc-200 rounded-xl font-bold px-8 hover:bg-zinc-50 transition-all"
            >
              Voltar ao login
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
