import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, Star, BookOpen, ArrowRight, icons as LucideIcons } from "lucide-react";
import { motion } from "framer-motion";

interface TutorialCardProps {
  tutorial: any;
  onClick: (tutorial: any) => void;
}

const LEVEL_MAP: Record<string, { label: string; className: string }> = {
  basico: { label: "Básico", className: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
  intermediario: { label: "Intermediário", className: "bg-sky-500/15 text-sky-400 border-sky-500/30" },
  avancado: { label: "Avançado", className: "bg-rose-500/15 text-rose-400 border-rose-500/30" },
};

function resolveIcon(name?: string) {
  if (!name) return BookOpen;
  const key = name
    .split(/[-_ ]/)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join("");
  return (LucideIcons as any)[key] || BookOpen;
}

export function TutorialCard({ tutorial, onClick }: TutorialCardProps) {
  const Icon = resolveIcon(tutorial.icon);
  const level = LEVEL_MAP[tutorial.level as string] || LEVEL_MAP.basico;

  return (
    <motion.div
      whileHover={{ y: -4 }}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="h-full"
    >
      <Card
        onClick={() => onClick(tutorial)}
        className="group h-full flex flex-col overflow-hidden cursor-pointer bg-gradient-to-b from-[#0b0f17] to-[#05070d] border border-[#f59e0b]/15 hover:border-[#f59e0b]/50 transition-all duration-300 hover:shadow-[0_8px_32px_-8px_rgba(245,158,11,0.35)]"
      >
        <CardHeader className="p-5 pb-3 space-y-3">
          <div className="flex items-start justify-between">
            <div className="h-11 w-11 rounded-xl grid place-items-center bg-gradient-to-br from-[#f59e0b]/20 to-[#ea580c]/5 border border-[#f59e0b]/30 text-[#f59e0b] group-hover:scale-110 transition-transform">
              <Icon className="h-5 w-5" />
            </div>
            {tutorial.is_featured && (
              <Badge className="gap-1 rounded-full border border-[#D4AF37]/50 bg-gradient-to-r from-[#D4AF37] via-[#f5d97a] to-[#B8941F] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-black shadow-[0_2px_10px_rgba(212,175,55,0.35)] transition-all group-hover:shadow-[0_4px_16px_rgba(212,175,55,0.55)]">
                <Star size={10} className="fill-black text-black" /> Destaque
              </Badge>
            )}
          </div>
          <div>
            <span className="text-[10px] font-bold text-[#f59e0b] uppercase tracking-widest">
              {tutorial.category?.name || "Geral"}
            </span>
            <h3 className="mt-1 font-bold text-base text-white group-hover:text-[#f59e0b] transition-colors line-clamp-2">
              {tutorial.title}
            </h3>
          </div>
        </CardHeader>

        <CardContent className="px-5 pb-4 flex-1">
          <p className="text-xs text-zinc-400 line-clamp-3 leading-relaxed">
            {tutorial.description || "Nenhuma descrição fornecida."}
          </p>
        </CardContent>

        <CardFooter className="p-5 pt-4 border-t border-zinc-800/70 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Badge variant="outline" className={`text-[10px] px-2 py-0.5 ${level.className}`}>
              {level.label}
            </Badge>
            <span className="flex items-center gap-1 text-[10px] text-zinc-500 font-medium">
              <Clock size={11} /> {tutorial.estimated_time || "3 min"}
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-[10px] font-bold uppercase tracking-wider text-[#f59e0b] hover:text-[#fbbf24] hover:bg-[#f59e0b]/10 gap-1"
          >
            Ver <ArrowRight size={12} />
          </Button>
        </CardFooter>
      </Card>
    </motion.div>
  );
}
