import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Scissors, Calendar, BarChart3, Users, MessageSquare, Zap, ShieldCheck, ChevronRight, CheckCircle2, Star, Clock } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

function LandingPage() {
  return (
    <div className="min-h-screen bg-[#05070d] text-white">
      {/* Header */}
      <header className="fixed top-0 w-full z-50 bg-[#05070d]/80 backdrop-blur-md border-b border-gold/10">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="text-2xl font-black tracking-tighter">BARBEX</div>
          <nav className="hidden md:flex gap-8 text-[11px] font-black uppercase tracking-widest text-slate-400">
            <a href="#recursos" className="hover:text-gold transition-colors">Recursos</a>
            <a href="#planos" className="hover:text-gold transition-colors">Planos</a>
            <a href="#faq" className="hover:text-gold transition-colors">FAQ</a>
          </nav>
          <div className="flex gap-4">
            <Button variant="ghost" className="text-xs font-black uppercase tracking-widest text-slate-400 hover:text-white" asChild>
              <Link to="/auth">Entrar</Link>
            </Button>
            <Button className="bg-gold text-black font-black uppercase tracking-widest text-xs h-10 px-6 rounded-xl hover:bg-gold/90" asChild>
              <Link to="/auth" search={{ tab: "register" }}>Testar Grátis</Link>
            </Button>
          </div>
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
