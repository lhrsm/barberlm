import { createFileRoute, Link } from "@tanstack/react-router";
import { Cookie, ArrowLeft, ShieldCheck, Settings, BarChart3, Megaphone } from "lucide-react";
import { ManageCookiesLink } from "@/components/CookieBanner";

export const Route = createFileRoute("/cookies")({
  head: () => ({
    meta: [
      { title: "Cookies — Barbex" },
      { name: "description", content: "Como o Barbex utiliza cookies e como você pode gerenciar suas preferências." },
    ],
  }),
  component: CookiesPage,
});

const CATS = [
  { icon: ShieldCheck, title: "Necessários", desc: "Mantêm a sessão, autenticação e segurança. Não podem ser desativados.", ttl: "Sessão / até 30 dias" },
  { icon: Settings, title: "Preferências", desc: "Lembram suas escolhas como idioma, tema e layout preferido.", ttl: "Até 1 ano" },
  { icon: BarChart3, title: "Estatísticos", desc: "Coletam métricas anônimas de uso para melhorar o produto.", ttl: "Até 1 ano" },
  { icon: Megaphone, title: "Marketing", desc: "Permitem personalizar ofertas e medir o desempenho de campanhas.", ttl: "Até 1 ano" },
];

function CookiesPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="max-w-4xl mx-auto px-6 py-16">
        <Link to="/trust" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary mb-8">
          <ArrowLeft className="h-4 w-4" /> Central de Confiança
        </Link>
        <header className="mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/15 border border-primary/40 text-primary text-xs font-bold uppercase tracking-wider mb-4">
            <Cookie className="h-3.5 w-3.5" /> Cookies
          </div>
          <h1 className="text-4xl font-black mb-3">Política de Cookies</h1>
          <p className="text-lg text-muted-foreground">
            Utilizamos cookies para melhorar a experiência, oferecer recursos essenciais e analisar o
            desempenho da plataforma. Você pode aceitar todos, recusar os opcionais ou personalizar.
          </p>
        </header>

        <div className="grid sm:grid-cols-2 gap-4 mb-10">
          {CATS.map((c) => (
            <div key={c.title} className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/15 border border-primary/30 flex items-center justify-center shrink-0">
                  <c.icon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-bold">{c.title}</h3>
                  <p className="text-sm text-muted-foreground mt-1">{c.desc}</p>
                  <p className="text-xs text-muted-foreground/70 mt-2">Tempo de armazenamento: {c.ttl}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-2xl border border-primary/30 bg-primary/5 p-6">
          <h2 className="text-xl font-bold mb-2">Como gerenciar</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Você pode alterar suas preferências a qualquer momento. Também é possível desativar cookies
            diretamente pelo navegador (Chrome, Firefox, Safari, Edge).
          </p>
          <ManageCookiesLink className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground font-bold hover:brightness-110" />
        </div>
      </main>
    </div>
  );
}
