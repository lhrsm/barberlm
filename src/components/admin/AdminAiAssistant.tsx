import { useState, useRef, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { askAdminAssistant } from "@/lib/admin-assistant.functions";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Send, Loader2, Bot, User, X } from "lucide-react";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface Msg {
  role: "user" | "assistant";
  content: string;
}

const SUGGESTIONS = [
  "Como está o MRR e o churn?",
  "Quais barbearias estão em risco de churn?",
  "Tem alguma anomalia crítica agora?",
  "Quantos novos cadastros nos últimos 30 dias?",
];

export function AdminAiAssistant() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Msg[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  const ask = useServerFn(askAdminAssistant);
  const mutation = useMutation({
    mutationFn: (question: string) =>
      ask({ data: { question, history: messages } }),
    onSuccess: (res: any) => {
      if (res?.error) {
        setMessages((m) => [...m, { role: "assistant", content: `❌ ${res.error}` }]);
      } else {
        setMessages((m) => [...m, { role: "assistant", content: res.answer || "(sem resposta)" }]);
      }
    },
    onError: (e: any) => {
      setMessages((m) => [...m, { role: "assistant", content: `❌ ${e.message || e}` }]);
    },
  });

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, mutation.isPending]);

  const send = (text: string) => {
    const q = text.trim();
    if (!q || mutation.isPending) return;
    setMessages((m) => [...m, { role: "user", content: q }]);
    setInput("");
    mutation.mutate(q);
  };

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-40 h-14 w-14 rounded-full shadow-2xl bg-gradient-to-br from-purple-500 to-fuchsia-600 hover:from-purple-400 hover:to-fuchsia-500 border border-white/10"
        title="Assistente IA (Super Admin)"
      >
        <Sparkles className="w-6 h-6 text-white" />
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-md p-0 bg-black/95 backdrop-blur-xl border-l border-white/10 text-white flex flex-col"
        >
          <SheetHeader className="p-4 border-b border-white/10 flex flex-row items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-gradient-to-br from-purple-500/30 to-fuchsia-500/30 border border-purple-500/40">
                <Sparkles className="w-4 h-4 text-purple-300" />
              </div>
              <div>
                <SheetTitle className="text-white text-base">Assistente IA</SheetTitle>
                <p className="text-[10px] text-white/50 uppercase tracking-widest">Super Admin · Read-only</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setOpen(false)}
              className="text-white/60 hover:text-white hover:bg-white/10"
            >
              <X className="w-4 h-4" />
            </Button>
          </SheetHeader>

          <ScrollArea className="flex-1 p-4" ref={scrollRef as any}>
            {messages.length === 0 ? (
              <div className="space-y-4">
                <div className="text-sm text-white/60 leading-relaxed">
                  Olá 👋 Sou o assistente do painel. Posso responder sobre <strong className="text-white">MRR, churn, saúde de barbearias, anomalias</strong> e outros dados do snapshot atual.
                </div>
                <div className="space-y-2">
                  <p className="text-[10px] uppercase tracking-widest text-white/40 font-bold">Sugestões</p>
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => send(s)}
                      className="w-full text-left px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-purple-500/40 text-sm text-white/80 transition-colors"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map((msg, i) => (
                  <div
                    key={i}
                    className={cn(
                      "flex gap-2",
                      msg.role === "user" ? "flex-row-reverse" : "flex-row"
                    )}
                  >
                    <div
                      className={cn(
                        "flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center",
                        msg.role === "user"
                          ? "bg-purple-500/30 border border-purple-500/50"
                          : "bg-white/10 border border-white/20"
                      )}
                    >
                      {msg.role === "user" ? (
                        <User className="w-3.5 h-3.5 text-purple-300" />
                      ) : (
                        <Bot className="w-3.5 h-3.5 text-white/80" />
                      )}
                    </div>
                    <div
                      className={cn(
                        "max-w-[85%] rounded-2xl px-3 py-2 text-sm",
                        msg.role === "user"
                          ? "bg-purple-500/20 border border-purple-500/30 text-white"
                          : "bg-white/5 border border-white/10 text-white/90"
                      )}
                    >
                      {msg.role === "assistant" ? (
                        <div className="prose prose-invert prose-sm max-w-none prose-p:my-1 prose-ul:my-1 prose-headings:mt-2 prose-headings:mb-1 prose-strong:text-white">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                        </div>
                      ) : (
                        <span className="whitespace-pre-wrap">{msg.content}</span>
                      )}
                    </div>
                  </div>
                ))}
                {mutation.isPending && (
                  <div className="flex gap-2">
                    <div className="w-7 h-7 rounded-full bg-white/10 border border-white/20 flex items-center justify-center">
                      <Bot className="w-3.5 h-3.5 text-white/80" />
                    </div>
                    <div className="bg-white/5 border border-white/10 rounded-2xl px-3 py-2 text-sm text-white/60 flex items-center gap-2">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Analisando snapshot...
                    </div>
                  </div>
                )}
              </div>
            )}
          </ScrollArea>

          <div className="p-3 border-t border-white/10">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                send(input);
              }}
              className="flex gap-2"
            >
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Pergunte algo…"
                className="bg-white/5 border-white/10 text-white placeholder:text-white/40 focus-visible:ring-purple-500/50"
                disabled={mutation.isPending}
              />
              <Button
                type="submit"
                disabled={!input.trim() || mutation.isPending}
                className="bg-purple-500 hover:bg-purple-400 text-white"
              >
                {mutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </Button>
            </form>
            <div className="flex items-center justify-between mt-2">
              <Badge className="bg-white/5 text-white/40 border-white/10 text-[9px]">
                Read-only · não executa ações
              </Badge>
              {messages.length > 0 && (
                <button
                  onClick={() => setMessages([])}
                  className="text-[10px] text-white/40 hover:text-white/70"
                >
                  Limpar conversa
                </button>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
