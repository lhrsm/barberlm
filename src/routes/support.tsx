import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/layout/AppLayout";
import { useState } from "react";
import { 
  LifeBuoy, 
  MessageCircle, 
  Headset, 
  Plus,
  ArrowLeft
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { TicketList } from "@/components/support/TicketList";
import { TicketForm } from "@/components/support/TicketForm";
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
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
        {!selectedTicket ? (
          <>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-primary/10 rounded-lg text-primary">
                    <Headset className="h-6 w-6" />
                  </div>
                  <h2 className="text-3xl font-bold tracking-tight">Suporte</h2>
                </div>
                <p className="text-muted-foreground">Estamos aqui para ajudar você a ter a melhor experiência com a Barbex.</p>
              </div>
              <Button onClick={() => setIsNewTicketOpen(true)} className="gap-2 shadow-lg shadow-primary/20">
                <Plus size={18} /> Novo Chamado
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="md:col-span-3 space-y-6">
                <div className="flex items-center justify-between border-b pb-4">
                  <h3 className="font-bold flex items-center gap-2">
                    <MessageCircle className="h-5 w-5 text-primary" />
                    Seus Chamados
                  </h3>
                </div>
                <TicketList onSelectTicket={setSelectedTicket} />
              </div>

              <div className="space-y-6">
                <div className="p-6 rounded-2xl bg-gradient-to-br from-primary/10 to-transparent border border-primary/20 space-y-4">
                  <h4 className="font-bold flex items-center gap-2">
                    <LifeBuoy className="h-4 w-4 text-primary" />
                    Canais de Atendimento
                  </h4>
                  <div className="space-y-3">
                    <div className="p-3 bg-card rounded-xl border text-sm">
                      <p className="font-bold mb-1">WhatsApp Oficial</p>
                      <p className="text-muted-foreground text-xs mb-3">Atendimento de Seg. a Sex. das 09h às 18h.</p>
                      <Button variant="outline" size="sm" className="w-full text-xs" asChild>
                        <a href="https://wa.me/5500000000000" target="_blank" rel="noopener noreferrer">Falar agora</a>
                      </Button>
                    </div>
                    <div className="p-3 bg-card rounded-xl border text-sm">
                      <p className="font-bold mb-1">E-mail Suporte</p>
                      <p className="text-muted-foreground text-xs mb-3">suporte@barbex.shop</p>
                      <Button variant="outline" size="sm" className="w-full text-xs" asChild>
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

        {isNewTicketOpen && (
          <Dialog open={isNewTicketOpen} onOpenChange={setIsNewTicketOpen}>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Abrir Novo Chamado</DialogTitle>
                <DialogDescription>
                  Descreva sua dúvida ou problema e nossa equipe responderá o mais breve possível.
                </DialogDescription>
              </DialogHeader>
              <TicketForm 
                onSuccess={handleTicketCreated} 
                onCancel={() => setIsNewTicketOpen(false)} 
              />
            </DialogContent>
          </Dialog>
        )}
      </div>
    </AppLayout>
  );
}
