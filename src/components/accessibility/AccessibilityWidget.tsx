import { useState } from "react";
import { Accessibility, RotateCcw, Monitor, Volume2, VolumeX, Plus, Minus } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetTrigger } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { useA11y, type A11yPrefs } from "./AccessibilityProvider";

const SWITCHES: { key: keyof A11yPrefs; label: string; desc: string }[] = [
  { key: "highContrast", label: "Alto contraste", desc: "Aumenta o contraste de cores" },
  { key: "lineSpacing", label: "Espaçamento entre linhas", desc: "Mais respiro vertical" },
  { key: "letterSpacing", label: "Espaçamento entre letras", desc: "Mais legibilidade" },
  { key: "bigCursor", label: "Cursor ampliado", desc: "Cursor maior e visível" },
  { key: "highlightLinks", label: "Destacar links", desc: "Sublinha e realça links" },
  { key: "highlightFocus", label: "Destacar foco do teclado", desc: "Indicador de foco reforçado" },
  { key: "grayscale", label: "Escala de cinza", desc: "Remove cores da tela" },
  { key: "darkMode", label: "Modo escuro", desc: "Tema com fundo escuro" },
  { key: "reduceMotion", label: "Reduzir animações", desc: "Diminui movimento na interface" },
  { key: "readingGuide", label: "Guia de leitura", desc: "Barra horizontal seguindo o cursor" },
];

export function AccessibilityWidget() {
  const { prefs, update, reset, useSystem, speak, stopSpeak, speaking } = useA11y();
  const [open, setOpen] = useState(false);

  const changeFont = (delta: number) =>
    update("fontScale", Math.min(1.5, Math.max(0.85, +(prefs.fontScale + delta).toFixed(2))));

  const readPage = () => {
    const main = document.getElementById("main-content") || document.querySelector("main") || document.body;
    const text = (main?.textContent || "").replace(/\s+/g, " ").trim().slice(0, 4000);
    if (text) speak(text);
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          type="button"
          aria-label="Abrir menu de acessibilidade"
          className="fixed bottom-4 left-4 md:bottom-6 md:left-6 z-[60] h-12 w-12 rounded-full bg-primary text-primary-foreground shadow-xl ring-2 ring-primary/40 hover:scale-105 transition-transform flex items-center justify-center focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/60"
        >
          <Accessibility className="h-6 w-6" aria-hidden="true" />
        </button>
      </SheetTrigger>
      <SheetContent side="left" className="w-full sm:max-w-md overflow-y-auto bg-background text-foreground">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 text-foreground">
            <Accessibility className="h-5 w-5 text-primary" aria-hidden="true" />
            Acessibilidade
          </SheetTitle>
          <SheetDescription>
            Ajuste a experiência conforme suas necessidades. Preferências salvas no seu navegador.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Font size */}
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold">Tamanho da fonte</span>
              <span className="text-xs text-muted-foreground" aria-live="polite">
                {Math.round(prefs.fontScale * 100)}%
              </span>
            </div>
            <div className="flex gap-2">
              <Button type="button" size="sm" variant="outline" onClick={() => changeFont(-0.05)} aria-label="Diminuir fonte">
                <Minus className="h-4 w-4" aria-hidden="true" />
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => changeFont(0.05)} aria-label="Aumentar fonte">
                <Plus className="h-4 w-4" aria-hidden="true" />
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => update("fontScale", 1)} aria-label="Tamanho padrão da fonte">
                Padrão
              </Button>
            </div>
          </div>

          {/* Switches */}
          <div className="space-y-2">
            {SWITCHES.map((s) => (
              <label
                key={s.key}
                htmlFor={`a11y-${s.key}`}
                className="flex items-start justify-between gap-3 rounded-lg border border-border bg-card p-3 cursor-pointer hover:bg-accent/40 transition-colors"
              >
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-foreground">{s.label}</div>
                  <div className="text-xs text-muted-foreground">{s.desc}</div>
                </div>
                <Switch
                  id={`a11y-${s.key}`}
                  checked={Boolean(prefs[s.key])}
                  onCheckedChange={(v) => update(s.key, v as never)}
                  aria-label={s.label}
                />
              </label>
            ))}
          </div>

          {/* Reader */}
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="text-sm font-semibold mb-1">Leitor de conteúdo</div>
            <p className="text-xs text-muted-foreground mb-3">
              Lê em voz alta o conteúdo principal da página (quando suportado pelo navegador).
            </p>
            <div className="flex gap-2">
              <Button type="button" size="sm" onClick={readPage} aria-label="Ler conteúdo da página">
                <Volume2 className="h-4 w-4 mr-1" aria-hidden="true" /> Ler conteúdo
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={stopSpeak} disabled={!speaking} aria-label="Parar leitura">
                <VolumeX className="h-4 w-4 mr-1" aria-hidden="true" /> Parar
              </Button>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-2 pt-2">
            <Button type="button" size="sm" variant="outline" onClick={useSystem}>
              <Monitor className="h-4 w-4 mr-1" aria-hidden="true" /> Usar configuração do sistema
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={reset}>
              <RotateCcw className="h-4 w-4 mr-1" aria-hidden="true" /> Restaurar padrão
            </Button>
          </div>

          <p className="text-[11px] text-muted-foreground pt-2">
            Conforme as diretrizes WCAG 2.2 AA. Saiba mais em{" "}
            <a href="/accessibility" className="underline text-primary">/accessibility</a>.
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
