import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mail, Lock, ArrowLeft, Eye, EyeOff, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { requestEmailVerification, verifyEmailCode, finalizeAuthSetup } from "@/lib/auth-verification.functions";

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
  const [step, setStep] = useState<'email' | 'verification' | 'password'>('email');
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [timer, setTimer] = useState(0);

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
    setLoading(true);
    try {
      await requestEmailVerification({
        data: {
          email,
          clientId: customerId || undefined,
          userName: customerName
        }
      });
      toast.success("Código enviado para o seu e-mail!");
      setStep('verification');
      setTimer(60);
    } catch (error: any) {
      toast.error(error.message || "Erro ao enviar código");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    if (code.length !== 6) {
      toast.error("O código deve ter 6 dígitos");
      return;
    }
    setLoading(true);
    try {
      const res = await verifyEmailCode({ data: { email, code } });
      if (res.success) {
        setStep('password');
      } else {
        toast.error(res.error || "Código inválido");
      }
    } catch (error: any) {
      toast.error("Erro ao verificar código");
    } finally {
      setLoading(false);
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
    setLoading(true);
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
        toast.success("Acesso configurado com sucesso!");
        onSuccess(res.userId as string, email);
      }
    } catch (error: any) {
      toast.error(error.message || "Erro ao finalizar configuração");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white p-6 md:p-8">
      <div className="mb-6 flex items-center justify-between">
        <button onClick={onBack} className="p-2 -ml-2 rounded-full hover:bg-zinc-100 transition-colors">
          <ArrowLeft size={20} className="text-zinc-600" />
        </button>
        <div className="flex items-center gap-1.5">
          {[1, 2, 3].map(i => (
            <div 
              key={i} 
              className={`h-1.5 rounded-full transition-all duration-300 ${
                (step === 'email' && i === 1) || 
                (step === 'verification' && i <= 2) || 
                (step === 'password' && i <= 3) 
                ? 'w-6 bg-gold' : 'w-1.5 bg-zinc-200'
              }`}
            />
          ))}
        </div>
      </div>

      <AnimatePresence mode="wait">
        {step === 'email' && (
          <motion.div
            key="email"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            <div className="space-y-2">
              <h3 className="text-2xl font-black text-black tracking-tight leading-tight">Configurar seu acesso</h3>
              <p className="text-zinc-500 text-sm">Para sua segurança, precisamos validar seu e-mail e criar uma senha para futuros acessos.</p>
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
                    className="h-14 pl-12 bg-zinc-50 border-zinc-200 rounded-2xl text-black focus-visible:ring-gold/30"
                  />
                </div>
              </div>

              <Button 
                onClick={handleSendCode}
                disabled={loading || !email}
                className="w-full h-14 rounded-2xl bg-black text-white font-extrabold hover:bg-zinc-800 transition-all"
              >
                {loading ? <Loader2 className="animate-spin" /> : "Enviar código de confirmação"}
              </Button>
            </div>
          </motion.div>
        )}

        {step === 'verification' && (
          <motion.div
            key="verification"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            <div className="space-y-2">
              <h3 className="text-2xl font-black text-black tracking-tight leading-tight">Confirme seu e-mail</h3>
              <p className="text-zinc-500 text-sm">Enviamos um código de 6 dígitos para:</p>
              <p className="text-black font-bold truncate">{email}</p>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 text-center block">Código de 6 dígitos</Label>
                <div className="flex justify-center">
                  <Input 
                    maxLength={6}
                    placeholder="000000"
                    value={code}
                    onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
                    className="h-16 text-center text-3xl font-black tracking-[0.5em] bg-zinc-50 border-zinc-200 rounded-2xl text-black w-full max-w-[200px]"
                  />
                </div>
              </div>

              <Button 
                onClick={handleVerifyCode}
                disabled={loading || code.length !== 6}
                className="w-full h-14 rounded-2xl bg-black text-white font-extrabold hover:bg-zinc-800 transition-all"
              >
                {loading ? <Loader2 className="animate-spin" /> : "Confirmar código"}
              </Button>

              <div className="text-center">
                {timer > 0 ? (
                  <p className="text-xs text-zinc-400 font-medium">Reenviar código em {timer}s</p>
                ) : (
                  <button 
                    onClick={handleSendCode} 
                    className="text-xs text-gold font-bold hover:underline"
                  >
                    Não recebi o código. Reenviar agora.
                  </button>
                )}
              </div>
              
              <button 
                onClick={() => setStep('email')}
                className="w-full text-xs text-zinc-500 font-bold hover:text-black transition-colors"
              >
                Alterar e-mail
              </button>
            </div>
          </motion.div>
        )}

        {step === 'password' && (
          <motion.div
            key="password"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            <div className="space-y-2">
              <h3 className="text-2xl font-black text-black tracking-tight leading-tight">Crie sua senha</h3>
              <p className="text-zinc-500 text-sm">Agora defina uma senha segura para acessar seu portal no Barbex.</p>
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
                      className="h-14 pl-12 pr-12 bg-zinc-50 border-zinc-200 rounded-2xl text-black focus-visible:ring-gold/30"
                    />
                    <button 
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-black"
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
                      className="h-14 pl-12 bg-zinc-50 border-zinc-200 rounded-2xl text-black focus-visible:ring-gold/30"
                    />
                  </div>
                </div>
              </div>

              <div className="p-4 bg-zinc-50 border border-zinc-100 rounded-xl space-y-2">
                <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-tighter text-zinc-600">
                  <AlertCircle size={14} className="text-gold" /> Requisitos mínimos:
                </div>
                <ul className="grid grid-cols-1 gap-1 text-[12px] text-zinc-500 font-medium">
                  <li className="flex items-center gap-2">
                    <div className={`h-1.5 w-1.5 rounded-full ${password.length >= 6 ? 'bg-emerald-500' : 'bg-zinc-300'}`} />
                    Pelo menos 6 caracteres
                  </li>
                  <li className="flex items-center gap-2">
                    <div className={`h-1.5 w-1.5 rounded-full ${password === confirmPassword && password.length > 0 ? 'bg-emerald-500' : 'bg-zinc-300'}`} />
                    Senhas devem coincidir
                  </li>
                </ul>
              </div>

              <Button 
                onClick={handleFinish}
                disabled={loading || password.length < 6 || password !== confirmPassword}
                className="w-full h-14 rounded-2xl bg-black text-white font-extrabold hover:bg-zinc-800 transition-all"
              >
                {loading ? <Loader2 className="animate-spin" /> : "Finalizar configuração"}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
