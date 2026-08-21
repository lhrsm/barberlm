import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mail,
  Lock,
  ArrowLeft,
  Eye,
  EyeOff,
  Loader2,
  CheckCircle2,
  Crown,
  UserCheck,
  ShieldCheck,
  Sparkles,
  AlertCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { requestEmailVerification, verifyEmailCode, finalizeAuthSetup } from "@/lib/auth-verification.functions";

export type OnboardingStateMachine =
  | 'PHONE_IDENTIFICATION'
  | 'CUSTOMER_FOUND'
  | 'EMAIL_REQUIRED'
  | 'EMAIL_SUBMITTING'
  | 'OTP_REQUIRED'
  | 'OTP_VERIFYING'
  | 'PASSWORD_REQUIRED'
  | 'PASSWORD_CREATING'
  | 'AUTH_COMPLETE'
  | 'BOOKING_RESUME'
  | 'ERROR';

export interface BookingAuthStepProps {
  customerName: string;
  customerPhone: string;
  customerId: string | null;
  tenantId: string;
  activeSubscription?: any;
  subUsage?: any;
  onSuccess: (userId: string, email: string) => void;
  onBack: () => void;
}

function obfuscateEmail(email: string): string {
  if (!email || !email.includes('@')) return email || '';
  const [user, domain] = email.split('@');
  if (user.length <= 2) {
    return `${user.slice(0, 1)}***@${domain}`;
  }
  return `${user.slice(0, 1)}***${user.slice(-1)}@${domain}`;
}

