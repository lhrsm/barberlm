import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { icons as LucideIcons, BookOpen } from "lucide-react";
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
      <TutorialCardInner tutorial={tutorial} onClick={onClick} />
    </motion.div>
  );
}
