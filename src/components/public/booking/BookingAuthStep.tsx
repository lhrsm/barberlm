import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mail, Lock, ArrowLeft, Eye, EyeOff, Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { requestEmailVerification, verifyEmailCode, finalizeAuthSetup } from "@/lib/auth-verification.functions";

type OnboardingState = 
  | 'NEEDS_EMAIL' 
  | 'EMAIL_SENDING' 
  | 'EMAIL_SENT' 
  | 'VERIFYING_CODE' 
  | 'CODE_VERIFIED' 
  | 'NEEDS_PASSWORD' 
  | 'FINALIZING' 
  | 'READY' 
  | 'ERROR';

interface BookingAuthStepProps {
  customerName: string;
  customerPhone: string;
  customerId: string | null;
  tenantId: string;
  onSuccess: (userId: string, email: string) => void;
  onBack: () => void;
}

export function BookingAuthStep({
  customerName,
  customerPhone,
  customerId,
  tenantId,
  onSuccess,
  onBack
}: BookingAuthStepProps) {
  const [internalState, setInternalState] = useState<OnboardingState>('NEEDS_EMAIL');
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [timer, setTimer] = useState(0);

  useEffect(() => {
    console.log(`[BOOKING_ONBOARDING_TRACE] State Transition: ${internalState}`);
  }, [internalState]);

  useEffect(() => {
    let interval: any;
    if (timer > 0) {
      interval = setInterval(() => setTimer(t => t - 1), 1000);
    }
    return () => clearInterval(interval);
  }, [timer]);

  const handleSendCode = async () => {
    if (!/\S+@\S+\.\S+/.test(email)) {
      toast.error("E-mail inválido");
      return;
    }
    
    setInternalState('EMAIL_SENDING');
    console.log('[BOOKING_ONBOARDING_TRACE] Requesting code for', email);
    
    try {
      await requestEmailVerification({
        data: {
          email,
          clientId: customerId || undefined,
          userName: customerName
        }
      });
      toast.success("Código enviado para o seu e-mail!");
      setInternalState('EMAIL_SENT');
      setTimer(60);
    } catch (error: any) {
      console.error('[BOOKING_ONBOARDING_TRACE] Send Code Error:', error);
      toast.error(error.message || "Erro ao enviar código");
      setInternalState('NEEDS_EMAIL');
    }
  };

  const handleVerifyCode = async () => {
    if (code.length !== 6) {
      toast.error("O código deve ter 6 dígitos");
      return;
    }
    
    setInternalState('VERIFYING_CODE');
    console.log('[BOOKING_ONBOARDING_TRACE] Verifying code for', email);

    try {
      const res = await verifyEmailCode({ data: { email, code } });
      if (res.success) {
        setInternalState('CODE_VERIFIED');
        // Small delay for UX before showing password field
        setTimeout(() => setInternalState('NEEDS_PASSWORD'), 600);
      } else {
        toast.error(res.error || "Código inválido");
        setInternalState('EMAIL_SENT');
      }
    } catch (error: any) {
      console.error('[BOOKING_ONBOARDING_TRACE] Verify Code Error:', error);
      toast.error("Erro ao verificar código");
      setInternalState('EMAIL_SENT');
    }
  };

  const handleFinish = async () => {
    if (password.length < 6) {
      toast.error("A senha deve ter pelo menos 6 caracteres");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("As senhas não coincidem");
      return;
    }
    
    setInternalState('FINALIZING');
    console.log('[BOOKING_ONBOARDING_TRACE] Finalizing auth setup', { email, customerId, tenantId });

    try {
      const res = await finalizeAuthSetup({
        data: {
          email,
          password,
          clientId: customerId || "",
          phone: customerPhone,
          name: customerName,
          tenantId
        }
      });
      
      if (res.success) {
        console.log('[BOOKING_ONBOARDING_TRACE] Success: User ID', res.userId);
        setInternalState('READY');
        toast.success("Acesso configurado com sucesso!");
        onSuccess(res.userId as string, email);
      } else {
        throw new Error("Falha desconhecida");
      }
    } catch (error: any) {
      console.error('[BOOKING_ONBOARDING_TRACE] Finalize Error:', error);
      toast.error(error.message || "Erro ao finalizar configuração");
      setInternalState('NEEDS_PASSWORD');
    }
  };

  const isLoading = ['EMAIL_SENDING', 'VERIFYING_CODE', 'FINALIZING'].includes(internalState);

  return (
    <div className="flex flex-col w-full max-w-[min(720px,calc(100vw-48px))] mx-auto bg-[#0d0f14]/80 backdrop-blur-xl rounded-[24px] md:rounded-[32px] border border-white/5 shadow-xl overflow-hidden relative">
      <div className="p-6 md:p-8 space-y-6">
        <div className="flex items-center justify-between">
          <button 
            onClick={onBack} 
            disabled={isLoading}
            className="flex items-center gap-2 px-3 py-1.5 -ml-2 rounded-full hover:bg-white/5 transition-colors text-zinc-500 hover:text-white disabled:opacity-50"
          >
            <ArrowLeft size={18} />
            <span className="text-[10px] font-black uppercase tracking-widest">Voltar</span>
          </button>
          
          <div className="flex items-center gap-1.5">
            {[1, 2, 3].map(i => (
              <div 
                key={i} 
                className={cn(
                  "h-1.5 rounded-full transition-all duration-300",
                  ((['NEEDS_EMAIL', 'EMAIL_SENDING'].includes(internalState) && i === 1) || 
                  (['EMAIL_SENT', 'VERIFYING_CODE', 'CODE_VERIFIED'].includes(internalState) && i <= 2) || 
                  (['NEEDS_PASSWORD', 'FINALIZING', 'READY'].includes(internalState) && i <= 3))
                  ? 'w-6 bg-gold' : 'w-1.5 bg-white/10'
                )}
              />
            ))}
          </div>

          <div className="w-10 h-10 -mr-2" />
        </div>

      <AnimatePresence mode="wait">
        {(internalState === 'NEEDS_EMAIL' || internalState === 'EMAIL_SENDING') && (
          <motion.div
            key="email"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            <div className="space-y-2">
              <h3 className="text-2xl md:text-[26px] font-black text-white tracking-tight italic uppercase leading-tight">Configurar seu acesso</h3>
              <p className="text-zinc-500 text-sm leading-relaxed max-w-[420px]">Para sua segurança, precisamos validar seu e-mail e criar uma senha para futuros acessos.</p>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Seu melhor E-mail</Label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                  <Input 
                    type="email"
                    placeholder="seuemail@exemplo.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    disabled={isLoading}
                    className="h-14 pl-12 bg-[#151D2C] border-white/10 rounded-2xl text-white placeholder:text-zinc-600 focus:bg-[#151D2C] focus:text-white focus-visible:ring-gold/10 focus-visible:border-gold/60 transition-all autofill:[-webkit-text-fill-color:#ffffff] autofill:[box-shadow:0_0_0_1000px_#151D2C_inset]"
                  />
                </div>
              </div>

              <Button 
                onClick={handleSendCode}
                disabled={isLoading || !email}
                className="w-full h-14 rounded-2xl bg-gold text-black font-extrabold hover:bg-gold/90 transition-all"
              >
                {isLoading ? <Loader2 className="animate-spin" /> : "Enviar código de confirmação"}
              </Button>
            </div>
          </motion.div>
        )}

        {(internalState === 'EMAIL_SENT' || internalState === 'VERIFYING_CODE' || internalState === 'CODE_VERIFIED') && (
          <motion.div
            key="verification"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            <div className="space-y-2">
              <h3 className="text-2xl md:text-[26px] font-black text-white tracking-tight italic uppercase leading-tight">Confirme seu e-mail</h3>
              <div className="space-y-1">
                <p className="text-zinc-500 text-sm leading-relaxed">Enviamos um código de 6 dígitos para:</p>
                <p className="text-white font-black truncate text-base">{email}</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-4 flex flex-col items-center">
                <div className="space-y-3 w-full max-w-[360px]">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 text-center block">Código de verificação</Label>
                  <div className="flex justify-center">
                    <InputOTP
                      maxLength={6}
                      value={code}
                      onChange={(val) => setCode(val)}
                      disabled={isLoading || internalState === 'CODE_VERIFIED'}
                      inputMode="numeric"
                      render={({ slots }) => (
                        <InputOTPGroup className="gap-2">
                          {slots.map((slot, index) => (
                            <InputOTPSlot
                              key={index}
                              index={index}
                              {...slot}
                              className="w-11 h-13 md:w-12 md:h-14 text-xl font-black bg-[#151D2C] border-white/10 text-white rounded-xl focus:ring-gold/10 focus:border-gold/60 transition-all"
                            />
                          ))}
                        </InputOTPGroup>
                      )}
                    />
                  </div>
                </div>

                <Button 
                  onClick={handleVerifyCode}
                  disabled={isLoading || code.length !== 6 || internalState === 'CODE_VERIFIED'}
                  className="w-full max-w-[360px] h-14 rounded-2xl bg-gold text-black font-black uppercase tracking-widest hover:bg-gold/90 transition-all shadow-lg active:scale-[0.98]"
                >
                  {isLoading ? <Loader2 className="animate-spin" /> : internalState === 'CODE_VERIFIED' ? <CheckCircle2 /> : "Confirmar código"}
                </Button>
              </div>

              <div className="text-center">
                {timer > 0 ? (
                  <p className="text-xs text-zinc-400 font-medium">Reenviar código em {timer}s</p>
                ) : (
                  <button 
                    onClick={handleSendCode} 
                    disabled={isLoading}
                    className="text-xs text-gold font-bold hover:underline disabled:opacity-50"
                  >
                    Não recebi o código. Reenviar agora.
                  </button>
                )}
              </div>
              
              <button 
                onClick={() => setInternalState('NEEDS_EMAIL')}
                disabled={isLoading}
                className="w-full text-xs text-zinc-500 font-bold hover:text-white transition-colors disabled:opacity-50"
              >
                Alterar e-mail
              </button>
            </div>
          </motion.div>
        )}

        {(internalState === 'NEEDS_PASSWORD' || internalState === 'FINALIZING' || internalState === 'READY') && (
          <motion.div
            key="password"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            <div className="space-y-2">
              <h3 className="text-2xl md:text-[26px] font-black text-white tracking-tight italic uppercase leading-tight">Crie sua senha</h3>
              <p className="text-zinc-500 text-sm leading-relaxed max-w-[420px]">Agora defina uma senha segura para acessar seu portal no Barbex.</p>
            </div>

            <div className="space-y-4">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Nova Senha</Label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                    <Input 
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      disabled={isLoading}
                      className="h-14 pl-12 pr-12 bg-[#151D2C] border-white/10 rounded-2xl text-white focus:bg-[#151D2C] focus:text-white focus-visible:ring-gold/10 focus-visible:border-gold/60 transition-all autofill:[-webkit-text-fill-color:#ffffff] autofill:[box-shadow:0_0_0_1000px_#151D2C_inset]"
                      autoComplete="new-password"
                    />
                    <button 
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white"
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Confirmar Senha</Label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                    <Input 
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      disabled={isLoading}
                      className="h-14 pl-12 bg-[#151D2C] border-white/10 rounded-2xl text-white focus:bg-[#151D2C] focus:text-white focus-visible:ring-gold/10 focus-visible:border-gold/60 transition-all autofill:[-webkit-text-fill-color:#ffffff] autofill:[box-shadow:0_0_0_1000px_#151D2C_inset]"
                      autoComplete="new-password"
                    />
                  </div>
                </div>
              </div>

              <div className="p-5 bg-white/5 border border-white/5 rounded-[20px] space-y-3">
                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-zinc-500">
                  REQUISITOS DA SENHA
                </div>
                <ul className="grid grid-cols-1 gap-2 text-[13px] text-zinc-400 font-bold">
                  <li className="flex items-center gap-2.5">
                    {password.length >= 6 ? (
                      <CheckCircle2 size={16} className="text-emerald-500" />
                    ) : (
                      <div className="h-4 w-4 rounded-full border-2 border-zinc-200" />
                    )}
                    <span className={cn(password.length >= 6 ? "text-emerald-600" : "text-zinc-400")}>
                      Pelo menos 6 caracteres
                    </span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    {password === confirmPassword && password.length > 0 ? (
                      <CheckCircle2 size={16} className="text-emerald-500" />
                    ) : (
                      <div className="h-4 w-4 rounded-full border-2 border-zinc-200" />
                    )}
                    <span className={cn(password === confirmPassword && password.length > 0 ? "text-emerald-600" : "text-zinc-400")}>
                      Senhas devem coincidir
                    </span>
                  </li>
                </ul>
              </div>

              <Button 
                onClick={handleFinish}
                disabled={isLoading || password.length < 6 || password !== confirmPassword}
                className="w-full md:w-[260px] h-14 rounded-2xl bg-gold text-black font-black uppercase tracking-widest hover:bg-gold/90 transition-all shadow-lg active:scale-[0.98]"
              >
                {isLoading ? <Loader2 className="animate-spin" /> : "Finalizar configuração"}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      </div>
    </div>
  );
}
