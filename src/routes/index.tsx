import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { useEffect, useState, useRef } from "react";
import { SignupOnboardingModal } from "@/components/onboarding/SignupOnboardingModal";
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
  Briefcase
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
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer">
            <div className="p-2 bg-primary/10 rounded-xl border border-primary/20">
              <Scissors className="text-primary h-6 w-6" />
            </div>
            <span className="text-2xl font-black tracking-tighter text-white">Barbex</span>
          </div>
          <div className="hidden lg:flex items-center gap-8">
            {["Recursos", "Automações", "Demonstração", "Planos", "FAQ"].map((item) => (
              <a key={item} href={`#${item.toLowerCase()}`} className="text-sm font-bold text-white/60 hover:text-primary transition-colors">
                {item}
              </a>
            ))}
          </div>
          <div className="flex items-center gap-4">
            <Button variant="ghost" className="text-white font-bold hover:bg-white/5" asChild>
              <Link to="/auth">Entrar</Link>
            </Button>
            <Button 
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-black px-6 rounded-xl hover:shadow-[0_0_20px_rgba(234,179,8,0.4)] transition-all" 
              onClick={() => setShowSignupModal(true)}
            >
              Teste grátis
            </Button>
          </div>
        </div>
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
              className="text-6xl lg:text-9xl font-black tracking-tightest mb-8 text-white leading-[0.9] max-w-5xl"
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
              Agendamentos online, automações inteligentes, WhatsApp, campanhas e gestão completa em uma única plataforma premium.
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
              <Button size="lg" variant="ghost" className="h-16 px-10 text-lg font-bold text-white hover:bg-white/5 group">
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
                whileHover={{ y: -5 }}
                className="p-8 rounded-[2rem] bg-zinc-900/50 border border-white/5 hover:border-red-500/20 hover:bg-red-500/[0.02] transition-all group"
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
              
              <div className="grid sm:grid-cols-2 gap-6 pt-8">
                {[
                  { title: "Agenda Inteligente", icon: <Calendar /> },
                  { title: "WhatsApp Automático", icon: <MessageSquare /> },
                  { title: "Financeiro Completo", icon: <CircleDollarSign /> },
                  { title: "Cashback & Fidelidade", icon: <Star /> },
                  { title: "Relatórios de Gestão", icon: <TrendingUp /> },
                  { title: "Controle de Estoque", icon: <Briefcase /> },
                ].map((s, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                      {s.icon}
                    </div>
                    <span className="text-white font-bold">{s.title}</span>
                  </div>
                ))}
              </div>

              <Button size="lg" className="h-16 px-10 text-lg font-black bg-white text-black hover:bg-zinc-200 rounded-2xl group mt-8">
                Explorar todos os recursos
                <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </Button>
            </div>
            
            <div className="relative">
              <div className="absolute -inset-10 bg-primary/20 blur-[100px] rounded-full opacity-30 animate-pulse" />
              <div className="relative rounded-[2.5rem] border border-white/10 bg-zinc-900/50 backdrop-blur p-2 shadow-2xl overflow-hidden">
                <img 
                  src="https://images.unsplash.com/photo-1585747860715-2ba37e788b70?auto=format&fit=crop&q=80&w=1200" 
                  alt="Barber working" 
                  className="rounded-[2rem] opacity-80"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Solution Section */}
      <section id="funcionalidades" className="py-32 px-4 bg-primary/[0.02]">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-20">
            <h2 className="text-base font-bold text-primary uppercase tracking-[0.2em] mb-4">Soluções</h2>
            <p className="text-4xl lg:text-6xl font-black text-white tracking-tight">Tudo o que sua barbearia precisa</p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <SolutionCard 
              icon={<Calendar className="h-8 w-8 text-primary" />}
              title="Agenda inteligente"
              description="Controle total dos horários com interface intuitiva."
            />
            <SolutionCard 
              icon={<MessageSquare className="h-8 w-8 text-primary" />}
              title="WhatsApp automático"
              description="Lembretes e confirmações enviadas automaticamente."
            />
            <SolutionCard 
              icon={<Zap className="h-8 w-8 text-primary" />}
              title="Cashback"
              description="Fidelize seus clientes com sistema de pontos e créditos."
            />
            <SolutionCard 
              icon={<CircleDollarSign className="h-8 w-8 text-primary" />}
              title="Financeiro completo"
              description="Controle de caixa, entradas e saídas em tempo real."
            />
            <SolutionCard 
              icon={<Users className="h-8 w-8 text-primary" />}
              title="Comissão automática"
              description="Cálculo instantâneo de quanto cada barbeiro deve receber."
            />
            <SolutionCard 
              icon={<Scissors className="h-8 w-8 text-primary" />}
              title="Multi barbeiros"
              description="Gestão individualizada para cada profissional da equipe."
            />
            <SolutionCard 
              icon={<TrendingUp className="h-8 w-8 text-primary" />}
              title="Dashboard real time"
              description="Acompanhe o crescimento do seu negócio de qualquer lugar."
            />
            <SolutionCard 
              icon={<Settings className="h-8 w-8 text-primary" />}
              title="Controle de clientes"
              description="Base de dados completa com histórico de cada atendimento."
            />
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="precos" className="py-32 px-4 relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/10 rounded-full blur-[150px] -z-10"></div>

        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-20">
            <h2 className="text-base font-bold text-primary uppercase tracking-[0.2em] mb-4">Planos</h2>
            <p className="text-4xl lg:text-6xl font-black text-white tracking-tight mb-6">Investimento que se paga</p>
            <p className="text-xl text-white/50 font-bold">Sem taxa por agendamento. Pague apenas o valor fixo.</p>
          </div>
          
          <div className="grid lg:grid-cols-3 gap-8 items-center max-w-6xl mx-auto">
            {/* Starter Plan */}
            <div className="glass p-10 rounded-3xl border border-white/5 flex flex-col h-full relative group hover:border-white/10 transition-all opacity-80 hover:opacity-100">
              <div className="mb-8">
                <h3 className="text-2xl font-black text-white mb-2">Starter</h3>
                <p className="text-white/50 font-medium">Ideal para barbeiros iniciantes.</p>
              </div>
              <div className="mb-10">
                <div className="text-5xl font-black text-white">R$ 19,90<span className="text-lg font-bold text-white/40">/mês</span></div>
              </div>
              <ul className="space-y-4 mb-10 flex-1">
                <PricingItem text="Agenda completa" />
                <PricingItem text="1 Profissional" />
                <PricingItem text="1 Conexão WhatsApp" />
                <PricingItem text="Financeiro básico" />
                <PricingItem text="Clientes ilimitados" />
              </ul>
              <Button 
                variant="outline" 
                className="w-full h-14 text-lg font-bold border-white/10 hover:bg-white/5" 
                onClick={() => setShowSignupModal(true)}
              >
                Começar agora
              </Button>
            </div>

            {/* Pro Plan */}
            <div className="glass p-10 rounded-3xl border-2 border-primary bg-primary/10 flex flex-col h-full relative scale-110 z-10 shadow-[0_0_80px_rgba(var(--primary),0.3)] ring-1 ring-primary/50 animate-in fade-in zoom-in duration-700">
              <div className="absolute -top-5 left-1/2 -translate-x-1/2 flex gap-2">
                <div className="bg-primary text-primary-foreground text-xs font-black px-4 py-2 rounded-full uppercase tracking-widest whitespace-nowrap shadow-lg">
                  MAIS POPULAR
                </div>
                <div className="bg-blue-500 text-white text-xs font-black px-4 py-2 rounded-full uppercase tracking-widest whitespace-nowrap shadow-lg">
                  15 DIAS GRÁTIS
                </div>
              </div>
              <div className="mb-8">
                <h3 className="text-3xl font-black text-white mb-2">Pro</h3>
                <p className="text-white/60 font-bold">Para barbearias em crescimento.</p>
              </div>
              <div className="mb-10">
                <div className="text-7xl font-black text-white tracking-tighter">R$ 39,90<span className="text-lg font-bold text-white/40">/mês</span></div>
                <div className="text-primary font-black text-sm uppercase tracking-widest mt-2">Teste grátis por 15 dias</div>
              </div>
              <ul className="space-y-4 mb-10 flex-1">
                <PricingItem text="Até 5 Profissionais" />
                <PricingItem text="2 Conexões WhatsApp" />
                <PricingItem text="Sistema de Cashback" />
                <PricingItem text="Financeiro avançado" />
                <PricingItem text="Relatórios de desempenho" />
                <PricingItem text="Automações inteligentes" />
              </ul>
              <Button 
                className="w-full h-16 text-xl font-black bg-primary hover:bg-primary/90 shadow-[0_0_40px_rgba(var(--primary),0.5)] animate-pulse" 
                onClick={() => setShowSignupModal(true)}
              >
                Começar teste grátis
              </Button>
            </div>

            {/* Elite Plan */}
            <div className="glass p-10 rounded-3xl border border-white/5 flex flex-col h-full relative group hover:border-white/10 transition-all opacity-80 hover:opacity-100">
              <div className="mb-8">
                <h3 className="text-2xl font-black text-white mb-2">Elite</h3>
                <p className="text-white/50 font-medium">Solução definitiva sem limites.</p>
              </div>
              <div className="mb-10">
                <div className="text-5xl font-black text-white">R$ 59,90<span className="text-lg font-bold text-white/40">/mês</span></div>
              </div>
              <ul className="space-y-4 mb-10 flex-1">
                <PricingItem text="Profissionais ilimitados" />
                <PricingItem text="WhatsApp ilimitado" />
                <PricingItem text="Dashboard analítico" />
                <PricingItem text="Automações premium" />
                <PricingItem text="Suporte prioritário" />
                <PricingItem text="Customização total" />
              </ul>
              <Button 
                variant="outline" 
                className="w-full h-14 text-lg font-bold border-white/10 hover:bg-white/5" 
                onClick={() => setShowSignupModal(true)}
              >
                Assinar agora
              </Button>
            </div>
          </div>
          
          <div className="text-center mt-20">
            <p className="text-xl text-white/60 font-medium">
              Teste gratuitamente o plano Pro por 15 dias e descubra como profissionalizar sua barbearia.
            </p>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="py-32 px-4 relative overflow-hidden bg-white/[0.01]">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-20">
            <h2 className="text-base font-bold text-primary uppercase tracking-[0.2em] mb-4">Depoimentos</h2>
            <p className="text-4xl lg:text-6xl font-black text-white tracking-tight">Quem usa, recomenda</p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            <TestimonialCard 
              name="Carlos Henrique"
              business="Barbearia Prime"
              text="Depois que comecei a usar o Barbex minha agenda ficou muito mais organizada."
              avatar="CH"
            />
            <TestimonialCard 
              name="Rafael Mendes"
              business="Barber Studio"
              text="O financeiro e as automações economizaram muito tempo no dia a dia."
              avatar="RM"
            />
            <TestimonialCard 
              name="João Victor"
              business="Barbearia Imperial"
              text="O WhatsApp automático reduziu muito as faltas dos clientes."
              avatar="JV"
            />
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="py-32 px-4 bg-white/[0.01]">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-base font-bold text-primary uppercase tracking-[0.2em] mb-4">Dúvidas</h2>
            <p className="text-4xl font-black text-white tracking-tight">Perguntas Frequentes</p>
          </div>
          
          <Accordion type="single" collapsible className="w-full space-y-4">
            <FaqItem 
              value="item-test-1"
              question="O teste realmente é gratuito?"
              answer="Sim! O teste do plano Pro é totalmente gratuito por 15 dias e não exige cartão de crédito. Você terá acesso a todas as funcionalidades premium para testar na prática."
            />
            <FaqItem 
              value="item-test-2"
              question="Precisa de cartão de crédito para testar?"
              answer="Não! Você pode começar seu teste imediatamente sem informar nenhum dado de pagamento. Queremos que você conheça o sistema primeiro."
            />
            <FaqItem 
              value="item-test-3"
              question="Posso cancelar antes de terminar os 15 dias?"
              answer="Com certeza. Você tem total liberdade para cancelar a qualquer momento, embora não haja cobrança automática durante o período de teste."
            />
            <FaqItem 
              value="item-test-4"
              question="O que acontece após os 15 dias de teste?"
              answer="Após os 15 dias, você poderá escolher um dos nossos planos pagos para continuar utilizando o sistema. Seus dados e configurações permanecem salvos para que você não perca nada."
            />
            <FaqItem 
              value="item-1"
              question="Funciona no celular?"
              answer="Sim! O Barbex é 100% responsivo e funciona perfeitamente em qualquer dispositivo: celular, tablet ou computador."
            />
            <FaqItem 
              value="item-4"
              question="Como funciona o WhatsApp?"
              answer="O sistema se conecta ao seu WhatsApp para enviar lembretes automáticos de agendamento, confirmações e mensagens de marketing."
            />
          </Accordion>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-32 px-4 relative overflow-hidden">
        <div className="absolute inset-0 bg-primary/20 blur-[100px] -z-10 animate-pulse"></div>
        <div className="max-w-5xl mx-auto glass p-16 lg:p-24 rounded-[4rem] border border-white/10 text-center relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/20 blur-[80px] -z-10"></div>
          
          <h2 className="text-5xl lg:text-7xl font-black text-white mb-8 tracking-tighter leading-none">
            Sua barbearia merece um <br />
            <span className="text-primary">sistema profissional.</span>
          </h2>
          <p className="text-xl text-white/60 max-w-2xl mx-auto mb-12 font-bold">
            Comece agora seu teste grátis de 15 dias no plano Pro. <br className="hidden md:block" />
            Sem compromisso e sem cartão de crédito.
          </p>
          <Button 
            size="lg" 
            className="h-20 px-16 text-2xl font-black bg-primary hover:bg-primary/90 shadow-[0_0_50px_rgba(var(--primary),0.5)] group" 
            onClick={() => setShowSignupModal(true)}
          >
            Começar teste grátis <ArrowRight className="ml-3 h-8 w-8 group-hover:translate-x-2 transition-transform" />
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-background border-t border-white/5 py-20 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-4 gap-16 mb-20">
            <div className="col-span-2">
              <div className="flex items-center gap-2 mb-6">
                <Scissors className="text-primary h-8 w-8" />
                <span className="text-3xl font-extrabold tracking-tighter text-white italic uppercase">Barbe<span className="text-primary">x</span></span>
              </div>
              <p className="text-white/50 max-w-sm mb-8 text-lg leading-relaxed">
                Ajudamos barbeiros a profissionalizarem seus negócios através de tecnologia simples, moderna e de alto impacto.
              </p>
            </div>
            <div>
              <h4 className="font-black text-white uppercase tracking-widest text-sm mb-8">Produto</h4>
              <ul className="space-y-4 text-white/50">
                <li><a href="#funcionalidades" className="hover:text-primary transition-colors">Funcionalidades</a></li>
                <li><a href="#precos" className="hover:text-primary transition-colors">Preços</a></li>
                <li><a href="#faq" className="hover:text-primary transition-colors">FAQ</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-black text-white uppercase tracking-widest text-sm mb-8">Links Úteis</h4>
              <ul className="space-y-4 text-white/50">
                <li><Link to="/auth" className="hover:text-primary transition-colors">Entrar</Link></li>
                <li><Link to="/auth" className="hover:text-primary transition-colors">Criar conta</Link></li>
                <li><a href="#" className="hover:text-primary transition-colors">Suporte</a></li>
              </ul>
            </div>
          </div>
          <div className="pt-10 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="text-white/40 font-medium">
              © 2026 Barbex. Todos os direitos reservados.
            </div>
            <div className="flex gap-8 text-white/40 text-sm font-medium">
              <a href="#" className="hover:text-white transition-colors">Termos de Uso</a>
              <a href="#" className="hover:text-white transition-colors">Privacidade</a>
            </div>
          </div>
        </div>
      </footer>
      <SignupOnboardingModal isOpen={showSignupModal} onOpenChange={setShowSignupModal} />
    </div>
  );
}

