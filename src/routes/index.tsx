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
  X
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import { PLAN_LIMITS } from "@/hooks/use-plan-limits";

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
            <div className="p-1.5 bg-gold/10 rounded-lg shrink-0">
              <Scissors className="text-gold h-6 w-6" />
            </div>
            <span className="text-xl font-black tracking-tighter">BARBEX</span>
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
          <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="text-5xl md:text-7xl font-black uppercase italic tracking-tighter leading-[0.9]">
            Gestão completa para <span className="text-gold">barbearias</span> que querem crescer
          </motion.h1>
          <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="text-slate-400 text-lg md:text-xl max-w-2xl mx-auto leading-relaxed">
            Agenda, clientes, profissionais, financeiro, loja, assinaturas, automações e inteligência operacional em uma única plataforma Enterprise.
          </motion.p>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="flex gap-4 justify-center pt-4">
            <Button className="h-14 px-8 rounded-2xl bg-gold text-black font-black uppercase tracking-widest hover:bg-gold/90 text-sm" asChild>
              <Link to="/auth" search={{ tab: "register" }}>Começar teste grátis</Link>
            </Button>
            <Button variant="outline" className="h-14 px-8 rounded-2xl border-white/10 bg-transparent hover:bg-white/5 font-black uppercase tracking-widest text-sm" asChild>
              <a href="#recursos">Ver recursos</a>
            </Button>
          </motion.div>
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

      {/* Footer CTA */}
      <section className="py-24 text-center">
        <h3 className="text-3xl font-black uppercase italic tracking-tighter mb-8">Pronto para transformar sua barbearia?</h3>
        <Button className="h-14 px-8 rounded-2xl bg-gold text-black font-black uppercase tracking-widest hover:bg-gold/90" asChild>
          <Link to="/auth" search={{ tab: "register" }}>Começar agora</Link>
        </Button>
      </section>
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
