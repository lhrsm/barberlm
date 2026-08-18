import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  CheckCircle2, 
  Store, 
  User, 
  Mail, 
  Phone, 
  Users, 
  Lock, 
  ChevronRight, 
  ChevronLeft,
  Star,
  ShieldCheck,
  Zap,
  Check
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { BarbexLogo } from "@/components/ui/barbex-logo";
import { cn } from "@/lib/utils";
import { PLAN_LIMITS } from "@/hooks/use-plan-limits";
import { useNavigate } from "@tanstack/react-router";

export function RegisterWizard({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    businessName: "",
    responsibleName: "",
    email: "",
    phone: "",
    professionalCount: "1-3",
    password: "",
    confirmPassword: "",
    selectedPlan: "pro" as "starter" | "pro" | "elite"
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateStep = (currentStep: number) => {
    const newErrors: Record<string, string> = {};
    
    if (currentStep === 1) {
      if (!formData.businessName) newErrors.businessName = "Nome da barbearia é obrigatório";
      if (!formData.responsibleName) newErrors.responsibleName = "Nome do responsável é obrigatório";
      if (!formData.email) {
        newErrors.email = "E-mail é obrigatório";
      } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
        newErrors.email = "E-mail inválido";
      }
      if (!formData.phone) newErrors.phone = "WhatsApp é obrigatório";
    }

    if (currentStep === 3) {
      if (!formData.password) {
        newErrors.password = "Senha é obrigatória";
      } else if (formData.password.length < 6) {
        newErrors.password = "A senha deve ter pelo menos 6 caracteres";
      }
      if (formData.password !== formData.confirmPassword) {
        newErrors.confirmPassword = "As senhas não coincidem";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const nextStep = () => {
    if (validateStep(step)) {
      setStep(s => s + 1);
    }
  };

  const prevStep = () => setStep(s => s - 1);

  const handleFinish = async () => {
    if (!validateStep(step)) return;
    
    setLoading(true);
    // Simulating registration since we must not alter the actual auth flow/db
    // but the user wants the UI experience.
    // In a real scenario, this would call a server function.
    setTimeout(() => {
      setLoading(false);
      setIsSuccess(true);
      toast.success("Barbearia criada com sucesso!");
    }, 2000);
  };

  const getPasswordStrength = (pass: string) => {
    if (!pass) return 0;
    let score = 0;
    if (pass.length > 6) score += 25;
    if (/[A-Z]/.test(pass)) score += 25;
    if (/[0-9]/.test(pass)) score += 25;
    if (/[^A-Za-z0-9]/.test(pass)) score += 25;
    return score;
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter" && step < 5 && !isSuccess) nextStep();
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [step, formData, isSuccess]);

  if (isSuccess) {
    return (
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 p-6 backdrop-blur-xl"
      >
        <div className="w-full max-w-2xl bg-zinc-900/50 border border-gold/20 rounded-[3rem] p-12 text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-gold/5 to-transparent pointer-events-none" />
          
          <motion.div 
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", damping: 12 }}
            className="w-24 h-24 bg-gold rounded-full flex items-center justify-center mx-auto mb-8 shadow-[0_0_50px_rgba(212,175,55,0.4)]"
          >
            <Check size={48} className="text-black stroke-[3]" />
          </motion.div>

          <h2 className="text-4xl md:text-5xl font-black uppercase italic tracking-tighter text-white mb-4">
            Bem-vindo ao Barbex!
          </h2>
          <p className="text-slate-400 text-lg md:text-xl leading-relaxed max-w-lg mx-auto mb-10">
            Sua barbearia foi criada com sucesso. Seu ambiente já está pronto e você já pode começar a utilizar todos os recursos disponíveis do período de teste.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
            {[
              { label: "Plano Selecionado", value: formData.selectedPlan.toUpperCase(), icon: ShieldCheck },
              { label: "Período Gratuito", value: "15 Dias", icon: Zap },
              { label: "Próximos Passos", value: "Configurar Equipe", icon: Star }
            ].map((item, idx) => (
              <div key={idx} className="p-4 rounded-2xl bg-white/5 border border-white/10 text-left">
                <item.icon className="text-gold mb-2" size={20} />
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">{item.label}</div>
                <div className="text-sm font-bold text-white uppercase">{item.value}</div>
              </div>
            ))}
          </div>

          <Button 
            className="h-16 px-12 rounded-2xl bg-gold text-black font-black uppercase tracking-widest hover:bg-gold/90 text-sm shadow-[0_20px_40px_-10px_rgba(212,175,55,0.4)]"
            onClick={() => {
              // Redirect to dashboard (simulated)
              navigate({ to: "/dashboard" });
            }}
          >
            Entrar no painel
          </Button>
        </div>
      </motion.div>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-start md:items-center justify-center bg-black/90 backdrop-blur-xl md:p-4 overflow-y-auto">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full md:max-w-4xl min-h-screen md:min-h-0 md:h-auto bg-zinc-950 border-x md:border border-white/10 md:rounded-[2.5rem] shadow-2xl relative overflow-hidden flex flex-col pb-[env(safe-area-inset-bottom)]"
      >
        {/* Progress Bar */}
        <div className="absolute top-0 left-0 w-full h-1.5 bg-white/5">
          <motion.div 
            className="h-full bg-gold"
            initial={{ width: "0%" }}
            animate={{ width: `${(step / 5) * 100}%` }}
          />
        </div>

        {/* Close Button */}
        <button 
          onClick={onClose}
          className="absolute top-6 right-8 text-slate-500 hover:text-white transition-colors p-2 text-xs font-bold uppercase tracking-widest"
        >
          ESC Sair
        </button>

        <div className="p-6 md:p-12 lg:p-16 flex-1 flex flex-col min-h-0">
          <div className="flex justify-between items-center mb-8 md:mb-12 shrink-0">
            <BarbexLogo size="md" className="scale-90 md:scale-100 origin-left" />
            <div className="text-[10px] font-black uppercase tracking-[0.3em] text-gold">
              Passo {step} de 5
            </div>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              className="min-h-[400px]"
            >
              {step === 1 && (
                <div className="space-y-8">
                  <div className="space-y-2">
                    <h3 className="text-3xl font-black uppercase italic tracking-tighter text-white">Dados da Barbearia</h3>
                    <p className="text-slate-500">Comece informando os detalhes básicos do seu negócio.</p>
                  </div>
                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-1 md:space-y-2">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Nome da Barbearia</Label>
                      <div className="relative group/field">
                        <Store className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within/field:text-gold transition-colors" size={18} />
                        <Input 
                          placeholder="Ex: Barbearia do João" 
                          className="h-14 pl-12"
                          value={formData.businessName}
                          onChange={e => setFormData({...formData, businessName: e.target.value})}
                        />
                      </div>
                      {errors.businessName && <p className="text-red-500 text-[10px] font-bold uppercase mt-1">{errors.businessName}</p>}
                    </div>
                    <div className="space-y-1 md:space-y-2">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Nome do Responsável</Label>
                      <div className="relative group/field">
                        <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within/field:text-gold transition-colors" size={18} />
                        <Input 
                          placeholder="Seu nome completo" 
                          className="h-14 pl-12"
                          value={formData.responsibleName}
                          onChange={e => setFormData({...formData, responsibleName: e.target.value})}
                        />
                      </div>
                      {errors.responsibleName && <p className="text-red-500 text-[10px] font-bold uppercase mt-1">{errors.responsibleName}</p>}
                    </div>
                    <div className="space-y-1 md:space-y-2">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">E-mail Profissional</Label>
                      <div className="relative group/field">
                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within/field:text-gold transition-colors" size={18} />
                        <Input 
                          type="email"
                          placeholder="contato@empresa.com" 
                          className="h-14 pl-12"
                          value={formData.email}
                          onChange={e => setFormData({...formData, email: e.target.value})}
                        />
                      </div>
                      {errors.email && <p className="text-red-500 text-[10px] font-bold uppercase mt-1">{errors.email}</p>}
                    </div>
                    <div className="space-y-1 md:space-y-2">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">WhatsApp</Label>
                      <div className="relative group/field">
                        <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within/field:text-gold transition-colors" size={18} />
                        <Input 
                          placeholder="(00) 00000-0000" 
                          className="h-14 pl-12"
                          value={formData.phone}
                          onChange={e => setFormData({...formData, phone: e.target.value})}
                        />
                      </div>
                      {errors.phone && <p className="text-red-500 text-[10px] font-bold uppercase mt-1">{errors.phone}</p>}
                    </div>
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-8 text-center">
                  <div className="space-y-2">
                    <h3 className="text-3xl font-black uppercase italic tracking-tighter text-white">Tamanho da Equipe</h3>
                    <p className="text-slate-500">Quantos profissionais trabalham na sua barbearia?</p>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-2xl mx-auto pt-8">
                    {["1-3", "3-7", "7-10", "10+"].map(count => (
                      <button
                        key={count}
                        onClick={() => setFormData({...formData, professionalCount: count})}
                        className={cn(
                          "h-24 rounded-2xl border transition-all flex flex-col items-center justify-center gap-2",
                          formData.professionalCount === count 
                            ? "bg-gold/10 border-gold text-gold shadow-lg" 
                            : "bg-white/5 border-white/10 text-slate-400 hover:border-white/30"
                        )}
                      >
                        <Users size={24} />
                        <span className="font-black tracking-tighter uppercase">{count}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="space-y-8">
                  <div className="space-y-2">
                    <h3 className="text-3xl font-black uppercase italic tracking-tighter text-white">Segurança</h3>
                    <p className="text-slate-500">Crie uma senha forte para acessar seu painel.</p>
                  </div>
                  <div className="max-w-md mx-auto space-y-6 pt-8">
                    <div className="space-y-1 md:space-y-2">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Senha de Acesso</Label>
                      <div className="relative group/field">
                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within/field:text-gold transition-colors" size={18} />
                        <Input 
                          type="password"
                          placeholder="••••••••" 
                          className="h-14 pl-12"
                          value={formData.password}
                          onChange={e => setFormData({...formData, password: e.target.value})}
                        />
                      </div>
                      {errors.password && <p className="text-red-500 text-[10px] font-bold uppercase mt-1">{errors.password}</p>}
                      <div className="pt-2">
                        <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">
                          <span>Força da senha</span>
                          <span className={cn(
                            getPasswordStrength(formData.password) < 50 ? "text-red-500" : 
                            getPasswordStrength(formData.password) < 100 ? "text-yellow-500" : "text-green-500"
                          )}>
                            {getPasswordStrength(formData.password) < 50 ? "Fraca" : 
                             getPasswordStrength(formData.password) < 100 ? "Média" : "Forte"}
                          </span>
                        </div>
                        <Progress value={getPasswordStrength(formData.password)} className="h-1 bg-white/5" />
                      </div>
                    </div>
                    <div className="space-y-1 md:space-y-2">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Confirmar Senha</Label>
                      <div className="relative group/field">
                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within/field:text-gold transition-colors" size={18} />
                        <Input 
                          type="password"
                          placeholder="••••••••" 
                          className="h-14 pl-12"
                          value={formData.confirmPassword}
                          onChange={e => setFormData({...formData, confirmPassword: e.target.value})}
                        />
                      </div>
                      {errors.confirmPassword && <p className="text-red-500 text-[10px] font-bold uppercase mt-1">{errors.confirmPassword}</p>}
                    </div>
                  </div>
                </div>
              )}

              {step === 4 && (
                <div className="space-y-8">
                  <div className="space-y-2 text-center">
                    <h3 className="text-3xl font-black uppercase italic tracking-tighter text-white">Escolha do Plano</h3>
                    <p className="text-slate-500">Selecione o plano que melhor atende suas necessidades.</p>
                  </div>
                  <div className="grid md:grid-cols-3 gap-6 pt-4">
                    {["starter", "pro", "elite"].map(planKey => {
                      const plan = PLAN_LIMITS[planKey as keyof typeof PLAN_LIMITS];
                      const isSelected = formData.selectedPlan === planKey;
                      const isPro = planKey === "pro";

                      return (
                        <button
                          key={planKey}
                          onClick={() => setFormData({...formData, selectedPlan: planKey as any})}
                          className={cn(
                            "p-6 rounded-[2rem] border text-left transition-all relative group",
                            isSelected 
                              ? "bg-gold/10 border-gold shadow-lg" 
                              : "bg-white/5 border-white/10 hover:border-white/30"
                          )}
                        >
                          {isPro && (
                            <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gold text-black px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest">
                              Mais Escolhido
                            </span>
                          )}
                          <h4 className="text-xl font-black uppercase italic tracking-tight text-white mb-2">{planKey}</h4>
                          <div className="flex items-baseline gap-1 mb-6">
                            <span className="text-2xl font-black text-white italic">R$</span>
                            <span className="text-4xl font-black text-white">{(plan as any).price?.toFixed(2)}</span>
                            <span className="text-[10px] text-slate-500 font-bold uppercase ml-1">/mês</span>
                          </div>
                          <ul className="space-y-3 mb-4">
                            {[
                              { label: plan.barbers === Infinity ? "Ilimitados" : `${plan.barbers} Barbeiros`, ok: true },
                              { label: "Agenda & Financeiro", ok: true },
                              { label: "CRM Premium", ok: planKey !== "starter" }
                            ].map((f, idx) => (
                              <li key={idx} className={cn("flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest", f.ok ? "text-slate-300" : "text-slate-600")}>
                                <CheckCircle2 size={12} className={f.ok ? "text-gold" : "text-slate-800"} />
                                {f.label}
                              </li>
                            ))}
                          </ul>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {step === 5 && (
                <div className="space-y-8">
                  <div className="space-y-2">
                    <h3 className="text-3xl font-black uppercase italic tracking-tighter text-white">Resumo do Cadastro</h3>
                    <p className="text-slate-500">Confirme se todas as informações estão corretas.</p>
                  </div>
                  <div className="bg-white/5 border border-white/10 rounded-3xl p-8 grid md:grid-cols-2 gap-8">
                    <div className="space-y-6 text-left">
                      {[
                        { label: "Barbearia", value: formData.businessName },
                        { label: "Responsável", value: formData.responsibleName },
                        { label: "E-mail", value: formData.email },
                        { label: "WhatsApp", value: formData.phone }
                      ].map((item, idx) => (
                        <div key={idx}>
                          <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">{item.label}</div>
                          <div className="text-lg font-bold text-white truncate">{item.value}</div>
                        </div>
                      ))}
                    </div>
                    <div className="space-y-6 text-left">
                      <div>
                        <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Equipe</div>
                        <div className="text-lg font-bold text-white uppercase">{formData.professionalCount} Profissionais</div>
                      </div>
                      <div>
                        <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Plano Escolhido</div>
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gold/20 border border-gold/30 text-gold text-[10px] font-black uppercase tracking-widest">
                          <Zap size={12} /> {formData.selectedPlan.toUpperCase()}
                        </div>
                      </div>
                      <div className="pt-4 p-4 rounded-2xl bg-gold/10 border border-gold/20">
                        <p className="text-[11px] font-bold text-gold uppercase leading-relaxed">
                          Ao clicar em finalizar, você inicia seu período de teste de 15 dias gratuitamente.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          <div className="mt-auto md:mt-16 flex flex-col-reverse md:flex-row justify-between items-center pt-8 border-t border-white/5 gap-4">
            <Button
              variant="ghost"
              onClick={step === 1 ? onClose : prevStep}
              className="text-slate-500 hover:text-white font-black uppercase tracking-widest text-xs h-12 px-6 w-full md:w-auto"
            >
              {step === 1 ? "Cancelar" : "Voltar"}
            </Button>
            
            <Button
              onClick={step === 5 ? handleFinish : nextStep}
              disabled={loading}
              className="h-14 px-10 rounded-xl bg-gold text-black font-black uppercase tracking-widest text-xs shadow-lg hover:bg-gold/90 w-full md:w-auto"
            >
              {loading ? "Processando..." : step === 5 ? "Finalizar Cadastro" : "Próximo Passo"}
              {!loading && <ChevronRight className="ml-2" size={16} />}
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}