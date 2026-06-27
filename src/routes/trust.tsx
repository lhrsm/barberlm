import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ShieldCheck, Lock, Accessibility, Activity, Cookie, FileText, Scale,
  Building2, HelpCircle, ArrowUpRight, Scissors, ArrowLeft,
} from "lucide-react";
import { ManageCookiesLink } from "@/components/CookieBanner";

export const Route = createFileRoute("/trust")({
  head: () => ({
    meta: [
      { title: "Central de Confiança — Barbex" },
      { name: "description", content: "Transparência, segurança e privacidade fazem parte do Barbex. Tudo sobre LGPD, segurança, acessibilidade, cookies, status e subprocessadores." },
      { property: "og:title", content: "Central de Confiança — Barbex" },
      { property: "og:description", content: "Privacidade, segurança e acessibilidade em primeiro lugar." },
    ],
  }),
  component: TrustCenter,
});

const CARDS = [
  { icon: Scale, title: "LGPD", desc: "Bases legais, direitos do titular e como exercer seus direitos.", to: "/lgpd", tag: "Conformidade" },
  { icon: FileText, title: "Política de Privacidade", desc: "Quais dados coletamos, finalidade, retenção e compartilhamento.", to: "/privacy", tag: "Privacidade" },
  { icon: FileText, title: "Termos de Uso", desc: "Regras de uso da plataforma para barbearias e clientes.", to: "/terms", tag: "Legal" },
  { icon: Cookie, title: "Cookies", desc: "Categorias, finalidades e como gerenciar suas preferências.", to: "/cookies", tag: "Privacidade" },
  { icon: Lock, title: "Segurança", desc: "Criptografia, autenticação, controles de acesso e boas práticas.", to: "/security", tag: "Infra" },
  { icon: Accessibility, title: "Acessibilidade", desc: "Recursos WCAG 2.2 AA disponíveis para pessoas com deficiência.", to: "/accessibility", tag: "Inclusão" },
  { icon: Activity, title: "Status da Plataforma", desc: "Disponibilidade em tempo real de serviços, APIs e integrações.", to: "/status", tag: "Operação" },
  { icon: Building2, title: "Subprocessadores", desc: "Serviços terceiros utilizados pela plataforma e suas finalidades.", to: "/subprocessors", tag: "Transparência" },
  { icon: HelpCircle, title: "FAQ de Privacidade", desc: "Respostas rápidas para as dúvidas mais comuns sobre seus dados.", to: "/privacy-faq", tag: "Ajuda" },
] as const;

function TrustCenter() {
  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="border-b border-white/5 bg-black/60 backdrop-blur-xl sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <Scissors className="h-6 w-6 text-primary" />
            <span className="font-black text-lg tracking-tight">Barbex</span>
          </Link>
          <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-white/70 hover:text-primary">
            <ArrowLeft className="h-4 w-4" /> Voltar ao site
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(245,197,66,.12),transparent_60%)]" />
        <div className="relative max-w-5xl mx-auto px-6 py-20 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/40 bg-primary/10 text-primary text-xs font-bold uppercase tracking-widest mb-6">
            <ShieldCheck className="h-3.5 w-3.5" /> Trust Center
          </div>
          <h1 className="text-4xl md:text-6xl font-black tracking-tighter">
            Central de <span className="bg-gradient-to-r from-primary to-amber-300 bg-clip-text text-transparent">Confiança</span>
          </h1>
          <p className="mt-5 text-lg text-white/65 max-w-2xl mx-auto">
            Transparência, segurança e privacidade fazem parte do Barbex. Aqui reunimos
            tudo o que você precisa saber sobre como protegemos seus dados e operamos a plataforma.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link to="/status" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-sm font-bold hover:bg-emerald-500/25">
              <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" /><span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" /></span>
              Status em tempo real
            </Link>
            <ManageCookiesLink className="px-5 py-2.5 rounded-full border border-primary/40 bg-primary/10 text-primary text-sm font-bold hover:bg-primary/20" />
          </div>
        </div>
      </section>

      {/* Cards */}
      <section className="px-6 pb-24">
        <div className="max-w-7xl mx-auto grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {CARDS.map((c) => (
            <Link
              key={c.title}
              to={c.to}
              className="group relative rounded-2xl p-6 bg-gradient-to-br from-[#0A0A0C] to-[#0F1115] border border-primary/20 hover:border-primary/60 transition-all hover:-translate-y-1 hover:shadow-[0_20px_60px_-20px_rgba(245,197,66,.35)]"
            >
              <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none bg-[radial-gradient(circle_at_top,rgba(245,197,66,.12),transparent_60%)]" />
              <div className="relative">
                <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-primary/25 to-transparent border border-primary/40 flex items-center justify-center mb-4">
                  <c.icon className="h-6 w-6 text-primary" aria-hidden="true" />
                </div>
                <span className="inline-block text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-white/60 uppercase tracking-wider mb-2">
                  {c.tag}
                </span>
                <h3 className="text-lg font-black mb-1.5">{c.title}</h3>
                <p className="text-sm text-white/55 leading-relaxed">{c.desc}</p>
                <span className="inline-flex items-center gap-1 mt-4 text-primary text-sm font-bold">
                  Acessar <ArrowUpRight className="h-4 w-4" />
                </span>
              </div>
            </Link>
          ))}
        </div>

        <div className="max-w-3xl mx-auto mt-16 rounded-2xl border border-white/10 bg-white/[0.02] p-6 text-center">
          <p className="text-sm text-white/60">
            Tem dúvidas específicas sobre privacidade ou segurança? Fale com nosso encarregado de dados (DPO):
          </p>
          <a href="mailto:privacidade@barbex.shop" className="inline-block mt-2 text-primary font-bold">
            privacidade@barbex.shop
          </a>
        </div>
      </section>
    </div>
  );
}
