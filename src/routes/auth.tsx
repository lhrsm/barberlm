import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { AuthForm } from "@/components/auth/AuthForm";
import { useAuth } from "@/hooks/use-auth";
import { useEffect, useState } from "react";
import { ArrowLeft, CheckCircle2, Lock, Star, ShieldCheck, MessageCircle, Calendar, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";

export const Route = createFileRoute("/auth")({
  component: AuthPageComponent,
  head: () => ({
    meta: [
      { title: "Entrar no Barbex — Acesse sua barbearia" },
      {
        name: "description",
        content:
          "Acesse o painel da sua barbearia no Barbex para gerenciar agenda, clientes, assinaturas e financeiro.",
      },
      { property: "og:title", content: "Entrar no Barbex" },
      {
        property: "og:description",
        content: "Login do painel de gestão da sua barbearia.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://barbex.shop/auth" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "https://barbex.shop/auth" }],
  }),
});


const TESTIMONIALS = [
  {
    quote: "Organizamos completamente nossa agenda com o Barbex. Triplicamos os agendamentos no primeiro mês.",
    name: "Carlos Oliveira",
    role: "Barbearia Premium",
  },
  {
    quote: "A integração com WhatsApp acabou com as faltas. Recomendo para qualquer barbearia séria.",
    name: "Rafael Mendes",
    role: "LM Cuts Studio",
  },
  {
    quote: "Em uma semana implantamos assinaturas e fidelidade. Plataforma simplesmente completa.",
    name: "Diego Almeida",
    role: "Casa do Barbeiro",
  },
];

function AuthPageComponent() {
  const { user, loading, role } = useAuth();
  const navigate = useNavigate();
  const [hydrated, setHydrated] = useState(false);
  const [testimonialIdx, setTestimonialIdx] = useState(0);

  useEffect(() => {
    setHydrated(true);
  }, []);

  useEffect(() => {
    const id = setInterval(() => setTestimonialIdx((i) => (i + 1) % TESTIMONIALS.length), 6000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!hydrated || loading || !user) return;
    if (role === undefined) return;
    const destination =
      role === "super_admin" ? "/admin/dashboard" :
      role === "barber" ? "/calendar" : "/dashboard" as any;
    navigate({ to: destination, replace: true });
  }, [hydrated, user, loading, role, navigate]);

  const currentTestimonial = TESTIMONIALS[testimonialIdx];

  return (
    <div className="min-h-screen w-full relative overflow-hidden bg-[#050b18] text-white">
      {/* Background image + overlay */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{
          backgroundImage:
            "url('https://images.unsplash.com/photo-1585747860715-2ba37e788b70?auto=format&fit=crop&w=2000&q=80')",
          filter: "blur(2px)",
        }}
        aria-hidden
      />
      <div className="absolute inset-0 bg-[rgba(5,11,24,0.82)]" aria-hidden />
      <div
        className="absolute inset-0 opacity-40 pointer-events-none"
        style={{
          background:
            "radial-gradient(circle at 15% 20%, rgba(245,158,11,0.25), transparent 45%), radial-gradient(circle at 85% 80%, rgba(217,119,6,0.18), transparent 50%)",
        }}
        aria-hidden
      />

      {/* Back button */}
      <div className="absolute top-6 left-6 z-20">
        <Button
          variant="ghost"
          asChild
          className="gap-2 text-white/80 hover:text-white hover:bg-white/10 backdrop-blur-sm rounded-full px-4"
        >
          <Link to="/">
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Link>
        </Button>
      </div>

      <div className="relative z-10 min-h-screen grid lg:grid-cols-[45fr_55fr]">
        {/* LEFT — Brand side (desktop only) */}
        <motion.aside
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="hidden lg:flex flex-col justify-between p-12 xl:p-16 relative"
        >
          <div>
            <h1 className="text-4xl font-black tracking-tight">
              <span className="text-[#F59E0B]">Barbe</span>
              <span className="text-white">X</span>
            </h1>
          </div>

          <div className="space-y-8 max-w-md">
            <div>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#F59E0B]/15 text-[#F59E0B] text-[10px] font-black uppercase tracking-[0.25em] border border-[#F59E0B]/30">
                <Sparkles size={12} /> Plataforma Premium
              </span>
              <h2 className="mt-5 text-4xl xl:text-5xl font-black leading-[1.05] tracking-tight">
                A plataforma completa para{" "}
                <span className="bg-gradient-to-r from-[#F59E0B] to-[#D97706] bg-clip-text text-transparent">
                  barbearias modernas
                </span>
              </h2>
              <p className="mt-4 text-white/70 text-base xl:text-lg leading-relaxed">
                Agendamentos, clientes, automações, fidelidade, assinaturas, loja online e muito mais — em um só lugar.
              </p>
            </div>

            <ul className="space-y-3">
              {[
                { icon: Calendar, text: "Mais de 50.000 agendamentos realizados" },
                { icon: ShieldCheck, text: "Gestão completa do seu negócio" },
                { icon: MessageCircle, text: "Integração com WhatsApp" },
                { icon: Sparkles, text: "Fidelidade e Assinaturas" },
              ].map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-center gap-3 text-white/85">
                  <span className="h-9 w-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-[#F59E0B] shrink-0">
                    <Icon size={16} />
                  </span>
                  <span className="text-sm xl:text-[15px] font-medium">{text}</span>
                </li>
              ))}
            </ul>

            {/* Testimonial */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-sm p-5 xl:p-6 min-h-[160px]">
              <AnimatePresence mode="wait">
                <motion.div
                  key={testimonialIdx}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.4 }}
                >
                  <div className="flex gap-0.5 mb-2 text-[#F59E0B]">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} size={14} fill="currentColor" />
                    ))}
                  </div>
                  <p className="text-white/90 text-sm xl:text-[15px] leading-relaxed italic">
                    "{currentTestimonial.quote}"
                  </p>
                  <div className="mt-3 flex items-center gap-3">
                    <div className="h-9 w-9 rounded-full bg-gradient-to-br from-[#F59E0B] to-[#D97706] flex items-center justify-center text-black font-black text-sm">
                      {currentTestimonial.name.charAt(0)}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-white leading-tight">{currentTestimonial.name}</p>
                      <p className="text-[11px] text-white/60">{currentTestimonial.role}</p>
                    </div>
                  </div>
                </motion.div>
              </AnimatePresence>
              <div className="flex gap-1.5 mt-4">
                {TESTIMONIALS.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setTestimonialIdx(i)}
                    className={`h-1.5 rounded-full transition-all ${
                      i === testimonialIdx ? "w-6 bg-[#F59E0B]" : "w-1.5 bg-white/25 hover:bg-white/40"
                    }`}
                    aria-label={`Depoimento ${i + 1}`}
                  />
                ))}
              </div>
            </div>
          </div>

          <p className="text-[11px] text-white/40 font-medium tracking-wide">Barbex © 2026 — Todos os direitos reservados</p>
        </motion.aside>

        {/* RIGHT — Auth card */}
        <motion.main
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut", delay: 0.1 }}
          className="flex items-center justify-center p-6 sm:p-10 lg:p-12"
        >
          <div className="w-full max-w-md">
            {/* Mobile logo */}
            <div className="lg:hidden text-center mb-6">
              <h1 className="text-3xl font-black tracking-tight">
                <span className="text-[#F59E0B]">Barbe</span>
                <span className="text-white">X</span>
              </h1>
              <p className="text-white/60 text-sm mt-1">O sistema definitivo para sua barbearia</p>
            </div>

            <div
              className="rounded-[24px] p-7 sm:p-8 backdrop-blur-xl"
              style={{
                background: "rgba(5,11,24,0.95)",
                border: "1px solid rgba(255,184,0,.15)",
                boxShadow: "0 25px 60px rgba(0,0,0,.35)",
              }}
            >
              <div className="mb-6">
                <h2 className="text-2xl font-black text-white tracking-tight">Bem-vindo ao Barbex</h2>
                <p className="text-white/60 text-sm mt-1.5">
                  Acesse sua barbearia e gerencie seu negócio de qualquer lugar.
                </p>
              </div>

              <AuthForm />

              {/* Benefits */}
              <ul className="grid grid-cols-2 gap-2 mt-6 pt-6 border-t border-white/5">
                {[
                  "15 dias grátis",
                  "Sem cartão de crédito",
                  "Configuração em minutos",
                  "Suporte especializado",
                ].map((b) => (
                  <li key={b} className="flex items-center gap-1.5 text-[11.5px] text-white/70 font-medium">
                    <CheckCircle2 size={12} className="text-[#F59E0B] shrink-0" />
                    {b}
                  </li>
                ))}
              </ul>
            </div>

            {/* Security footer */}
            <div className="mt-5 flex items-start gap-2 px-2 text-white/50">
              <Lock size={13} className="mt-0.5 shrink-0" />
              <div>
                <p className="text-[11px] font-bold text-white/70 leading-tight">Ambiente seguro</p>
                <p className="text-[11px] leading-snug mt-0.5">
                  Seus dados são protegidos por criptografia e autenticação segura.
                </p>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-center gap-4 text-[11px] text-white/40">
              <Link to="/terms" className="hover:text-white/80 transition-colors">Termos de Uso</Link>
              <span className="text-white/20">•</span>
              <Link to="/privacy" className="hover:text-white/80 transition-colors">Política de Privacidade</Link>
            </div>
            <p className="lg:hidden text-center text-[11px] text-white/30 mt-3">Barbex © 2026</p>
          </div>
        </motion.main>
      </div>
    </div>
  );
}
