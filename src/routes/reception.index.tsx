import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  CalendarPlus,
  UserPlus,
  Users,
  Clock,
  LogIn,
  Footprints,
  CircleDollarSign,
  ListChecks,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AppointmentModal } from "@/components/calendar/AppointmentModal";
import { WalkinModal } from "@/components/calendar/WalkinModal";
import { ReceptionQueue } from "@/components/reception/ReceptionQueue";
import { useReception } from "@/hooks/use-reception";

export const Route = createFileRoute("/reception/")({
  head: () => ({
    meta: [
      { title: "Central de Atendimento | Recepção Barbex" },
      { name: "description", content: "Resumo operacional do dia: atendimentos, check-ins, walk-ins e pagamentos pendentes." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Central de Atendimento | Recepção Barbex" },
      { property: "og:description", content: "Resumo operacional do dia da barbearia." },
    ],
  }),
  component: ReceptionHome,
});

function greeting() {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return "Bom dia";
  if (h >= 12 && h < 18) return "Boa tarde";
  return "Boa noite";
}

function KpiCard({ label, value, icon: Icon }: { label: string; value: string | number; icon: any }) {
  return (
    <Card className="flex items-center gap-3 p-4">
      <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="h-5 w-5" aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-xl font-semibold tabular-nums">{value}</p>
      </div>
    </Card>
  );
}

function ReceptionHome() {
  const { tenantId, profile, can } = useReception();
  const [apptOpen, setApptOpen] = useState(false);
  const [walkinOpen, setWalkinOpen] = useState(false);
  const day = format(new Date(), "yyyy-MM-dd");

  const { data: stats, isLoading } = useQuery({
    queryKey: ["reception-stats", tenantId, day],
    enabled: !!tenantId,
    refetchInterval: 60_000,
    queryFn: async () => {
      const start = `${day}T00:00:00`;
      const end = `${day}T23:59:59`;

      const [{ data: appts }, { count: checkins }, { count: waiting }] = await Promise.all([
        supabase
          .from("appointments")
          .select("id, status, start_time, payment_status, source")
          .eq("tenant_id", tenantId!)
          .gte("start_time", start)
          .lte("start_time", end),
        supabase
          .from("appointment_checkins")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", tenantId!)
          .gte("checked_in_at", start)
          .lte("checked_in_at", end),
        supabase
          .from("waiting_list")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", tenantId!)
          .eq("status", "aguardando"),
      ]);

      const list = appts || [];
      const now = new Date();
      return {
        today: list.length,
        next: list.filter(
          (a: any) => new Date(a.start_time) > now && !["cancelled", "completed"].includes(a.status),
        ).length,
        checkins: checkins ?? 0,
        walkins: list.filter((a: any) => a.source === "walkin").length,
        pendingPayment: list.filter(
          (a: any) => a.payment_status && a.payment_status !== "paid" && a.status !== "cancelled",
        ).length,
        waiting: waiting ?? 0,
      };
    },
  });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Central de Atendimento</h1>
        <p className="text-sm text-muted-foreground">
          {greeting()}, <span className="uppercase">{(profile as any)?.full_name?.split(' ')[0] || (profile as any)?.business_name || "recepção"}</span>. Aqui está a operação de hoje.
        </p>
      </header>

      {/* Atalhos rápidos */}
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => setApptOpen(true)}>
          <CalendarPlus className="mr-2 h-4 w-4" aria-hidden /> Novo agendamento
        </Button>
        <Button variant="outline" onClick={() => setWalkinOpen(true)}>
          <Footprints className="mr-2 h-4 w-4" aria-hidden /> Adicionar atendimento presencial
        </Button>
        <Button variant="outline" asChild>
          <a href="/reception/waiting-list">
            <ListChecks className="mr-2 h-4 w-4" aria-hidden /> Lista de espera
          </a>
        </Button>
        <Button variant="outline" asChild>
          <a href="/reception/customers">
            <UserPlus className="mr-2 h-4 w-4" aria-hidden /> Clientes
          </a>
        </Button>
      </div>

      {/* KPIs */}
      {isLoading ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
          <KpiCard label="Atendimentos hoje" value={stats?.today ?? 0} icon={Users} />
          <KpiCard label="Próximos" value={stats?.next ?? 0} icon={Clock} />
          <KpiCard label="Check-ins" value={stats?.checkins ?? 0} icon={LogIn} />
          <KpiCard label="Walk-ins" value={stats?.walkins ?? 0} icon={Footprints} />
          {can("view_finances_summary") && (
            <KpiCard label="Pagamentos pendentes" value={stats?.pendingPayment ?? 0} icon={CircleDollarSign} />
          )}
          <KpiCard label="Lista de espera" value={stats?.waiting ?? 0} icon={ListChecks} />
        </div>
      )}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Fila de Atendimento</h2>
        <ReceptionQueue />
      </section>

      <AppointmentModal open={apptOpen} onOpenChange={setApptOpen} />
      <WalkinModal open={walkinOpen} onOpenChange={setWalkinOpen} />
    </div>
  );
}