function TestimonialCard({ name, business, text, avatar }: { name: string, business: string, text: string, avatar: string }) {
  return (
    <div className="p-8 rounded-3xl glass border border-white/5 hover:border-primary/20 transition-all flex flex-col h-full">
      <div className="flex gap-1 mb-6">
        {[1, 2, 3, 4, 5].map((s) => (
          <Zap key={s} className="h-4 w-4 text-primary fill-current" />
        ))}
      </div>
      <p className="text-white/80 text-lg italic mb-8 flex-1 leading-relaxed">"{text}"</p>
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center text-primary font-black">
          {avatar}
        </div>
        <div>
          <div className="font-bold text-white">{name}</div>
          <div className="text-white/40 text-sm uppercase tracking-widest font-bold">{business}</div>
        </div>
      </div>
    </div>
  );
}

function SolutionCard({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) {
  return (
    <div className="p-8 rounded-3xl glass border border-white/5 hover:border-primary/30 hover:bg-primary/[0.03] transition-all group group cursor-default">
      <div className="mb-6 p-4 bg-primary/10 rounded-2xl w-fit group-hover:bg-primary/20 transition-colors">{icon}</div>
      <h3 className="text-xl font-bold text-white mb-3 tracking-tight">{title}</h3>
      <p className="text-white/50 leading-relaxed font-medium">{description}</p>
    </div>
  );
}

function PricingItem({ text }: { text: string }) {
  return (
    <li className="flex items-center gap-3 text-white/70 font-medium">
      <div className="p-1 bg-primary/20 rounded-full">
        <Check className="h-4 w-4 text-primary" />
      </div>
      {text}
    </li>
  );
}

function FaqItem({ value, question, answer }: { value: string, question: string, answer: string }) {
  return (
    <AccordionItem value={value} className="border-none glass rounded-2xl px-6 mb-4">
      <AccordionTrigger className="text-xl font-bold text-white hover:no-underline py-6 text-left">
        {question}
      </AccordionTrigger>
      <AccordionContent className="text-white/60 text-lg leading-relaxed pb-6">
        {answer}
      </AccordionContent>
    </AccordionItem>
  );
}
