import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion, AnimatePresence } from "framer-motion";
import { Lock, Eye, EyeOff, Loader2, ShieldCheck, AlertCircle, ArrowLeft, CheckCircle2, Sparkles } from "lucide-react";
import { BarbexLogo } from "@/components/ui/barbex-logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { updatePassword } from "@/lib/auth-client.functions";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";

const resetPasswordSchema = z.object({
  password: z.string().min(6, "A senha deve ter pelo menos 6 caracteres"),
  confirmPassword: z.string().min(6, "A confirmação deve ter pelo menos 6 caracteres"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "As senhas não coincidem",
  path: ["confirmPassword"],
});

type ResetPasswordValues = z.infer<typeof resetPasswordSchema>;

export const Route = createFileRoute("/auth/reset-password" as any)({
  component: ResetPasswordPage,
  head: () => ({
    title: "Redefinir Senha — Barbex Premium",
    meta: [
      { name: "description", content: "Crie uma nova senha para sua conta Barbex Enterprise." },
    ],
  }),
});

function ResetPasswordPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<'initializing' | 'validating' | 'ready' | 'success' | 'expired'>('initializing');
  const updatePasswordFn = useServerFn(updatePassword);
  const navigate = useNavigate();

  const form = useForm<ResetPasswordValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
  });

  useEffect(() => {
    let mounted = true;

    const handleRecovery = async (event: string) => {
      console.log(`[RESET_PASSWORD_TRACE] Auth event detected: ${event}`);
      if (event === 'PASSWORD_RECOVERY') {
        if (mounted) setStatus('ready');
      }
    };

    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session) {
        console.log("[RESET_PASSWORD_TRACE] Active session found.");
        if (mounted) setStatus('ready');
      } else {
        console.log("[RESET_PASSWORD_TRACE] No session. Waiting for Supabase event...");
        if (mounted) setStatus('validating');
        
        setTimeout(async () => {
          if (!mounted) return;
          const { data: { session: retrySession } } = await supabase.auth.getSession();
          if (!retrySession && status !== 'ready') {
            console.warn("[RESET_PASSWORD_TRACE] Validation timeout. No recovery session detected.");
            setStatus('expired');
          }
        }, 3000);
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      handleRecovery(event);
    });

    init();

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const onSubmit = async (values: ResetPasswordValues) => {
    setLoading(true);
    console.log("[RESET_PASSWORD_TRACE] Executing password update...");
    try {
      const { error } = await supabase.auth.updateUser({
        password: values.password
      });

      if (error) throw error;

      console.log("[RESET_PASSWORD_TRACE] Password updated successfully.");
      setStatus('success');
      toast.success("Senha redefinida com sucesso!");
    } catch (error: any) {
      console.error("[RESET_PASSWORD_TRACE] Update error:", error);
      toast.error(error.message || "Falha ao atualizar senha.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#05070d] p-6 relative overflow-hidden font-sora">
      <div className="absolute inset-0 z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-gold/5 rounded-full blur-[150px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-gold/5 rounded-full blur-[150px]" />
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-[0.02]" />
      </div>

      <div className="w-full max-w-[440px] relative z-10">
        <div className="flex flex-col items-center mb-10">
          <BarbexLogo size="lg" showText={false} className="h-12 w-auto object-contain" />
          <div className="mt-4 px-3 py-1 rounded-full border border-gold/20 bg-gold/5 backdrop-blur-md">
            <span className="text-[9px] font-black text-gold uppercase tracking-[0.2em] flex items-center gap-2">
              <ShieldCheck size={12} />
              Segurança Barbex
            </span>
          </div>
        </div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-[#0d0f14]/80 backdrop-blur-xl border border-white/5 rounded-[32px] shadow-2xl overflow-hidden p-8 md:p-10"
        >
          <AnimatePresence mode="wait">
            {(status === 'initializing' || status === 'validating') && (
              <motion.div 
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center py-10 space-y-4"
              >
                <div className="relative">
                  <div className="h-12 w-12 border-2 border-gold/10 border-t-gold rounded-full animate-spin" />
                  <Sparkles className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-gold h-4 w-4" />
                </div>
                <p className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.2em]">Validando sessão segura...</p>
              </motion.div>
            )}

            {status === 'ready' && (
              <motion.div
                key="form"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                <div className="text-center space-y-3 mb-8">
                  <h2 className="text-2xl md:text-3xl font-black text-white tracking-tighter uppercase italic leading-none">
                    Nova <span className="text-gold">Senha</span>
                  </h2>
                  <p className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.2em] leading-relaxed max-w-[240px] mx-auto">
                    Crie uma combinação forte para proteger sua conta Barbex.
                  </p>
                </div>

                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5" noValidate>
                  <div className="space-y-1.5">
                    <Label htmlFor="password" className="text-[10px] font-black uppercase tracking-widest text-white/40 ml-1">Nova Senha</Label>
                    <div className="relative group">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-gold transition-colors" size={20} />
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        placeholder="••••••••"
                        {...form.register("password")}
                        autoComplete="new-password"
                        className="h-[56px] pl-12 pr-12 bg-white/[0.03] border-white/5 rounded-[16px] text-white placeholder:text-white/10 focus-visible:ring-gold/20 focus-visible:border-gold/60 transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-white/20 hover:text-white transition-colors p-1"
                      >
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                    {form.formState.errors.password && (
                      <p className="text-[10px] text-red-500 font-bold ml-1">{form.formState.errors.password.message}</p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="confirmPassword" className="text-[10px] font-black uppercase tracking-widest text-white/40 ml-1">Confirmar Senha</Label>
                    <div className="relative group">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-gold transition-colors" size={20} />
                      <Input
                        id="confirmPassword"
                        type={showPassword ? "text" : "password"}
                        placeholder="••••••••"
                        {...form.register("confirmPassword")}
                        autoComplete="new-password"
                        className="h-[56px] pl-12 bg-white/[0.03] border-white/5 rounded-[16px] text-white placeholder:text-white/10 focus-visible:ring-gold/20 focus-visible:border-gold/60 transition-all"
                      />
                    </div>
                    {form.formState.errors.confirmPassword && (
                      <p className="text-[10px] text-red-500 font-bold ml-1">{form.formState.errors.confirmPassword.message}</p>
                    )}
                  </div>

                  <div className="p-4 bg-white/[0.02] border border-white/5 rounded-2xl space-y-2">
                    <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-zinc-400">
                      <CheckCircle2 size={12} className="text-gold" /> Requisito Mínimo
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-zinc-500 font-medium italic">
                      <div className={`h-1.5 w-1.5 rounded-full ${form.watch("password").length >= 6 ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-zinc-700'}`} />
                      Ao menos 6 caracteres alfanuméricos
                    </div>
                  </div>

                  <Button
                    type="submit"
                    disabled={loading}
                    className="w-full h-[56px] rounded-[16px] text-black font-black uppercase tracking-widest text-xs transition-all duration-300 hover:brightness-110 active:scale-[0.98] shadow-lg shadow-gold/10"
                    style={{
                      background: "linear-gradient(135deg, #D4AF37, #B8860B)",
                    }}
                  >
                    {loading ? (
                      <div className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" /> Atualizando
                      </div>
                    ) : "Redefinir Senha"}
                  </Button>
                </form>
              </motion.div>
            )}

            {status === 'success' && (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center space-y-8 py-4"
              >
                <div className="relative w-24 h-24 mx-auto">
                  <div className="absolute inset-0 bg-emerald-500/20 rounded-full blur-2xl animate-pulse" />
                  <div className="relative w-24 h-24 bg-emerald-500/10 border border-emerald-500/20 rounded-full flex items-center justify-center text-emerald-500">
                    <ShieldCheck size={48} />
                  </div>
                </div>
                
                <div className="space-y-3">
                  <h2 className="text-2xl font-black text-white tracking-tighter uppercase italic leading-none">Acesso <span className="text-emerald-500">Restaurado</span></h2>
                  <p className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.2em] leading-relaxed">Sua senha foi atualizada com sucesso. Agora você pode acessar o painel.</p>
                </div>

                <Button
                  onClick={async () => {
                    const { data: { user } } = await supabase.auth.getUser();
                    if (!user) {
                      navigate({ to: '/auth' as any });
                      return;
                    }

                    const { data: profile } = await supabase
                      .from('profiles')
                      .select('role, slug, tenant_id')
                      .eq('id', user.id)
                      .maybeSingle();
                    
                    if (profile?.role === 'client') {
                      // Se for cliente, precisamos do slug do tenant
                      if (profile.tenant_id) {
                        const { data: shop } = await supabase
                          .from('barbershops')
                          .select('slug')
                          .eq('id', profile.tenant_id)
                          .maybeSingle();
                        
                        if (shop?.slug) {
                          window.location.href = `/${shop.slug}/portal`;
                          return;
                        }
                      }
                      window.location.href = '/'; // Fallback
                    } else if (profile?.slug) {
                      window.location.href = `/dashboard`;
                    } else {
                      window.location.href = '/auth';
                    }
                  }}
                  className="w-full h-[56px] rounded-[16px] text-black font-black uppercase tracking-widest text-xs transition-all duration-300 hover:brightness-110 active:scale-[0.98]"
                  style={{
                    background: "linear-gradient(135deg, #D4AF37, #B8860B)",
                  }}
                >
                  Ir para o Login
                </Button>
              </motion.div>
            )}

            {status === 'expired' && (
              <motion.div
                key="expired"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center space-y-8 py-4"
              >
                <div className="w-24 h-24 bg-red-500/10 border border-red-500/20 rounded-full flex items-center justify-center mx-auto text-red-500">
                  <AlertCircle size={48} />
                </div>
                
                <div className="space-y-3">
                  <h2 className="text-2xl font-black text-white tracking-tighter uppercase italic leading-none">Link <span className="text-red-500">Inválido</span></h2>
                  <p className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.2em] leading-relaxed">Este link de recuperação expirou ou já foi utilizado anteriormente.</p>
                </div>

                <div className="space-y-3 pt-4">
                  <Button
                    asChild
                    className="w-full h-[56px] rounded-[16px] text-black font-black uppercase tracking-widest text-xs transition-all duration-300 hover:brightness-110 active:scale-[0.98]"
                    style={{
                      background: "linear-gradient(135deg, #D4AF37, #B8860B)",
                    }}
                  >
                    <Link to="/auth">Solicitar Novo Link</Link>
                  </Button>
                  <Button
                    asChild
                    variant="ghost"
                    className="w-full text-zinc-500 hover:text-white font-black uppercase tracking-widest text-[10px]"
                  >
                    <Link to="/auth"><ArrowLeft size={14} className="mr-2" /> Voltar ao Início</Link>
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        <p className="mt-12 text-center text-zinc-600 text-[9px] font-black uppercase tracking-[0.3em] italic">
          &copy; 2026 BARBEX ENTERPRISE &bull; SECURITY PROTOCOL
        </p>
      </div>
    </div>
  );
}
