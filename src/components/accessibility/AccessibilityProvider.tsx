import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";

export type A11yPrefs = {
  highContrast: boolean;
  fontScale: number; // 1 = base
  lineSpacing: boolean;
  letterSpacing: boolean;
  bigCursor: boolean;
  highlightLinks: boolean;
  highlightFocus: boolean;
  grayscale: boolean;
  darkMode: boolean;
  reduceMotion: boolean;
  readingGuide: boolean;
};

const DEFAULTS: A11yPrefs = {
  highContrast: false,
  fontScale: 1,
  lineSpacing: false,
  letterSpacing: false,
  bigCursor: false,
  highlightLinks: false,
  highlightFocus: false,
  grayscale: false,
  darkMode: true,
  reduceMotion: false,
  readingGuide: false,
};

const STORAGE_KEY = "barbex.a11y.prefs.v1";

type Ctx = {
  prefs: A11yPrefs;
  update: <K extends keyof A11yPrefs>(k: K, v: A11yPrefs[K]) => void;
  reset: () => void;
  useSystem: () => void;
  speak: (text: string) => void;
  stopSpeak: () => void;
  speaking: boolean;
};

const A11yContext = createContext<Ctx | null>(null);

export function useA11y() {
  const ctx = useContext(A11yContext);
  if (!ctx) throw new Error("useA11y must be inside AccessibilityProvider");
  return ctx;
}

function loadPrefs(): A11yPrefs {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return DEFAULTS;
  }
}

function applyPrefs(p: A11yPrefs) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.classList.toggle("a11y-high-contrast", p.highContrast);
  root.classList.toggle("a11y-line-spacing", p.lineSpacing);
  root.classList.toggle("a11y-letter-spacing", p.letterSpacing);
  root.classList.toggle("a11y-big-cursor", p.bigCursor);
  root.classList.toggle("a11y-highlight-links", p.highlightLinks);
  root.classList.toggle("a11y-highlight-focus", p.highlightFocus);
  root.classList.toggle("a11y-grayscale", p.grayscale);
  root.classList.toggle("a11y-reduce-motion", p.reduceMotion);
  root.classList.toggle("a11y-reading-guide", p.readingGuide);
  root.classList.toggle("dark", p.darkMode);
  root.style.fontSize = `${Math.round(16 * p.fontScale)}px`;
}

export function AccessibilityProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<A11yPrefs>(DEFAULTS);
  const [speaking, setSpeaking] = useState(false);

  useEffect(() => {
    const loaded = loadPrefs();
    // respect prefers-reduced-motion on first load
    if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      loaded.reduceMotion = true;
    }
    setPrefs(loaded);
    applyPrefs(loaded);
  }, []);

  const persist = (next: A11yPrefs) => {
    setPrefs(next);
    applyPrefs(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {}
  };

  const update: Ctx["update"] = (k, v) => persist({ ...prefs, [k]: v });
  const reset = () => persist(DEFAULTS);
  const useSystem = () => {
    const sys: A11yPrefs = {
      ...DEFAULTS,
      darkMode: window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? true,
      reduceMotion: window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false,
    };
    persist(sys);
  };

  const stopSpeak = useCallback(() => {
    if (typeof window === "undefined") return;
    window.speechSynthesis?.cancel();
    setSpeaking(false);
  }, []);

  const speak = useCallback(
    (text: string) => {
      if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = "pt-BR";
      u.onend = () => setSpeaking(false);
      u.onerror = () => setSpeaking(false);
      setSpeaking(true);
      window.speechSynthesis.speak(u);
    },
    []
  );

  // Reading guide: horizontal bar following cursor
  useEffect(() => {
    if (!prefs.readingGuide) return;
    const bar = document.createElement("div");
    bar.setAttribute("aria-hidden", "true");
    bar.style.cssText =
      "position:fixed;left:0;right:0;height:40px;background:rgba(255,200,0,.15);border-top:1px solid rgba(255,200,0,.5);border-bottom:1px solid rgba(255,200,0,.5);pointer-events:none;z-index:99998;transform:translateY(-50%);transition:top 60ms linear;top:0";
    document.body.appendChild(bar);
    const onMove = (e: MouseEvent) => {
      bar.style.top = `${e.clientY}px`;
    };
    window.addEventListener("mousemove", onMove);
    return () => {
      window.removeEventListener("mousemove", onMove);
      bar.remove();
    };
  }, [prefs.readingGuide]);

  return (
    <A11yContext.Provider value={{ prefs, update, reset, useSystem, speak, stopSpeak, speaking }}>
      {children}
    </A11yContext.Provider>
  );
}
