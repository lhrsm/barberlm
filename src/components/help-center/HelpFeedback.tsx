import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ThumbsUp, ThumbsDown, MessageSquare } from "lucide-react";
import { toast } from "sonner";

export function HelpFeedback({ articleId }: { articleId: string }) {
  const [submitted, setSubmitted] = useState(false);

  const handleFeedback = (type: 'useful' | 'not-useful') => {
    setSubmitted(true);
    toast.success("Obrigado pelo seu feedback!");
  };

  if (submitted) {
    return (
      <div className="p-8 text-center bg-gold/5 border border-gold/20 rounded-3xl animate-in zoom-in-95">
        <p className="text-gold font-bold">Feedback enviado com sucesso!</p>
        <p className="text-sm text-zinc-500 mt-1">Sua opinião ajuda a melhorar nossa base de conhecimento.</p>
      </div>
    );
  }

  return (
    <div className="p-8 bg-[#0b0f17] border border-zinc-800 rounded-3xl space-y-6">
      <div className="text-center">
        <h4 className="text-lg font-bold text-white">Este conteúdo foi útil?</h4>
        <p className="text-sm text-zinc-500 mt-1">Sua avaliação é anônima e nos ajuda muito.</p>
      </div>
      <div className="flex flex-wrap justify-center gap-4">
        <Button 
          variant="outline" 
          onClick={() => handleFeedback('useful')}
          className="h-12 px-6 rounded-2xl border-zinc-800 hover:border-emerald-500/50 hover:bg-emerald-500/5 hover:text-emerald-500 transition-all gap-2"
        >
          <ThumbsUp size={18} /> Sim, ajudou
        </Button>
        <Button 
          variant="outline"
          onClick={() => handleFeedback('not-useful')}
          className="h-12 px-6 rounded-2xl border-zinc-800 hover:border-rose-500/50 hover:bg-rose-500/5 hover:text-rose-500 transition-all gap-2"
        >
          <ThumbsDown size={18} /> Não muito
        </Button>
        <Button 
          variant="ghost"
          className="h-12 px-6 rounded-2xl text-zinc-500 hover:text-white gap-2"
        >
          <MessageSquare size={18} /> Deixar comentário
        </Button>
      </div>
    </div>
  );
}
