import { createFileRoute, Link } from "@tanstack/react-router";
import { Accessibility, Eye, Keyboard, Volume2, MousePointer, ZoomIn, Contrast, Palette, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/accessibility")({
  head: () => ({
    meta: [
      { title: "Acessibilidade — Barbex" },
      { name: "description", content: "Recursos de acessibilidade do Barbex seguindo as diretrizes WCAG 2.2 AA." },
      { property: "og:title", content: "Acessibilidade — Barbex" },
      { property: "og:description", content: "Plataforma acessível para todos, conforme WCAG 2.2 AA." },
    ],
  }),
  component: AccessibilityPage,
});

const FEATURES = [
  { icon: Contrast, title: "Alto contraste", desc: "Ajuste de contraste para melhorar a leitura em diferentes condições de luz." },
  { icon: ZoomIn, title: "Tamanho da fonte", desc: "Aumente ou diminua o tamanho do texto sem quebrar o layout." },
  { icon: Eye, title: "Espaçamento e leitura", desc: "Ajustes de espaçamento entre linhas, letras e guia de leitura horizontal." },
  { icon: MousePointer, title: "Cursor ampliado", desc: "Cursor maior e mais visível para facilitar a navegação." },
  { icon: Keyboard, title: "Navegação por teclado", desc: "Tab, Shift+Tab, Enter, Espaço, Esc e setas em todos os componentes." },
  { icon: Volume2, title: "Leitor de conteúdo", desc: "Leitura em voz alta do conteúdo principal via SpeechSynthesis." },
  { icon: Palette, title: "Escala de cinza & modo escuro", desc: "Modos visuais alternativos para diferentes sensibilidades." },
  { icon: Accessibility, title: "Reduzir animações", desc: "Respeita prefers-reduced-motion e oferece controle manual." },
];

function AccessibilityPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="max-w-5xl mx-auto px-6 py-16">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary mb-8">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Voltar
        </Link>
        <header className="mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/15 border border-primary/40 text-primary text-xs font-bold uppercase tracking-wider mb-4">
            <Accessibility className="h-3.5 w-3.5" aria-hidden="true" /> WCAG 2.2 AA
          </div>
          <h1 className="text-4xl font-black text-foreground mb-4">Acessibilidade</h1>
          <p className="text-lg text-muted-foreground max-w-3xl">
            O Barbex segue as diretrizes <strong>WCAG 2.2 AA</strong> para oferecer uma experiência inclusiva
            a pessoas com deficiência visual, motora, auditiva e cognitiva. Esta página apresenta os recursos
            disponíveis na plataforma.
          </p>
        </header>

        <section aria-labelledby="recursos" className="mb-16">
          <h2 id="recursos" className="text-2xl font-bold mb-6">Recursos disponíveis</h2>
          <ul className="grid sm:grid-cols-2 gap-4 list-none p-0">
            {FEATURES.map((f) => (
              <li key={f.title} className="rounded-xl border border-border bg-card p-5">
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-lg bg-primary/15 border border-primary/30 flex items-center justify-center shrink-0">
                    <f.icon className="h-5 w-5 text-primary" aria-hidden="true" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">{f.title}</h3>
                    <p className="text-sm text-muted-foreground mt-1">{f.desc}</p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="ativar" className="mb-16">
          <h2 id="ativar" className="text-2xl font-bold mb-4">Como ativar</h2>
          <p className="text-muted-foreground">
            Clique no botão flutuante de <strong>Acessibilidade</strong>, no canto inferior esquerdo de qualquer página,
            para abrir o painel com todos os ajustes. Suas preferências ficam salvas no navegador e, quando autenticado,
            também no seu perfil.
          </p>
        </section>

        <section aria-labelledby="conformidade">
          <h2 id="conformidade" className="text-2xl font-bold mb-4">Conformidade e contato</h2>
          <p className="text-muted-foreground mb-3">
            Realizamos verificações periódicas com ferramentas como Lighthouse, axe DevTools e WAVE.
            Caso encontre alguma barreira de acesso, fale conosco — vamos corrigir o mais rápido possível.
          </p>
          <p className="text-sm text-muted-foreground">
            E-mail: <a href="mailto:acessibilidade@barbex.shop" className="underline text-primary">acessibilidade@barbex.shop</a>
          </p>
        </section>
      </main>
    </div>
  );
}
