import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { 
  Scissors, 
  Calendar, 
  BarChart3, 
  Users, 
  MessageSquare, 
  Zap, 
  ShieldCheck, 
  ChevronRight, 
  CheckCircle2, 
  Star, 
  Clock, 
  Sparkles, 
  CircleDollarSign,
  TrendingUp,
  Activity,
  ShoppingBag,
  Target,
  ArrowRight,
  ChevronDown,
  Menu,
  X,
  Smartphone,
  LayoutDashboard,
  Layers,
  Award,
  Globe,
  Bell,
  Cpu,
  Lock,
  ArrowUpRight,
  Play
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import { PLAN_LIMITS } from "@/hooks/use-plan-limits";
import { BarbexLogo } from "@/components/ui/barbex-logo";
import { WhyChooseUs } from "@/components/public/WhyChooseUs";
import { PortalFaq } from "@/components/public/PortalFaq";
import { SubscriptionValueProps } from "@/components/public/SubscriptionValueProps";
import { AboutShop } from "@/components/public/AboutShop";


function LandingPage() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 50);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div className="min-h-screen bg-[#05070d] text-white selection:bg-gold selection:text-black">
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, x: "100%" }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: "100%" }}
            className="fixed inset-0 z-[60] bg-black p-6 flex flex-col md:hidden"
          >
            <div className="flex justify-between items-center mb-12">
              <span className="text-xl font-black italic">BARBEX</span>
              <Button variant="ghost" className="text-white" onClick={() => setIsMobileMenuOpen(false)}>
                <X size={24} />
              </Button>
            </div>
            <nav className="flex flex-col gap-6 text-2xl font-black uppercase italic tracking-tighter">
              {["Recursos", "Planos", "FAQ"].map(item => (
                <a key={item} href={`#${item.toLowerCase()}`} onClick={() => setIsMobileMenuOpen(false)} className="hover:text-gold transition-colors">{item}</a>
              ))}
            </nav>
            <div className="mt-auto flex flex-col gap-4">
              <Button className="h-14 rounded-2xl bg-gold text-black font-black uppercase tracking-widest" asChild>
                <Link to="/auth" search={{ tab: "register" }} onClick={() => setIsMobileMenuOpen(false)}>Testar Grátis</Link>
              </Button>
              <Button variant="outline" className="h-14 rounded-2xl border-white/10 text-white font-black uppercase tracking-widest" asChild>
                <Link to="/auth" onClick={() => setIsMobileMenuOpen(false)}>Entrar no Sistema</Link>
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <header className={cn(
        "fixed top-0 w-full z-50 transition-all duration-300 border-b",
        isScrolled ? "bg-black/80 backdrop-blur-md border-gold/20 py-4" : "bg-transparent border-transparent py-6"
      )}>
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <BarbexLogo size="md" />
          </Link>
          
          <nav className="hidden md:flex gap-8 text-[11px] font-black uppercase tracking-widest text-slate-400">
            {["Recursos", "Planos", "FAQ"].map(item => (
              <a key={item} href={`#${item.toLowerCase()}`} className="hover:text-gold transition-colors">{item}</a>
            ))}
          </nav>
          
          <div className="hidden md:flex gap-4">
            <Button variant="ghost" className="text-xs font-black uppercase tracking-widest text-slate-400 hover:text-white" asChild>
              <Link to="/auth">Entrar</Link>
            </Button>
            <Button className="bg-gold text-black font-black uppercase tracking-widest text-xs h-10 px-6 rounded-xl hover:bg-gold/90" asChild>
              <Link to="/auth" search={{ tab: "register" }}>Testar Grátis</Link>
            </Button>
          </div>
          
          <Button variant="ghost" className="md:hidden text-white" onClick={() => setIsMobileMenuOpen(true)}>
            <Menu size={24} />
          </Button>
        </div>
      </header>

      {/* Hero */}
      <section className="pt-32 pb-24 px-6 text-center">
        <div className="max-w-4xl mx-auto space-y-8">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-gold/20 bg-gold/5 text-gold text-[10px] font-black uppercase tracking-widest">
            <Sparkles size={12} />
            Gestão Premium de Barbearias
          </motion.div>
          <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="text-5xl md:text-8xl font-black uppercase italic tracking-tighter leading-[0.85] py-2">
            A plataforma <span className="text-gold">completa</span> para barbearias que querem <span className="relative inline-block">crescer<div className="absolute -bottom-2 left-0 w-full h-1 bg-gold/30 rounded-full blur-[2px]" /></span>
          </motion.h1>
          <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="text-slate-400 text-lg md:text-2xl max-w-3xl mx-auto leading-tight font-medium">
            Centralize agenda, clientes, equipe, financeiro, loja, assinaturas, marketing e automações em uma única plataforma Enterprise.
          </motion.p>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="flex flex-col sm:flex-row gap-4 justify-center pt-8">
            <Button className="h-16 px-10 rounded-2xl bg-gold text-black font-black uppercase tracking-widest hover:bg-gold/90 text-sm shadow-[0_20px_40px_-10px_rgba(212,175,55,0.4)]" asChild>
              <Link to="/auth" search={{ tab: "register" }}>Começar teste grátis</Link>
            </Button>
            <Button variant="outline" className="h-16 px-10 rounded-2xl border-white/20 bg-white/5 backdrop-blur-sm hover:bg-white/10 font-black uppercase tracking-widest text-sm text-white" asChild>
              <a href="#demo" className="flex items-center gap-2">
                <Play size={16} fill="currentColor" />
                Assistir Demonstração
              </a>
            </Button>
          </motion.div>
          
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} className="flex flex-wrap justify-center gap-x-8 gap-y-4 pt-10 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
            <div className="flex items-center gap-2"><CheckCircle2 size={14} className="text-gold" /> 15 dias grátis</div>
            <div className="flex items-center gap-2"><CheckCircle2 size={14} className="text-gold" /> Sem cartão de crédito</div>
            <div className="flex items-center gap-2"><CheckCircle2 size={14} className="text-gold" /> Configuração simples</div>
          </motion.div>
        </div>
      </section>

      {/* Trust Bar / Benefits */}
      <section className="py-12 border-y border-white/5 bg-zinc-950/50 backdrop-blur-sm overflow-hidden">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-wrap justify-center md:justify-between items-center gap-8 opacity-40 grayscale hover:grayscale-0 hover:opacity-100 transition-all duration-700">
            {[
              { icon: Calendar, label: "Agenda Online" },
              { icon: Smartphone, label: "Portal do Cliente" },
              { icon: BarChart3, label: "Financeiro Premium" },
              { icon: MessageSquare, label: "Automações WhatsApp" },
              { icon: ShoppingBag, label: "Loja Virtual" },
              { icon: Award, label: "Clube de Assinaturas" }
            ].map((item, idx) => (
              <div key={idx} className="flex items-center gap-3 group">
                <item.icon size={20} className="text-gold group-hover:scale-110 transition-transform" />
                <span className="text-[10px] font-black uppercase tracking-widest whitespace-nowrap">{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>


      {/* Features Grid */}
      <section id="recursos" className="py-24 bg-black">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid md:grid-cols-4 gap-6">
            {[
              { icon: Calendar, title: "Gestão de Agenda", desc: "Online, manual, walk-in e fila." },
              { icon: Users, title: "CRM & Clientes", desc: "Perfil 360°, histórico e fidelização." },
              { icon: CircleDollarSign, title: "Financeiro & BI", desc: "Caixa, comissões e DRE Executivo." },
              { icon: MessageSquare, title: "Automações", desc: "WhatsApp, lembretes e marketing." },
            ].map((f, i) => (
              <div key={i} className="p-8 rounded-3xl border border-white/5 bg-zinc-900/30 hover:border-gold/20 transition-all">
                <f.icon className="text-gold mb-6" size={32} />
                <h4 className="text-white font-black uppercase tracking-tight mb-2">{f.title}</h4>
                <p className="text-slate-400 text-sm">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Solution Overview (Bento Grid) */}
      <section id="solucoes" className="py-32 bg-black relative">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_50%,rgba(212,175,55,0.05),transparent_50%)]" />
        <div className="max-w-7xl mx-auto px-6 relative">
          <div className="text-center mb-20 space-y-4">
            <span className="text-gold font-black uppercase tracking-[0.4em] text-[10px]">Ecossistema Enterprise</span>
            <h2 className="text-4xl md:text-6xl font-black uppercase italic tracking-tighter text-white">Um único sistema para toda a operação</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-6 grid-rows-auto md:grid-rows-2 gap-6">
            {/* Main Feature */}
            <motion.div 
              whileHover={{ y: -5 }}
              className="md:col-span-3 md:row-span-2 p-10 rounded-[2.5rem] border border-gold/20 bg-gradient-to-br from-zinc-900 to-black overflow-hidden group relative"
            >
              <div className="absolute top-0 right-0 p-8 opacity-20 group-hover:opacity-40 transition-opacity">
                <Calendar size={120} className="text-gold" />
              </div>
              <Calendar size={48} className="text-gold mb-8" />
              <h3 className="text-3xl font-black uppercase italic tracking-tighter text-white mb-4">Agenda Inteligente</h3>
              <p className="text-slate-400 text-lg leading-relaxed mb-8 max-w-sm">
                Agendamento online, manual, walk-in e check-in. Gestão de conflitos, buffers automáticos e sincronização em tempo real.
              </p>
              <div className="flex flex-wrap gap-2">
                {["Walk-in", "Check-in", "Lista de Espera", "Buffers"].map(t => (
                  <span key={t} className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[9px] font-black uppercase tracking-widest text-slate-300">{t}</span>
                ))}
              </div>
            </motion.div>

            {/* Middle Feature 1 */}
            <motion.div 
              whileHover={{ y: -5 }}
              className="md:col-span-3 p-8 rounded-[2.5rem] border border-white/5 bg-zinc-950 flex flex-col justify-between group"
            >
              <div className="flex justify-between items-start mb-6">
                <Users size={32} className="text-gold group-hover:scale-110 transition-transform" />
                <ArrowUpRight size={20} className="text-slate-600 group-hover:text-gold transition-colors" />
              </div>
              <div>
                <h4 className="text-xl font-black uppercase italic tracking-tight text-white mb-2">CRM & Clientes 360°</h4>
                <p className="text-slate-400 text-sm leading-relaxed">Histórico completo, frequência, ticket médio, cashback e preferências individuais.</p>
              </div>
            </motion.div>

            {/* Middle Feature 2 */}
            <motion.div 
              whileHover={{ y: -5 }}
              className="md:col-span-3 p-8 rounded-[2.5rem] border border-white/5 bg-zinc-950 flex flex-col justify-between group"
            >
              <div className="flex justify-between items-start mb-6">
                <BarChart3 size={32} className="text-gold group-hover:scale-110 transition-transform" />
                <ArrowUpRight size={20} className="text-slate-600 group-hover:text-gold transition-colors" />
              </div>
              <div>
                <h4 className="text-xl font-black uppercase italic tracking-tight text-white mb-2">Financeiro & BI</h4>
                <p className="text-slate-400 text-sm leading-relaxed">Fluxo de caixa, DRE gerencial, comissões automáticas e indicadores de saúde do negócio.</p>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Prova Visual (Mockup) */}
      <section className="py-24 px-6 overflow-hidden bg-[#05070d] relative">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-px bg-gradient-to-r from-transparent via-gold/50 to-transparent" />
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="relative rounded-[3rem] border border-gold/20 bg-black/40 backdrop-blur-sm p-4 shadow-[0_0_100px_-20px_rgba(212,175,55,0.2)] overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-b from-white/[0.02] to-transparent pointer-events-none" />
            <img 
              src="https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/0ce0d0ed-5497-443c-a203-78d6752261b7/id-preview-67ef2cc9--8e95dc9e-ab64-44cf-956c-ecec6fefeb51.lovable.app-1777896732289.png" 
              alt="Barbex Enterprise Dashboard" 
              className="rounded-[2.5rem] border border-white/10 w-full"
            />
            {/* Floating Overlays */}
            <motion.div 
              initial={{ x: -20, opacity: 0 }}
              whileInView={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="absolute top-1/4 -left-10 md:left-20 p-6 rounded-3xl border border-gold/30 bg-black/80 backdrop-blur-xl shadow-2xl hidden md:block"
            >
              <div className="flex items-center gap-4">
                <div className="p-3 bg-gold/10 rounded-2xl text-gold"><TrendingUp size={24} /></div>
                <div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">Crescimento Mensal</div>
                  <div className="text-2xl font-black text-white">+24.8%</div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* About Shop Integration (Recuperando componente visual anterior) */}
      <AboutShop 
        shop={{ business_name: "Barbex Enterprise" }} 
        barbers={[{}, {}, {}]} 
        services={[{}, {}, {}, {}]} 
        products={[{}, {}]}
        testimonials={[{}, {}, {}]}
      />

      {/* Role Experience */}
      <section className="py-32 px-6 bg-black">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row gap-20 items-center">
            <div className="flex-1 space-y-8">
              <span className="text-gold font-black uppercase tracking-[0.4em] text-[10px]">Experiência Multi-Perfil</span>
              <h2 className="text-4xl md:text-6xl font-black uppercase italic tracking-tighter text-white leading-none">
                Uma visão <span className="text-gold underline decoration-gold/30 underline-offset-8">personalizada</span> para cada usuário
              </h2>
              <p className="text-slate-400 text-lg leading-relaxed max-w-xl">
                Do administrador ao cliente final, cada perfil tem uma interface otimizada para suas necessidades específicas.
              </p>
              
              <div className="space-y-4">
                {[
                  { title: "Gestor (Admin)", desc: "Controle total da operação, financeiro e KPIs em tempo real." },
                  { title: "Profissional", desc: "Agenda própria, metas, comissões e histórico de atendimentos." },
                  { title: "Cliente", desc: "Self-service total: agendamentos, planos, cashback e loja." }
                ].map((item, idx) => (
                  <div key={idx} className="p-6 rounded-2xl border border-white/5 bg-zinc-950 hover:border-gold/30 transition-all cursor-default group">
                    <h5 className="font-black uppercase tracking-tight text-white group-hover:text-gold transition-colors">{item.title}</h5>
                    <p className="text-sm text-slate-500 mt-1">{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex-1 relative">
              <div className="absolute -inset-10 bg-gold/10 blur-[100px] rounded-full" />
              <div className="relative rounded-[2.5rem] border border-white/10 bg-zinc-900 p-2 shadow-2xl">
                 <img 
                  src="https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/0ce0d0ed-5497-443c-a203-78d6752261b7/id-preview-67ef2cc9--8e95dc9e-ab64-44cf-956c-ecec6fefeb51.lovable.app-1777896732289.png" 
                  alt="Interface por Perfil" 
                  className="rounded-[2rem] w-full"
                />
              </div>
            </div>
          </div>
        </div>
      </section>


      {/* Planos Section */}
      <section id="planos" className="py-24 px-6 relative overflow-hidden">
        <div className="max-w-7xl mx-auto relative z-10">
          <div className="text-center space-y-4 mb-16">
            <span className="text-gold font-black uppercase tracking-[0.3em] text-xs">Investimento</span>
            <h3 className="text-4xl md:text-6xl font-black uppercase italic tracking-tighter text-white">Planos que acompanham você</h3>
            <p className="text-slate-400 max-w-xl mx-auto">
              Comece agora com 15 dias de teste grátis. Sem cartão de crédito necessário.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {Object.entries(PLAN_LIMITS).filter(([key]) => key !== 'free').map(([key, plan]) => (
              <div 
                key={key} 
                className={cn(
                  "relative p-8 rounded-[2.5rem] border transition-all duration-300",
                  key === 'pro' ? "bg-gold/5 border-gold shadow-gold scale-105 z-10" : "bg-zinc-950 border-white/10 hover:border-gold/30"
                )}
              >
                {key === 'pro' && (
                  <span className="absolute -top-4 left-1/2 -translate-x-1/2 bg-gold text-black px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest shadow-xl">Recomendado</span>
                )}
                <div className="mb-8">
                  <h4 className="text-xl font-black uppercase italic tracking-tight text-white mb-2">{key}</h4>
                  <div className="flex items-baseline gap-1">
                    <span className="text-sm font-bold text-slate-400 italic">R$</span>
                    <span className="text-5xl font-black tracking-tighter text-white">
                      {/* @ts-ignore */}
                      {plan.price?.toFixed(2).split('.')[0]}
                    </span>
                    <span className="text-lg font-black text-gold">
                      {/* @ts-ignore */}
                      ,{plan.price?.toFixed(2).split('.')[1]}
                    </span>
                    <span className="text-slate-400 text-xs uppercase tracking-widest ml-2">/mês</span>
                  </div>
                </div>

                <ul className="space-y-4 mb-10">
                  {/* @ts-ignore */}
                  {[
                    // @ts-ignore
                    { label: plan.barbers === Infinity ? "Barbeiros ilimitados" : `${plan.barbers} Barbeiros`, ok: true },
                    // @ts-ignore
                    { label: plan.whatsappConnections === Infinity ? "WhatsApp ilimitado" : `${plan.whatsappConnections} Conexão WhatsApp`, ok: true },
                    { label: "Agenda & Financeiro", ok: true },
                    { label: "CRM & Fidelização", ok: true },
                    { label: "Marketplace & Loja", ok: true },
                    { label: "Relatórios de BI", ok: key !== 'starter' },
                  ].map((feature, idx) => (
                    <li key={idx} className={cn("flex items-center gap-3 text-sm", feature.ok ? "text-slate-200" : "text-slate-500 opacity-50")}>
                      <CheckCircle2 size={16} className={feature.ok ? "text-gold" : "text-slate-700"} />
                      {feature.label}
                    </li>
                  ))}
                </ul>

                <Button 
                  className={cn(
                    "w-full h-12 rounded-2xl font-black uppercase tracking-widest text-xs",
                    key === 'pro' ? "bg-gold text-black hover:bg-gold/90" : "bg-white/5 text-white hover:bg-white/10"
                  )}
                  asChild
                >
                  <Link to="/auth" search={{ tab: "register", plan: key }}>Selecionar Plano</Link>
                </Button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Final */}
      <section id="faq" className="py-24 px-6 bg-black/50">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <h3 className="text-4xl font-black uppercase italic tracking-tighter text-white">Dúvidas Frequentes</h3>
          </div>
          <div className="space-y-4">
            {[
              { q: "Preciso de cartão de crédito para testar?", a: "Não. Você pode criar sua conta agora e usar todos os recursos por 15 dias sem compromisso." },
              { q: "O Barbex funciona em qualquer barbearia?", a: "Sim. Desde barbeiros autônomos até redes com múltiplas unidades e profissionais." },
              { q: "Consigo cancelar quando quiser?", a: "Com certeza. Não temos fidelidade. Você paga pelo mês de uso e pode cancelar a qualquer momento." },
              { q: "Tem suporte em português?", a: "Sim, suporte especializado via ticket e WhatsApp para assinantes de planos Pro e Elite." },
            ].map((item, idx) => (
              <details key={idx} className="group rounded-3xl border border-white/5 bg-zinc-950 overflow-hidden">
                <summary className="flex items-center justify-between p-6 cursor-pointer list-none font-bold text-white group-open:text-gold transition-colors">
                  {item.q}
                  <ChevronDown size={20} className="group-open:rotate-180 transition-transform" />
                </summary>
                <div className="px-6 pb-6 text-slate-400 text-sm leading-relaxed">
                  {item.a}
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Footer Final */}
      <footer className="py-20 px-6 border-t border-white/5 bg-black">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-12">
          <div className="space-y-4 text-center md:text-left">
            <div className="text-2xl font-black tracking-tighter">BARBEX</div>
            <p className="text-slate-500 text-sm max-w-xs uppercase tracking-widest font-bold">Plataforma SaaS Enterprise para gestão de barbearias.</p>
          </div>
          <div className="flex gap-8 text-[10px] font-black uppercase tracking-widest text-slate-400">
            <Link to="/auth" className="hover:text-gold transition-colors">Entrar</Link>
            <Link to="/tutorials" className="hover:text-gold transition-colors">Ajuda</Link>
            <a href="#" className="hover:text-gold transition-colors">Termos</a>
            <a href="#" className="hover:text-gold transition-colors">Privacidade</a>
          </div>
          <div className="text-slate-600 text-[10px] font-black uppercase tracking-widest">
            © {new Date().getFullYear()} BARBEX ENTERPRISE. TODOS OS DIREITOS RESERVADOS.
          </div>
        </div>
      </footer>
    </div>
  );
}

export const Route = createFileRoute("/")({
  component: LandingPage,
  head: () => ({
    meta: [
      { title: "Barbex | Gestão completa para barbearias" },
      { name: "description", content: "Gerencie agenda, clientes, profissionais, financeiro, loja, assinaturas, automações e muito mais com o Barbex." }
    ]
  })
});
