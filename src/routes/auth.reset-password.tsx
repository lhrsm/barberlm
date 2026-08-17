import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion, AnimatePresence } from "framer-motion";
import { Lock, Eye, EyeOff, Loader2, ShieldCheck, Scissors, AlertCircle, ArrowLeft } from "lucide-react";
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
    title: "Redefinir Senha — Barbex",
    meta: [
      { name: "description", content: "Crie uma nova senha para sua conta Barbex." },
    ],
  }),
});

function ResetPasswordPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<'form' | 'success' | 'expired'>('form');
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
    // Supabase automatically handles the recovery token in the URL and establishes a session.
    // We can check if we have a session to see if the link is valid.
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        // If no session is present, it might be expired or invalid
        // But let's wait a bit as it might be processing the hash
        setTimeout(async () => {
          const { data: { session: retrySession } } = await supabase.auth.getSession();
          if (!retrySession) {
            setStatus('expired');
          }
        }, 1500);
      }
    };

    checkSession();
  }, []);

  const onSubmit = async (values: ResetPasswordValues) => {
    setLoading(true);
    try {
      await updatePasswordFn({
        data: {
          password: values.password,
        }
      });
      setStatus('success');
      toast.success("Senha atualizada com sucesso!");
    } catch (error: any) {
      toast.error(error.message || "Erro ao atualizar senha");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#050b18] p-4 relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-gold/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-gold/5 rounded-full blur-[120px]" />
      </div>

      <div className="w-full max-w-md relative z-10">
        <div className="mb-8 flex flex-col items-center">
          <BarbexLogo size="2xl" showText={false} />
          <h2 className="mt-4 text-[11px] font-black text-zinc-500 tracking-[0.2em] uppercase italic">Premium Experience</h2>
        </div>

        <div className="bg-white rounded-[32px] shadow-2xl overflow-hidden p-8">
          <AnimatePresence mode="wait">
            {status === 'form' && (
              <motion.div
                key="form"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                <div className="text-center space-y-2">
                  <h2 className="text-2xl md:text-3xl font-black text-black tracking-tight uppercase italic leading-tight">Crie uma nova senha</h2>
                  <p className="text-zinc-500 text-[11px] font-black uppercase tracking-widest ml-1">Defina sua nova senha de acesso.</p>
                </div>

                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="password" className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Nova Senha</Label>
                    <div className="relative group">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-gold transition-colors" size={18} />
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        placeholder="••••••••"
                        {...form.register("password")}
                        autoComplete="new-password"
                        className="h-14 pl-12 pr-12 bg-white border-zinc-200 rounded-2xl text-black focus-visible:ring-gold/10 focus-visible:border-gold/60 transition-all"
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

                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword" className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Confirmar Nova Senha</Label>
                    <div className="relative group">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-gold transition-colors" size={18} />
                      <Input
                        id="confirmPassword"
                        type={showPassword ? "text" : "password"}
                        placeholder="••••••••"
                        {...form.register("confirmPassword")}
                        autoComplete="new-password"
                        className="h-14 pl-12 bg-white border-zinc-200 rounded-2xl text-black focus-visible:ring-gold/10 focus-visible:border-gold/60 transition-all"
                      />
                    </div>
                    {form.formState.errors.confirmPassword && (
                      <p className="text-[10px] text-red-500 font-bold ml-1">{form.formState.errors.confirmPassword.message}</p>
                    )}
                  </div>

                  <div className="p-4 bg-zinc-50 border border-zinc-100 rounded-xl space-y-2">
                    <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-tighter text-zinc-600">
                      <AlertCircle size={14} className="text-gold" /> Requisitos mínimos:
                    </div>
                    <ul className="grid grid-cols-1 gap-1 text-[12px] text-zinc-500 font-medium">
                      <li className="flex items-center gap-2">
                        <div className={`h-1.5 w-1.5 rounded-full ${form.watch("password").length >= 6 ? 'bg-emerald-500' : 'bg-zinc-300'}`} />
                        Pelo menos 6 caracteres
                      </li>
                    </ul>
                  </div>

                  <Button
                    type="submit"
                    disabled={loading}
                    className="w-full h-14 rounded-2xl bg-black text-white font-black uppercase tracking-widest hover:bg-zinc-800 transition-all shadow-lg shadow-black/10 active:scale-[0.98]"
                  >
                    {loading ? <Loader2 className="animate-spin" /> : "Atualizar senha"}
                  </Button>
                </form>
              </motion.div>
            )}

            {status === 'success' && (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center space-y-6 py-4"
              >
                <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mx-auto text-emerald-500">
                  <ShieldCheck size={40} />
                </div>
                <div className="space-y-2">
                  <h2 className="text-2xl font-black text-black tracking-tight">Senha atualizada!</h2>
                  <p className="text-zinc-500 text-sm font-medium">Sua senha foi redefinida com sucesso.</p>
                </div>
                <Button
                  asChild
                  className="w-full h-14 rounded-2xl bg-black text-white font-black uppercase tracking-widest hover:bg-zinc-800 transition-all"
                >
                  <Link to="/auth" search={{ tab: "login" }}>Entrar no Barbex</Link>
                </Button>
              </motion.div>
            )}

            {status === 'expired' && (
              <motion.div
                key="expired"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center space-y-6 py-4"
              >
                <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto text-red-500">
                  <AlertCircle size={40} />
                </div>
                <div className="space-y-2">
                  <h2 className="text-2xl font-black text-black tracking-tight">Link expirado</h2>
                  <p className="text-zinc-500 text-sm font-medium">Este link de recuperação expirou ou não é mais válido.</p>
                </div>
                <Button
                  asChild
                  variant="outline"
                  className="w-full h-14 rounded-2xl border-zinc-200 font-black uppercase tracking-widest"
                >
                  <Link to="/auth" search={{ tab: "login" }}>Solicitar novo link</Link>
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <p className="mt-8 text-center text-zinc-500 text-xs font-bold uppercase tracking-widest">
          &copy; 2026 Barbex Enterprise. Segurança Garantida.
        </p>
      </div>
    </div>
  );
}