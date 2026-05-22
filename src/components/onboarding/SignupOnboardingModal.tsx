import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Dialog, 
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Scissors, 
  User, 
  Mail, 
  Phone, 
  ChevronRight, 
  ChevronLeft, 
  Check, 
  Star,
  Zap,
  Crown,
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  LogIn,
  KeyRound,
  X
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useNavigate } from "@tanstack/react-router";

const step1Schema = z.object({
  barbershopName: z.string().min(3, "Nome da barbearia deve ter pelo menos 3 caracteres"),
  responsibleName: z.string().min(3, "Nome do responsável deve ter pelo menos 3 caracteres"),
  email: z.string().email("E-mail inválido"),
  whatsapp: z.string().min(10, "WhatsApp inválido"),
});

const passwordSchema = z.object({
  password: z.string().min(6, "A senha deve ter pelo menos 6 caracteres"),
  confirmPassword: z.string().min(6, "A confirmação deve ter pelo menos 6 caracteres"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "As senhas não coincidem",
  path: ["confirmPassword"],
});

type Step1Data = z.infer<typeof step1Schema>;
type PasswordData = z.infer<typeof passwordSchema>;

interface SignupOnboardingModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SignupOnboardingModal({ isOpen, onOpenChange }: SignupOnboardingModalProps) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [selectedBarbersRange, setSelectedBarbersRange] = useState<string | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<string>("pro");
  const [emailExists, setEmailExists] = useState(false);
  const [showEmailExistsModal, setShowEmailExistsModal] = useState(false);
  
  const navigate = useNavigate();

  const step1Form = useForm<Step1Data>({
    resolver: zodResolver(step1Schema),
    defaultValues: {
      barbershopName: "",
      responsibleName: "",
      email: "",
      whatsapp: "",
    }
  });

  const passwordForm = useForm<PasswordData>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      password: "",
      confirmPassword: "",
    }
  });

  const nextStep = () => setStep((s) => s + 1);
  const prevStep = () => setStep((s) => s - 1);

  const checkEmail = async (email: string) => {
    setLoading(true);
    const normalizedEmail = email.trim().toLowerCase();
    console.log('checking email', normalizedEmail);
    
    try {
      // 1. Verificar na tabela profiles (para garantir que temos os dados do sistema)
      const { data: profileData } = await supabase
        .from("profiles")
        .select("id")
        .eq("email", normalizedEmail)
        .maybeSingle();

      if (profileData) {
        console.log('email found in profiles');
        setEmailExists(true);
        setShowEmailExistsModal(true);
        return true;
      }

      // Remove the signInWithPassword hack as it fails with Supabase User Enumeration Protection
      // We rely on the profiles table check and handling signUp errors


      // Se chegamos aqui e não houve erro impeditivo, o e-mail está disponível
      setEmailExists(false);
      return false;
    } catch (error) {
      console.error("Error checking email:", error);
      toast.error("Erro ao validar e-mail. Tente novamente.");
      return true; // Bloqueia o avanço em caso de falha técnica
    } finally {
      setLoading(false);
    }
  };

  const handleStep1Submit = async (data: Step1Data) => {
    const exists = await checkEmail(data.email);
    if (!exists) {
      nextStep();
    }
  };

  const handleFinalSubmit = async () => {
    setLoading(true);
    const step1Data = step1Form.getValues();
    const { password } = passwordForm.getValues();

    try {
      const { data, error } = await supabase.auth.signUp({
        email: step1Data.email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth`,
          data: {
            business_name: step1Data.barbershopName,
            responsible_name: step1Data.responsibleName,
            whatsapp_number: step1Data.whatsapp,
            barbers_range: selectedBarbersRange,
            plan: selectedPlan,
          },
        },
      });

      if (error) throw error;

      // If identities is an empty array and we are using email/password, 
      // it means the user already exists (with User Enumeration Protection enabled)
      if (data.user && data.user.identities && data.user.identities.length === 0) {
        setEmailExists(true);
        setShowEmailExistsModal(true);
        setStep(1); // Go back to first step to show the error
        return;
      }

      nextStep(); // Go to summary step (Step 5)

    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const finishOnboarding = () => {
    onOpenChange(false);
    navigate({ to: "/" });
    toast.success("Verifique seu e-mail para ativar sua conta.");
  };

  return (
    <div className="contents">
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl w-[95vw] md:w-full p-0 bg-black/95 border-white/10 text-white overflow-hidden shadow-[0_0_50px_rgba(124,58,237,0.3)] max-h-[90vh] overflow-y-auto">
        <div className="relative p-6 md:p-12">

          {/* Progress Bar */}
          <div className="absolute top-0 left-0 w-full h-1 bg-white/5">
            <motion.div 
              className="h-full bg-primary shadow-[0_0_10px_rgba(var(--primary),0.5)]"
              initial={{ width: "0%" }}
              animate={{ width: `${(step / 5) * 100}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>

          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-8"
              >
                <div className="space-y-2">
                  <h2 className="text-2xl md:text-3xl font-black tracking-tighter bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
                    Vamos criar sua barbearia
                  </h2>

                  <p className="text-gray-400">Preencha os dados básicos para começarmos.</p>
                </div>

                <form onSubmit={step1Form.handleSubmit(handleStep1Submit)} className="space-y-6">
                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="barbershopName" className="text-gray-300">Nome da Barbearia</Label>
                      <div className="relative">
                        <Scissors className="absolute left-3 top-3 h-4 w-4 text-primary" />
                        <Input 
                          id="barbershopName" 
                          placeholder="Ex: Barber Shop Premium"
                          className="bg-white/5 border-white/10 pl-10 focus:border-primary/50"
                          {...step1Form.register("barbershopName")}
                        />
                      </div>
                      {step1Form.formState.errors.barbershopName && (
                        <p className="text-xs text-red-500">{step1Form.formState.errors.barbershopName.message}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="responsibleName" className="text-gray-300">Nome do Responsável</Label>
                      <div className="relative">
                        <User className="absolute left-3 top-3 h-4 w-4 text-primary" />
                        <Input 
                          id="responsibleName" 
                          placeholder="Seu nome completo"
                          className="bg-white/5 border-white/10 pl-10 focus:border-primary/50"
                          {...step1Form.register("responsibleName")}
                        />
                      </div>
                      {step1Form.formState.errors.responsibleName && (
                        <p className="text-xs text-red-500">{step1Form.formState.errors.responsibleName.message}</p>
                      )}
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="email" className="text-gray-300">E-mail</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-3 h-4 w-4 text-primary" />
                        <Input 
                          id="email" 
                          type="email"
                          placeholder="contato@empresa.com"
                          className={cn(
                            "bg-white/5 border-white/10 pl-10 focus:border-primary/50",
                            emailExists && "border-red-500/50 focus:border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.2)]"
                          )}
                          {...step1Form.register("email", {
                            onChange: () => {
                              if (emailExists) setEmailExists(false);
                            }
                          })}
                        />
                      </div>
                      {step1Form.formState.errors.email && (
                        <p className="text-xs text-red-500">{step1Form.formState.errors.email.message}</p>
                      )}
                      {emailExists && (
                        <p className="text-xs text-red-500 flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" />
                          Este e-mail já está cadastrado.
                        </p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="whatsapp" className="text-gray-300">WhatsApp</Label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-3 h-4 w-4 text-primary" />
                        <Input 
                          id="whatsapp" 
                          placeholder="(00) 00000-0000"
                          className="bg-white/5 border-white/10 pl-10 focus:border-primary/50"
                          {...step1Form.register("whatsapp")}
                        />
                      </div>
                      {step1Form.formState.errors.whatsapp && (
                        <p className="text-xs text-red-500">{step1Form.formState.errors.whatsapp.message}</p>
                      )}
                    </div>
                  </div>

                  <Button 
                    type="submit" 
                    className="w-full bg-primary hover:bg-primary/90 h-12 text-lg font-bold"
                    disabled={loading}
                  >
                    {loading ? "Verificando..." : "Continuar"}
                    <ChevronRight className="ml-2 h-5 w-5" />
                  </Button>
                </form>

              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-8"
              >
                <div className="space-y-2">
                  <h2 className="text-2xl md:text-3xl font-black tracking-tighter bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
                    Quantos barbeiros sua barbearia possui?
                  </h2>

                  <p className="text-gray-400">Isso nos ajuda a configurar sua agenda da melhor forma.</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                  {["1 a 3", "3 a 5", "+5"].map((range) => (
                    <motion.div
                      key={range}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setSelectedBarbersRange(range)}
                      className={cn(
                        "p-8 rounded-2xl border cursor-pointer transition-all text-center space-y-4",
                        selectedBarbersRange === range 
                          ? "bg-primary/20 border-primary shadow-[0_0_30px_rgba(var(--primary),0.3)]" 
                          : "bg-white/5 border-white/10 hover:border-white/20"
                      )}
                    >
                      <div className={cn(
                        "mx-auto h-12 w-12 rounded-full flex items-center justify-center",
                        selectedBarbersRange === range ? "bg-primary text-white" : "bg-white/10 text-gray-400"
                      )}>
                        <Star className="h-6 w-6" />
                      </div>
                      <span className="text-xl font-bold">{range}</span>
                    </motion.div>
                  ))}
                </div>

                <div className="flex gap-4">
                  <Button variant="ghost" className="h-12 px-6" onClick={prevStep}>
                    <ChevronLeft className="mr-2 h-5 w-5" /> Voltar
                  </Button>
                  <Button 
                    className="flex-1 bg-primary hover:bg-primary/90 h-12 text-lg font-bold"
                    disabled={!selectedBarbersRange}
                    onClick={nextStep}
                  >
                    Próximo Passo
                    <ChevronRight className="ml-2 h-5 w-5" />
                  </Button>
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-8"
              >
                <div className="space-y-2">
                  <h2 className="text-3xl font-black tracking-tighter bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
                    Segurança da conta
                  </h2>
                  <p className="text-gray-400">Crie uma senha forte para proteger seu painel.</p>
                </div>

                <form onSubmit={passwordForm.handleSubmit(nextStep)} className="space-y-6">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="password">Criar senha</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-3 h-4 w-4 text-primary" />
                        <Input 
                          id="password" 
                          type={showPassword ? "text" : "password"}
                          className="bg-white/5 border-white/10 pl-10 pr-10 focus:border-primary/50"
                          {...passwordForm.register("password")}
                        />
                        <button 
                          type="button"
                          className="absolute right-3 top-3 text-gray-400 hover:text-white"
                          onClick={() => setShowPassword(!showPassword)}
                        >
                          {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                      {passwordForm.formState.errors.password && (
                        <p className="text-xs text-red-500">{passwordForm.formState.errors.password.message}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="confirmPassword">Confirmar senha</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-3 h-4 w-4 text-primary" />
                        <Input 
                          id="confirmPassword" 
                          type={showConfirmPassword ? "text" : "password"}
                          className="bg-white/5 border-white/10 pl-10 pr-10 focus:border-primary/50"
                          {...passwordForm.register("confirmPassword")}
                        />
                        <button 
                          type="button"
                          className="absolute right-3 top-3 text-gray-400 hover:text-white"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        >
                          {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                      {passwordForm.formState.errors.confirmPassword && (
                        <p className="text-xs text-red-500">{passwordForm.formState.errors.confirmPassword.message}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <Button variant="ghost" className="h-12 px-6" type="button" onClick={prevStep}>
                      <ChevronLeft className="mr-2 h-5 w-5" /> Voltar
                    </Button>
                    <Button 
                      type="submit"
                      className="flex-1 bg-primary hover:bg-primary/90 h-12 text-lg font-bold"
                    >
                      Continuar
                      <ChevronRight className="ml-2 h-5 w-5" />
                    </Button>
                  </div>
                </form>
              </motion.div>
            )}

            {step === 4 && (
              <motion.div
                key="step4"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-8"
              >
                <div className="space-y-2 text-center">
                  <h2 className="text-3xl font-black tracking-tighter bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
                    Escolha seu Plano
                  </h2>
                  <p className="text-gray-400">Comece com o Pro e experimente tudo o que oferecemos.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Starter */}
                  <div 
                    onClick={() => setSelectedPlan("starter")}
                    className={cn(
                      "p-6 rounded-2xl border cursor-pointer transition-all space-y-4 relative",
                      selectedPlan === "starter" ? "bg-white/10 border-white/30" : "bg-white/5 border-white/5 hover:border-white/10"
                    )}
                  >
                    <div className="space-y-1">
                      <h3 className="font-bold">Starter</h3>
                      <div className="text-2xl font-black">R$ 49,90<span className="text-sm font-normal text-gray-500">/mês</span></div>
                    </div>
                    <ul className="text-xs space-y-2 text-gray-400">
                      <li className="flex items-center gap-2"><Check size={12} className="text-primary" /> Agenda Básica</li>
                      <li className="flex items-center gap-2"><Check size={12} className="text-primary" /> Até 2 Barbeiros</li>
                    </ul>
                  </div>

                  {/* Pro */}
                  <div 
                    onClick={() => setSelectedPlan("pro")}
                    className={cn(
                      "p-6 rounded-2xl border cursor-pointer transition-all space-y-4 relative scale-105",
                      selectedPlan === "pro" 
                        ? "bg-primary/20 border-primary shadow-[0_0_40px_rgba(var(--primary),0.2)]" 
                        : "bg-white/5 border-white/5 hover:border-white/10"
                    )}
                  >
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-white text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-wider">
                      15 dias grátis
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold">Pro</h3>
                        <Zap size={14} className="text-primary fill-primary" />
                      </div>
                      <div className="text-2xl font-black">R$ 89,90<span className="text-sm font-normal text-gray-500">/mês</span></div>
                    </div>
                    <ul className="text-xs space-y-2 text-gray-400">
                      <li className="flex items-center gap-2"><Check size={12} className="text-primary" /> WhatsApp Automático</li>
                      <li className="flex items-center gap-2"><Check size={12} className="text-primary" /> Cashback & Fidelidade</li>
                      <li className="flex items-center gap-2"><Check size={12} className="text-primary" /> Financeiro Completo</li>
                    </ul>
                  </div>

                  {/* Elite */}
                  <div 
                    onClick={() => setSelectedPlan("elite")}
                    className={cn(
                      "p-6 rounded-2xl border cursor-pointer transition-all space-y-4 relative",
                      selectedPlan === "elite" ? "bg-white/10 border-white/30" : "bg-white/5 border-white/5 hover:border-white/10"
                    )}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold">Elite</h3>
                        <Crown size={14} className="text-yellow-500 fill-yellow-500" />
                      </div>
                      <div className="text-2xl font-black">R$ 149,90<span className="text-sm font-normal text-gray-500">/mês</span></div>
                    </div>
                    <ul className="text-xs space-y-2 text-gray-400">
                      <li className="flex items-center gap-2"><Check size={12} className="text-primary" /> Barbeiros Ilimitados</li>
                      <li className="flex items-center gap-2"><Check size={12} className="text-primary" /> Suporte VIP 24h</li>
                    </ul>
                  </div>
                </div>

                <div className="flex gap-4">
                  <Button variant="ghost" className="h-12 px-6" onClick={prevStep}>
                    <ChevronLeft className="mr-2 h-5 w-5" /> Voltar
                  </Button>
                  <Button 
                    className="flex-1 bg-primary hover:bg-primary/90 h-12 text-lg font-bold"
                    onClick={handleFinalSubmit}
                    disabled={loading}
                  >
                    {loading ? "Processando..." : "Finalizar Cadastro"}
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </div>
              </motion.div>
            )}

            {step === 5 && (
              <motion.div
                key="step5"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center space-y-8 py-8"
              >
                <div className="flex justify-center">
                  <div className="h-24 w-24 rounded-full bg-green-500/20 flex items-center justify-center text-green-500 shadow-[0_0_50px_rgba(34,197,94,0.3)]">
                    <CheckCircle2 size={48} />
                  </div>
                </div>

                <div className="space-y-2">
                  <h2 className="text-4xl font-black tracking-tighter">Quase lá!</h2>
                  <p className="text-gray-400 text-lg">Seu cadastro foi criado com sucesso.</p>
                </div>

                <div className="max-w-md mx-auto p-6 rounded-2xl bg-white/5 border border-white/10 text-left space-y-4">
                  <h4 className="font-bold text-sm uppercase tracking-widest text-primary">Resumo da sua conta:</h4>
                  <div className="grid grid-cols-2 gap-y-3 text-sm">
                    <div className="text-gray-500">Barbearia:</div>
                    <div className="font-medium">{step1Form.getValues().barbershopName}</div>
                    <div className="text-gray-500">Responsável:</div>
                    <div className="font-medium">{step1Form.getValues().responsibleName}</div>
                    <div className="text-gray-500">Plano:</div>
                    <div className="font-medium uppercase">{selectedPlan}</div>
                    <div className="text-gray-500">WhatsApp:</div>
                    <div className="font-medium">{step1Form.getValues().whatsapp}</div>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="flex items-center justify-center gap-3 text-sm text-gray-400">
                    <ShieldCheck className="h-5 w-5 text-primary" />
                    <span>Enviamos um e-mail de confirmação para ativar sua conta.</span>
                  </div>
                  
                  <Button 
                    className="w-full bg-primary hover:bg-primary/90 h-14 text-xl font-black shadow-[0_0_30px_rgba(var(--primary),0.5)]"
                    onClick={finishOnboarding}
                  >
                    Finalizar
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </DialogContent>
    </Dialog>

    <Dialog open={showEmailExistsModal} onOpenChange={setShowEmailExistsModal}>
      <DialogContent className="max-w-md bg-black/95 border-white/10 text-white overflow-hidden shadow-[0_0_50px_rgba(239,68,68,0.3)] p-0">
        <div className="relative p-8 space-y-6">
          <div className="mx-auto w-16 h-16 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center">
            <AlertCircle className="h-8 w-8 text-red-500" />
          </div>
          
          <div className="space-y-2 text-center">
            <h3 className="text-2xl font-black tracking-tighter">E-mail já cadastrado</h3>
            <p className="text-gray-400">
              Já existe uma conta BarberLM utilizando este e-mail.
            </p>
          </div>

          <div className="grid gap-3">
            <Button 
              className="w-full bg-primary hover:bg-primary/90 h-12 font-bold gap-2"
              onClick={() => {
                setShowEmailExistsModal(false);
                onOpenChange(false);
                navigate({ to: "/auth" });
              }}
            >
              <LogIn className="h-4 w-4" />
              Ir para login
            </Button>
            <Button 
              variant="outline" 
              className="w-full bg-transparent border-violet-500/50 text-white hover:bg-violet-500/10 hover:border-violet-400 hover:shadow-[0_0_20px_rgba(139,92,246,0.35)] transition-all duration-300 h-12 font-bold gap-2 rounded-xl"
              onClick={() => {
                setShowEmailExistsModal(false);
                onOpenChange(false);
                navigate({ to: "/auth?type=recovery" });
              }}
            >
              <KeyRound className="h-4 w-4" />
              Recuperar senha
            </Button>
            <Button 
              variant="ghost" 
              className="w-full bg-zinc-900 border border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:border-zinc-500 hover:shadow-[0_0_15px_rgba(255,255,255,0.05)] transition-all duration-300 h-12 font-bold rounded-xl"
              onClick={() => setShowEmailExistsModal(false)}
            >
              Fechar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  </div>
  );
}
