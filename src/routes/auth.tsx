import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AuthForm } from "@/components/auth/AuthForm";
import { ClientLoginForm } from "@/components/public/auth/ClientLoginForm";
import { BookingAuthStep } from "@/components/public/booking/BookingAuthStep";
import { useState } from "react";
import { motion } from "framer-motion";
import { 
  CheckCircle2, 
  ShieldCheck, 
  ChevronLeft,
  Sparkles,
  Calendar,
  Users,
  MessageSquare,
  BarChart3,
  Award,
  Zap
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
  component: AuthPageComponent,
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

function AuthPageComponent() {
  const navigate = useNavigate();
  const { tab, redirect } = Route.useSearch();
  const [migrationData, setMigrationData] = useState<{ userId: string; phone: string | null } | null>(null);

  const isClientPortal = tab === "client";
  
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
          onClick={() => navigate({ to: "/" })}
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

          {/* Social Proof Placeholder - Discreto */}
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

      {/* Right Section: Login Card */}
      <motion.div 
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        className="relative z-20 w-full md:w-[40%] min-w-[320px] max-w-full md:max-w-[550px] flex items-center justify-center p-6 md:p-12"
      >
        <div className="w-full max-w-[430px] md:max-w-[480px]">
          {/* Main Card */}
          <div className="relative group">
            {/* Glow Effect */}
            <div className="absolute -inset-1 bg-gradient-to-b from-gold/20 to-transparent rounded-[32px] blur-2xl opacity-20 group-hover:opacity-30 transition-opacity duration-500" />
            
            <div className={`relative ${isClientPortal ? 'bg-white' : 'bg-[#0d0f14]/80 backdrop-blur-xl border border-white/5'} rounded-[32px] shadow-2xl overflow-hidden p-8 md:p-10`}>
              <div className="text-center space-y-3 mb-10">
                <h2 className={`text-2xl md:text-3xl font-black ${isClientPortal ? 'text-zinc-900' : 'text-white'} tracking-tighter uppercase italic leading-none`}>
                  {isClientPortal ? 'PORTAL DO' : 'BEM-VINDO AO'} <span className="text-gold">{isClientPortal ? 'CLIENTE' : 'BARBEX'}</span>
                </h2>
                <p className={`${isClientPortal ? 'text-zinc-400' : 'text-zinc-500'} text-[10px] font-black uppercase tracking-[0.2em] leading-relaxed max-w-[240px] mx-auto`}>
                  {isClientPortal ? 'Gerencie seus agendamentos e cashback em um só lugar.' : 'Acesse sua barbearia e gerencie sua operação de qualquer lugar.'}
                </p>
              </div>

              {isClientPortal ? (
                <div className="space-y-6">
                  {!migrationData ? (
                    <ClientLoginForm onMigrationRequired={(data) => setMigrationData(data)} />
                  ) : (
                    <BookingAuthStep
                      customerName="Cliente Barbex"
                      customerPhone={migrationData.phone || ""}
                      customerId={null}
                      tenantId=""
                      onSuccess={() => window.location.reload()}
                      onBack={() => setMigrationData(null)}
                    />
                  )}
                  <div className="text-center pt-4">
                    <Button 
                      variant="link" 
                      onClick={() => navigate({ to: '/auth', search: { tab: undefined } })}
                      className="text-zinc-400 hover:text-gold text-[10px] font-black uppercase tracking-widest"
                    >
                      Acesso Administrativo
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <AuthForm />
                  <div className="text-center pt-6">
                    <Button 
                      variant="link" 
                      onClick={() => navigate({ to: '/auth', search: { tab: 'client' } })}
                      className="text-zinc-500 hover:text-gold text-[10px] font-black uppercase tracking-widest"
                    >
                      Acesso para Clientes
                    </Button>
                  </div>
                </>
              )}

              {/* Commercial Info / Badges */}
              <div className={`mt-8 pt-8 border-t ${isClientPortal ? 'border-zinc-100' : 'border-white/5'} grid grid-cols-2 gap-4`}>
                {[
                  { text: isClientPortal ? "Check-in Rápido" : "15 dias grátis" },
                  { text: isClientPortal ? "Histórico 360°" : "Sem cartão" },
                  { text: isClientPortal ? "Cashback Ativo" : "Config. Rápida" },
                  { text: isClientPortal ? "Agenda 24h" : "Suporte VIP" }
                ].map((info, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <CheckCircle2 size={12} className="text-gold/60" />
                    <span className={`text-[9px] font-bold ${isClientPortal ? 'text-zinc-400' : 'text-zinc-500'} uppercase tracking-widest`}>{info.text}</span>
                  </div>
                ))}
              </div>

              {/* Security Footer */}
              <div className="mt-10 flex flex-col items-center text-center space-y-2 opacity-50">
                <div className={`flex items-center gap-2 text-[10px] font-black ${isClientPortal ? 'text-zinc-900' : 'text-white'} uppercase tracking-widest`}>
                  <ShieldCheck size={14} className="text-gold" />
                  Ambiente Seguro
                </div>
                <p className={`text-[8px] font-medium ${isClientPortal ? 'text-zinc-500' : 'text-zinc-500'} leading-relaxed max-w-[200px]`}>
                  Seus dados são protegidos por autenticação e controles de segurança avançados.
                </p>
              </div>
            </div>
          </div>
          
          <p className="mt-8 text-center text-zinc-600 text-[9px] font-black uppercase tracking-[0.3em] italic">
            &copy; 2026 BARBEX ENTERPRISE &bull; V1.8.4
          </p>
        </div>
      </motion.div>
    </div>
  );
}
