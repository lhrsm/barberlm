import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Eye, Sparkles } from "lucide-react";
import * as LucideIcons from "lucide-react";

type Props = {
  template: any;
  onPreview: () => void;
  onUse: () => void;
};

const DIFF_LABEL: Record<string, { label: string; cls: string }> = {
  easy: { label: "Fácil", cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
  medium: { label: "Médio", cls: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
  advanced: { label: "Avançado", cls: "bg-red-500/15 text-red-400 border-red-500/30" },
};

export function TemplateCard({ template, onPreview, onUse }: Props) {
  const IconComp = (LucideIcons as any)[template.icon || "Gift"] || LucideIcons.Gift;
  const diff = DIFF_LABEL[template.difficulty] || DIFF_LABEL.easy;
  const color = template.color || "#f59e0b";
  const benefits: string[] = Array.isArray(template.benefits) ? template.benefits : [];

  return (
    <div className="group relative bg-gradient-to-b from-[#0b0f17] to-[#05070d] border border-zinc-800/80 rounded-2xl p-5 hover:border-[#f59e0b]/40 hover:-translate-y-1 hover:shadow-[0_10px_40px_rgba(245,158,11,0.15)] transition-all duration-300 flex flex-col">
      {template.is_featured && (
        <span className="absolute top-3 right-3 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md bg-gradient-to-r from-[#f59e0b] to-[#ea580c] text-black">
          <Sparkles className="inline h-3 w-3 mr-1" />
          Popular
        </span>
      )}

      <div
        className="h-14 w-14 rounded-2xl grid place-items-center mb-4 border"
        style={{
          background: `linear-gradient(135deg, ${color}33, ${color}11)`,
          borderColor: `${color}55`,
        }}
      >
        <IconComp className="h-7 w-7" style={{ color }} />
      </div>

      <h3 className="text-lg font-bold text-white">{template.name}</h3>
      <p className="text-sm text-zinc-400 mt-1 line-clamp-2 min-h-[40px]">{template.description}</p>

      <div className="flex items-center gap-2 mt-3">
        <Badge variant="outline" className={`text-[10px] font-bold border ${diff.cls}`}>
          {diff.label}
        </Badge>
        <Badge variant="outline" className="text-[10px] font-bold border-zinc-700 text-zinc-400 capitalize">
          {template.category}
        </Badge>
      </div>

      <ul className="mt-4 space-y-1.5 text-xs text-zinc-300 flex-1">
        {benefits.slice(0, 3).map((b, i) => (
          <li key={i} className="flex items-start gap-2">
            <span className="mt-1 h-1.5 w-1.5 rounded-full flex-shrink-0" style={{ background: color }} />
            <span>{b}</span>
          </li>
        ))}
      </ul>

      <div className="mt-5 flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onPreview}
          className="flex-1 h-10 rounded-xl bg-transparent border-zinc-800 text-zinc-300 hover:text-white hover:border-[#f59e0b]/40"
        >
          <Eye className="h-4 w-4 mr-1.5" /> Visualizar
        </Button>
        <Button
          size="sm"
          onClick={onUse}
          className="flex-1 h-10 rounded-xl bg-gradient-to-r from-[#f59e0b] to-[#ea580c] hover:from-[#fbbf24] hover:to-[#f59e0b] text-black font-bold shadow-[0_4px_16px_rgba(245,158,11,0.25)]"
        >
          Usar modelo
        </Button>
      </div>
    </div>
  );
}
