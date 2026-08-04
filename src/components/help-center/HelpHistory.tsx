import { Button } from "@/components/ui/button";
import { History, ArrowRight } from "lucide-react";

interface HelpHistoryProps {
  recentArticles: any[];
  onSelect: (article: any) => void;
}

export function HelpHistory({ recentArticles, onSelect }: HelpHistoryProps) {
  if (recentArticles.length === 0) return null;

  return (
    <div className="bg-[#0b0f17] border border-zinc-800 rounded-3xl p-6 space-y-4">
      <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-2">
        <History size={14} /> Visto recentemente
      </h4>
      <div className="space-y-2">
        {recentArticles.map((article) => (
          <Button
            key={article.id}
            variant="ghost"
            onClick={() => onSelect(article)}
            className="w-full justify-between h-auto py-3 px-4 rounded-xl text-zinc-400 hover:text-white hover:bg-white/5 group"
          >
            <span className="text-sm font-medium line-clamp-1">{article.title}</span>
            <ArrowRight size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
          </Button>
        ))}
      </div>
    </div>
  );
}
