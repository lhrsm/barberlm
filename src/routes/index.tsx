import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
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
  Check
} from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export const Route = createFileRoute("/")({
  component: LandingPageComponent,
});

function LandingPageComponent() {
  const { user, loading, role } = useAuth();
  const navigate = useNavigate();

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
    <div className="min-h-screen bg-background text-foreground selection:bg-primary/20 dark overflow-x-hidden">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 glass border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-2 group cursor-pointer">
            <div className="p-2 bg-primary/20 rounded-lg group-hover:bg-primary/30 transition-colors">
              <Scissors className="text-primary h-6 w-6" />
            </div>
            <span className="text-2xl font-bold tracking-tight text-white">Barber<span className="text-primary">LM</span></span>
          </div>
          <div className="hidden lg:flex items-center gap-10">
            <a href="#funcionalidades" className="text-sm font-medium text-white/70 hover:text-white transition-colors">Funcionalidades</a>
            <a href="#precos" className="text-sm font-medium text-white/70 hover:text-white transition-colors">Preços</a>
            <a href="#faq" className="text-sm font-medium text-white/70 hover:text-white transition-colors">FAQ</a>
          </div>
          <div className="flex items-center gap-4">
            <Button variant="ghost" className="text-white hover:bg-white/10" asChild>
              <Link to="/auth">Entrar</Link>
            </Button>
            <Button className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-6 shadow-[0_0_20px_rgba(var(--primary),0.3)]" asChild>
              <Link to="/auth">Começar agora</Link>
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-40 pb-20 lg:pt-56 lg:pb-32 px-4 overflow-hidden">
        {/* Glow Effects */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-primary/20 rounded-full blur-[120px] -z-10 animate-glow"></div>
        <div className="absolute top-1/4 -right-1/4 w-[500px] h-[500px] bg-blue-500/10 rounded-full blur-[100px] -z-10 animate-glow" style={{ animationDelay: '2s' }}></div>

        <div className="max-w-7xl mx-auto text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-6 py-2 rounded-full glass border border-primary/30 text-primary text-sm font-bold mb-8 animate-in fade-in slide-in-from-bottom-4 duration-700 shadow-[0_0_20px_rgba(var(--primary),0.2)]">
            <Zap className="h-4 w-4 fill-current" />
            <span>Teste o plano Pro grátis por 15 dias</span>
          </div>
          
          <h1 className="text-5xl lg:text-[84px] font-black tracking-tighter mb-8 text-white leading-[1] animate-in fade-in slide-in-from-bottom-8 duration-700 delay-100">
            A plataforma completa para transformar sua <br className="hidden lg:block" />
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary via-blue-400 to-primary bg-[length:200%_auto] animate-pulse">barbearia em um negócio profissional.</span>
          </h1>
          
          <p className="text-xl text-white/60 max-w-3xl mx-auto mb-12 leading-relaxed animate-in fade-in slide-in-from-bottom-10 duration-700 delay-200">
            Agendamentos online, WhatsApp, financeiro, cashback, comissões e automações em um único sistema simples de usar.
          </p>

          <div className="flex flex-col items-center gap-6 mb-20 animate-in fade-in slide-in-from-bottom-12 duration-700 delay-300">
            <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
              <Button size="lg" className="h-20 px-12 text-xl font-black bg-primary hover:bg-primary/90 shadow-[0_0_40px_rgba(var(--primary),0.5)] group relative overflow-hidden" asChild>
                <Link to="/auth">
                  <div className="flex flex-col items-center leading-tight">
                    <span>Começar teste grátis</span>
                    <span className="text-xs font-medium opacity-80">Acesse o plano Pro grátis por 15 dias</span>
                  </div>
                  <ArrowRight className="ml-3 h-6 w-6 group-hover:translate-x-1 transition-transform" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" className="h-20 px-12 text-xl font-bold border-white/10 hover:bg-white/5 text-white" asChild>
                <a href="#funcionalidades">Ver funcionalidades</a>
              </Button>
            </div>
            
            <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-2 text-white/40 text-sm font-bold uppercase tracking-widest">
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-primary" /> Sem cartão de crédito
              </div>
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-primary" /> Acesso imediato
              </div>
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-primary" /> Cancele quando quiser
              </div>
            </div>
          </div>
          
          {/* Dashboard Mockup */}
          <div className="relative max-w-6xl mx-auto animate-in fade-in slide-in-from-bottom-16 duration-1000 delay-500">
            <div className="absolute -inset-1 bg-gradient-to-r from-primary/50 to-blue-500/50 rounded-2xl blur opacity-20 group-hover:opacity-40 transition duration-1000"></div>
            <div className="relative rounded-2xl border border-white/10 glass p-2 lg:p-4 shadow-2xl overflow-hidden animate-float">
              <img 
                src="https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&q=80&w=2000" 
                alt="Barber Dashboard Mockup" 
                className="w-full h-auto rounded-xl opacity-90"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent"></div>
              
              {/* Floating UI Elements */}
              <div className="absolute top-10 left-10 hidden lg:block glass p-4 rounded-xl border border-white/10 animate-float" style={{ animationDelay: '1s' }}>
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                    <TrendingUp className="text-green-500 h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-[10px] text-white/50 uppercase font-bold tracking-wider">Faturamento</div>
                    <div className="text-lg font-bold text-white">R$ 12.450,00</div>
                  </div>
                </div>
              </div>

              <div className="absolute bottom-20 right-10 hidden lg:block glass p-4 rounded-xl border border-white/10 animate-float" style={{ animationDelay: '2s' }}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                    <Calendar className="text-primary h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-[10px] text-white/50 uppercase font-bold tracking-wider">Próximo Agendamento</div>
                    <div className="text-sm font-bold text-white">Corte Degradê - 14:30</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Metrics Bar */}
      <section className="py-20 border-y border-white/5 bg-white/[0.02]">
        <div className="max-w-7xl mx-auto px-4 grid grid-cols-1 md:grid-cols-3 gap-12 text-center">
          <div className="space-y-2">
            <div className="text-5xl font-black text-white">+1.200</div>
            <div className="text-white/50 font-medium uppercase tracking-widest text-sm">Agendamentos realizados</div>
          </div>
          <div className="space-y-2">
            <div className="text-5xl font-black text-white">Milhares</div>
            <div className="text-white/50 font-medium uppercase tracking-widest text-sm">De clientes atendidos</div>
          </div>
          <div className="space-y-2">
            <div className="text-5xl font-black text-white">Dezenas</div>
            <div className="text-white/50 font-medium uppercase tracking-widest text-sm">De barbearias utilizando</div>
          </div>
        </div>
      </section>

      {/* Trial Exclusive Benefits */}
      <section className="py-32 px-4 relative overflow-hidden bg-primary/5">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col lg:flex-row items-center gap-16">
            <div className="flex-1 space-y-8">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass border border-primary/20 text-primary text-sm font-bold uppercase tracking-widest">
                <CheckCircle2 className="h-4 w-4" />
                <span>O que está incluso no teste</span>
              </div>
              <h2 className="text-4xl lg:text-6xl font-black text-white tracking-tight leading-tight">
                Tudo liberado por <span className="text-primary">15 dias grátis.</span>
              </h2>
              <p className="text-xl text-white/50 font-medium leading-relaxed">
                Durante os 15 dias de teste do plano Pro, você terá acesso total a todas as ferramentas premium do sistema, sem limitações.
              </p>
              
              <div className="grid sm:grid-cols-2 gap-6 pt-4">
                {[
                  "WhatsApp automático",
                  "Sistema de Cashback",
                  "Financeiro completo",
                  "Comissão automática",
                  "Agenda inteligente",
                  "Relatórios avançados",
                  "Dashboard em tempo real",
                  "Gestão de estoque"
                ].map((benefit, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                      <Check className="h-4 w-4 text-primary" />
                    </div>
                    <span className="text-white font-bold">{benefit}</span>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="flex-1 relative">
              <div className="absolute -inset-4 bg-primary/20 blur-[60px] rounded-full animate-pulse"></div>
              <div className="relative glass p-8 lg:p-12 rounded-[3rem] border border-white/10 shadow-2xl">
                <div className="space-y-6">
                  <div className="flex items-center justify-between p-6 bg-white/5 rounded-2xl border border-white/5">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center">
                        <Zap className="text-primary h-6 w-6" />
                      </div>
                      <div className="font-bold text-white text-lg">Plano Pro Liberado</div>
                    </div>
                    <div className="text-primary font-black text-xl">GRÁTIS</div>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                      <div className="h-full bg-primary w-1/3 animate-pulse"></div>
                    </div>
                    <div className="flex justify-between text-sm font-bold uppercase tracking-widest text-white/40">
                      <span>Início do teste</span>
                      <span>15 dias</span>
                    </div>
                  </div>
                  
                  <div className="pt-4">
                    <Button className="w-full h-16 text-lg font-black bg-primary hover:bg-primary/90" asChild>
                      <Link to="/auth">Começar agora</Link>
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Problem Section */}
      <section className="py-32 px-4 relative overflow-hidden">
        <div className="max-w-4xl mx-auto text-center mb-20">
          <h2 className="text-base font-bold text-primary uppercase tracking-[0.2em] mb-4">O Desafio</h2>
          <p className="text-4xl lg:text-5xl font-black text-white tracking-tight">Você ainda perde clientes por:</p>
        </div>
        
        <div className="max-w-7xl mx-auto grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {[
            { title: "Agenda desorganizada", icon: <XCircle className="text-red-500" /> },
            { title: "Esquecimentos de clientes", icon: <XCircle className="text-red-500" /> },
            { title: "Confirmações manuais", icon: <XCircle className="text-red-500" /> },
            { title: "Controle financeiro ruim", icon: <XCircle className="text-red-500" /> },
            { title: "Falta de gestão dos barbeiros", icon: <XCircle className="text-red-500" /> },
            { title: "Dificuldade em fidelizar", icon: <XCircle className="text-red-500" /> },
          ].map((item, index) => (
            <div key={index} className="glass p-8 rounded-2xl border border-white/5 flex items-center gap-6 hover:border-white/10 transition-colors">
              <div className="p-3 bg-red-500/10 rounded-xl">
                {item.icon}
              </div>
              <h3 className="text-xl font-bold text-white/90">{item.title}</h3>
            </div>
          ))}
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
              <Button variant="outline" className="w-full h-14 text-lg font-bold border-white/10 hover:bg-white/5" asChild>
                <Link to="/auth">Começar agora</Link>
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
              <Button className="w-full h-16 text-xl font-black bg-primary hover:bg-primary/90 shadow-[0_0_40px_rgba(var(--primary),0.5)] animate-pulse" asChild>
                <Link to="/auth">Começar teste grátis</Link>
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
              <Button variant="outline" className="w-full h-14 text-lg font-bold border-white/10 hover:bg-white/5" asChild>
                <Link to="/auth">Assinar agora</Link>
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
          <Button size="lg" className="h-20 px-16 text-2xl font-black bg-primary hover:bg-primary/90 shadow-[0_0_50px_rgba(var(--primary),0.5)] group" asChild>
            <Link to="/auth">
              Começar teste grátis <ArrowRight className="ml-3 h-8 w-8 group-hover:translate-x-2 transition-transform" />
            </Link>
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
                <span className="text-3xl font-bold tracking-tight text-white">Barber<span className="text-primary">LM</span></span>
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
