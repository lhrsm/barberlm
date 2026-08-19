import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format, parseISO, differenceInMinutes } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CheckCircle2, LogIn, PlayCircle, XCircle, Eye, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EntityAvatar } from "@/components/calendar/appointment/EntityAvatar";
import { AppointmentDetailsModal } from "@/components/calendar/AppointmentDetailsModal";
import { useAppointmentStatus } from "@/hooks/use-appointment-status";
import { useReception } from "@/hooks/use-reception";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const STATUS_LABEL: Record<string, string> = {
  pending: "Aguardando confirmação",
  scheduled: "Aguardando confirmação",
  confirmed: "Confirmado",
  checked_in: "Check-in realizado",
  in_progress: "Em atendimento",
  completed: "Concluído",
  cancelled: "Cancelado",
  no_show: "No-show",
  rescheduled: "Reagendado",
};

const STATUS_CLASS: Record<string, string> = {
  pending: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  scheduled: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  confirmed: "bg-primary/15 text-primary",
  checked_in: "bg-sky-500/15 text-sky-600 dark:text-sky-400",
  in_progress: "bg-violet-500/15 text-violet-600 dark:text-violet-400",
  completed: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  cancelled: "bg-destructive/15 text-destructive",
  no_show: "bg-destructive/15 text-destructive",
  rescheduled: "bg-muted text-muted-foreground",
};

function delayInfo(startTime: string, arrived: string | null) {
  if (!arrived) return null;
  const diff = differenceInMinutes(parseISO(arrived), parseISO(startTime));
  if (diff <= 0) return { label: "No horário", tone: "text-emerald-600 dark:text-emerald-400" };
  if (diff <= 5) return { label: `+${diff} min`, tone: "text-amber-600 dark:text-amber-400" };
  if (diff <= 15) return { label: `Atraso moderado (${diff} min)`, tone: "text-orange-600 dark:text-orange-400" };
  return { label: `Atraso crítico (${diff} min)`, tone: "text-destructive" };
}

