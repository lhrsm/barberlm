import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import {
  CheckCircle2,
  Mail,
  Lock,
  ArrowRight,
  Sparkles,
  Scissors,
  Eye,
  EyeOff,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import {
  requestStaffEmailVerification,
  verifyStaffEmailCode,
  finalizeStaffAuthSetup,
} from "@/lib/staff-auth.functions";
import { supabase } from "@/integrations/supabase/client";
import { useProfessionalAuth } from "@/components/professional/ProfessionalAuthProvider";

interface StaffMigrationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  barber: {
    id: string;
    name: string;
    phone: string;
    tenant_id: string;
    slug?: string;
  } | null;
  onSuccess: (targetRoute: string) => void;
}

export function StaffMigrationModal({
  open,
  onOpenChange,
  barber,
  onSuccess,
}: StaffMigrationModalProps) {
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [email, setEmail] = useState("");
  const [emailExists, setEmailExists] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login } = useProfessionalAuth();

  const reqVerification = useServerFn(requestStaffEmailVerification);
  const verifyCode = useServerFn(verifyStaffEmailCode);
  const finalizeAuth = useServerFn(finalizeStaffAuthSetup);

  if (!barber) return null;

  // ETAPA 1 -> 2: Enviar OTP para o e-mail digitado
  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes("@")) {
      toast.error("Informe um e-mail válido.");
      return;
    }

    setLoading(true);
    try {
      const res = await reqVerification({
        data: {
          email: email.trim().toLowerCase(),
          phone: barber.phone,
          barberId: barber.id,
          tenantId: barber.tenant_id,
          barberName: barber.name,
        },
      });
      setEmailExists(!!res.emailExists);
      toast.success("Código de verificação enviado para seu e-mail!");
      setStep(3);
    } catch (err: any) {
      toast.error(err.message || "Erro ao enviar código.");
    } finally {
      setLoading(false);
    }
  };

  // ETAPA 3: Validar código OTP
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otpCode.length !== 6) {
      toast.error("Digite o código completo de 6 dígitos.");
      return;
    }

    setLoading(true);
    try {
      const cleanEmail = email.trim().toLowerCase();
      const res = await verifyCode({
        data: {
          email: cleanEmail,
          code: otpCode,
        },
      });

      if (!res.success) {
        throw new Error(res.error || "Código inválido.");
      }

      toast.success("E-mail verificado com sucesso!");

      if (emailExists) {
        // Se a conta já existe, finaliza o vínculo diretamente sem pedir criação de senha redundante
        await finalizeAuth({
          data: {
            email: cleanEmail,
            barberId: barber.id,
            phone: barber.phone,
            name: barber.name,
            tenantId: barber.tenant_id,
          },
        });

        login({
          phone: barber.phone,
          barber_id: barber.id,
          name: barber.name,
          role: "barber",
          tenant_id: barber.tenant_id,
        });

        setStep(5);
      } else {
        setStep(4);
      }
    } catch (err: any) {
      toast.error(err.message || "Código incorreto ou expirado.");
    } finally {
      setLoading(false);
    }
  };

  // ETAPA 4: Criar senha e finalizar migração (somente contas novas)
  const handleFinalizeSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast.error("A senha deve ter no mínimo 6 caracteres.");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("As senhas não coincidem.");
      return;
    }

    setLoading(true);
    try {
      const cleanEmail = email.trim().toLowerCase();
      await finalizeAuth({
        data: {
          email: cleanEmail,
          password,
          barberId: barber.id,
          phone: barber.phone,
          name: barber.name,
          tenantId: barber.tenant_id,
        },
      });

      // Fazer login imediato com a nova credencial criada
      await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });

      // Sincronizar sessão profissional
      login({
        phone: barber.phone,
        barber_id: barber.id,
        name: barber.name,
        role: "barber",
        tenant_id: barber.tenant_id,
      });

      setStep(5);
    } catch (err: any) {
      toast.error(err.message || "Erro ao finalizar configuração.");
    } finally {
      setLoading(false);
    }
  };

  const handleFinish = () => {
    const slug = barber.slug || "general";
    const target = slug !== "general" ? `/${slug}/profissional` : "/dashboard";
    onOpenChange(false);
    onSuccess(target);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#0d0f14] border-white/10 text-white rounded-[32px] sm:max-w-[440px] p-8 shadow-2xl">
        {step === 1 && (
          <div className="space-y-6 text-center">
            <div className="mx-auto h-16 w-16 rounded-2xl bg-gold/10 border border-gold/30 flex items-center justify-center text-gold">
              <Scissors size={28} />
            </div>
            <div>
              <DialogTitle className="text-2xl font-black uppercase italic tracking-tighter text-white">
                Olá, <span className="text-gold">{barber.name}</span>
              </DialogTitle>
              <DialogDescription className="text-zinc-400 text-xs mt-2 leading-relaxed">
                Identificamos seu cadastro como profissional. Vamos configurar seu acesso permanente por <strong>e-mail e senha</strong>.
              </DialogDescription>
            </div>
            <Button
              onClick={() => setStep(2)}
              className="w-full h-12 rounded-xl bg-gold hover:bg-gold/90 text-black font-black uppercase text-xs tracking-wider"
            >
              Configurar Meu Acesso <ArrowRight size={14} className="ml-1.5" />
            </Button>
          </div>
        )}

        {step === 2 && (
          <form onSubmit={handleSendOtp} className="space-y-6">
            <DialogHeader className="text-left space-y-1">
              <DialogTitle className="text-xl font-black uppercase italic tracking-tight text-white">
                Informe seu <span className="text-gold">E-mail</span>
              </DialogTitle>
              <DialogDescription className="text-zinc-400 text-xs leading-relaxed">
                Enviaremos um código OTP de 6 dígitos para confirmar seu endereço.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-2">
              <Label htmlFor="staff-email" className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
                Seu e-mail profissional
              </Label>
              <div className="relative group">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-500 group-focus-within:text-gold transition-colors z-10" />
                <Input
                  id="staff-email"
                  type="email"
                  placeholder="exemplo@barbex.shop"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-12 h-14 rounded-2xl bg-[#15171B] border-white/10 text-white placeholder:text-zinc-600 focus:border-gold"
                  required
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-12 rounded-xl bg-gold hover:bg-gold/90 text-black font-black uppercase text-xs tracking-wider"
            >
              {loading ? "Enviando código..." : "Enviar Código de Verificação"}
            </Button>
          </form>
        )}

        {step === 3 && (
          <form onSubmit={handleVerifyOtp} className="space-y-6 text-center">
            <DialogHeader className="text-center space-y-1">
              <DialogTitle className="text-xl font-black uppercase italic tracking-tight text-white">
                Digite o <span className="text-gold">Código OTP</span>
              </DialogTitle>
              <DialogDescription className="text-zinc-400 text-xs leading-relaxed">
                Enviamos um código de 6 dígitos para <strong>{email}</strong>.
              </DialogDescription>
            </DialogHeader>

            <div className="flex justify-center py-2">
              <InputOTP maxLength={6} value={otpCode} onChange={setOtpCode}>
                <InputOTPGroup className="gap-2">
                  {[0, 1, 2, 3, 4, 5].map((index) => (
                    <InputOTPSlot
                      key={index}
                      index={index}
                      className="h-12 w-11 rounded-xl bg-[#15171B] border-white/10 text-white text-lg font-bold focus:border-gold"
                    />
                  ))}
                </InputOTPGroup>
              </InputOTP>
            </div>

            <Button
              type="submit"
              disabled={loading || otpCode.length !== 6}
              className="w-full h-12 rounded-xl bg-gold hover:bg-gold/90 text-black font-black uppercase text-xs tracking-wider"
            >
              {loading ? "Validando..." : "Confirmar Código"}
            </Button>

            <button
              type="button"
              onClick={handleSendOtp}
              disabled={loading}
              className="text-[10px] text-zinc-400 hover:text-gold uppercase tracking-wider font-bold inline-flex items-center gap-1.5"
            >
              <RefreshCw size={12} /> Reenviar código
            </button>
          </form>
        )}

        {step === 4 && (
          <form onSubmit={handleFinalizeSetup} className="space-y-5">
            <DialogHeader className="text-left space-y-1">
              <DialogTitle className="text-xl font-black uppercase italic tracking-tight text-white">
                Crie sua <span className="text-gold">Senha</span>
              </DialogTitle>
              <DialogDescription className="text-zinc-400 text-xs leading-relaxed">
                Defina a senha que você usará para entrar no Barbex.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="staff-new-pass" className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
                  Nova Senha (mín. 6 caracteres)
                </Label>
                <div className="relative group">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-500 group-focus-within:text-gold transition-colors z-10" />
                  <Input
                    id="staff-new-pass"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-12 pr-12 h-13 rounded-2xl bg-[#15171B] border-white/10 text-white placeholder:text-zinc-600 focus:border-gold"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="staff-confirm-pass" className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
                  Confirmar Senha
                </Label>
                <div className="relative group">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-500 group-focus-within:text-gold transition-colors z-10" />
                  <Input
                    id="staff-confirm-pass"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="pl-12 h-13 rounded-2xl bg-[#15171B] border-white/10 text-white placeholder:text-zinc-600 focus:border-gold"
                    required
                  />
                </div>
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-12 rounded-xl bg-gold hover:bg-gold/90 text-black font-black uppercase text-xs tracking-wider"
            >
              {loading ? "Finalizando..." : "Concluir Configuração"}
            </Button>
          </form>
        )}

        {step === 5 && (
          <div className="space-y-6 text-center">
            <div className="mx-auto h-16 w-16 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
              <CheckCircle2 size={32} />
            </div>
            <div>
              <DialogTitle className="text-2xl font-black uppercase italic tracking-tighter text-white">
                {emailExists ? "Conta " : "Acesso "}
                <span className="text-emerald-400">Concluído!</span>
              </DialogTitle>
              <p className="text-zinc-300 text-xs mt-3 leading-relaxed">
                {emailExists
                  ? "Identificamos sua conta existente no Barbex. Seu perfil profissional foi vinculado com sucesso sem alterar sua senha atual."
                  : "Seu acesso agora está padronizado. Nos próximos logins, utilize seu e-mail e senha diretamente na página principal."}
              </p>
            </div>
            <Button
              onClick={handleFinish}
              className="w-full h-12 rounded-xl bg-gold hover:bg-gold/90 text-black font-black uppercase text-xs tracking-wider"
            >
              Acessar Meu Painel <ArrowRight size={14} className="ml-1.5" />
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
