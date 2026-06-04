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
  Briefcase,
  Menu
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
            <div className="p-2 bg-primary/10 rounded-xl border border-primary/20">
              <Scissors className="text-primary h-5 w-5 sm:h-6 sm:w-6" />
            </div>
            <span className="text-xl sm:text-2xl font-black tracking-tighter text-white">Barbex</span>
          </div>
          
          <div className="hidden lg:flex items-center gap-8">
            {["Recursos", "Automações", "Demonstração", "Planos", "FAQ"].map((item) => (
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
                {["Recursos", "Automações", "Demonstração", "Planos", "FAQ"].map((item) => (
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

      {/* Automation Flow Section */}
      <section id="automações" className="py-24 lg:py-40 px-6 bg-zinc-950/40 relative">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-20">
            <h2 className="text-primary font-black uppercase tracking-widest text-sm mb-4">Automações</h2>
            <h3 className="text-4xl lg:text-7xl font-black text-white tracking-tight">Relacionamento no <br /><span className="text-primary italic">automático.</span></h3>
          </div>

          <div className="relative flex flex-col md:flex-row items-center justify-between gap-8 max-w-5xl mx-auto">
            <div className="absolute top-1/2 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-primary/20 to-transparent hidden md:block -z-10" />
            
            {[
              { title: "Agendamento", icon: <Calendar />, desc: "Cliente agenda no seu link personalizado" },
              { title: "Confirmação", icon: <MessageSquare />, desc: "WhatsApp enviado na hora para confirmar" },
              { title: "Lembrete", icon: <Zap />, desc: "Aviso enviado 2h antes do horário marcado" },
              { title: "Fidelização", icon: <Star />, desc: "Cashback e convite para próxima visita" },
            ].map((step, i) => (
              <div key={i} className="flex-1 flex flex-col items-center text-center space-y-4">
                <div className="w-20 h-20 rounded-[2rem] bg-zinc-900 border border-white/10 flex items-center justify-center text-primary shadow-2xl group-hover:bg-primary transition-all">
                  {step.icon}
                </div>
                <h4 className="text-lg font-black text-white">{step.title}</h4>
                <p className="text-xs text-white/40 font-bold max-w-[150px]">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="planos" className="py-24 lg:py-40 px-6 relative overflow-hidden">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16 lg:mb-24">
            <h2 className="text-primary font-black uppercase tracking-widest text-sm mb-4">Planos</h2>
            <h3 className="text-4xl lg:text-7xl font-black text-white tracking-tight mb-8">Investimento que se paga <br /><span className="text-white/40">na primeira semana.</span></h3>
            
            <div className="inline-flex items-center p-1 bg-zinc-900 rounded-2xl border border-white/5 mb-12">
              <button className="px-6 py-2 rounded-xl bg-primary text-primary-foreground font-black text-sm">Mensal</button>
              <button className="px-6 py-2 rounded-xl text-white/40 font-black text-sm">Anual (20% OFF)</button>
            </div>
          </div>

          <div className="grid lg:grid-cols-3 gap-8 max-w-6xl mx-auto items-end">
            {/* Starter */}
            <div className="p-10 rounded-[2.5rem] bg-zinc-900/50 border border-white/5 flex flex-col h-fit">
              <h4 className="text-xl font-black text-white mb-2">Starter</h4>
              <p className="text-sm text-white/40 font-bold mb-8">Para barbeiros individuais.</p>
              <div className="text-4xl font-black text-white mb-8">R$ 49,90<span className="text-sm text-white/40 font-bold">/mês</span></div>
              <ul className="space-y-4 mb-10 flex-1">
                <PricingItem text="Até 2 Barbeiros" />
                <PricingItem text="Agenda Inteligente" />
                <PricingItem text="Gestão de Clientes" />
                <PricingItem text="Financeiro Básico" />
              </ul>
              <Button variant="outline" className="h-14 rounded-2xl border-white/10 text-white font-black hover:bg-white/5">Escolher Starter</Button>
            </div>

            {/* Pro */}
            <div className="p-12 rounded-[3rem] bg-zinc-900 border-2 border-primary flex flex-col h-full relative shadow-[0_40px_80px_-20px_rgba(234,179,8,0.2)]">
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-[10px] font-black px-4 py-1.5 rounded-full uppercase tracking-widest">Mais Vendido</div>
              <h4 className="text-2xl font-black text-white mb-2">Pro</h4>
              <p className="text-sm text-white/40 font-bold mb-8">Para barbearias em expansão.</p>
              <div className="text-6xl font-black text-white mb-8">R$ 89,90<span className="text-sm text-white/40 font-bold">/mês</span></div>
              <ul className="space-y-4 mb-10 flex-1">
                <PricingItem text="Até 10 Barbeiros" />
                <PricingItem text="WhatsApp Automático" />
                <PricingItem text="Sistema de Cashback" />
                <PricingItem text="Financeiro Completo" />
                <PricingItem text="Marketing & Campanhas" />
                <PricingItem text="15 Dias Grátis" />
              </ul>
              <Button className="h-16 rounded-2xl bg-primary hover:bg-primary/90 text-primary-foreground font-black text-lg shadow-xl" onClick={() => setShowSignupModal(true)}>Começar teste grátis</Button>
            </div>

            {/* Elite */}
            <div className="p-10 rounded-[2.5rem] bg-zinc-900/50 border border-white/5 flex flex-col h-fit">
              <h4 className="text-xl font-black text-white mb-2">Elite</h4>
              <p className="text-sm text-white/40 font-bold mb-8">Gestão total sem limites.</p>
              <div className="text-4xl font-black text-white mb-8">R$ 149,90<span className="text-sm text-white/40 font-bold">/mês</span></div>
              <ul className="space-y-4 mb-10 flex-1">
                <PricingItem text="Barbeiros Ilimitados" />
                <PricingItem text="Suporte VIP 24h" />
                <PricingItem text="Mentoria de Gestão" />
                <PricingItem text="Automações Premium" />
              </ul>
              <Button variant="outline" className="h-14 rounded-2xl border-white/10 text-white font-black hover:bg-white/5">Escolher Elite</Button>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="py-24 lg:py-40 px-6 bg-zinc-950/20">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-16 lg:mb-24">
            <h2 className="text-primary font-black uppercase tracking-widest text-sm mb-4">FAQ</h2>
            <h3 className="text-4xl lg:text-6xl font-black text-white tracking-tight">Tire suas dúvidas</h3>
          </div>
          
          <Accordion type="single" collapsible className="w-full space-y-4">
            <FaqItem 
              value="item-1"
              question="O teste de 15 dias é grátis mesmo?"
              answer="Sim! Você terá acesso a 100% das funcionalidades do plano Pro por 15 dias sem pagar nada e sem precisar cadastrar cartão."
            />
            <FaqItem 
              value="item-2"
              question="Consigo usar no celular?"
              answer="Com certeza. O Barbex é feito para ser usado no seu dia a dia, direto do celular, tablet ou computador."
            />
            <FaqItem 
              value="item-3"
              question="Como funciona o WhatsApp?"
              answer="O sistema envia mensagens automáticas de confirmação, lembrete e marketing usando sua própria conta de WhatsApp conectada."
            />
            <FaqItem 
              value="item-4"
              question="Tem multa se eu quiser cancelar?"
              answer="Não. Nossos planos não possuem fidelidade. Você pode cancelar quando quiser sem qualquer taxa adicional."
            />
          </Accordion>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-24 lg:py-40 px-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-primary/10 blur-[120px] -z-10" />
        <div className="max-w-5xl mx-auto p-12 lg:p-24 rounded-[3.5rem] bg-zinc-900 border border-white/10 text-center relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/20 blur-[80px] -z-10" />
          
          <h2 className="text-5xl lg:text-8xl font-black text-white mb-8 tracking-tighter leading-none">
            Pronto para <br />
            <span className="text-primary italic">transformar?</span>
          </h2>
          <p className="text-lg lg:text-xl text-white/40 max-w-2xl mx-auto mb-12 font-bold leading-relaxed">
            Junte-se a centenas de barbearias que já automatizaram sua gestão e aumentaram seu faturamento com o Barbex.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button 
              size="lg" 
              className="h-20 px-16 text-2xl font-black bg-primary hover:bg-primary/90 text-primary-foreground rounded-2xl shadow-[0_20px_40px_-15px_rgba(234,179,8,0.5)] group transition-all"
              onClick={() => setShowSignupModal(true)}
            >
              Começar agora
              <ArrowRight className="ml-2 h-6 w-6 group-hover:translate-x-2 transition-transform" />
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-background border-t border-white/5 py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-4 gap-16 mb-20">
            <div className="col-span-2">
              <div className="flex items-center gap-2 mb-8">
                <Scissors className="text-primary h-8 w-8" />
                <span className="text-3xl font-black tracking-tighter text-white">Barbex</span>
              </div>
              <p className="text-white/40 max-w-sm mb-8 text-lg font-bold leading-relaxed">
                A plataforma premium definitiva para barbearias modernas que buscam escala, profissionalismo e lucro.
              </p>
            </div>
            <div>
              <h4 className="font-black text-white uppercase tracking-widest text-xs mb-8">Produto</h4>
              <ul className="space-y-4 text-white/40 font-bold">
                <li><a href="#recursos" className="hover:text-primary transition-colors">Recursos</a></li>
                <li><a href="#automações" className="hover:text-primary transition-colors">Automações</a></li>
                <li><a href="#planos" className="hover:text-primary transition-colors">Planos</a></li>
                <li><a href="#faq" className="hover:text-primary transition-colors">FAQ</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-black text-white uppercase tracking-widest text-xs mb-8">Links Úteis</h4>
              <ul className="space-y-4 text-white/40 font-bold">
                <li><Link to="/auth" className="hover:text-primary transition-colors">Entrar</Link></li>
                <li><Link to="/auth" className="hover:text-primary transition-colors">Criar conta</Link></li>
                <li><a href="#" className="hover:text-primary transition-colors">Suporte</a></li>
                <li><a href="#" className="hover:text-primary transition-colors">Privacidade</a></li>
              </ul>
            </div>
          </div>
          <div className="pt-10 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="text-white/20 text-sm font-bold">
              © 2026 Barbex. Todos os direitos reservados.
            </div>
            <div className="flex gap-8 text-white/20 text-sm font-bold">
              <span className="flex items-center gap-1"><Smartphone className="h-3 w-3" /> App Disponível</span>
              <span className="flex items-center gap-1"><ShieldCheck className="h-3 w-3" /> 100% Seguro</span>
            </div>
          </div>
        </div>
      </footer>
      <SignupOnboardingModal isOpen={showSignupModal} onOpenChange={setShowSignupModal} />
    </div>
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
