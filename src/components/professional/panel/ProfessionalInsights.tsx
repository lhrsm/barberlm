import { memo } from "react";
import { cn } from "@/lib/utils";
import { Lightbulb, Flag } from "lucide-react";
import type { Insight } from "./metrics";

const TONES: Record<Insight["tone"], string> = {
  gold: "border-gold/30 bg-gold/[0.07] text-gold",
  positive: "border-green-500/25 bg-green-500/[0.07] text-green-300",
  warning: "border-amber-500/25 bg-amber-500/[0.07] text-amber-300",
  neutral: "border-white/10 bg-white/[0.03] text-white/75",
};

export const ProfessionalInsights = memo(function ProfessionalInsights({
  insights,
  objectives,
}: {
  insights: Insight[];
  objectives: Insight[];
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel title="Meu Desempenho" subtitle="Gerado a partir dos seus dados" icon={Lightbulb} items={insights} />
      <Panel title="Meus Objetivos" subtitle="O que falta para o próximo marco" icon={Flag} items={objectives} />
    </div>
  );
});

function Panel({
  title,
  subtitle,
  icon: Icon,
  items,
}: {
  title: string;
  subtitle: string;
  icon: any;
  items: Insight[];
}) {
  return (
    <section aria-label={title} className="rounded-2xl border border-gold/15 bg-[#0b0f17] p-5 md:p-6">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gold/10">
          <Icon className="h-4 w-4 text-gold" aria-hidden />
        </div>
        <div>
          <h3 className="text-base font-black text-white">{title}</h3>
          <p className="text-[10px] font-black uppercase tracking-widest text-white/40">{subtitle}</p>
        </div>
      </div>
      {items.length === 0 ? (
        <p className="py-6 text-center text-sm text-white/40">Sem dados suficientes ainda.</p>
      ) : (
        <ul className="space-y-2">
          {items.map((i) => (
            <li
              key={i.id}
              className={cn(
                "rounded-xl border px-4 py-3 text-sm font-medium transition-all duration-200 hover:translate-x-0.5",
                TONES[i.tone],
              )}
            >
              {i.text}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
