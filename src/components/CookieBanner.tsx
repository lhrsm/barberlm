import { useEffect, useState, useCallback } from "react";
import { Link } from "@tanstack/react-router";
import { Cookie, X, ShieldCheck, Settings as SettingsIcon, BarChart3, Megaphone } from "lucide-react";
import { submitCookieConsent } from "@/lib/trust.functions";
import { COOKIES_VERSION } from "@/lib/legal-versions";

const STORAGE_KEY = "barbex_cookie_consent_v2";

export type CookiePrefs = {
  necessary: true;
  preferences: boolean;
  statistics: boolean;
  marketing: boolean;
  version: string;
  decidedAt: string;
};

const EVT = "barbex:open-cookie-preferences";

export function openCookiePreferences() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(EVT));
  }
}

export function getCookiePrefs(): CookiePrefs | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as CookiePrefs) : null;
  } catch {
    return null;
  }
}

export function CookieBanner() {
  const [visible, setVisible] = useState(false);
  const [showCustomize, setShowCustomize] = useState(false);
  const [preferences, setPreferences] = useState(true);
  const [statistics, setStatistics] = useState(true);
  const [marketing, setMarketing] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const existing = getCookiePrefs();
    if (!existing || existing.version !== COOKIES_VERSION) {
      setVisible(true);
    }
    const handler = () => {
      const cur = getCookiePrefs();
      if (cur) {
        setPreferences(cur.preferences);
        setStatistics(cur.statistics);
        setMarketing(cur.marketing);
      }
      setShowCustomize(true);
      setVisible(true);
    };
    window.addEventListener(EVT, handler);
    return () => window.removeEventListener(EVT, handler);
  }, []);

  const persist = useCallback(
    async (prefs: Omit<CookiePrefs, "necessary" | "version" | "decidedAt">) => {
      const payload: CookiePrefs = {
        necessary: true,
        ...prefs,
        version: COOKIES_VERSION,
        decidedAt: new Date().toISOString(),
      };
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
        // Force an event to notify other listeners (like Playwright scripts)
        window.dispatchEvent(new Event('storage'));
      } catch {}
      setVisible(false);
      setShowCustomize(false);
      try {
        await submitCookieConsent({
          data: {
            preferences: prefs.preferences,
            statistics: prefs.statistics,
            marketing: prefs.marketing,
            policy_version: COOKIES_VERSION,
            source: typeof window !== "undefined" ? window.location.pathname : "web",
          },
        });
      } catch (e) {
        // soft fail — preferences still saved locally
        console.warn("[cookie-consent] remote save failed", e);
      }
    },
    [],
  );

  if (!visible) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-[80] p-3 sm:p-5 pointer-events-none">
      <div className="pointer-events-auto mx-auto max-w-4xl rounded-2xl border border-primary/30 bg-[#0a0a0c]/95 text-white shadow-[0_30px_80px_rgba(0,0,0,.55)] backdrop-blur-xl overflow-hidden">
        <div className="p-5 sm:p-6">
          <div className="flex items-start gap-4">
            <div className="hidden sm:flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/40 to-amber-500/20 border border-primary/50">
              <Cookie className="h-6 w-6 text-primary" aria-hidden="true" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-base sm:text-lg font-bold">Respeitamos sua privacidade</h2>
              <p className="mt-1 text-sm text-white/65 leading-relaxed">
                Utilizamos cookies para melhorar sua experiência, oferecer recursos essenciais e analisar o desempenho da plataforma.
                Saiba mais em{" "}
                <Link to="/cookies" className="underline text-primary hover:text-primary/80">cookies</Link>{" "}
                e{" "}
                <Link to="/privacy" className="underline text-primary hover:text-primary/80">privacidade</Link>.
              </p>

              {showCustomize && (
                <div className="mt-4 grid sm:grid-cols-2 gap-2.5">
                  <Row
                    icon={ShieldCheck}
                    title="Necessários"
                    desc="Essenciais para o funcionamento da plataforma."
                    locked
                    checked
                  />
                  <Row
                    icon={SettingsIcon}
                    title="Preferências"
                    desc="Lembram suas escolhas (idioma, tema)."
                    checked={preferences}
                    onChange={setPreferences}
                  />
                  <Row
                    icon={BarChart3}
                    title="Estatísticos"
                    desc="Métricas anônimas para melhorar o produto."
                    checked={statistics}
                    onChange={setStatistics}
                  />
                  <Row
                    icon={Megaphone}
                    title="Marketing"
                    desc="Personalização de ofertas e campanhas."
                    checked={marketing}
                    onChange={setMarketing}
                  />
                </div>
              )}

              <div className="mt-5 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => persist({ preferences: true, statistics: true, marketing: true })}
                  className="rounded-full bg-gradient-to-br from-[#F5C542] to-[#D4A017] px-5 py-2.5 text-sm font-bold text-[#050505] hover:brightness-110 transition"
                >
                  Aceitar
                </button>
                <button
                  type="button"
                  onClick={() => persist({ preferences: false, statistics: false, marketing: false })}
                  className="rounded-full border border-white/15 bg-white/[0.04] px-5 py-2.5 text-sm font-bold text-white hover:bg-white/10 transition"
                >
                  Recusar
                </button>
                {showCustomize ? (
                  <button
                    type="button"
                    onClick={() => persist({ preferences, statistics, marketing })}
                    className="rounded-full border border-primary/50 bg-primary/15 px-5 py-2.5 text-sm font-bold text-primary hover:bg-primary/25 transition"
                  >
                    Salvar preferências
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowCustomize(true)}
                    className="rounded-full px-4 py-2.5 text-sm font-semibold text-white/70 hover:text-white transition"
                  >
                    Personalizar
                  </button>
                )}
              </div>
            </div>
            <button
              type="button"
              aria-label="Fechar"
              onClick={() => setVisible(false)}
              className="ml-1 text-white/50 hover:text-white"
            >
              <X size={18} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({
  icon: Icon,
  title,
  desc,
  checked,
  locked,
  onChange,
}: {
  icon: any;
  title: string;
  desc: string;
  checked: boolean;
  locked?: boolean;
  onChange?: (v: boolean) => void;
}) {
  return (
    <label
      className={`flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3 ${locked ? "opacity-90" : "cursor-pointer hover:bg-white/[0.05]"}`}
    >
      <div className="h-8 w-8 shrink-0 rounded-lg bg-primary/15 border border-primary/30 flex items-center justify-center">
        <Icon className="h-4 w-4 text-primary" aria-hidden="true" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-white">{title}</p>
          {locked && (
            <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-white/10 text-white/70">
              obrigatório
            </span>
          )}
        </div>
        <p className="text-xs text-white/55 mt-0.5">{desc}</p>
      </div>
      <input
        type="checkbox"
        checked={checked}
        disabled={locked}
        onChange={(e) => onChange?.(e.target.checked)}
        className="h-4 w-4 mt-1 accent-[#F5C542]"
        aria-label={title}
      />
    </label>
  );
}

export function ManageCookiesLink({ className }: { className?: string }) {
  return (
    <button
      type="button"
      onClick={openCookiePreferences}
      className={className || "hover:text-primary transition-colors"}
    >
      Gerenciar Cookies
    </button>
  );
}
