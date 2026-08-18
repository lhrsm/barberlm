import { createFileRoute, useNavigate, Outlet } from "@tanstack/react-router";
import { useState } from "react";
import { motion } from "framer-motion";
import { 
  CheckCircle2, 
  ShieldCheck, 
  ChevronLeft,
  Sparkles,
  Calendar,
  Award,
  Zap,
  MessageSquare
} from "lucide-react";
import { BarbexLogo } from "@/components/ui/barbex-logo";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/auth")({
  validateSearch: (search: Record<string, unknown>): { tab?: string; redirect?: string } => {
    return {
      tab: (search.tab as string) || undefined,
      redirect: (search.redirect as string) || undefined,
    };
  },
  component: AuthLayoutComponent,
  head: () => ({
    title: "Barbex — Autenticação Premium",
    meta: [
      { 
        name: "description", 
        content: "Acesse a gestão completa ou o portal do cliente. Barbex Enterprise." 
      },
      { property: "og:title", content: "Barbex - Login" },
      { property: "og:type", content: "website" },
    ],
  }),
});

function AuthLayoutComponent() {
  const navigate = useNavigate();
  
  const benefits = [
    { icon: Calendar, text: "Mais agendamentos online" },
    { icon: Zap, text: "Gestão completa da barbearia" },
    { icon: MessageSquare, text: "Integração com WhatsApp" },
    { icon: Award, text: "Fidelidade e relacionamento" },
    { icon: ShieldCheck, text: "LGPD e Segurança Enterprise" }
  ];

  return (
    <div className="min-h-screen w-full flex flex-col md:flex-row bg-[#05070d] overflow-hidden relative selection:bg-gold selection:text-black font-sora">
      {/* Voltar Button */}
      <div className="absolute top-6 left-6 z-50">
        <Button 
          variant="ghost" 
          size="sm"
          onClick={() => window.history.back()}
          className="text-white/60 hover:text-gold transition-colors gap-2 font-bold uppercase tracking-widest text-[10px]"
        >
          <ChevronLeft size={16} />
          Voltar
        </Button>
      </div>

      {/* Plataforma Premium Badge */}
      <div className="absolute top-6 right-6 z-50 hidden md:block">
        <div className="px-3 py-1.5 rounded-full border border-gold/20 bg-gold/5 backdrop-blur-md">
          <span className="text-[9px] font-black text-gold uppercase tracking-[0.2em] flex items-center gap-2">
            <Sparkles size={12} />
            Plataforma Premium
          </span>
        </div>
      </div>

      {/* Background with Image and Overlays */}
      <div className="absolute inset-0 z-0 hidden md:block w-[60%]">
        <img 
          src="https://images.unsplash.com/photo-1503951914875-452162b0f3f1?q=80&w=2070&auto=format&fit=crop" 
          alt="Barbershop" 
          className="w-full h-full object-cover opacity-30 mix-blend-luminosity grayscale"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#05070d]/60 via-[#05070d]/90 to-[#05070d]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_30%,rgba(212,175,55,0.1),transparent_50%)]" />
      </div>

      {/* Left Section: Institutional Content */}
      <motion.div 
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        className="relative z-10 w-full md:w-[60%] flex flex-col justify-center px-8 md:px-24 py-20 md:py-0"
      >
        <div className="mb-12 mt-4 md:mt-0">
          <div className="w-[120px] sm:w-[150px] md:w-[200px] h-auto flex items-center justify-start overflow-visible">
            <BarbexLogo size="lg" showText={false} className="h-full w-full object-contain" />
          </div>
        </div>

        <div className="max-w-xl space-y-8">
          <div className="space-y-4">
            <h1 className="text-4xl md:text-7xl font-black uppercase italic tracking-tighter leading-[0.9] text-white">
              A GESTÃO COMPLETA <br />
              PARA <span className="text-gold relative inline-block">
                BARBEARIAS MODERNAS
                <div className="absolute -bottom-2 left-0 w-full h-1 bg-gold/30 rounded-full blur-[2px]" />
              </span>
            </h1>
            <p className="text-zinc-400 text-base md:text-xl font-medium leading-relaxed max-w-lg">
              Agendamentos, clientes, automações, financeiro e fidelidade em um só lugar. Eleve o padrão da sua gestão.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-8 pt-4">
            {benefits.map((benefit, idx) => (
              <div key={idx} className="flex items-center gap-3 group">
                <div className="h-6 w-6 rounded-full bg-gold/10 border border-gold/20 flex items-center justify-center shrink-0 group-hover:bg-gold/20 transition-colors">
                  <CheckCircle2 size={14} className="text-gold" />
                </div>
                <span className="text-[11px] font-black uppercase tracking-widest text-zinc-300">{benefit.text}</span>
              </div>
            ))}
          </div>

          {/* Social Proof Placeholder */}
          <div className="pt-12 hidden lg:block">
            <div className="p-6 rounded-3xl bg-white/[0.02] border border-white/5 backdrop-blur-sm max-w-sm">
              <div className="flex gap-1 mb-3">
                {[1, 2, 3, 4, 5].map(s => <Sparkles key={s} size={12} className="text-gold" />)}
              </div>
              <p className="text-zinc-400 text-xs italic leading-relaxed mb-4">
                "A Barbex transformou a forma como gerenciamos nossos agendamentos e o relacionamento com nossos clientes VIP."
              </p>
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-gold to-orange-500 flex items-center justify-center text-[10px] font-black text-black">LM</div>
                <div>
                  <div className="text-[10px] font-black text-white uppercase tracking-widest">Louis Menezes</div>
                  <div className="text-[8px] font-bold text-zinc-500 uppercase tracking-[0.2em]">Barbearia Premium</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Right Section: Content Area (Outlet) */}
      <div className="relative z-20 w-full md:w-[40%] flex items-center justify-center">
        <Outlet />
      </div>
    </div>
  );
}
