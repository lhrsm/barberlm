import { createFileRoute, Link } from "@tanstack/react-router";
import { ShieldCheck, Lock, KeyRound, Database, Server, UserCheck, ArrowLeft, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/security")({
  head: () => ({
    meta: [
      { title: "Segurança — Barbex" },
      { name: "description", content: "Práticas de segurança da informação adotadas pelo Barbex." },
      { property: "og:title", content: "Segurança — Barbex" },
      { property: "og:description", content: "Criptografia, autenticação, controle de acesso e boas práticas." },
    ],
  }),
  component: SecurityPage,
});

const PILLARS = [
  { icon: Lock, title: "Criptografia em trânsito", desc: "Todo o tráfego entre o navegador e nossos servidores trafega via HTTPS/TLS." },
  { icon: KeyRound, title: "Autenticação segura", desc: "Senhas armazenadas com hash seguro e suporte a provedores OAuth confiáveis." },
  { icon: UserCheck, title: "Controle de acesso", desc: "Permissões baseadas em papéis (admin, barbeiro, cliente) com Row Level Security no banco." },
  { icon: Database, title: "Proteção de dados", desc: "Backups periódicos e isolamento por tenant para garantir integridade e privacidade." },
  { icon: Server, title: "Infraestrutura gerenciada", desc: "Hospedagem em provedores de classe mundial com monitoramento contínuo." },
  { icon: ShieldCheck, title: "Boas práticas", desc: "Revisão de código, controle de dependências e atualizações constantes." },
];

function SecurityPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="max-w-5xl mx-auto px-6 py-16">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary mb-8">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Voltar
        </Link>
        <header className="mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/15 border border-primary/40 text-primary text-xs font-bold uppercase tracking-wider mb-4">
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" /> Segurança da Informação
          </div>
          <h1 className="text-4xl font-black mb-4">Segurança</h1>
          <p className="text-lg text-muted-foreground max-w-3xl">
            Esta página é mantida pelo time do Barbex para responder dúvidas comuns sobre segurança e
            práticas adotadas na plataforma. Não constitui uma certificação independente.
          </p>
        </header>

        <section aria-labelledby="pilares" className="mb-16">
          <h2 id="pilares" className="text-2xl font-bold mb-6">Pilares</h2>
          <ul className="grid sm:grid-cols-2 gap-4 list-none p-0">
            {PILLARS.map((p) => (
              <li key={p.title} className="rounded-xl border border-border bg-card p-5">
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-lg bg-primary/15 border border-primary/30 flex items-center justify-center shrink-0">
                    <p.icon className="h-5 w-5 text-primary" aria-hidden="true" />
                  </div>
                  <div>
                    <h3 className="font-semibold">{p.title}</h3>
                    <p className="text-sm text-muted-foreground mt-1">{p.desc}</p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="responsabilidade" className="mb-16">
          <h2 id="responsabilidade" className="text-2xl font-bold mb-4">Responsabilidade compartilhada</h2>
          <p className="text-muted-foreground">
            A segurança é uma responsabilidade conjunta entre o Barbex (plataforma) e a barbearia
            (operadora), que deve manter senhas fortes, controlar quem tem acesso ao painel e revisar
            permissões periodicamente.
          </p>
        </section>

        <section aria-labelledby="report">
          <h2 id="report" className="text-2xl font-bold mb-4 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-primary" aria-hidden="true" /> Reportar vulnerabilidades
          </h2>
          <p className="text-muted-foreground mb-2">
            Encontrou uma vulnerabilidade? Entre em contato em sigilo para investigarmos:
          </p>
          <p className="text-sm">
            <a className="underline text-primary" href="mailto:seguranca@barbex.shop">seguranca@barbex.shop</a>
          </p>
        </section>
      </main>
    </div>
  );
}
