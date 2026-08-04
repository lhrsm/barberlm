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
  Play,
  Heart,
  Check,
  CreditCard,
  Briefcase
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import { PLAN_LIMITS } from "@/hooks/use-plan-limits";
import { BarbexLogo } from "@/components/ui/barbex-logo";
import { WhyChooseUs } from "@/components/public/WhyChooseUs";
import { PortalFaq } from "@/components/public/PortalFaq";
import { PrivacyAndLGPDSection } from "@/components/public/PrivacyAndLGPDSection";
import { ScrollToTopButton } from "@/components/public/ScrollToTopButton";
import { AboutShop } from "@/components/public/AboutShop";
import { RegisterWizard } from "@/components/auth/RegisterWizard";
import { SystemMockup } from "@/components/public/SystemMockup";
import { LandingImage, CTASection } from "@/components/public/LandingUI";
import { 
  Instagram, 
  Facebook, 
  Twitter, 
  Youtube 
} from "@/components/ui/social-icons";



function LandingPage() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showRegisterWizard, setShowRegisterWizard] = useState(false);

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
              <Button className="h-14 rounded-2xl bg-gold text-black font-black uppercase tracking-widest" onClick={() => { setIsMobileMenuOpen(false); setShowRegisterWizard(true); }}>
                Testar Grátis
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
              <Link to="/auth" search={{ tab: "login" }}>Entrar</Link>
            </Button>
            <Button className="bg-gold text-black font-black uppercase tracking-widest text-xs h-10 px-6 rounded-xl hover:bg-gold/90" onClick={() => setShowRegisterWizard(true)}>
              Testar Grátis
            </Button>
          </div>
          
          <Button variant="ghost" className="md:hidden text-white" onClick={() => setIsMobileMenuOpen(true)}>
            <Menu size={24} />
          </Button>
        </div>
      </header>

      {/* Hero */}
      <section className="relative pt-32 pb-24 px-6 overflow-hidden">
        {/* Hero Background Image with Parallax-ready setup */}
        <div className="absolute inset-0 z-0">
          <img 
            src="https://images.unsplash.com/photo-1503951914875-452162b0f3f1?q=80&w=2070&auto=format&fit=crop" 
            alt="" 
            className="w-full h-full object-cover opacity-20 mix-blend-luminosity"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[#05070d] via-transparent to-[#05070d]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(245,158,11,0.15),transparent_45%)]" />
        </div>

        <div className="max-w-4xl mx-auto space-y-8 relative z-10 text-center">
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
            <Button className="h-16 px-10 rounded-2xl bg-gold text-black font-black uppercase tracking-widest hover:bg-gold/90 text-sm shadow-[0_20px_40px_-10px_rgba(212,175,55,0.4)]" onClick={() => setShowRegisterWizard(true)}>
              Começar teste grátis
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


      {/* System Mockup Visual */}
      <section className="relative w-full px-6 max-w-7xl mx-auto overflow-hidden">
        <SystemMockup />
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
      <section id="recursos" className="py-24 bg-black relative overflow-hidden">
        <div className="absolute top-0 right-0 w-1/3 h-full opacity-10 pointer-events-none">
          <img src="https://images.unsplash.com/photo-1599351431202-180f0b485ff8?q=80&w=1000&auto=format&fit=crop" alt="" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-l from-black via-black/80 to-black" />
        </div>
        
        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <div className="grid md:grid-cols-4 gap-6">
            {[
              { icon: Calendar, title: "Gestão de Agenda", desc: "Online, manual, walk-in e lista de espera inteligente." },
              { icon: Users, title: "CRM & Clientes", desc: "Perfil 360°, histórico de consumo e fidelização ativa." },
              { icon: CircleDollarSign, title: "Financeiro & BI", desc: "Fluxo de caixa, comissões e DRE Executivo em tempo real." },
              { icon: MessageSquare, title: "Automações", desc: "WhatsApp, lembretes, aniversários e marketing segmentado." },
            ].map((f, i) => (
              <motion.div 
                key={i} 
                whileHover={{ y: -5 }}
                className="p-8 rounded-3xl border border-white/5 bg-zinc-900/30 hover:border-gold/20 transition-all backdrop-blur-sm"
              >
                <f.icon className="text-gold mb-6" size={32} />
                <h4 className="text-white font-black uppercase tracking-tight mb-2">{f.title}</h4>
                <p className="text-slate-400 text-sm leading-relaxed">{f.desc}</p>
              </motion.div>
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

          <div className="grid grid-cols-1 md:grid-cols-6 grid-rows-auto md:grid-rows-2 gap-6 mb-20">
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

          {/* Imagem 01: Operação sem fricção */}
          <div className="grid md:grid-cols-2 gap-20 items-center">
            <div className="relative group">
              <LandingImage 
                src="https://images.unsplash.com/photo-1599351431202-180f0b485ff8?q=80&w=2000&auto=format&fit=crop"
                alt="Equipe de uma barbearia moderna trabalhando com apoio de tecnologia."
                className="border-gold/10 shadow-[0_20px_50px_-15px_rgba(212,175,55,0.15)]"
              />
              {/* Floating Cards */}
              <div className="absolute -top-6 -right-6 hidden md:block animate-bounce-slow">
                <div className="bg-black/80 backdrop-blur-md border border-gold/20 p-4 rounded-2xl shadow-2xl">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-white">Agenda organizada</span>
                  </div>
                </div>
              </div>
              <div className="absolute -bottom-6 -left-6 hidden md:block animate-bounce-slow" style={{ animationDelay: '1s' }}>
                <div className="bg-black/80 backdrop-blur-md border border-gold/20 p-4 rounded-2xl shadow-2xl">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-[#F59E0B] animate-pulse" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-white">Próximo atendimento: 14:30</span>
                  </div>
                </div>
              </div>
              <div className="absolute top-1/2 -left-10 hidden md:block animate-bounce-slow" style={{ animationDelay: '0.5s' }}>
                <div className="bg-black/80 backdrop-blur-md border border-gold/20 p-4 rounded-2xl shadow-2xl">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-white">Ocupação do dia: 92%</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="space-y-6">
              <h3 className="text-3xl md:text-5xl font-black uppercase italic tracking-tighter text-white">
                Operação sem fricção. <br /> Lucratividade máxima.
              </h3>
              <p className="text-slate-400 text-lg">
                O Barbex foi desenhado para eliminar gargalos operacionais e permitir que você foque no que realmente importa: a arte e a experiência do cliente.
              </p>
              <div className="flex items-center gap-4 pt-4">
                <Button className="h-14 px-8 rounded-2xl bg-gold text-black font-black uppercase tracking-widest hover:bg-gold/90" onClick={() => setShowRegisterWizard(true)}>
                  Conhecer todos os recursos
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Prova Visual (Mockup Contextual) */}
      <section className="py-24 px-6 overflow-hidden bg-[#05070d] relative">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-px bg-gradient-to-r from-transparent via-gold/50 to-transparent" />
        <div className="max-w-7xl mx-auto text-center mb-16">
          <span className="text-gold font-black uppercase tracking-[0.4em] text-[10px] mb-4 block">Experiência de Uso</span>
          <h2 className="text-3xl md:text-5xl font-black uppercase italic tracking-tighter text-white">Tecnologia que <span className="text-gold">eleva</span> o seu negócio</h2>
        </div>
        
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, x: -40 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="relative"
            >
              <div className="relative rounded-[2.5rem] border border-gold/20 bg-zinc-950 overflow-hidden shadow-2xl p-4">
                <SystemMockup className="py-0" />
              </div>
              
              <div className="absolute -top-6 -left-6 bg-black/80 backdrop-blur-md border border-gold/20 p-4 rounded-2xl shadow-2xl z-50 animate-bounce-slow">
                 <div className="flex items-center gap-3">
                    <Cpu size={16} className="text-gold" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-white">Tecnologia Integrada</span>
                 </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 40 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="space-y-6"
            >
              {[
                { title: "Alta Resolução", desc: "Interfaces nítidas e otimizadas para telas Retina e 4K." },
                { title: "Performance Edge", desc: "Carregamento instantâneo em qualquer lugar do mundo." },
                { title: "Mobile First", desc: "Experiência nativa no celular sem precisar baixar nada." },
                { title: "Segurança Bancária", desc: "Seus dados protegidos com criptografia de ponta a ponta." }
              ].map((item, i) => (
                <div key={i} className="flex gap-4 p-6 rounded-2xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.05] transition-colors">
                  <div className="w-10 h-10 rounded-xl bg-gold/10 flex items-center justify-center text-gold shrink-0">
                    <Check size={20} />
                  </div>
                  <div>
                    <h4 className="text-lg font-black uppercase italic tracking-tight text-white mb-1">{item.title}</h4>
                    <p className="text-slate-400 text-sm">{item.desc}</p>
                  </div>
                </div>
              ))}
            </motion.div>
          </div>
        </div>

        {/* Separator Image with Blended Background (Tradição & Futuro) */}
        <div className="mt-24 w-full rounded-[3rem] overflow-hidden relative border border-white/5 shadow-2xl">
          <div className="grid grid-cols-1 md:grid-cols-2 min-h-[400px]">
            <div className="relative h-full overflow-hidden border-r border-white/5">
              <img 
                src="https://images.unsplash.com/photo-1593702275677-f916c8c96045?q=80&w=2000&auto=format&fit=crop" 
                alt="Instrumentos tradicionais de barbearia integrados a dispositivos digitais."
                className="w-full h-full object-cover opacity-40 mix-blend-luminosity"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-black via-transparent to-black/80" />
            </div>
            <div className="relative h-full overflow-hidden">
              <img 
                src="https://images.unsplash.com/photo-1512690196236-d44d3204003d?q=80&w=2000&auto=format&fit=crop" 
                alt="Tecnologia na barbearia"
                className="w-full h-full object-cover opacity-30 mix-blend-luminosity"
              />
              <div className="absolute inset-0 bg-gradient-to-l from-black via-transparent to-black/80" />
            </div>
          </div>
          
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px]" />
          
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-center space-y-4 px-6 z-10">
              <span className="text-gold font-black uppercase tracking-[0.4em] text-[10px]">Elegância & Precisão</span>
              <h3 className="text-3xl md:text-5xl font-black uppercase italic tracking-tighter text-white">Onde a tradição encontra o futuro</h3>
            </div>
          </div>
        </div>
      </section>

      {/* Separador Visual Premium */}
      <section className="py-24 bg-black overflow-hidden">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid md:grid-cols-2 gap-6 h-[400px]">
             <LandingImage 
               src="https://images.unsplash.com/photo-1590540179852-2110a54f813a?q=80&w=1000&auto=format&fit=crop" 
               alt="Ferramentas de barbearia clássica" 
               className="h-full"
             />
             <LandingImage 
               src="https://images.unsplash.com/photo-1585747860715-2ba37e788b70?q=80&w=1000&auto=format&fit=crop" 
               alt="Barbeiro atendendo cliente com foco" 
               className="h-full"
             />
          </div>
        </div>
      </section>

      {/* Imagem 02: Tradição e cuidado */}
      <section className="py-32 bg-zinc-950/50 relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 grid md:grid-cols-2 gap-20 items-center">
          <div className="space-y-8">
            <div className="space-y-4">
              <span className="text-gold font-black uppercase tracking-[0.4em] text-[10px]">Sobre Nós</span>
              <h2 className="text-4xl md:text-6xl font-black uppercase italic tracking-tighter text-white">
                Tradição e cuidado <br /> em cada detalhe
              </h2>
            </div>
            <p className="text-slate-400 text-lg leading-relaxed">
              Elevamos o padrão da sua barbearia unindo a precisão da barbearia clássica com a inteligência da gestão moderna Enterprise.
            </p>
            
            {/* Cards de profissionais/serviços/produtos */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
                <div className="text-gold font-black text-xl">12+</div>
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">Profissionais</div>
              </div>
              <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
                <div className="text-gold font-black text-xl">450+</div>
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">Agendamentos/mês</div>
              </div>
            </div>
          </div>
          
          <div className="relative group">
            <LandingImage 
              src="https://images.unsplash.com/photo-1503951914875-452162b0f3f1?q=80&w=2000&auto=format&fit=crop"
              alt="Barbeiro realizando acabamento cuidadoso na barba de um cliente."
              aspectRatio="portrait"
              className="border-gold/10 shadow-2xl"
            />
            <div className="absolute top-8 right-8">
              <div className="bg-gold text-black font-black uppercase tracking-widest text-[9px] px-3 py-1 rounded-full shadow-lg">
                Experiência Premium
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA 1 - Antecipando Recursos */}
      <CTASection
        title="Experiência Multi-Perfil"
        description="Gestão sob medida para cada papel: Administrador, Recepção, Profissional e Cliente."
        backgroundImage="https://images.unsplash.com/photo-1599351431202-180f0b485ff8?q=80&w=2000&auto=format&fit=crop"
        align="left"
      >
        <div className="flex flex-wrap gap-3">
          {["Admin", "Recepção", "Profissional", "Cliente"].map(role => (
            <span key={role} className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-widest text-gold backdrop-blur-sm">
              {role}
            </span>
          ))}
        </div>
      </CTASection>
    

      {/* CTA 1 */}
      <CTASection
        title="Menos tarefas manuais. Mais tempo para atender e crescer."
        backgroundImage="https://images.unsplash.com/photo-1585747860715-2ba37e788b70?q=80&w=2000&auto=format&fit=crop"
      >
        <Button className="h-14 px-8 rounded-2xl bg-gold text-black font-black uppercase tracking-widest hover:bg-gold/90" onClick={() => setShowRegisterWizard(true)}>
          Começar teste grátis
        </Button>
      </CTASection>


      {/* CTA 2 - Antes dos Planos */}
      <CTASection
        title="Gestão de Profissionais"
        description="Controle de agenda individual, comissões automáticas, metas e avaliações por profissional."
        backgroundImage="https://images.unsplash.com/photo-1590540179852-2110a54f813a?q=80&w=2000&auto=format&fit=crop"
        align="left"
      >
        <Button className="h-14 px-8 rounded-2xl bg-gold text-black font-black uppercase tracking-widest hover:bg-gold/90" onClick={() => setShowRegisterWizard(true)}>
          Ver recursos para equipe
        </Button>
      </CTASection>

      {/* Imagem 03: Financeiro & BI */}
      <section className="py-32 px-6 bg-black relative">
        <div className="max-w-7xl mx-auto grid md:grid-cols-2 gap-20 items-center">
          <div className="space-y-8">
            <span className="text-gold font-black uppercase tracking-[0.4em] text-[10px]">Financeiro & BI</span>
            <h2 className="text-4xl md:text-6xl font-black uppercase italic tracking-tighter text-white leading-none">
              Dados reais para decisões inteligentes
            </h2>
            <p className="text-slate-400 text-lg">
              Fluxo de caixa, DRE gerencial, indicadores de ticket médio e recorrência. Saiba exatamente quanto sua barbearia lucra, sem planilhas complexas.
            </p>
            <div className="flex flex-wrap gap-4 pt-4">
              <Button className="h-14 px-8 rounded-2xl bg-gold text-black font-black uppercase tracking-widest hover:bg-gold/90" onClick={() => setShowRegisterWizard(true)}>
                Testar Financeiro
              </Button>
            </div>
          </div>
          <div className="relative group">
            <div className="relative rounded-[2.5rem] border border-gold/20 bg-zinc-950 overflow-hidden shadow-2xl p-6">
              <div className="grid grid-cols-2 gap-4 mb-6">
                {[
                  { label: "Receita Mensal", val: "R$ 42.850", icon: TrendingUp, color: "text-green-400" },
                  { label: "Ticket Médio", val: "R$ 85,00", icon: Target, color: "text-blue-400" },
                  { label: "Crescimento", val: "+15%", icon: Activity, color: "text-gold" },
                  { label: "Assinaturas", val: "128 ativas", icon: ShoppingBag, color: "text-purple-400" }
                ].map((stat, i) => (
                  <div key={i} className="bg-white/[0.03] border border-white/5 p-4 rounded-2xl backdrop-blur-sm">
                    <div className="flex justify-between items-start mb-2">
                       <stat.icon size={16} className={stat.color} />
                       <span className="text-[8px] font-black text-green-500 uppercase tracking-tighter">+12%</span>
                    </div>
                    <div className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1">{stat.label}</div>
                    <div className="text-lg font-black text-white italic">{stat.val}</div>
                  </div>
                ))}
              </div>
              
              <div className="rounded-2xl bg-white/[0.02] border border-white/5 p-6 space-y-4">
                 <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-white italic">
                    <span>Fluxo de Caixa Mensal</span>
                    <BarChart3 size={14} className="text-gold" />
                 </div>
                 <div className="h-32 w-full flex items-end gap-2">
                    {[40, 60, 45, 90, 75, 85, 100].map((h, i) => (
                      <div key={i} className="flex-1 bg-gold/20 hover:bg-gold transition-colors rounded-t-lg" style={{ height: `${h}%` }} />
                    ))}
                 </div>
              </div>
            </div>

            <div className="absolute -bottom-6 -right-6 hidden md:block animate-bounce-slow">
              <div className="bg-black/80 backdrop-blur-md border border-gold/20 p-4 rounded-2xl shadow-2xl">
                <div className="flex items-center gap-3">
                  <BarChart3 size={16} className="text-gold" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-white italic">Dashboard Financeiro Barbex</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA 4 - Loja e Automações */}
      <CTASection
        title="Loja Virtual & Automações WhatsApp"
        description="Venda produtos 24h por dia e deixe que o Barbex lembre seus clientes de agendar através de lembretes automáticos."
        backgroundImage="https://images.unsplash.com/photo-1512690196236-d44d3204003d?q=80&w=2000&auto=format&fit=crop"
      >
        <Button className="h-14 px-8 rounded-2xl bg-gold text-black font-black uppercase tracking-widest hover:bg-gold/90" onClick={() => setShowRegisterWizard(true)}>
          Automatizar minha barbearia
        </Button>
      </CTASection>

      {/* LGPD */}
      <PrivacyAndLGPDSection />

      {/* FAQ Final */}
      <PortalFaq />

      {/* Botão Voltar ao Topo */}
      <ScrollToTopButton />

      {/* Final CTA: Imagem 04 */}
      <CTASection
        title="Sua barbearia pode operar em outro nível"
        description="Comece seu teste gratuito e centralize toda a gestão da sua barbearia em uma única plataforma."
        backgroundImage="https://images.unsplash.com/photo-1503951914875-452162b0f3f1?q=80&w=2000&auto=format&fit=crop"
        className="py-48"
      >
        <div className="w-full space-y-12">
          <div className="flex flex-col sm:flex-row gap-6 justify-center">
            <Button 
              className="h-16 px-12 rounded-2xl bg-gold text-black font-black uppercase tracking-widest hover:bg-gold/90 text-sm shadow-[0_20px_40px_-10px_rgba(212,175,55,0.4)]" 
              onClick={() => setShowRegisterWizard(true)}
            >
              Começar teste grátis
            </Button>
            <Button 
              variant="outline" 
              className="h-16 px-12 rounded-2xl border-white/20 bg-white/5 backdrop-blur-sm hover:bg-white/10 font-black uppercase tracking-widest text-sm text-white" 
              asChild
            >
              <Link to="/auth" search={{ tab: "login" }}>Entrar no Sistema</Link>
            </Button>
          </div>
          
          <div className="flex flex-wrap justify-center gap-x-12 gap-y-4 text-[10px] font-black uppercase tracking-[0.3em] text-slate-300">
            <div className="flex items-center gap-2"><CheckCircle2 size={14} className="text-gold" /> 15 dias grátis</div>
            <div className="flex items-center gap-2"><CheckCircle2 size={14} className="text-gold" /> Sem cartão de crédito</div>
            <div className="flex items-center gap-2"><CheckCircle2 size={14} className="text-gold" /> Cancele quando quiser</div>
          </div>
        </div>
      </CTASection>

      {/* Footer Final */}
      <footer className="py-24 px-6 border-t border-white/5 bg-black">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-16">
            <div className="space-y-6">
              <BarbexLogo size="md" />
              <p className="text-slate-500 text-[11px] leading-relaxed max-w-xs uppercase tracking-widest font-bold">
                A plataforma completa de gestão, fidelização e inteligência para barbearias de alto nível.
              </p>
            </div>
            <div>
              <h6 className="text-white font-black uppercase tracking-widest text-xs mb-6">Produto</h6>
              <ul className="space-y-4 text-[10px] font-black uppercase tracking-widest text-slate-500">
                <li><a href="#solucoes" className="hover:text-gold transition-colors">Recursos</a></li>
                <li><a href="#planos" className="hover:text-gold transition-colors">Planos</a></li>
                <li><Link to="/updates" className="hover:text-gold transition-colors">Novidades</Link></li>
              </ul>
            </div>
            <div>
              <h6 className="text-white font-black uppercase tracking-widest text-xs mb-6">Suporte</h6>
              <ul className="space-y-4 text-[10px] font-black uppercase tracking-widest text-slate-500">
                <li><Link to="/tutorials" className="hover:text-gold transition-colors">Central de Ajuda</Link></li>
                <li><Link to="/academy" className="hover:text-gold transition-colors">Academia Barbex</Link></li>
                <li><a href="#faq" className="hover:text-gold transition-colors">FAQ</a></li>
              </ul>
            </div>
            <div>
              <h6 className="text-white font-black uppercase tracking-widest text-xs mb-6">Legal</h6>
              <ul className="space-y-4 text-[10px] font-black uppercase tracking-widest text-slate-500">
                <li><Link to="/terms" className="hover:text-gold transition-colors">Termos de Uso</Link></li>
                <li><Link to="/privacy" className="hover:text-gold transition-colors">Privacidade</Link></li>
              </ul>
            </div>
          </div>
          <div className="pt-12 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="text-slate-600 text-[10px] font-black uppercase tracking-widest">
              © {new Date().getFullYear()} BARBEX ENTERPRISE. TODOS OS DIREITOS RESERVADOS.
            </div>
            <div className="flex gap-6">
              {[Instagram, Facebook, Twitter, Youtube].map((Icon, idx) => (
                <a key={idx} href="#" className="text-slate-600 hover:text-gold transition-colors">
                  <Icon size={18} />
                </a>
              ))}
            </div>
          </div>
        </div>
      </footer>

      {showRegisterWizard && (
        <RegisterWizard onClose={() => setShowRegisterWizard(false)} />
      )}
    </div>
  );
}

export const Route = createFileRoute("/")({
  component: LandingPage,
  head: () => ({
    title: "Barbex | Gestão Premium para Barbearias Enterprise",
    meta: [
      { name: "description", content: "O ecossistema completo para elevar o nível da sua barbearia. Agenda inteligente, CRM 360°, Financeiro & BI e Automações WhatsApp." },
      { property: "og:title", content: "Barbex | Gestão Premium para Barbearias Enterprise" },
      { property: "og:description", content: "Transforme sua barbearia em um negócio de alto nível com tecnologia de ponta." },
      { name: "twitter:card", content: "summary_large_image" }
    ]
  })
});
