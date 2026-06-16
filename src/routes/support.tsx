import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/layout/AppLayout";
import { useState } from "react";
import {
  LifeBuoy,
  MessageCircle,
  Headset,
  Plus,
  Mail,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { TicketList } from "@/components/support/TicketList";
import { CreateTicketModal } from "@/components/support/CreateTicketModal";
import { TicketDetails } from "@/components/support/TicketDetails";
import { useQueryClient } from "@tanstack/react-query";

export const Route = createFileRoute("/support")({
  component: SupportPage,
});

function SupportPage() {
  const [isNewTicketOpen, setIsNewTicketOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<any>(null);
  const queryClient = useQueryClient();

  const handleTicketCreated = () => {
    setIsNewTicketOpen(false);
    queryClient.invalidateQueries({ queryKey: ["tenant-tickets"] });
  };

  return (
    <AppLayout>
      <div className="min-h-screen bg-[#05070d] text-white">
        <div className="p-4 md:p-8 space-y-8 max-w-[1400px] mx-auto animate-in fade-in duration-500">
          {!selectedTicket ? (
            <>
              {/* HEADER */}
              <header className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 sm:flex sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-4">
                  <div className="shrink-0 h-14 w-14 rounded-2xl bg-gradient-to-br from-[#f59e0b]/20 to-[#ea580c]/5 border border-[#f59e0b]/30 grid place-items-center shadow-[0_4px_20px_rgba(245,158,11,0.15)]">
                    <Headset className="h-7 w-7 text-[#f59e0b]" />
                  </div>
                  <div className="min-w-0">
                    <h1 className="text-2xl md:text-3xl font-black tracking-tight truncate">
                      Suporte
                    </h1>
                    <p className="text-sm text-zinc-400 mt-1 truncate">
                      Estamos aqui para ajudar você a ter a melhor experiência com a Barbex.
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0">
                  <Button
                    onClick={() => setIsNewTicketOpen(true)}
                    className="h-[42px] px-[18px] rounded-xl bg-gradient-to-r from-[#f59e0b] to-[#ea580c] hover:from-[#fbbf24] hover:to-[#f59e0b] text-white font-bold shadow-[0_4px_16px_rgba(245,158,11,0.3)] hover:shadow-[0_6px_24px_rgba(245,158,11,0.45)] transition-all hover:-translate-y-0.5"
                  >
                    <Plus className="h-4 w-4 mr-2" /> Novo Chamado
                  </Button>
                </div>
              </header>

              {/* CONTENT GRID */}
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                {/* TICKETS */}
                <div className="lg:col-span-3">
                  <div className="bg-[#0b0f17] border border-zinc-800/80 rounded-2xl p-6 space-y-5">
                    <div className="flex items-center justify-between border-b border-zinc-800/80 pb-4">
                      <h3 className="font-bold flex items-center gap-2 text-white">
                        <MessageCircle className="h-5 w-5 text-[#f59e0b]" />
                        Seus Chamados
                      </h3>
                    </div>
                    <TicketList onSelectTicket={setSelectedTicket} />
                  </div>
                </div>

                {/* CHANNELS */}
                <div className="space-y-6">
                  <div className="p-6 rounded-2xl bg-[#0b0f17] border border-[#f59e0b]/20 space-y-4">
                    <h4 className="font-bold flex items-center gap-2 text-white">
                      <LifeBuoy className="h-4 w-4 text-[#f59e0b]" />
                      Canais de Atendimento
                    </h4>
                    <div className="space-y-3">
                      <div className="p-4 bg-[#05070d] rounded-xl border border-zinc-800/80 text-sm">
                        <p className="font-bold mb-1 text-white flex items-center gap-2">
                          <MessageCircle className="h-4 w-4 text-emerald-400" />
                          WhatsApp Oficial
                        </p>
                        <p className="text-zinc-400 text-xs mb-3">
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
                      <div className="p-4 bg-[#05070d] rounded-xl border border-zinc-800/80 text-sm">
                        <p className="font-bold mb-1 text-white flex items-center gap-2">
                          <Mail className="h-4 w-4 text-[#f59e0b]" />
                          E-mail Suporte
                        </p>
                        <p className="text-zinc-400 text-xs mb-3">
                          suporte@barbex.shop
                        </p>
                        <Button
                          size="sm"
                          className="w-full h-9 rounded-lg bg-[#f59e0b]/10 border border-[#f59e0b]/30 text-[#f59e0b] hover:bg-[#f59e0b]/20 hover:text-[#fbbf24] text-xs font-semibold transition-all"
                          asChild
                        >
                          <a href="mailto:suporte@barbex.shop">Enviar e-mail</a>
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
        </div>
      </div>
    </AppLayout>
  );
}