function formatPhoneBr(phone: string): string {
  const digits = (phone || '').replace(/\D/g, '');
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 13 && digits.startsWith('55')) {
    return `(${digits.slice(2, 4)}) ${digits.slice(4, 9)}-${digits.slice(9)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return phone || '';
}

export function BookingAuthStep({
  customerName,
  customerPhone,
  customerId,
  tenantId,
  activeSubscription,
  subUsage,
  onSuccess,
  onBack
}: BookingAuthStepProps) {
  const [state, setState] = useState<OnboardingStateMachine>('EMAIL_REQUIRED');
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [timer, setTimer] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Transition trace logger
  const transitionTo = (nextState: OnboardingStateMachine, reason?: string) => {
    console.log(`[BOOKING_ONBOARDING_TRACE] State Transition: ${state} -> ${nextState} (${reason || 'user_action'})`);
    setErrorMessage(null);
    setState(nextState);
  };

  // Timer countdown for OTP resend
  useEffect(() => {
    let interval: any;
    if (timer > 0) {
      interval = setInterval(() => setTimer(t => t - 1), 1000);
    }
    return () => clearInterval(interval);
  }, [timer]);

  // Handle Send Verification Email
  const handleSendCode = async () => {
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      toast.error("Por favor, informe um e-mail válido.");
      return;
    }

    transitionTo('EMAIL_SUBMITTING', 'Sending verification code');

    try {
      await requestEmailVerification({
        data: {
          email: trimmedEmail,
          clientId: customerId || undefined,
          userName: customerName
        }
      });
      toast.success("Código enviado para o seu e-mail!");
      setTimer(60);
      transitionTo('OTP_REQUIRED', 'Code sent successfully');
    } catch (error: any) {
      console.error('[BOOKING_ONBOARDING_TRACE] Send Code Error:', error);
      const rawMsg = error?.message || '';
      let userMsg = "Erro ao enviar código de verificação.";
      if (rawMsg.includes("already registered") || rawMsg.includes("cadastrado")) {
        userMsg = "Este e-mail já possui uma conta. Acesse com sua senha ou recupere o acesso.";
      } else if (rawMsg.includes("rate limit") || rawMsg.includes("limite")) {
        userMsg = "Muitas tentativas. Aguarde alguns instantes antes de reenviar.";
      }
      setErrorMessage(userMsg);
      toast.error(userMsg);
      transitionTo('EMAIL_REQUIRED', 'Send code error fallback');
    }
  };

  // Handle Verify OTP Code
  const handleVerifyCode = async () => {
    if (code.length !== 6) {
      toast.error("O código de verificação deve ter 6 dígitos.");
      return;
    }

    transitionTo('OTP_VERIFYING', 'Verifying OTP code');

    try {
      const res = await verifyEmailCode({
        data: {
          email: email.trim().toLowerCase(),
          code
        }
      });

      if (res?.success) {
        toast.success("E-mail verificado com sucesso!");
        transitionTo('PASSWORD_REQUIRED', 'OTP validated successfully');
      } else {
        const errorText = res?.error || "Código inválido ou expirado. Verifique os números digitados.";
        setErrorMessage(errorText);
        toast.error(errorText);
        transitionTo('OTP_REQUIRED', 'OTP verification rejected');
      }
    } catch (error: any) {
      console.error('[BOOKING_ONBOARDING_TRACE] Verify Code Error:', error);
      const userMsg = "Erro ao validar o código. Tente novamente.";
      setErrorMessage(userMsg);
      toast.error(userMsg);
      transitionTo('OTP_REQUIRED', 'OTP verification exception');
    }
  };

  // Handle Set Password & Finalize
  const handleFinish = async () => {
    if (password.length < 6) {
      toast.error("A senha deve ter pelo menos 6 caracteres.");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("As senhas não coincidem.");
      return;
    }

    transitionTo('PASSWORD_CREATING', 'Finalizing account setup');

    try {
      const res = await finalizeAuthSetup({
        data: {
          email: email.trim().toLowerCase(),
          password,
          clientId: customerId || "",
          phone: customerPhone,
          name: customerName,
          tenantId
        }
      });

      if (res?.success && res?.userId) {
        toast.success("Acesso configurado com sucesso!");
        transitionTo('AUTH_COMPLETE', 'Account created and linked');
        setTimeout(() => {
          transitionTo('BOOKING_RESUME', 'Resuming booking flow');
          onSuccess(res.userId as string, email.trim().toLowerCase());
        }, 400);
      } else {
        throw new Error("Não foi possível finalizar a configuração de acesso.");
      }
    } catch (error: any) {
      console.error('[BOOKING_ONBOARDING_TRACE] Finalize Error:', error);
      const rawMsg = error?.message || '';
      let userMsg = "Erro ao criar senha. Tente novamente.";
      if (rawMsg.includes("already registered") || rawMsg.includes("cadastrado")) {
        userMsg = "Este e-mail já está vinculado a outra conta.";
      }
      setErrorMessage(userMsg);
      toast.error(userMsg);
      transitionTo('PASSWORD_REQUIRED', 'Password creation error fallback');
    }
  };

  const isSubmitting = state === 'EMAIL_SUBMITTING' || state === 'OTP_VERIFYING' || state === 'PASSWORD_CREATING';

  const planName = activeSubscription?.plan?.name || "Plano Barber Semanal";
  const maxUses = activeSubscription?.plan?.max_uses_per_month ?? 8;
  const usedUses = subUsage?.total_uses_consumed ?? 4;
  const isSubscriber = !!(activeSubscription && activeSubscription.status === 'active');

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="relative rounded-3xl bg-zinc-950/95 border border-amber-500/30 p-6 md:p-8 shadow-[0_20px_50px_rgba(0,0,0,0.8),0_0_30px_rgba(212,175,55,0.15)] text-white backdrop-blur-xl overflow-hidden">

        {/* Glow ambient background */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Header navigation & step indicator */}
        <div className="flex items-center justify-between mb-6">
          <button
            type="button"
            onClick={onBack}
            disabled={isSubmitting}
            className="flex items-center gap-1.5 text-xs font-bold text-zinc-400 hover:text-white transition-colors disabled:opacity-40"
          >
            <ArrowLeft size={16} />
            <span>Voltar</span>
          </button>

          {/* Stepper pills */}
          <div className="flex items-center gap-1.5">
            {[1, 2, 3].map((stepIdx) => {
              const isActive =
                (stepIdx === 1 && (state === 'EMAIL_REQUIRED' || state === 'EMAIL_SUBMITTING')) ||
                (stepIdx === 2 && (state === 'OTP_REQUIRED' || state === 'OTP_VERIFYING')) ||
                (stepIdx === 3 && (state === 'PASSWORD_REQUIRED' || state === 'PASSWORD_CREATING' || state === 'AUTH_COMPLETE' || state === 'BOOKING_RESUME'));
              return (
                <div
                  key={stepIdx}
                  className={cn(
                    "h-1.5 rounded-full transition-all duration-300",
                    isActive ? "w-6 bg-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.5)]" : "w-2 bg-zinc-800"
                  )}
                />
              );
            })}
          </div>
        </div>

        {/* Error Alert Box if any */}
        {errorMessage && (
          <div className="mb-5 p-3.5 rounded-2xl bg-red-950/50 border border-red-500/30 text-red-200 text-xs flex items-start gap-2.5">
            <AlertCircle size={16} className="text-red-400 shrink-0 mt-0.5" />
            <p className="leading-relaxed font-medium">{errorMessage}</p>
          </div>
        )}

        {/* STEP 1: EMAIL COLLECTION */}
        <AnimatePresence mode="wait">
          {(state === 'EMAIL_REQUIRED' || state === 'EMAIL_SUBMITTING') && (
            <motion.div
              key="step-email"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-5"
            >
              {/* Header */}
              <div className="space-y-1.5">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[11px] font-bold uppercase tracking-wider mb-1">
                  <Mail size={13} />
                  <span>Complete seu acesso</span>
                </div>
                <h3 className="text-2xl font-black tracking-tight text-white">
                  Informe seu e-mail
                </h3>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Encontramos seu cadastro. Informe seu e-mail para continuar e proteger sua conta.
                </p>
              </div>

              {/* Customer Recognition & Club Barbex Card */}
              <div className="rounded-2xl bg-zinc-900/80 border border-zinc-800 p-4 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold">
                    <CheckCircle2 size={15} />
                    <span>Cliente reconhecido</span>
                  </div>
                  {isSubscriber && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-gradient-to-r from-amber-500/20 to-amber-600/20 border border-amber-400/40 text-amber-300 text-[10px] font-black uppercase tracking-wider">
                      <Crown size={11} className="text-amber-400" />
                      Clube Barbex
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between pt-1">
                  <div>
                    <p className="text-sm font-extrabold text-white">{customerName || "Cliente"}</p>
                    <p className="text-xs text-zinc-400 font-medium">{formatPhoneBr(customerPhone)}</p>
                  </div>
                  {isSubscriber && (
                    <div className="text-right">
                      <p className="text-[11px] font-bold text-amber-400">{planName}</p>
                      <p className="text-[10px] text-zinc-400">{usedUses} de {maxUses} utilizados</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Email Input Field */}
              <div className="space-y-2">
                <Label htmlFor="auth-email-input" className="text-xs font-bold text-zinc-300">
                  E-mail
                </Label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" size={18} />
                  <Input
                    id="auth-email-input"
                    type="email"
                    placeholder="seuemail@exemplo.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={isSubmitting}
                    autoFocus
                    className="h-13 pl-11 bg-zinc-900 border-zinc-800 focus:border-amber-400 text-white placeholder:text-zinc-600 rounded-xl text-sm"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && email.trim()) {
                        handleSendCode();
                      }
                    }}
                  />
                </div>
              </div>

              {/* Action Button */}
              <Button
                type="button"
                onClick={handleSendCode}
                disabled={isSubmitting || !email.trim()}
                className="w-full h-13 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 text-zinc-950 font-black text-sm uppercase tracking-wider transition-all duration-200 shadow-lg shadow-amber-500/20 disabled:opacity-50"
              >
                {state === 'EMAIL_SUBMITTING' ? (
                  <span className="flex items-center gap-2">
                    <Loader2 size={16} className="animate-spin" />
                    Enviando código...
                  </span>
                ) : (
                  "Continuar"
                )}
              </Button>

              {/* Footer */}
              <p className="text-[11px] text-zinc-500 text-center leading-relaxed">
                Enviaremos um código de verificação para este e-mail.
              </p>
            </motion.div>
          )}

          {/* STEP 2: OTP VERIFICATION */}
          {(state === 'OTP_REQUIRED' || state === 'OTP_VERIFYING') && (
            <motion.div
              key="step-otp"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-5"
            >
              <div className="space-y-1.5">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[11px] font-bold uppercase tracking-wider mb-1">
                  <ShieldCheck size={13} />
                  <span>Verificação de Segurança</span>
                </div>
                <h3 className="text-2xl font-black tracking-tight text-white">
                  Verifique seu e-mail
                </h3>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Enviamos um código de 6 dígitos para{" "}
                  <strong className="text-zinc-200">{obfuscateEmail(email)}</strong>
                </p>
              </div>

              {/* OTP Input - Direct Slots without broken render prop */}
              <div className="py-2 flex flex-col items-center">
                <InputOTP
                  maxLength={6}
                  value={code}
                  onChange={(val) => setCode(val)}
                  disabled={isSubmitting}
                  autoFocus
                >
                  <InputOTPGroup className="gap-2 justify-center">
                    <InputOTPSlot index={0} className="w-11 h-13 md:w-12 md:h-14 text-xl font-bold bg-zinc-900 border-zinc-700 text-white rounded-xl focus:border-amber-400" />
                    <InputOTPSlot index={1} className="w-11 h-13 md:w-12 md:h-14 text-xl font-bold bg-zinc-900 border-zinc-700 text-white rounded-xl focus:border-amber-400" />
                    <InputOTPSlot index={2} className="w-11 h-13 md:w-12 md:h-14 text-xl font-bold bg-zinc-900 border-zinc-700 text-white rounded-xl focus:border-amber-400" />
                    <InputOTPSlot index={3} className="w-11 h-13 md:w-12 md:h-14 text-xl font-bold bg-zinc-900 border-zinc-700 text-white rounded-xl focus:border-amber-400" />
                    <InputOTPSlot index={4} className="w-11 h-13 md:w-12 md:h-14 text-xl font-bold bg-zinc-900 border-zinc-700 text-white rounded-xl focus:border-amber-400" />
                    <InputOTPSlot index={5} className="w-11 h-13 md:w-12 md:h-14 text-xl font-bold bg-zinc-900 border-zinc-700 text-white rounded-xl focus:border-amber-400" />
                  </InputOTPGroup>
                </InputOTP>
              </div>

              {/* CTA Confirm Code */}
              <Button
                type="button"
                onClick={handleVerifyCode}
                disabled={isSubmitting || code.length !== 6}
                className="w-full h-13 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 text-zinc-950 font-black text-sm uppercase tracking-wider transition-all duration-200 shadow-lg shadow-amber-500/20 disabled:opacity-50"
              >
                {state === 'OTP_VERIFYING' ? (
                  <span className="flex items-center gap-2">
                    <Loader2 size={16} className="animate-spin" />
                    Validando código...
                  </span>
                ) : (
                  "Confirmar código"
                )}
              </Button>

              {/* Resend / Change email options */}
              <div className="flex flex-col items-center gap-2 pt-2 text-xs">
                {timer > 0 ? (
                  <p className="text-zinc-400 font-medium">Reenviar código em {timer}s</p>
                ) : (
                  <button
                    type="button"
                    onClick={handleSendCode}
                    disabled={isSubmitting}
                    className="text-amber-400 font-bold hover:underline disabled:opacity-50"
                  >
                    Reenviar código
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => transitionTo('EMAIL_REQUIRED', 'Change email requested')}
                  disabled={isSubmitting}
                  className="text-zinc-400 hover:text-white font-medium transition-colors disabled:opacity-50"
                >
                  Alterar e-mail
                </button>
              </div>
            </motion.div>
          )}

          {/* STEP 3: CREATE PASSWORD */}
          {(state === 'PASSWORD_REQUIRED' || state === 'PASSWORD_CREATING' || state === 'AUTH_COMPLETE' || state === 'BOOKING_RESUME') && (
            <motion.div
              key="step-password"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-5"
            >
              <div className="space-y-1.5">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[11px] font-bold uppercase tracking-wider mb-1">
                  <Lock size={13} />
                  <span>Segurança da Conta</span>
                </div>
                <h3 className="text-2xl font-black tracking-tight text-white">
                  Crie sua senha
                </h3>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Defina uma senha segura para acessar seu portal e histórico no Barbex.
                </p>
              </div>

              {/* Password Fields */}
              <div className="space-y-3.5">
                <div className="space-y-1.5">
                  <Label htmlFor="new-password-input" className="text-xs font-bold text-zinc-300">
                    Nova senha
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" size={17} />
                    <Input
                      id="new-password-input"
                      type={showPassword ? "text" : "password"}
                      placeholder="Mínimo de 6 caracteres"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={isSubmitting}
                      className="h-12 pl-11 pr-11 bg-zinc-900 border-zinc-800 focus:border-amber-400 text-white rounded-xl text-sm"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 p-1"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="confirm-password-input" className="text-xs font-bold text-zinc-300">
                    Confirmar senha
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" size={17} />
                    <Input
                      id="confirm-password-input"
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder="Repita a nova senha"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      disabled={isSubmitting}
                      className="h-12 pl-11 pr-11 bg-zinc-900 border-zinc-800 focus:border-amber-400 text-white rounded-xl text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 p-1"
                    >
                      {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Visual Requirements checklist */}
              <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-2 text-xs">
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={14} className={password.length >= 6 ? "text-emerald-400" : "text-zinc-600"} />
                  <span className={password.length >= 6 ? "text-emerald-300 font-medium" : "text-zinc-400"}>
                    Pelo menos 6 caracteres
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={14} className={password && password === confirmPassword ? "text-emerald-400" : "text-zinc-600"} />
                  <span className={password && password === confirmPassword ? "text-emerald-300 font-medium" : "text-zinc-400"}>
                    Senhas coincidem
                  </span>
                </div>
              </div>

              {/* Submit Button */}
              <Button
                type="button"
                onClick={handleFinish}
                disabled={isSubmitting || password.length < 6 || password !== confirmPassword}
                className="w-full h-13 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 text-zinc-950 font-black text-sm uppercase tracking-wider transition-all duration-200 shadow-lg shadow-amber-500/20 disabled:opacity-50"
              >
                {state === 'PASSWORD_CREATING' || state === 'AUTH_COMPLETE' || state === 'BOOKING_RESUME' ? (
                  <span className="flex items-center gap-2">
                    <Loader2 size={16} className="animate-spin" />
                    Criando acesso e continuando...
                  </span>
                ) : (
                  "Criar senha e continuar"
                )}
              </Button>
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
}