export function ReceptionQueue({ date, barberId }: { date?: string; barberId?: string }) {
  const { tenantId, can } = useReception();
  const { updateStatus } = useAppointmentStatus();
  const queryClient = useQueryClient();
  const [detailsId, setDetailsId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const day = date || format(new Date(), "yyyy-MM-dd");

  const { data, isLoading } = useQuery({
    queryKey: ["reception-queue", tenantId, day, barberId ?? "all"],
    enabled: !!tenantId,
    refetchInterval: 60_000,
    queryFn: async () => {
      const start = `${day}T00:00:00`;
      const end = `${day}T23:59:59`;

      let apptQuery = supabase
        .from("appointments")
        .select(
          "*, customers(*), barbers:barbers!appointments_barber_id_fkey(*), services(*)",
        )
        .eq("tenant_id", tenantId!)
        .gte("start_time", start)
        .lte("start_time", end)
        .order("start_time", { ascending: true });

      if (barberId && barberId !== 'all') apptQuery = apptQuery.eq("barber_id", barberId);

      const [{ data: appts, error }, { data: checkins }] = await Promise.all([
        apptQuery,
        supabase
          .from("appointment_checkins")
          .select("appointment_id, checked_in_at")
          .eq("tenant_id", tenantId!)
          .gte("checked_in_at", start)
          .lte("checked_in_at", end),
      ]);

      if (error) {
        console.error("[ReceptionQueue] Fetch error:", error);
        throw error;
      }

      const checkinMap = new Map(
        (checkins || []).map((c: any) => [c.appointment_id, c.checked_in_at]),
      );

      return (appts || []).map((a: any) => ({
        ...a,
        arrived_at: checkinMap.get(a.id) ?? null,
      }));
    },
  });

  const items = useMemo(() => data || [], [data]);

  async function handleCheckin(appt: any) {
    if (appt.arrived_at) return;
    setBusyId(appt.id);
    const { error } = await supabase.from("appointment_checkins").insert({
      appointment_id: appt.id,
      tenant_id: tenantId!,
      customer_id: appt.customers?.id ?? null,
      source: "reception",
    });
    setBusyId(null);
    if (error) {
      toast.error("Não foi possível registrar o check-in.");
      return;
    }
    toast.success(`Cliente chegou às ${format(new Date(), "HH:mm")}.`);
    queryClient.invalidateQueries({ queryKey: ["reception-queue"] });
  }

  async function handleStatus(appt: any, status: string) {
    setBusyId(appt.id);
    await updateStatus(appt.id, status, {}, "reception_portal");
    setBusyId(null);
    queryClient.invalidateQueries({ queryKey: ["reception-queue"] });
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-24 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <Card className="flex flex-col items-center justify-center gap-2 p-10 text-center">
        <Clock className="h-8 w-8 text-muted-foreground" aria-hidden />
        <p className="text-sm font-medium">Nenhum atendimento para hoje</p>
        <p className="text-xs text-muted-foreground">
          Novos agendamentos aparecem aqui automaticamente.
        </p>
      </Card>
    );
  }

  return (
    <>
      <ul className="space-y-3">
        {items.map((appt: any) => {
          const delay = delayInfo(appt.start_time, appt.arrived_at);
          const status = appt.arrived_at && appt.status === "confirmed" ? "checked_in" : appt.status;
          const busy = busyId === appt.id;

          return (
            <li key={appt.id}>
              <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="w-14 shrink-0 text-center">
                    <p className="text-base font-semibold tabular-nums">
                      {format(parseISO(appt.start_time), "HH:mm")}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {appt.services?.duration ? `${appt.services.duration} min` : "—"}
                    </p>
                  </div>
                  <EntityAvatar
                    imageUrl={appt.customers?.avatar_url}
                    name={appt.customers?.name}
                    entityType="customer"
                    size={40}
                  />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">
                      {appt.customers?.name || "Cliente"}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {appt.services?.name || "Serviço"} · {appt.customers?.phone || "sem telefone"}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                        <EntityAvatar
                          imageUrl={appt.barbers?.avatar_url}
                          name={appt.barbers?.name}
                          entityType="professional"
                          size={18}
                        />
                        {appt.barbers?.name || "Sem profissional"}
                      </span>
                      <Badge
                        variant="secondary"
                        className={cn("border-0 text-[11px]", STATUS_CLASS[status] || "")}
                      >
                        {STATUS_LABEL[status] || status}
                      </Badge>
                      {appt.source && (
                        <Badge variant="outline" className="text-[11px] capitalize">
                          {appt.source === "walkin" ? "Walk-in" : appt.source}
                        </Badge>
                      )}
                      {delay && (
                        <span className={cn("text-[11px] font-medium", delay.tone)}>
                          {delay.label}
                        </span>
                      )}
                    </div>
                    {appt.notes && (
                      <p className="mt-1 truncate text-[11px] italic text-muted-foreground">
                        {appt.notes}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {["pending", "scheduled"].includes(appt.status) && (
                    <Button size="sm" disabled={busy} onClick={() => handleStatus(appt, "confirmed")}>
                      <CheckCircle2 className="mr-1.5 h-4 w-4" aria-hidden /> Confirmar
                    </Button>
                  )}
                  {!appt.arrived_at && !["completed", "cancelled"].includes(appt.status) && (
                    <Button size="sm" variant="outline" disabled={busy} onClick={() => handleCheckin(appt)}>
                      <LogIn className="mr-1.5 h-4 w-4" aria-hidden /> Check-in
                    </Button>
                  )}
                  {can("complete_appointment") && !["completed", "cancelled"].includes(appt.status) && (
                    <Button size="sm" variant="outline" disabled={busy} onClick={() => handleStatus(appt, "completed")}>
                      <PlayCircle className="mr-1.5 h-4 w-4" aria-hidden /> Concluir
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => setDetailsId(appt.id)}>
                    <Eye className="mr-1.5 h-4 w-4" aria-hidden /> Detalhes
                  </Button>
                  {!["completed", "cancelled"].includes(appt.status) && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                      disabled={busy}
                      onClick={() => {
                        if (confirm("Cancelar este atendimento?")) handleStatus(appt, "cancelled");
                      }}
                    >
                      <XCircle className="mr-1.5 h-4 w-4" aria-hidden /> Cancelar
                    </Button>
                  )}
                </div>
              </Card>
            </li>
          );
        })}
      </ul>

      <AppointmentDetailsModal
        appointmentId={detailsId || undefined}
        open={!!detailsId}
        onOpenChange={(v) => !v && setDetailsId(null)}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ["reception-queue"] })}
      />
    </>
  );
}
