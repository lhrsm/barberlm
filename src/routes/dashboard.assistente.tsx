import React from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { 
  Sparkles, 
  MessageSquare, 
  Send,
  User,
  Bot,
  Zap,
  HelpCircle,
  Database,
  ArrowRight,
  TrendingUp,
  Users,
  Calendar,
  Wallet
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

export const Route = createFileRoute("/dashboard/assistente")({
  component: AIAssistantPage,
});

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

function AIAssistantPage() {
  const [messages, setMessages] = React.useState<Message[]>([
    {
      role: "assistant",
      content: "Olá! Sou o Assistente Barbex. Como posso ajudar com os dados da sua barbearia hoje?",
      timestamp: new Date(),
    }
  ]);
  const [input, setInput] = React.useState("");
  const scrollRef = React.useRef<HTMLDivElement>(null);

  const suggestedQuestions = [
    { text: "Quanto faturei este mês?", icon: Wallet },
    { text: "Qual profissional teve maior ocupação?", icon: User },
    { text: "Quais clientes ainda não retornaram?", icon: Users },
    { text: "Como está o meu ticket médio?", icon: TrendingUp },
  ];

  const handleSend = () => {
    if (!input.trim()) return;
    
    const userMsg: Message = {
      role: "user",
      content: input,
      timestamp: new Date(),
    };
    
    setMessages(prev => [...prev, userMsg]);
    setInput("");

    // Simulate response
    setTimeout(() => {
      const botMsg: Message = {
        role: "assistant",
        content: "Estou processando seus dados operacionais. Em breve poderei responder perguntas complexas usando a Central de KPIs do Barbex.",
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, botMsg]);
    }, 1000);
  };

  React.useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <div className="flex flex-col h-[calc(100vh-180px)] max-w-5xl mx-auto gap-6 animate-in fade-in duration-500">
      {/* Header Info */}
      <div className="flex items-center justify-between p-6 rounded-3xl bg-zinc-900/50 border border-gold/10 backdrop-blur-xl shrink-0">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-gold/10 rounded-2xl">
            <Sparkles className="h-6 w-6 text-gold" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black text-white tracking-tight italic uppercase">Assistente AI</h1>
              <Badge className="bg-gold text-black font-black uppercase tracking-widest text-[9px] px-2 py-0.5 shadow-[0_0_15px_rgba(212,175,55,0.3)] border-none">
                Beta
              </Badge>
            </div>
            <p className="text-white/40 text-xs font-bold uppercase tracking-widest mt-0.5">Inteligência Operacional Barbex</p>
          </div>
        </div>
        
        <div className="hidden md:flex items-center gap-6">
           <div className="flex flex-col items-end">
             <span className="text-[10px] font-black text-white/30 uppercase tracking-widest">Base de Dados</span>
             <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
               <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
               Sincronizado
             </span>
           </div>
        </div>
      </div>

      <div className="flex flex-1 gap-6 overflow-hidden">
        {/* Chat Area */}
        <Card className="flex-1 bg-[#0b0f17]/40 border-white/5 rounded-[2.5rem] flex flex-col overflow-hidden backdrop-blur-sm">
          <div 
            ref={scrollRef}
            className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-hide"
          >
            <AnimatePresence initial={false}>
              {messages.map((msg, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn(
                    "flex gap-4 max-w-[85%]",
                    msg.role === "user" ? "ml-auto flex-row-reverse" : "mr-auto"
                  )}
                >
                  <div className={cn(
                    "w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border",
                    msg.role === "assistant" 
                      ? "bg-gold/10 border-gold/20 text-gold" 
                      : "bg-white/5 border-white/10 text-zinc-400"
                  )}>
                    {msg.role === "assistant" ? <Bot size={18} /> : <User size={18} />}
                  </div>
                  
                  <div className={cn(
                    "p-4 rounded-2xl text-sm leading-relaxed",
                    msg.role === "assistant"
                      ? "bg-white/[0.03] border border-white/5 text-zinc-300 rounded-tl-none"
                      : "bg-gold text-black font-bold rounded-tr-none shadow-[0_10px_20px_-10px_rgba(212,175,55,0.3)]"
                  )}>
                    {msg.content}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          <div className="p-6 bg-white/[0.02] border-t border-white/5">
            <div className="relative group">
              <Input 
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSend()}
                placeholder="Ex: Qual foi meu faturamento hoje?" 
                className="h-14 bg-zinc-950/50 border-white/10 rounded-2xl text-white font-medium pr-14 focus:border-gold/50 transition-all placeholder:text-zinc-600"
              />
              <Button 
                onClick={handleSend}
                disabled={!input.trim()}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-xl bg-gold hover:bg-gold/90 text-black p-0 disabled:opacity-30 disabled:bg-zinc-800"
              >
                <Send size={18} />
              </Button>
            </div>
            <p className="text-[10px] text-zinc-600 mt-3 text-center font-medium">
              O assistente analisa dados anonimizados para insights operacionais.
            </p>
          </div>
        </Card>

        {/* Sidebar Info */}
        <div className="hidden lg:flex flex-col gap-6 w-80 shrink-0">
          <Card className="bg-[#0b0f17]/40 border-white/5 rounded-[2.5rem] p-6 backdrop-blur-sm">
            <h3 className="text-xs font-black text-gold uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
              <HelpCircle size={14} /> Sugestões
            </h3>
            <div className="space-y-3">
              {suggestedQuestions.map((q, i) => (
                <button 
                  key={i}
                  onClick={() => setInput(q.text)}
                  className="w-full text-left p-4 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-gold/30 hover:bg-gold/5 group transition-all"
                >
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-zinc-900 group-hover:bg-gold/10 transition-colors">
                      <q.icon size={14} className="text-zinc-500 group-hover:text-gold" />
                    </div>
                    <div className="flex-1">
                      <p className="text-[11px] font-bold text-zinc-400 group-hover:text-zinc-200 leading-snug">
                        {q.text}
                      </p>
                    </div>
                    <ArrowRight size={12} className="text-zinc-700 group-hover:text-gold mt-1 opacity-0 group-hover:opacity-100 transition-all" />
                  </div>
                </button>
              ))}
            </div>
          </Card>

          <Card className="bg-[#0b0f17]/40 border-white/5 rounded-[2.5rem] p-6 backdrop-blur-sm flex-1">
            <h3 className="text-xs font-black text-white/40 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
              <Database size={14} /> Integração
            </h3>
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {['CRM', 'Financeiro', 'Agenda', 'Estoque'].map(tag => (
                  <Badge key={tag} variant="outline" className="bg-zinc-950/50 border-white/5 text-[9px] text-zinc-500 font-bold uppercase tracking-widest px-2">
                    {tag}
                  </Badge>
                ))}
              </div>
              <p className="text-[10px] text-zinc-500 font-medium leading-relaxed">
                Dados processados localmente via Central de KPIs Barbex.
              </p>
              
              <div className="pt-4 border-t border-white/5">
                <div className="flex items-center gap-3 p-3 rounded-2xl bg-emerald-500/5 border border-emerald-500/10">
                  <Zap size={14} className="text-emerald-400" />
                  <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Tempo Real</span>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
