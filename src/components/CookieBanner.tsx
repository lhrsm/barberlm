import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Cookie, X } from "lucide-react";

const STORAGE_KEY = "barbex_cookie_consent_v1";

type Consent = {
  essential: true;
  analytics: boolean;
  marketing: boolean;
  decidedAt: string;
};

export function CookieBanner() {
  const [open, setOpen] = useState(false);
  const [customize, setCustomize] = useState(false);
  const [analytics, setAnalytics] = useState(true);
  const [marketing, setMarketing] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) setOpen(true);
    } catch {
      setOpen(true);
    }
  }, []);

  const save = (c: Omit<Consent, "decidedAt" | "essential">) => {
    const payload: Consent = {
      essential: true,
      analytics: c.analytics,
      marketing: c.marketing,
      decidedAt: new Date().toISOString(),
    };
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {}
    setOpen(false);
  };

  if (!open) return null;

  return (
    <div className="fixed bottom-3 left-3 z-[80] sm:bottom-4 sm:left-4">
      <div className="w-[calc(100vw-1.5rem)] max-w-sm rounded-xl border border-white/10 bg-[#0b0b0c]/95 p-3 text-white shadow-[0_20px_60px_rgba(0,0,0,0.55)] backdrop-blur">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#F5C542] to-[#D4A017] text-[#050505]">
            <Cookie size={18} strokeWidth={2.5} />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold">Utilizamos cookies para melhorar sua experiência</p>
            <p className="mt-1 text-xs text-white/65">
              Usamos cookies essenciais para o funcionamento da plataforma e, com seu consentimento,
              cookies de análise e marketing. Leia nossa{" "}
              <Link to="/privacy" className="underline underline-offset-2 hover:text-[#F5C542]">
                Política de Privacidade
              </Link>
              .
            </p>

            {customize && (
              <div className="mt-3 space-y-2 rounded-lg border border-white/10 bg-white/[0.03] p-3 text-xs">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-white">Essenciais</p>
                    <p className="text-white/55">Sempre ativos. Necessários para o sistema funcionar.</p>
                  </div>
                  <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] uppercase tracking-wide">obrigatório</span>
                </div>
                <label className="flex items-center justify-between gap-3 cursor-pointer">
                  <div>
                    <p className="font-medium text-white">Análise</p>
                    <p className="text-white/55">Métricas anônimas de uso para melhorar a plataforma.</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={analytics}
                    onChange={(e) => setAnalytics(e.target.checked)}
                    className="h-4 w-4 accent-[#F5C542]"
                  />
                </label>
                <label className="flex items-center justify-between gap-3 cursor-pointer">
                  <div>
                    <p className="font-medium text-white">Marketing</p>
                    <p className="text-white/55">Personalização de ofertas e campanhas.</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={marketing}
                    onChange={(e) => setMarketing(e.target.checked)}
                    className="h-4 w-4 accent-[#F5C542]"
                  />
                </label>
              </div>
            )}

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => save({ analytics: true, marketing: true })}
                className="rounded-full bg-gradient-to-br from-[#F5C542] to-[#D4A017] px-4 py-2 text-xs font-semibold text-[#050505] hover:brightness-110"
              >
                Aceitar todos
              </button>
              <button
                type="button"
                onClick={() => save({ analytics: false, marketing: false })}
                className="rounded-full border border-white/15 bg-white/[0.04] px-4 py-2 text-xs font-semibold text-white hover:bg-white/10"
              >
                Recusar opcionais
              </button>
              {customize ? (
                <button
                  type="button"
                  onClick={() => save({ analytics, marketing })}
                  className="rounded-full border border-[#F5C542]/40 bg-[#F5C542]/10 px-4 py-2 text-xs font-semibold text-[#F5C542] hover:bg-[#F5C542]/20"
                >
                  Salvar preferências
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setCustomize(true)}
                  className="rounded-full px-3 py-2 text-xs font-semibold text-white/70 hover:text-white"
                >
                  Personalizar
                </button>
              )}
            </div>
          </div>
          <button
            type="button"
            aria-label="Fechar"
            onClick={() => save({ analytics: false, marketing: false })}
            className="ml-1 text-white/50 hover:text-white"
          >
            <X size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
