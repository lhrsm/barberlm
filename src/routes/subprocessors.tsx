import { createFileRoute, Link } from "@tanstack/react-router";
import { Building2, ArrowLeft, ExternalLink } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { listSubprocessors } from "@/lib/trust.functions";

export const Route = createFileRoute("/subprocessors")({
  head: () => ({
    meta: [
      { title: "Subprocessadores — Barbex" },
      { name: "description", content: "Serviços terceiros utilizados pelo Barbex para operar a plataforma." },
    ],
  }),
  component: SubprocessorsPage,
});

function SubprocessorsPage() {
  const { data } = useQuery({
    queryKey: ["subprocessors"],
    queryFn: () => listSubprocessors(),
  });
  const items = data?.items ?? [];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="max-w-5xl mx-auto px-6 py-16">
        <Link to="/trust" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary mb-8">
          <ArrowLeft className="h-4 w-4" /> Central de Confiança
        </Link>
        <header className="mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/15 border border-primary/40 text-primary text-xs font-bold uppercase tracking-wider mb-4">
            <Building2 className="h-3.5 w-3.5" /> Transparência
          </div>
          <h1 className="text-4xl font-black mb-3">Subprocessadores</h1>
          <p className="text-lg text-muted-foreground max-w-3xl">
            Para operar a plataforma, contratamos provedores especializados em pagamentos, infraestrutura,
            comunicação e inteligência artificial. Atualizamos esta lista sempre que houver mudanças.
          </p>
        </header>

        <div className="grid sm:grid-cols-2 gap-4">
          {items.map((sp: any) => (
            <article key={sp.id} className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div>
                  <h3 className="font-black text-lg">{sp.name}</h3>
                  <span className="inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 border border-primary/30 text-primary uppercase tracking-wider">
                    {sp.category}
                  </span>
                </div>
                {sp.country && (
                  <span className="text-xs text-muted-foreground">{sp.country}</span>
                )}
              </div>
              <p className="text-sm text-muted-foreground mb-3">{sp.purpose}</p>
              <div className="flex flex-wrap gap-3 text-sm">
                {sp.privacy_url && (
                  <a href={sp.privacy_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                    Política de privacidade <ExternalLink className="h-3 w-3" />
                  </a>
                )}
                {sp.website_url && (
                  <a href={sp.website_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-muted-foreground hover:text-primary">
                    Site oficial <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            </article>
          ))}
        </div>
      </main>
    </div>
  );
}
