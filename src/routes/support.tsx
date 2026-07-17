import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/layout/AppLayout";
import { useState } from "react";
import {
  LifeBuoy,
  MessageCircle,
  Headset,
  Plus,
  Mail,
  Lightbulb,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { TicketList } from "@/components/support/TicketList";
import { CreateTicketModal } from "@/components/support/CreateTicketModal";
import { TicketDetails } from "@/components/support/TicketDetails";
import { EmailContactModal } from "@/components/support/EmailContactModal";
import { useQueryClient } from "@tanstack/react-query";
import { withModule } from "@/components/modules/withModule";

export const Route = createFileRoute("/support")({
  component: withModule("support", "Suporte", SupportPage),
});

function SupportPage() {
  const [isNewTicketOpen, setIsNewTicketOpen] = useState(false);
  const [isSuggestionOpen, setIsSuggestionOpen] = useState(false);
  const [isEmailOpen, setIsEmailOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<any>(null);
  const queryClient = useQueryClient();

  const handleTicketCreated = () => {
    setIsNewTicketOpen(false);
    queryClient.invalidateQueries({ queryKey: ["tenant-tickets"] });
  };

  const handleSuggestionSent = () => {
    setIsSuggestionOpen(false);
    queryClient.invalidateQueries({ queryKey: ["tenant-tickets"] });
  };

  return (
    <AppLayout>
      <div className="min-h-screen bg-[#050816] text-white overflow-x-hidden">
        <div className="p-4 md:p-8 space-y-6 md:space-y-8 max-w-[1400px] mx-auto animate-in fade-in duration-500 w-full">
          {!selectedTicket ? (
            <>
              {/* HEADER */}
              <header className="flex flex-col items-start gap-3 sm:grid sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-4">
                <div className="flex min-w-0 items-center gap-3 sm:gap-4 w-full">
                  <div className="shrink-0 h-12 w-12 sm:h-14 sm:w-14 rounded-2xl bg-gradient-to-br from-[#f59e0b]/20 to-[#ea580c]/5 border border-[#f59e0b]/30 grid place-items-center shadow-[0_4px_20px_rgba(245,158,11,0.15)]">
                    <Headset className="h-6 w-6 sm:h-7 sm:w-7 text-[#f59e0b]" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h1 className="text-[28px] sm:text-3xl font-black tracking-tight leading-tight">
                      Suporte
                    </h1>
                    <p className="text-[13px] sm:text-sm text-zinc-400 mt-1">
                      Central de atendimento e chamados
                    </p>
                  </div>
                </div>
                <div className="flex w-full sm:w-auto sm:shrink-0 flex-col sm:flex-row gap-2">
                  <Button
                    onClick={() => setIsSuggestionOpen(true)}
                    variant="outline"
                    className="w-full sm:w-auto h-[46px] sm:h-[42px] px-[18px] rounded-[14px] sm:rounded-xl bg-[#f59e0b]/10 border-[#f59e0b]/30 text-[#f59e0b] hover:bg-[#f59e0b]/20 hover:text-[#fbbf24] font-semibold transition-all"
                  >
                    <Lightbulb className="h-4 w-4 mr-2" /> Enviar Sugestão
                  </Button>
                  <Button
                    onClick={() => setIsNewTicketOpen(true)}
                    className="w-full sm:w-auto h-[46px] sm:h-[42px] px-[18px] rounded-[14px] sm:rounded-xl bg-gradient-to-r from-[#f59e0b] to-[#ea580c] hover:from-[#fbbf24] hover:to-[#f59e0b] text-white font-semibold sm:font-bold shadow-[0_4px_16px_rgba(245,158,11,0.3)] hover:shadow-[0_6px_24px_rgba(245,158,11,0.45)] transition-all hover:-translate-y-0.5"
                  >
                    <Plus className="h-4 w-4 mr-2" /> Novo Chamado
                  </Button>
                </div>
              </header>

              {/* CONTENT GRID */}
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 md:gap-6">
                {/* TICKETS */}
                <div className="lg:col-span-3 min-w-0">
                  <div className="bg-[#0A1020] border border-[rgba(255,184,0,0.12)] rounded-[20px] p-4 md:p-6 space-y-4 md:space-y-5">
                    <div className="flex items-center justify-between border-b border-zinc-800/80 pb-4">
                      <h3 className="text-base font-bold flex items-center gap-2 text-white">
                        <MessageCircle className="h-5 w-5 text-[#f59e0b]" />
                        Seus Chamados
                      </h3>
                    </div>
                    <TicketList onSelectTicket={setSelectedTicket} />
                  </div>
                </div>

                {/* CHANNELS */}
                <div className="space-y-4 md:space-y-6 min-w-0">
                  <div className="p-4 md:p-6 rounded-[20px] bg-[#0A1020] border border-[rgba(255,184,0,0.12)] space-y-4">
                    <h4 className="text-base font-bold flex items-center gap-2 text-white">
                      <LifeBuoy className="h-4 w-4 text-[#f59e0b]" />
                      Canais de Atendimento
                    </h4>
                    <div className="grid grid-cols-1 gap-3 md:gap-4">
                      <div className="w-full p-4 bg-[#050816] rounded-xl border border-zinc-800/80 text-sm transition-all hover:border-[#f59e0b]/30">
                        <p className="text-base font-bold mb-1 text-white flex items-center gap-2">
                          <MessageCircle className="h-4 w-4 text-emerald-400" />
                          WhatsApp Oficial
                        </p>
                        <p className="text-zinc-400 text-[13px] mb-3">
                          Atendimento de Seg. a Sex. das 09h às 18h.
                        </p>
                        <Button
                          size="sm"
                          className="w-full h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 hover:text-emerald-300 text-xs font-semibold transition-all"
                          asChild
                        >
                          <a
                            href="https://wa.me/5500000000000"
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            Falar agora
                          </a>
                        </Button>
                      </div>
                      <div className="w-full p-4 bg-[#050816] rounded-xl border border-zinc-800/80 text-sm transition-all hover:border-[#f59e0b]/30">
                        <p className="text-base font-bold mb-1 text-white flex items-center gap-2">
                          <Mail className="h-4 w-4 text-[#f59e0b]" />
                          E-mail Suporte
                        </p>
                        <p className="text-zinc-400 text-[13px] mb-3">
                          suporte@barbex.shop
                        </p>
                        <Button
                          size="sm"
                          onClick={() => setIsEmailOpen(true)}
                          className="w-full h-9 rounded-lg bg-[#f59e0b]/10 border border-[#f59e0b]/30 text-[#f59e0b] hover:bg-[#f59e0b]/20 hover:text-[#fbbf24] text-xs font-semibold transition-all"
                        >
                          Enviar e-mail
                        </Button>
                      </div>
                      <div className="w-full p-4 bg-[#050816] rounded-xl border border-zinc-800/80 text-sm transition-all hover:border-[#f59e0b]/30">
                        <p className="text-base font-bold mb-1 text-white flex items-center gap-2">
                          <Lightbulb className="h-4 w-4 text-amber-300" />
                          Sugestões
                        </p>
                        <p className="text-zinc-400 text-[13px] mb-3">
                          Tem uma ideia para melhorar o Barbex? Envie para nossa equipe.
                        </p>
                        <Button
                          size="sm"
                          onClick={() => setIsSuggestionOpen(true)}
                          className="w-full h-9 rounded-lg bg-amber-400/10 border border-amber-400/30 text-amber-300 hover:bg-amber-400/20 hover:text-amber-200 text-xs font-semibold transition-all"
                        >
                          Enviar sugestão
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </>

          ) : (
            <TicketDetails
              ticket={selectedTicket}
              onBack={() => {
                setSelectedTicket(null);
                queryClient.invalidateQueries({ queryKey: ["tenant-tickets"] });
              }}
            />
          )}

          <CreateTicketModal
            isOpen={isNewTicketOpen}
            onClose={() => setIsNewTicketOpen(false)}
            onSuccess={handleTicketCreated}
          />

          <EmailContactModal
            isOpen={isEmailOpen}
            onClose={() => setIsEmailOpen(false)}
          />
        </div>
      </div>
    </AppLayout>
  );
}
