import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { useEffect, useState, useRef } from "react";
import { SignupOnboardingModal } from "@/components/onboarding/SignupOnboardingModal";
import { ManageCookiesLink } from "@/components/CookieBanner";
import barbexLogo from "@/assets/logo-barbex.png.asset.json";
import { Button } from "@/components/ui/button";
import { motion, useScroll, useTransform, AnimatePresence } from "framer-motion";
import { 
  Calendar, 
  Users, 
  CircleDollarSign, 
  Scissors, 
  CheckCircle2, 
  ArrowRight,
  BarChart3,
  Smartphone,
  ShieldCheck,
  Zap,
  MessageSquare,
  TrendingUp,
  Settings,
  HelpCircle,
  XCircle,
  Check,
  Star,
  Play,
  ArrowUpRight,
  ChevronDown,
  LayoutDashboard,
  Megaphone,
  CreditCard,
  Accessibility,
  Lock,
  Briefcase,
  Menu,
  Search,
  Sparkles,
  ShoppingBag,
  Repeat,
  UserCircle,
  Percent,
  Tag,
  ArrowUp,
} from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  component: LandingPageComponent,
});

function LandingPageComponent() {
  const { user, loading, role } = useAuth();
  const navigate = useNavigate();
  const [showSignupModal, setShowSignupModal] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">("monthly");
  const planPrices = {
    monthly: { starter: "R$ 59,90", pro: "R$ 99,90", elite: "R$ 149,90" },
    annual:  { starter: "R$ 47,90", pro: "R$ 79,90", elite: "R$ 119,90" },
  } as const;
  const WHATSAPP_COMERCIAL = "5571981708086";
  const personalizadoUrl = `https://wa.me/${WHATSAPP_COMERCIAL}?text=${encodeURIComponent("Olá! Tenho interesse em um Plano Personalizado do BarberX para minha barbearia.")}`;
  const prices = planPrices[billingCycle];
  const priceSuffix = billingCycle === "annual" ? "/mês · cobrado anualmente" : "/mês";

  useEffect(() => {
    if (!loading && user && role) {
      if (role === 'super_admin') {
        navigate({ to: "/admin/dashboard", replace: true });
      } else if (role === 'barber') {
        navigate({ to: "/calendar", replace: true });
      } else {
        navigate({ to: "/dashboard", replace: true });
      }
    }
  }, [user, loading, role, navigate]);

  if (loading) return null;
  if (user) return null;

  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-primary/20 overflow-x-hidden">
      {/* Navigation */}
      <motion.nav 
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        className="fixed top-0 w-full z-50 bg-background/80 backdrop-blur-md border-b border-white/5"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer">
            <img
              src={barbexLogo.url}
              alt="Barbex"
              className="h-10 sm:h-12 w-auto drop-shadow-[0_0_10px_rgba(212,175,55,0.35)]"
            />
          </div>
          
          <div className="hidden lg:flex items-center gap-8">
            {["Recursos", "Módulos", "Automações", "Planos", "FAQ"].map((item) => (
              <a key={item} href={`#${item.toLowerCase()}`} className="text-sm font-bold text-white/60 hover:text-primary transition-colors">
                {item}
              </a>
            ))}
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            <div className="hidden xs:flex items-center gap-2 sm:gap-4">
              <Button variant="ghost" className="text-white font-bold hover:bg-white/5 px-3 sm:px-4" asChild>
                <Link to="/auth">Entrar</Link>
              </Button>
              <Button 
                className="bg-primary hover:bg-primary/90 text-primary-foreground font-black px-4 sm:px-6 rounded-xl hover:shadow-[0_0_20px_rgba(234,179,8,0.4)] transition-all text-sm sm:text-base" 
                onClick={() => setShowSignupModal(true)}
              >
                Teste grátis
              </Button>
            </div>
            
            <Button 
              variant="ghost" 
              size="icon" 
              className="lg:hidden text-white" 
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              <Menu className="h-6 w-6" />
            </Button>
          </div>
        </div>

        {/* Mobile Menu Overlay */}
        <AnimatePresence>
          {isMobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="lg:hidden bg-zinc-950 border-b border-white/5 overflow-hidden"
            >
              <div className="flex flex-col p-6 gap-4">
                {["Recursos", "Módulos", "Automações", "Planos", "FAQ"].map((item) => (
                  <a 
                    key={item} 
                    href={`#${item.toLowerCase()}`} 
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="text-lg font-bold text-white/60 hover:text-primary transition-colors py-2"
                  >
                    {item}
                  </a>
                ))}
                <div className="xs:hidden flex flex-col gap-3 pt-4 border-t border-white/5">
                  <Button variant="ghost" className="text-white font-bold justify-start px-0" asChild>
                    <Link to="/auth">Entrar</Link>
                  </Button>
                  <Button 
                    className="bg-primary hover:bg-primary/90 text-primary-foreground font-black w-full rounded-xl" 
                    onClick={() => {
                      setIsMobileMenuOpen(false);
                      setShowSignupModal(true);
                    }}
                  >
                    Teste grátis
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 px-6 overflow-hidden">
        {/* Abstract Background Shapes */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full -z-10 pointer-events-none">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/20 blur-[120px] rounded-full animate-pulse" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-primary/10 blur-[120px] rounded-full" />
        </div>

        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col items-center text-center mb-16">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-primary text-xs font-black uppercase tracking-widest mb-8 shadow-xl"
            >
              <Zap className="h-3.5 w-3.5 fill-current" />
              <span>Sua barbearia no próximo nível</span>
            </motion.div>
            
            <motion.h1 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-4xl sm:text-6xl lg:text-9xl font-black tracking-tightest mb-8 text-white leading-[0.9] max-w-5xl px-4"
            >
              Sua barbearia no <br />
              <span className="text-primary italic">piloto automático.</span>
            </motion.h1>
            
            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-lg lg:text-xl text-white/50 max-w-2xl mb-12 font-bold leading-relaxed"
            >
              A plataforma <span className="text-primary">modular</span> para barbearias. Agenda, financeiro, comissões, assinaturas, fidelidade, cashback, loja e automações de WhatsApp — ative apenas os módulos que você precisa.
            </motion.p>

            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="flex flex-col sm:flex-row items-center gap-4"
            >
              <Button 
                size="lg" 
                className="h-16 px-10 text-lg font-black bg-primary hover:bg-primary/90 text-primary-foreground rounded-2xl shadow-[0_20px_40px_-15px_rgba(234,179,8,0.5)] group transition-all"
                onClick={() => setShowSignupModal(true)}
              >
                Começar teste grátis
                <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </Button>
              <Button size="lg" variant="ghost" className="h-16 px-10 text-lg font-bold text-white border border-white/20 rounded-2xl bg-white/5 hover:bg-white/10 hover:border-primary/60 hover:text-primary hover:shadow-[0_10px_30px_-15px_rgba(234,179,8,0.4)] transition-all duration-300 group">
                Ver demonstração
                <Play className="ml-2 h-4 w-4 fill-current group-hover:scale-110 transition-transform" />
              </Button>
            </motion.div>
            
            {/* Social Proof */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="mt-16 flex flex-col items-center gap-4"
            >
              <div className="flex -space-x-3">
                {[1,2,3,4].map(i => (
                  <div key={i} className="w-10 h-10 rounded-full border-2 border-background bg-zinc-800 flex items-center justify-center overflow-hidden">
                    <img src={`https://i.pravatar.cc/100?img=${i+10}`} alt="User" />
                  </div>
                ))}
                <div className="w-10 h-10 rounded-full border-2 border-background bg-primary flex items-center justify-center text-[10px] font-black text-primary-foreground">
                  +300
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex">
                  {[1,2,3,4,5].map(i => <Star key={i} className="h-4 w-4 fill-primary text-primary" />)}
                </div>
                <span className="text-sm font-bold text-white/60">300+ barbearias confiam no Barbex</span>
              </div>
            </motion.div>
          </div>
          
          {/* Dashboard Preview */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 40 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.8 }}
            className="relative max-w-6xl mx-auto mt-12"
          >
            <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-[120%] h-[120%] bg-primary/10 blur-[120px] -z-10 rounded-full opacity-50" />
            <div className="relative rounded-[2.5rem] border border-white/10 bg-zinc-950/50 backdrop-blur-3xl p-3 shadow-2xl overflow-hidden group">
              <div className="relative rounded-[2rem] overflow-hidden border border-white/5">
                <img 
                  src="https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&q=80&w=2400" 
                  alt="Barbex Dashboard" 
                  className="w-full h-auto opacity-90 group-hover:scale-[1.02] transition-transform duration-1000"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/80 via-transparent to-transparent" />
              </div>

              {/* Floating Cards */}
              <motion.div 
                animate={{ y: [0, -10, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                className="absolute top-20 -left-12 hidden xl:flex bg-zinc-900/90 backdrop-blur border border-white/10 p-5 rounded-3xl shadow-2xl items-center gap-4"
              >
                <div className="w-12 h-12 bg-green-500/20 rounded-2xl flex items-center justify-center">
                  <TrendingUp className="text-green-500 h-6 w-6" />
                </div>
                <div>
                  <div className="text-[10px] font-black text-white/40 uppercase tracking-widest">Faturamento Mensal</div>
                  <div className="text-xl font-black text-white">R$ 18.420,00</div>
                </div>
              </motion.div>

              <motion.div 
                animate={{ y: [0, 10, 0] }}
                transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 1 }}
                className="absolute bottom-40 -right-12 hidden xl:flex bg-zinc-900/90 backdrop-blur border border-white/10 p-5 rounded-3xl shadow-2xl items-center gap-4"
              >
                <div className="w-12 h-12 bg-primary/20 rounded-2xl flex items-center justify-center">
                  <Calendar className="text-primary h-6 w-6" />
                </div>
                <div>
                  <div className="text-[10px] font-black text-white/40 uppercase tracking-widest">Próximo Agendamento</div>
                  <div className="text-lg font-black text-white">14:30 - Corte & Barba</div>
                </div>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Problem Section */}
      <section className="py-24 lg:py-40 px-6 relative bg-zinc-950/20">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16 lg:mb-24">
            <h2 className="text-primary font-black uppercase tracking-widest text-sm mb-4">O Desafio</h2>
            <h3 className="text-4xl lg:text-7xl font-black text-white tracking-tight">Sua barbearia ainda <br /> <span className="text-white/40">perde clientes por:</span></h3>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { title: "Horários Vazios", desc: "Aquelas janelas na agenda que ninguém marca e você perde dinheiro.", icon: <Calendar className="h-6 w-6" /> },
              { title: "Faltas (No-show)", desc: "Clientes que agendam e não aparecem, deixando seu barbeiro parado.", icon: <XCircle className="h-6 w-6" /> },
              { title: "Baixa Retenção", desc: "Clientes que vêm uma vez e nunca mais voltam por falta de acompanhamento.", icon: <Users className="h-6 w-6" /> },
              { title: "Desorganização", desc: "Confusão com horários, comissões erradas e financeiro no papel.", icon: <Settings className="h-6 w-6" /> },
              { title: "Perda de Faturamento", desc: "Você sente que poderia ganhar mais, mas o processo te trava.", icon: <TrendingUp className="h-6 w-6" /> },
              { title: "Atendimento Lento", desc: "Demora para responder no WhatsApp e o cliente marca no vizinho.", icon: <MessageSquare className="h-6 w-6" /> },
            ].map((item, index) => (
              <motion.div 
                key={index}
                whileHover={{ y: -5, scale: 1.02 }}
                transition={{ duration: 0.25 }}
                className="p-8 rounded-[2rem] bg-zinc-900/50 border border-red-500/20 shadow-[0_0_24px_-12px_rgba(239,68,68,0.4)] hover:border-red-500/50 hover:bg-red-500/[0.04] hover:shadow-[0_12px_40px_-12px_rgba(239,68,68,0.45)] active:scale-[1.01] transition-all group"
              >
                <div className="w-12 h-12 rounded-2xl bg-red-500/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <div className="text-red-500">{item.icon}</div>
                </div>
                <h4 className="text-xl font-black text-white mb-2">{item.title}</h4>
                <p className="text-white/40 font-bold leading-relaxed">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Solution Section */}
      <section id="recursos" className="py-24 lg:py-40 px-6 relative overflow-hidden">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-16 lg:gap-32 items-center">
            <div className="space-y-8">
              <h2 className="text-primary font-black uppercase tracking-widest text-sm">A Solução</h2>
              <h3 className="text-4xl lg:text-7xl font-black text-white tracking-tight">Tudo sob seu <br /><span className="text-primary italic">total controle.</span></h3>
              <p className="text-lg lg:text-xl text-white/50 font-bold leading-relaxed">
                O Barbex foi desenhado para eliminar a fricção do seu dia a dia, automatizando o que é chato e potencializando o que traz lucro.
              </p>
              
              <div className="grid sm:grid-cols-2 gap-4 pt-8">
                {[
                  { title: "Agenda Inteligente", desc: "Preencha horários ociosos com sugestões automáticas.", icon: <Calendar /> },
                  { title: "WhatsApp Automático", desc: "Confirma, lembra e se comunica por você 24/7.", icon: <MessageSquare /> },
                  { title: "Financeiro Completo", desc: "Controle total do financeiro com fluxo de caixa e DRE.", icon: <CircleDollarSign /> },
                  { title: "Cashback & Fidelidade", desc: "Fidelize clientes e aumente o retorno com benefícios inteligentes.", icon: <Star /> },
                  { title: "Relatórios de Gestão", desc: "Relatórios avançados para decisões mais estratégicas.", icon: <TrendingUp /> },
                  { title: "Controle de Estoque", desc: "Tenha controle do estoque e receba alertas automáticos.", icon: <Briefcase /> },
                ].map((s, i) => (
                  <motion.div
                    key={i}
                    whileHover={{ y: -4, scale: 1.02 }}
                    transition={{ duration: 0.2 }}
                    className="p-4 rounded-2xl bg-zinc-900/40 border border-primary/20 hover:border-primary/60 hover:shadow-[0_10px_30px_-12px_rgba(245,197,66,0.45)] transition-all"
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
                        {s.icon}
                      </div>
                      <span className="text-white font-black text-sm">{s.title}</span>
                    </div>
                    <p className="text-xs text-white/50 font-medium leading-snug">{s.desc}</p>
                  </motion.div>
                ))}
              </div>

              <div className="flex justify-center sm:justify-start mt-8">
                <Button
                  className="h-auto py-3 px-6 text-sm sm:text-base font-black bg-gradient-to-r from-[#F5C542] to-[#D4A017] text-black hover:brightness-110 rounded-full group shadow-[0_20px_50px_-15px_rgba(245,197,66,0.6)] hover:scale-[1.03] transition-all"
                  onClick={() => document.getElementById('módulos')?.scrollIntoView({ behavior: 'smooth' })}
                >
                  Explorar todos os recursos
                  <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </Button>
              </div>
            </div>
            
            <div className="relative mx-auto w-[90%] lg:w-full">
              <div className="absolute -inset-10 bg-primary/20 blur-[100px] rounded-full opacity-30 animate-pulse" />
              <div className="relative rounded-[2.5rem] border border-primary/30 bg-zinc-900/50 backdrop-blur p-2 shadow-[0_30px_80px_-20px_rgba(245,197,66,0.35)] overflow-hidden">
                <img 
                  src="https://images.unsplash.com/photo-1585747860715-2ba37e788b70?auto=format&fit=crop&q=80&w=1200" 
                  alt="Barber working" 
                  className="rounded-[2rem] opacity-80 w-full"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Modular Section */}
      <section id="módulos" className="py-24 lg:py-40 px-6 relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[60%] h-[60%] bg-primary/5 blur-[140px] -z-10 rounded-full" />
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16 lg:mb-24">
            <h2 className="text-primary font-black uppercase tracking-widest text-sm mb-4">Modular</h2>
            <h3 className="text-4xl lg:text-7xl font-black text-white tracking-tight mb-6">
              Escolha os módulos que <br />
              <span className="text-primary italic">sua barbearia precisa.</span>
            </h3>
            <p className="text-lg lg:text-xl text-white/50 max-w-2xl mx-auto font-bold leading-relaxed">
              O Barbex se adapta ao modelo da sua barbearia. Ative apenas os módulos que fazem sentido para o seu negócio.
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 lg:gap-6">
            {[
              { title: "Agenda", icon: <Calendar />, desc: "Agendamentos online 24/7" },
              { title: "Financeiro", icon: <CircleDollarSign />, desc: "Fluxo de caixa e DRE" },
              { title: "Clientes", icon: <Users />, desc: "CRM com histórico completo" },
              { title: "Barbeiros", icon: <Scissors />, desc: "Painel individual por barbeiro" },
              { title: "Loja", icon: <Briefcase />, desc: "Venda de produtos e estoque" },
              { title: "Assinaturas", icon: <CreditCard />, desc: "Clube premium recorrente" },
              { title: "Fidelidade", icon: <Star />, desc: "Pontos e recompensas" },
              { title: "Cashback", icon: <TrendingUp />, desc: "Saldo a cada visita" },
              { title: "Automações", icon: <Zap />, desc: "WhatsApp no piloto automático" },
              { title: "Comissões", icon: <BarChart3 />, desc: "Cálculo automático por barbeiro" },
            ].map((mod, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.04, duration: 0.25 }}
                whileHover={{ y: -5, scale: 1.02 }}
                className="p-5 lg:p-6 rounded-3xl bg-zinc-900/60 border border-primary/20 shadow-[0_0_20px_-12px_rgba(245,197,66,0.4)] hover:border-primary/60 hover:bg-zinc-900 hover:shadow-[0_18px_40px_-15px_rgba(245,197,66,0.5)] transition-all group"
              >
                <div className="w-11 h-11 rounded-2xl bg-primary/10 flex items-center justify-center text-primary mb-4 group-hover:scale-110 group-hover:bg-primary/20 transition-all">
                  {mod.icon}
                </div>
                <h4 className="text-base font-black text-white mb-1">{mod.title}</h4>
                <p className="text-xs text-white/40 font-bold leading-snug">{mod.desc}</p>
              </motion.div>
            ))}
          </div>

          <div className="mt-12 flex items-center justify-center gap-2 text-sm font-bold text-white/40">
            <CheckCircle2 className="h-4 w-4 text-primary" />
            <span>Ative ou desative qualquer módulo a qualquer momento.</span>
          </div>
        </div>
      </section>

      {/* Automation Flow Section */}
      <section id="automações" className="py-24 lg:py-40 px-6 bg-zinc-950/40 relative">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16 lg:mb-20">
            <h2 className="text-primary font-black uppercase tracking-widest text-sm mb-4">Automações</h2>
            <h3 className="text-4xl lg:text-6xl font-black text-white tracking-tight mb-4">Automações que <span className="text-primary italic">trabalham por você</span></h3>
            <p className="text-base lg:text-lg text-white/60 max-w-2xl mx-auto">Enquanto você corta cabelo, o BarberX trabalha para aumentar seu faturamento. Quanto maior seu plano, mais inteligente sua barbearia se torna.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 max-w-6xl mx-auto items-stretch">
            {/* Starter */}
            <div className="p-7 rounded-[2rem] bg-zinc-900/50 border border-white/10 flex flex-col h-full hover:border-white/20 transition-all">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-11 h-11 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white/70"><Zap className="w-5 h-5" /></div>
                <div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-white/40">Plano Starter</div>
                  <h4 className="text-lg font-black text-white">3 automações essenciais</h4>
                </div>
              </div>
              <p className="text-xs text-white/50 mb-5">Ideal para começar a automatizar sua barbearia.</p>
              <ul className="space-y-2.5 flex-1 text-sm text-white/80">
                <li className="flex gap-2"><Check className="w-4 h-4 text-white/40 shrink-0 mt-0.5" /> Confirmação automática</li>
                <li className="flex gap-2"><Check className="w-4 h-4 text-white/40 shrink-0 mt-0.5" /> Cancelamento automático</li>
                <li className="flex gap-2"><Check className="w-4 h-4 text-white/40 shrink-0 mt-0.5" /> Lembrete de atendimento</li>
              </ul>
            </div>

            {/* Pro — destaque */}
            <div className="p-7 rounded-[2rem] bg-zinc-900 border-2 border-primary flex flex-col h-full relative shadow-[0_30px_60px_-20px_rgba(245,197,66,0.45)] lg:scale-[1.04]">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-[#F5C542] to-[#D4A017] text-black text-[10px] font-black px-4 py-1 rounded-full uppercase tracking-widest whitespace-nowrap shadow-lg">⭐ Mais Vendido</div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-11 h-11 rounded-xl bg-primary/15 border border-primary/40 flex items-center justify-center text-primary"><Zap className="w-5 h-5" /></div>
                <div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-primary">Plano Pro</div>
                  <h4 className="text-lg font-black text-white">8 automações inteligentes</h4>
                </div>
              </div>
              <p className="text-xs text-white/60 mb-5">Automatize atendimento, fidelização e vendas.</p>
              <ul className="space-y-2.5 flex-1 text-sm text-white/90">
                {["Reagendamento automático","Mensagem de aniversário","Cliente inativo","Pós-atendimento","Avaliações Google","Recuperação de cancelados","Promoções programadas","Fluxos inteligentes"].map(a => (
                  <li key={a} className="flex gap-2"><Check className="w-4 h-4 text-primary shrink-0 mt-0.5" /> {a}</li>
                ))}
              </ul>
            </div>

            {/* Elite */}
            <div className="p-7 rounded-[2rem] bg-zinc-900/50 border border-emerald-500/30 shadow-[0_0_24px_-12px_rgba(16,185,129,0.5)] flex flex-col h-full hover:border-emerald-500/60 transition-all">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-11 h-11 rounded-xl bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center text-emerald-400"><Star className="w-5 h-5" /></div>
                <div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-emerald-300">Plano Elite</div>
                  <h4 className="text-lg font-black text-white">Automações ilimitadas com IA</h4>
                </div>
              </div>
              <p className="text-xs text-white/60 mb-5">Uma verdadeira equipe digital trabalhando 24 horas por dia.</p>
              <ul className="space-y-2.5 flex-1 text-sm text-white/90">
                {["IA Agendadora","IA Comercial","IA Atendimento","IA Campanhas","IA Fidelização","IA WhatsApp","IA Produtos","IA Assinaturas","IA Pós-venda","IA Google Reviews"].map(a => (
                  <li key={a} className="flex gap-2"><Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" /> {a}</li>
                ))}
              </ul>
            </div>
          </div>

          <p className="text-center text-sm text-white/50 mt-10 italic">"Seu atendente nunca dorme." — Quanto maior seu plano, mais inteligente sua barbearia se torna.</p>
        </div>
      </section>


      {/* Pricing Section */}
      <section id="planos" className="py-24 lg:py-40 px-6 relative overflow-hidden">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16 lg:mb-24">
            <h2 className="text-primary font-black uppercase tracking-widest text-sm mb-4">Planos</h2>
            <h3 className="text-4xl lg:text-7xl font-black text-white tracking-tight mb-8">Investimento que se paga <br /><span className="text-white/40">na primeira semana.</span></h3>
            
            <div className="inline-flex items-center p-1 bg-zinc-900 rounded-2xl border border-white/5 mb-12">
              <button
                type="button"
                onClick={() => setBillingCycle("monthly")}
                className={cn(
                  "px-6 py-2 rounded-xl font-black text-sm transition-all",
                  billingCycle === "monthly" ? "bg-primary text-primary-foreground" : "text-white/40 hover:text-white/70"
                )}
              >
                Mensal
              </button>
              <button
                type="button"
                onClick={() => setBillingCycle("annual")}
                className={cn(
                  "px-6 py-2 rounded-xl font-black text-sm transition-all",
                  billingCycle === "annual" ? "bg-primary text-primary-foreground" : "text-white/40 hover:text-white/70"
                )}
              >
                Anual <span className="ml-1 text-[10px] opacity-80">(20% OFF)</span>
              </button>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-6 max-w-6xl mx-auto items-stretch">
            {/* Starter */}
            <div className="p-8 rounded-[2rem] bg-zinc-900/50 border border-primary/20 shadow-[0_10px_30px_-15px_rgba(245,197,66,0.25)] hover:border-primary/40 hover:shadow-[0_18px_40px_-15px_rgba(245,197,66,0.35)] hover:-translate-y-1 transition-all duration-300 flex flex-col h-full">
              <h4 className="text-lg font-black text-white mb-2 uppercase italic tracking-tighter">Starter</h4>
              <p className="text-xs text-white/40 font-bold mb-6 italic">Para barbeiros autônomos e pequenas barbearias.</p>
              <div className="text-3xl font-black text-white mb-1">{prices.starter}<span className="text-xs text-white/40 font-bold">{priceSuffix}</span></div>
              <p className="text-[11px] text-white/40 mb-6">Até 3 barbeiros · 300 clientes</p>
              <ul className="space-y-3 mb-8 flex-1">
                <PricingItem text="Agenda online" />
                <PricingItem text="Clientes, barbeiros e serviços" />
                <PricingItem text="Portal do cliente" />
                <PricingItem text="WhatsApp" />
                <PricingItem text="Financeiro básico" />
                <PricingItem text="3 automações essenciais" />
              </ul>
              <Button
                className="w-full h-12 rounded-xl bg-white/5 hover:bg-white/10 text-white font-black text-sm border border-primary/30 hover:border-primary/60 italic uppercase tracking-wider transition-all"
                onClick={() => setShowSignupModal(true)}
              >
                Começar agora
              </Button>
            </div>

            {/* Pro — destaque máximo */}
            <div className="p-8 lg:p-10 rounded-[2rem] bg-zinc-900 border-2 border-primary flex flex-col h-full relative shadow-[0_40px_80px_-20px_rgba(245,197,66,0.55)] z-10 lg:scale-[1.06] hover:shadow-[0_50px_100px_-20px_rgba(245,197,66,0.7)] transition-all duration-300">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-[#F5C542] to-[#D4A017] text-black text-[10px] font-black px-4 py-1 rounded-full uppercase tracking-widest whitespace-nowrap shadow-lg">⭐ Mais Vendido</div>
              <h4 className="text-lg font-black text-white mb-2 uppercase italic tracking-tighter">Pro</h4>
              <p className="text-xs text-white/40 font-bold mb-6 italic">Recomendado para a maioria das barbearias.</p>
              <div className="text-3xl font-black text-white mb-1">{prices.pro}<span className="text-xs text-white/40 font-bold">{priceSuffix}</span></div>
              <p className="text-[11px] text-white/40 mb-6">Até 10 barbeiros · Clientes ilimitados</p>
              <ul className="space-y-3 mb-8 flex-1">
                <PricingItem text="Tudo do Starter" />
                <PricingItem text="Estoque, Loja & Cupons" />
                <PricingItem text="Cashback & Fidelidade" />
                <PricingItem text="Assinaturas & Gateway de Pagamento" />
                <PricingItem text="Financeiro completo & Dashboard avançado" />
                <PricingItem text="8 automações inteligentes" />
                <PricingItem text="Suporte prioritário" />
              </ul>
              <Button
                className="w-full h-12 rounded-xl bg-gradient-to-r from-[#F5C542] to-[#D4A017] hover:brightness-110 text-black font-black text-sm shadow-[0_15px_30px_-10px_rgba(245,197,66,0.6)] italic uppercase tracking-wider transition-all hover:scale-[1.02] active:scale-95"
                onClick={() => setShowSignupModal(true)}
              >
                Teste 15 dias grátis
              </Button>
            </div>

            {/* Elite */}
            <div className="p-8 rounded-[2rem] bg-zinc-900/50 border border-primary/20 shadow-[0_10px_30px_-15px_rgba(245,197,66,0.25)] hover:border-primary/40 hover:shadow-[0_18px_40px_-15px_rgba(245,197,66,0.35)] hover:-translate-y-1 transition-all duration-300 flex flex-col h-full">
              <h4 className="text-lg font-black text-white mb-2 uppercase italic tracking-tighter">Elite</h4>
              <p className="text-xs text-white/40 font-bold mb-6 italic">Inteligência artificial e escala ilimitada.</p>
              <div className="text-3xl font-black text-white mb-1">{prices.elite}<span className="text-xs text-white/40 font-bold">{priceSuffix}</span></div>
              <p className="text-[11px] text-white/40 mb-6">Barbeiros e admins ilimitados</p>
              <ul className="space-y-3 mb-8 flex-1">
                <PricingItem text="Tudo do Pro" />
                <PricingItem text="12 IAs (Agendadora, Comercial, WhatsApp...)" />
                <PricingItem text="Automações ilimitadas" />
                <PricingItem text="API aberta & Integrações" />
                <PricingItem text="White Label parcial" />
                <PricingItem text="Prioridade máxima no suporte" />
              </ul>
              <Button
                className="w-full h-12 rounded-xl bg-white/5 hover:bg-white/10 text-white font-black text-sm border border-primary/30 hover:border-primary/60 italic uppercase tracking-wider transition-all"
                onClick={() => setShowSignupModal(true)}
              >
                Assinar Elite
              </Button>
            </div>
          </div>

          {/* Plano Personalizado — card separado */}
          <div className="mt-10 max-w-5xl mx-auto">
            <div className="p-8 lg:p-10 rounded-[2rem] bg-gradient-to-br from-zinc-900 via-zinc-900/80 to-zinc-950 border border-white/10 hover:border-white/20 transition-all flex flex-col lg:flex-row items-start lg:items-center gap-6 lg:gap-10">
              <div className="flex-1">
                <span className="inline-block text-[10px] font-black px-3 py-1 rounded-full bg-white/10 border border-white/20 text-white/80 uppercase tracking-widest mb-3">Serviço Premium</span>
                <h4 className="text-2xl lg:text-3xl font-black text-white mb-3 tracking-tight">Plano Personalizado</h4>
                <p className="text-sm text-white/60 mb-4 leading-relaxed">Sua barbearia tem necessidades específicas? Montamos um plano exclusivo: desenvolvimento personalizado, integrações, APIs, consultoria, migração, treinamentos, módulos exclusivos, fluxos e automações sob medida.</p>
                <div className="flex flex-wrap gap-2">
                  {["Consultoria", "Integrações", "API dedicada", "Treinamentos", "Módulos exclusivos", "Migração assistida"].map(t => (
                    <span key={t} className="text-[10px] px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-white/60 font-bold">{t}</span>
                  ))}
                </div>
              </div>
              <Button
                asChild
                className="w-full lg:w-auto h-12 px-8 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:brightness-110 text-white font-black text-sm shadow-[0_15px_30px_-10px_rgba(16,185,129,0.6)] italic uppercase tracking-wider transition-all whitespace-nowrap"
              >
                <a href={personalizadoUrl} target="_blank" rel="noopener noreferrer">Solicitar Orçamento</a>
              </Button>
            </div>
          </div>


          {/* Trial bar */}
          <div className="mt-12 max-w-4xl mx-auto p-6 rounded-2xl bg-primary/5 border border-primary/20 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-xs sm:text-sm text-white/70">
            <span className="flex items-center gap-2"><Check className="w-4 h-4 text-primary" /> 15 dias grátis</span>
            <span className="flex items-center gap-2"><Check className="w-4 h-4 text-primary" /> Sem cartão de crédito</span>
            <span className="flex items-center gap-2"><Check className="w-4 h-4 text-primary" /> Configuração gratuita</span>
            <span className="flex items-center gap-2"><Check className="w-4 h-4 text-primary" /> Migração gratuita</span>
            <span className="flex items-center gap-2"><Check className="w-4 h-4 text-primary" /> Cancele quando quiser</span>
          </div>

          {/* Upsells */}
          <div className="mt-16">
            <div className="text-center mb-12">
              <h3 className="text-primary font-black uppercase tracking-widest text-xs mb-3">Recursos adicionais</h3>
              <h4 className="text-3xl lg:text-4xl font-black text-white tracking-tight">Turbine seu plano com IA</h4>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 max-w-6xl mx-auto">
              {[
                { name: "IA Agendadora", price: "R$ 39,90", desc: "Confirma, reagenda, cancela e responde dúvidas no WhatsApp 24/7." },
                { name: "IA Comercial", price: "R$ 49,90", desc: "Recupera inativos, cria campanhas, ofertas inteligentes e pós-venda." },
                { name: "Loja Premium", price: "R$ 19,90", desc: "Vitrine completa para venda de produtos.", free: "Grátis no Elite" },
                { name: "Cashback Premium", price: "R$ 19,90", desc: "Cashback automático, regras personalizadas e mais recorrência.", free: "Grátis no Elite" },
                { name: "Assinaturas Premium", price: "R$ 29,90", desc: "Clube de assinatura recorrente com benefícios exclusivos.", free: "Grátis no Elite" },
              ].map((u) => (
                <motion.div
                  key={u.name}
                  whileHover={{ y: -4, scale: 1.02 }}
                  transition={{ duration: 0.25 }}
                  className="p-6 rounded-2xl bg-zinc-900/50 border border-emerald-500/30 shadow-[0_0_20px_-12px_rgba(16,185,129,0.45)] hover:border-emerald-500/60 hover:shadow-[0_18px_40px_-15px_rgba(16,185,129,0.5)] transition-all"
                >
                  <div className="flex items-start justify-between mb-3 gap-2">
                    <h5 className="text-sm font-black text-white uppercase italic tracking-tight">{u.name}</h5>
                    {u.free && <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/50 text-emerald-200 font-black whitespace-nowrap shadow-[0_0_12px_-4px_rgba(16,185,129,0.6)]">{u.free}</span>}
                  </div>
                  <div className="text-2xl font-black text-white mb-2">{u.price}<span className="text-xs text-white/40 font-bold">/mês</span></div>
                  <p className="text-xs text-white/50 leading-relaxed">{u.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>

        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="py-24 lg:py-40 px-6 bg-zinc-950/20">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12 lg:mb-16">
            <h2 className="text-primary font-black uppercase tracking-widest text-sm mb-4">FAQ</h2>
            <h3 className="text-4xl lg:text-6xl font-black text-white tracking-tight">Tire suas dúvidas</h3>
            <p className="mt-4 text-white/50 font-bold max-w-2xl mx-auto">Respostas rápidas sobre módulos, planos e funcionalidades do Barbex.</p>
          </div>

          <FaqExplorer />
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-24 lg:py-40 px-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-primary/10 blur-[120px] -z-10" />
        <div className="max-w-6xl mx-auto rounded-[3rem] p-[1.5px] bg-gradient-to-br from-[#F5C542] via-[#D4A017] to-[#7a5a0a] shadow-[0_40px_120px_-30px_rgba(245,197,66,0.45)]">
          <div className="relative rounded-[2.9rem] bg-gradient-to-br from-zinc-950 via-zinc-900 to-black overflow-hidden">
            <div className="absolute inset-0 opacity-30">
              <img
                src="https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&q=80&w=1600"
                alt=""
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-zinc-950 via-zinc-950/85 to-zinc-950/40" />
            </div>
            <div className="absolute top-0 right-0 w-96 h-96 bg-[#F5C542]/20 blur-[120px] pointer-events-none" />
            <div className="absolute -bottom-20 -left-20 w-80 h-80 bg-[#D4A017]/15 blur-[120px] pointer-events-none" />

            <div className="relative grid lg:grid-cols-[1.4fr_1fr] gap-10 items-center p-10 lg:p-20">
              <div className="text-center lg:text-left">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gradient-to-r from-[#F5C542] to-[#D4A017] text-black text-[10px] font-black uppercase tracking-[0.2em] shadow-lg mb-6">
                  <Sparkles className="h-3 w-3" /> Comece em minutos
                </span>
                <h2 className="text-4xl sm:text-5xl lg:text-7xl font-black text-white mb-6 tracking-tighter leading-[0.95]">
                  Pronto para <br />
                  <span className="bg-gradient-to-r from-[#F5C542] to-[#D4A017] bg-clip-text text-transparent italic">transformar</span> sua<br />
                  barbearia?
                </h2>
                <p className="text-base lg:text-lg text-white/60 max-w-xl mx-auto lg:mx-0 mb-10 font-medium leading-relaxed">
                  Junte-se a centenas de barbearias que já automatizaram sua gestão e aumentaram seu faturamento com o Barbex.
                </p>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                  <Button
                    size="lg"
                    className="h-14 w-full sm:w-auto px-8 text-base font-black bg-gradient-to-r from-[#F5C542] to-[#D4A017] hover:brightness-110 text-black rounded-2xl shadow-[0_20px_40px_-15px_rgba(245,197,66,0.6)] group transition-all hover:-translate-y-0.5"
                    onClick={() => setShowSignupModal(true)}
                  >
                    Começar agora
                    <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                  </Button>
                  <a
                    href="#planos"
                    className="h-14 w-full sm:w-auto px-8 inline-flex items-center justify-center rounded-2xl font-black text-sm border border-white/15 text-white/80 hover:text-white hover:border-primary/50 hover:shadow-[0_10px_30px_-15px_rgba(245,197,66,0.4)] transition-all"
                  >
                    Ver planos
                  </a>
                </div>
                <div className="mt-8 flex flex-wrap justify-center lg:justify-start gap-x-6 gap-y-2 text-xs text-white/50 font-bold">
                  <span className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-[#F5C542]" /> 15 dias grátis</span>
                  <span className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-[#F5C542]" /> Sem cartão</span>
                  <span className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-[#F5C542]" /> Cancele quando quiser</span>
                </div>
              </div>

              <div className="hidden lg:block relative">
                <div className="absolute -inset-6 bg-[#F5C542]/20 blur-[80px] rounded-full" />
                <div className="relative rounded-3xl overflow-hidden border border-white/10 shadow-2xl">
                  <img
                    src="https://images.unsplash.com/photo-1599351431202-1e0f0137899a?auto=format&fit=crop&q=80&w=900"
                    alt="Barbearia premium"
                    className="w-full h-[420px] object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Compromisso Barbex — Trust Badges */}
      <section aria-labelledby="compromisso-barbex" className="bg-background py-24 px-6 border-t border-white/5">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-14">
            <span className="inline-block text-primary font-black uppercase tracking-widest text-xs mb-3">
              Compromisso Barbex
            </span>
            <h2 id="compromisso-barbex" className="text-3xl md:text-5xl font-black text-white tracking-tighter">
              Segurança, privacidade e acessibilidade em primeiro lugar
            </h2>
            <p className="text-white/50 mt-4 max-w-2xl mx-auto font-bold">
              Construímos o Barbex com as melhores práticas para que você opere com confiança.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                icon: ShieldCheck,
                tag: "LGPD Ready",
                title: "Proteção de Dados",
                desc: "Desenvolvido seguindo as melhores práticas de proteção de dados pessoais, permitindo que sua barbearia opere com mais transparência e segurança.",
                href: "/privacy",
              },
              {
                icon: Accessibility as any,
                tag: "WCAG 2.2 AA",
                title: "Acessível para Todos",
                desc: "A plataforma segue as recomendações da WCAG 2.2 AA para proporcionar uma experiência inclusiva para pessoas com deficiência visual, motora, auditiva e cognitiva.",
                href: "/accessibility",
              },
              {
                icon: Lock as any,
                tag: "Segurança",
                title: "Segurança da Informação",
                desc: "Comunicação criptografada, autenticação segura, proteção de credenciais, controle de permissões e boas práticas para garantir a integridade dos dados.",
                href: "/security",
              },
            ].map((c) => (
              <Link
                key={c.title}
                to={c.href}
                aria-label={`Saiba mais sobre ${c.title}`}
                className="group relative rounded-2xl p-8 bg-gradient-to-br from-[#0A1020] to-[#0B1426] border border-primary/25 hover:border-primary/60 transition-all hover:-translate-y-1 hover:shadow-[0_20px_60px_-20px_rgba(255,184,0,.35)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none bg-[radial-gradient(circle_at_top,rgba(255,184,0,.12),transparent_60%)]" />
                <div className="relative">
                  <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-primary/25 to-transparent border border-primary/40 flex items-center justify-center mb-5">
                    <c.icon className="h-7 w-7 text-primary" aria-hidden="true" />
                  </div>
                  <span className="inline-block text-[10px] font-bold px-2.5 py-1 rounded-full bg-primary/15 border border-primary/40 text-primary uppercase tracking-wider mb-3">
                    {c.tag}
                  </span>
                  <h3 className="text-xl font-black text-white mb-2">{c.title}</h3>
                  <p className="text-sm text-white/60 leading-relaxed font-medium">{c.desc}</p>
                  <span className="inline-flex items-center gap-1 mt-5 text-primary text-sm font-bold">
                    Saiba mais <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-background border-t border-white/5 py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-4 gap-12 mb-20">
            <div className="md:col-span-1">
              <div className="flex items-center gap-2 mb-6">
                <Scissors className="text-primary h-8 w-8" />
                <span className="text-3xl font-black tracking-tighter text-white">Barbex</span>
              </div>
              <p className="text-white/40 max-w-sm mb-6 text-sm font-bold leading-relaxed">
                A plataforma premium definitiva para barbearias modernas.
              </p>
              <Link
                to="/trust"
                className="inline-flex items-center gap-2 px-3 py-2 rounded-full border border-primary/40 bg-primary/10 text-primary text-xs font-bold hover:bg-primary/20"
              >
                <ShieldCheck className="h-3.5 w-3.5" /> Central de Confiança
              </Link>
            </div>
            <div>
              <h4 className="font-black text-white uppercase tracking-widest text-xs mb-6">Produto</h4>
              <ul className="space-y-3 text-white/40 font-bold text-sm">
                <li><a href="#recursos" className="hover:text-primary transition-colors">Recursos</a></li>
                <li><a href="#automações" className="hover:text-primary transition-colors">Automações</a></li>
                <li><a href="#planos" className="hover:text-primary transition-colors">Planos</a></li>
                <li><a href="#faq" className="hover:text-primary transition-colors">FAQ</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-black text-white uppercase tracking-widest text-xs mb-6">Acesso</h4>
              <ul className="space-y-3 text-white/40 font-bold text-sm">
                <li><Link to="/auth" className="hover:text-primary transition-colors">Entrar</Link></li>
                <li><Link to="/auth" className="hover:text-primary transition-colors">Criar conta</Link></li>
                <li><Link to="/subscription" className="hover:text-primary transition-colors">Planos</Link></li>
                <li><Link to="/support" className="hover:text-primary transition-colors">Suporte</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-black text-white uppercase tracking-widest text-xs mb-6">Confiança</h4>
              <ul className="space-y-3 text-white/40 font-bold text-sm">
                <li><Link to="/trust" className="hover:text-primary transition-colors">Central de Confiança</Link></li>
                <li><Link to="/privacy" className="hover:text-primary transition-colors">Privacidade</Link></li>
                <li><Link to="/terms" className="hover:text-primary transition-colors">Termos</Link></li>
                <li><Link to="/cookies" className="hover:text-primary transition-colors">Cookies</Link></li>
                <li><Link to="/lgpd" className="hover:text-primary transition-colors">LGPD</Link></li>
                <li><Link to="/security" className="hover:text-primary transition-colors">Segurança</Link></li>
                <li><Link to="/accessibility" className="hover:text-primary transition-colors">Acessibilidade</Link></li>
                <li><Link to="/status" className="hover:text-primary transition-colors">Status</Link></li>
                <li><Link to="/subprocessors" className="hover:text-primary transition-colors">Subprocessadores</Link></li>
                <li><Link to="/privacy-faq" className="hover:text-primary transition-colors">FAQ Privacidade</Link></li>
                <li><ManageCookiesLink className="hover:text-primary transition-colors text-left" /></li>
              </ul>
            </div>
          </div>
          <div className="pt-10 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="text-white/20 text-sm font-bold">
              © 2026 Barbex. Todos os direitos reservados.
            </div>
            <div className="flex flex-wrap gap-3 text-white/60 text-xs font-bold">
              <Link to="/privacy" aria-label="LGPD Ready — Política de Privacidade" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-primary/30 bg-primary/5 hover:bg-primary/15 hover:border-primary/60 transition-colors">
                <ShieldCheck className="h-3.5 w-3.5 text-primary" aria-hidden="true" /> LGPD Ready
              </Link>
              <Link to="/accessibility" aria-label="Acessibilidade WCAG 2.2 AA" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-primary/30 bg-primary/5 hover:bg-primary/15 hover:border-primary/60 transition-colors">
                <Accessibility className="h-3.5 w-3.5 text-primary" aria-hidden="true" /> WCAG 2.2 AA
              </Link>
              <Link to="/security" aria-label="Página de Segurança" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-primary/30 bg-primary/5 hover:bg-primary/15 hover:border-primary/60 transition-colors">
                <Lock className="h-3.5 w-3.5 text-primary" aria-hidden="true" /> Segurança
              </Link>
              <Link to="/status" aria-label="Status da Plataforma" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/5 hover:bg-emerald-500/15 hover:border-emerald-500/70 transition-colors">
                <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span></span>
                <span className="text-emerald-300">Plataforma Monitorada 24h</span>
              </Link>
            </div>
          </div>
        </div>
      </footer>
      <SignupOnboardingModal isOpen={showSignupModal} onOpenChange={setShowSignupModal} />
      <BackToTopButton />
    </div>
  );
}

function BackToTopButton() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 400);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  return (
    <button
      type="button"
      aria-label="Voltar ao topo"
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      className={`fixed bottom-6 right-6 z-[60] h-12 w-12 rounded-full bg-gradient-to-br from-[#F5C542] to-[#D4A017] text-[#050505] shadow-[0_12px_30px_rgba(245,197,66,0.42)] flex items-center justify-center transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_16px_36px_rgba(245,197,66,0.55)] ${visible ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 translate-y-4 pointer-events-none'}`}
    >
      <ArrowUp size={20} strokeWidth={2.5} />
    </button>
  );
}

function PricingItem({ text }: { text: string }) {
  return (
    <li className="flex items-center gap-3 text-white/60 font-bold">
      <div className="p-1 bg-primary/10 rounded-full">
        <Check className="h-3 w-3 text-primary" />
      </div>
      {text}
    </li>
  );
}

function FaqItem({ value, question, answer }: { value: string, question: string, answer: string }) {
  return (
    <AccordionItem value={value} className="border-none bg-zinc-900/50 rounded-3xl px-8 mb-4 border border-white/5">
      <AccordionTrigger className="text-xl font-black text-white hover:no-underline py-8 text-left">
        {question}
      </AccordionTrigger>
      <AccordionContent className="text-white/40 text-lg font-bold leading-relaxed pb-8">
        {answer}
      </AccordionContent>
    </AccordionItem>
  );
}

type FaqEntry = {
  q: string;
  a: string;
  category:
    | "Planos"
    | "Cashback"
    | "Financeiro"
    | "WhatsApp"
    | "Assinaturas"
    | "Loja Virtual"
    | "Clientes"
    | "Comissões";
};

const FAQ_DATA: FaqEntry[] = [
  { category: "Planos", q: "O teste de 15 dias é grátis mesmo?", a: "Sim! Você terá acesso a 100% das funcionalidades do plano Pro por 15 dias sem pagar nada e sem precisar cadastrar cartão." },
  { category: "Planos", q: "Consigo usar no celular?", a: "Com certeza. O Barbex é feito para ser usado no seu dia a dia, direto do celular, tablet ou computador." },
  { category: "WhatsApp", q: "Como funciona o WhatsApp?", a: "O sistema envia mensagens automáticas de confirmação, lembrete e marketing usando sua própria conta de WhatsApp conectada." },
  { category: "Planos", q: "Tem multa se eu quiser cancelar?", a: "Não. Nossos planos não possuem fidelidade. Você pode cancelar quando quiser sem qualquer taxa adicional." },
  { category: "Cashback", q: "O Cashback Premium está incluso em todos os planos?", a: "Não.\n\nO módulo Cashback Premium pode ser contratado separadamente por R$ 19,90/mês ou está incluso gratuitamente no plano Elite." },
  { category: "Cashback", q: "Como funciona o cashback?", a: "A barbearia define a porcentagem e as regras de concessão.\n\nExemplo:\nServiço: R$ 50\nCashback: 10%\n\nO cliente recebe R$ 5 de saldo para utilizar em futuros agendamentos." },
  { category: "Financeiro", q: "O cliente pode pagar apenas com cashback?", a: "Sim.\n\nO sistema aceita:\n• Cashback\n• Créditos\n• PIX\n• Dinheiro\n• Cartão\n• Pagamentos mistos\n\nExemplo: Serviço de R$ 50 → R$ 10 em cashback + R$ 15 em créditos + R$ 25 em PIX." },
  { category: "WhatsApp", q: "Preciso contratar uma plataforma de WhatsApp?", a: "Sim.\n\nAs automações utilizam plataformas externas como:\n• Z-API\n• Evolution API\n• Outras integrações compatíveis\n\nImportante: o valor dessas plataformas é contratado diretamente pelo cliente." },
  { category: "Assinaturas", q: "Posso vender planos de assinatura?", a: "Sim.\n\nO módulo Assinaturas permite:\n• Planos semanais\n• Planos quinzenais\n• Planos mensais\n• Benefícios exclusivos\n• Controle de utilização\n• Renovação automática\n• Fidelidade Premium" },
  { category: "Planos", q: "Posso utilizar apenas agendamento sem loja e sem assinaturas?", a: "Sim. Os módulos são independentes.\n\nVocê pode ativar apenas:\n• Agenda\n• Clientes\n• Financeiro\n• WhatsApp\n\nE habilitar outros módulos futuramente." },
  { category: "Loja Virtual", q: "A loja virtual é obrigatória?", a: "Não. A loja é um módulo opcional.\n\nQuando estiver desativada:\n• O menu não aparece no painel\n• Não aparece no frontend\n• Nenhuma funcionalidade relacionada é carregada" },
  { category: "Comissões", q: "O sistema controla comissões dos barbeiros?", a: "Sim.\n\nO módulo de comissões permite:\n• Comissão por serviço\n• Comissão percentual\n• Comissão fixa\n• Relatórios por período\n• Histórico de pagamentos" },
  { category: "Clientes", q: "Os clientes possuem painel próprio?", a: "Sim.\n\nCada cliente pode acessar:\n• Histórico de atendimentos\n• Créditos\n• Cashback\n• Assinaturas\n• Fidelidade\n• Agendamentos futuros" },
  { category: "Planos", q: "Posso começar pequeno e evoluir depois?", a: "Sim. O Barbex foi desenvolvido de forma modular.\n\nVocê pode iniciar apenas com:\n• Agenda\n• Clientes\n• Financeiro\n\nE posteriormente habilitar:\n• Loja Virtual\n• Assinaturas\n• Cashback Premium\n• Fidelidade Premium\n• WhatsApp\n• Automações\n• Programa de Indicação" },
];

const FAQ_CATEGORIES: { name: string; icon: React.ReactNode }[] = [
  { name: "Todos", icon: <Sparkles className="h-3.5 w-3.5" /> },
  { name: "Planos", icon: <Tag className="h-3.5 w-3.5" /> },
  { name: "Cashback", icon: <Percent className="h-3.5 w-3.5" /> },
  { name: "Financeiro", icon: <CircleDollarSign className="h-3.5 w-3.5" /> },
  { name: "WhatsApp", icon: <MessageSquare className="h-3.5 w-3.5" /> },
  { name: "Assinaturas", icon: <Repeat className="h-3.5 w-3.5" /> },
  { name: "Loja Virtual", icon: <ShoppingBag className="h-3.5 w-3.5" /> },
  { name: "Clientes", icon: <UserCircle className="h-3.5 w-3.5" /> },
  { name: "Comissões", icon: <Briefcase className="h-3.5 w-3.5" /> },
];

function FaqExplorer() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("Todos");

  const filtered = FAQ_DATA.filter((f) => {
    const matchCat = category === "Todos" || f.category === category;
    const q = query.trim().toLowerCase();
    const matchQ = !q || f.q.toLowerCase().includes(q) || f.a.toLowerCase().includes(q);
    return matchCat && matchQ;
  });

  return (
    <div>
      <div className="relative mb-5">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar nas perguntas..."
          className="w-full h-14 pl-11 pr-4 rounded-2xl bg-zinc-900/70 border border-white/10 text-white placeholder:text-white/30 font-bold focus:outline-none focus:border-primary/60 transition-colors"
        />
      </div>

      <div className="flex flex-wrap justify-center gap-2 mb-8">
        {FAQ_CATEGORIES.map((c) => {
          const active = category === c.name;
          return (
            <button
              key={c.name}
              onClick={() => setCategory(c.name)}
              className={cn(
                "inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-black uppercase tracking-wider border transition-all",
                active
                  ? "bg-primary text-primary-foreground border-primary shadow-[0_10px_30px_-10px_rgba(245,197,66,0.6)]"
                  : "bg-transparent text-white border-primary/25 hover:border-primary/60 hover:shadow-[0_0_18px_-6px_rgba(245,197,66,0.6)] hover:text-primary"
              )}
            >
              {c.icon}
              {c.name}
            </button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 rounded-3xl border border-white/5 bg-zinc-900/40">
          <p className="text-white/60 font-bold">Nenhuma pergunta encontrada.</p>
          <p className="text-white/30 text-sm mt-1">Tente outro termo ou categoria.</p>
        </div>
      ) : (
        <Accordion type="single" collapsible className="w-full space-y-3">
          {filtered.map((f, idx) => (
            <AccordionItem
              key={`${f.category}-${idx}`}
              value={`faq-${idx}`}
              className="border border-white/5 bg-zinc-900/50 rounded-2xl px-6 hover:border-primary/20 transition-colors"
            >
              <AccordionTrigger className="text-left hover:no-underline py-6">
                <div className="flex items-start gap-3 pr-4">
                  <span className="mt-1 text-[10px] px-2 py-0.5 rounded-full bg-primary/15 border border-primary/30 text-primary font-black uppercase tracking-widest shrink-0">
                    {f.category}
                  </span>
                  <span className="text-base lg:text-lg font-black text-white">{f.q}</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="text-white/60 text-base font-medium leading-relaxed pb-6 whitespace-pre-line">
                {f.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}
    </div>
  );
}
