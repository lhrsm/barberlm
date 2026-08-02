import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, addDays, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight, CalendarPlus, Footprints } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AppointmentModal } from "@/components/calendar/AppointmentModal";
import { WalkinModal } from "@/components/calendar/WalkinModal";
import { ReceptionQueue } from "@/components/reception/ReceptionQueue";
import { useReception } from "@/hooks/use-reception";

export const Route = createFileRoute("/reception/agenda")({
  head: () => ({
    meta: [
      { title: "Agenda da Recepção | Barbex" },
      { name: "description", content: "Agenda operacional do dia com filtro por profissional, check-in e ações rápidas." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Agenda da Recepção | Barbex" },
      { property: "og:description", content: "Agenda operacional do dia da barbearia." },
    ],
  }),
  component: ReceptionAgenda,
});

function ReceptionAgenda() {
  const { tenantId } = useReception();
  const [date, setDate] = useState(() => new Date());
  const [barber, setBarber] = useState("all");
  const [apptOpen, setApptOpen] = useState(false);
  const [walkinOpen, setWalkinOpen] = useState(false);

  const day = format(date, "yyyy-MM-dd");

  const { data: barbers } = useQuery({
    queryKey: ["reception-barbers", tenantId],
    enabled: !!tenantId,
    staleTime: 300_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("barbers")
        .select("id, name")
        .eq("tenant_id", tenantId!)
        .eq("active", true)
        .order("name");
      return data || [];
    },
  });

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Agenda</h1>
          <p className="text-sm capitalize text-muted-foreground">
            {format(date, "EEEE, dd 'de' MMMM", { locale: ptBR })}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="icon" aria-label="Dia anterior" onClick={() => setDate((d) => subDays(d, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setDate(new Date())}>
            Hoje
          </Button>
          <Button variant="outline" size="icon" aria-label="Próximo dia" onClick={() => setDate((d) => addDays(d, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Select value={barber} onValueChange={setBarber}>
            <SelectTrigger className="w-48" aria-label="Filtrar por profissional">
              <SelectValue placeholder="Profissional" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os profissionais</SelectItem>
              {(barbers || []).map((b: any) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={() => setApptOpen(true)}>
            <CalendarPlus className="mr-2 h-4 w-4" aria-hidden /> Novo
          </Button>
          <Button variant="outline" onClick={() => setWalkinOpen(true)}>
            <Footprints className="mr-2 h-4 w-4" aria-hidden /> Walk-in
          </Button>
        </div>
      </header>

      <ReceptionQueue key={`${day}-${barber}`} date={day} barberId={barber === "all" ? undefined : barber} />

      <AppointmentModal open={apptOpen} onOpenChange={setApptOpen} initialDate={day} />
      <WalkinModal open={walkinOpen} onOpenChange={setWalkinOpen} />
    </div>
  );
}
