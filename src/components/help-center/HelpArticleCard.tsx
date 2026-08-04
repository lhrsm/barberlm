import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, Star, ArrowRight } from "lucide-react";
import * as LucideIcons from "lucide-react";

interface HelpArticleCardProps {
  article: any;
  onClick: (article: any) => void;
}

export function HelpArticleCard({ article, onClick }: HelpArticleCardProps) {
  const Icon = (LucideIcons as any)[article.icon] || LucideIcons.FileText;
  
  return (
    <Card 
      onClick={() => onClick(article)}
      className="group cursor-pointer bg-[#0b0f17] border-zinc-800 hover:border-gold/50 transition-all hover:shadow-[0_8px_32px_-8px_rgba(212,175,55,0.2)]"
    >
      <CardHeader className="p-5 pb-2">
        <div className="flex justify-between items-start mb-3">
          <div className="h-10 w-10 rounded-lg bg-gold/10 border border-gold/20 grid place-items-center text-gold">
            <Icon size={20} />
          </div>
          {article.is_featured && (
            <Badge className="bg-gold text-black hover:bg-gold/90">
              <Star size={10} className="mr-1 fill-black" /> Destaque
            </Badge>
          )}
        </div>
        <h3 className="font-bold text-white group-hover:text-gold transition-colors line-clamp-2">
          {article.title}
        </h3>
      </CardHeader>
      <CardContent className="p-5 pt-0">
        <p className="text-sm text-zinc-500 line-clamp-2 mb-4">
          {article.description}
        </p>
        <div className="flex items-center justify-between text-[11px] text-zinc-600 font-medium">
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1"><Clock size={12} /> {article.estimated_time}</span>
            <Badge variant="outline" className="text-[9px] uppercase border-zinc-800">{article.level}</Badge>
          </div>
          <span className="text-gold flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            Ler mais <ArrowRight size={12} />
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
