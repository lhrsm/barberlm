import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PlayCircle, FileText, ExternalLink, Clock, Star } from "lucide-react";
import { motion } from "framer-motion";

interface TutorialCardProps {
  tutorial: any;
  onClick: (tutorial: any) => void;
}

export function TutorialCard({ tutorial, onClick }: TutorialCardProps) {
  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'video': return <PlayCircle size={16} />;
      case 'pdf': return <FileText size={16} />;
      case 'link': return <ExternalLink size={16} />;
      default: return <FileText size={16} />;
    }
  };

  const getTypeText = (type: string) => {
    switch (type) {
      case 'video': return 'Vídeo';
      case 'pdf': return 'Manual PDF';
      case 'link': return 'Link Externo';
      default: return 'Documento';
    }
  };

  return (
    <motion.div
      whileHover={{ y: -5 }}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card 
        className="overflow-hidden border-white/10 bg-black/40 backdrop-blur-xl group cursor-pointer h-full flex flex-col"
        onClick={() => onClick(tutorial)}
      >
        <div className="relative aspect-video overflow-hidden">
          {tutorial.thumbnail_url ? (
            <img 
              src={tutorial.thumbnail_url} 
              alt={tutorial.title} 
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-purple-900/40 to-pink-900/40 flex items-center justify-center">
              {getTypeIcon(tutorial.type)}
            </div>
          )}
          
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-white border border-white/30">
              {tutorial.type === 'video' ? <PlayCircle size={24} fill="white" /> : <ExternalLink size={24} />}
            </div>
          </div>

          <div className="absolute top-2 left-2 flex gap-2">
            <Badge className="bg-black/60 backdrop-blur-md border-white/10 text-[10px] py-0 px-2 h-5">
              {getTypeText(tutorial.type)}
            </Badge>
            {tutorial.is_featured && (
              <Badge className="bg-yellow-500/80 backdrop-blur-md border-white/10 text-[10px] py-0 px-2 h-5">
                <Star size={10} className="mr-1 fill-current" /> Destaque
              </Badge>
            )}
          </div>
        </div>

        <CardHeader className="p-4 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-purple-400 uppercase tracking-widest">
              {tutorial.category?.name || "Geral"}
            </span>
          </div>
          <h3 className="font-bold text-base group-hover:text-purple-400 transition-colors line-clamp-1">{tutorial.title}</h3>
        </CardHeader>
        
        <CardContent className="p-4 pt-0 flex-1">
          <p className="text-xs text-gray-400 line-clamp-2 mb-4 leading-relaxed">
            {tutorial.description || "Nenhuma descrição fornecida."}
          </p>
        </CardContent>

        <CardFooter className="p-4 pt-0 flex items-center justify-between border-t border-white/5 bg-white/[0.02]">
          <span className="flex items-center gap-1 text-[10px] text-gray-500 font-medium">
            <Clock size={12} /> {tutorial.duration || "5 min"}
          </span>
          <Button variant="ghost" size="sm" className="h-7 text-[10px] font-bold uppercase tracking-wider text-purple-400 hover:text-purple-300 hover:bg-purple-400/10">
            Acessar agora
          </Button>
        </CardFooter>
      </Card>
    </motion.div>
  );
}
