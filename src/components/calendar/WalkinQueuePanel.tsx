import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format, parseISO } from "date-fns";
import { UserPlus, Play, CheckCircle2, Clock, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Props {
  tenantId: string;
  date: Date;
  refreshKey?: number;
  onChange?: () => void;
}

type Row = {
  id: string;
  status: string;
  start_time: string;
  walkin_arrived_at: string | null;
  walkin_started_at: string | null;
  walkin_ticket_number: number | null;
  total_price: number | null;
  customers?: { name?: string | null; phone?: string | null } | null;
  services?: { name?: string | null } | null;
  barbers?: { name?: string | null } | null;
};

export function WalkinQueuePanel({ tenantId, date, refreshKey, onChange }: Props) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const dayStart = new Date(date); dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(date); dayEnd.setHours(23, 59, 59, 999);
    const { data, error } = await supabase
      .from("appointments")
      .select("id, status, start_time, walkin_arrived_at, walkin_started_at, walkin_ticket_number, total_price, customers(name, phone), services(name), barbers!appointments_barber_id_fkey(name)")
      .eq("tenant_id", tenantId)
      .eq("appointment_type", "walk_in")
      .gte("start_time", dayStart.toISOString())
      .lte("start_time", dayEnd.toISOString())
      .not("status", "in", "(cancelled,canceled,cancelado,no_show)")
      .order("walkin_arrived_at", { ascending: true, nullsFirst: false });
    if (!error) setRows((data as any[]) || []);
    setLoading(false);
  }

  useEffect(() => { if (tenantId) load(); }, [tenantId, date, refreshKey]);

  async function advance(row: Row, next: "in_service" | "completed") {
    setBusyId(row.id);
    try {
      const patch: any = { status: next };
      if (next === "in_service" && !row.walkin_started_at) patch.walkin_started_at = new Date().toISOString();
      const { error } = await supabase.from("appointments").update(patch).eq("id", row.id);
      if (error) throw error;
      toast.success(next === "in_service" ? "Cliente em atendimento" : "Atendimento concluído");
      await load();
      onChange?.();
    } catch (err: any) {
      toast.error(err?.message || "Falha ao atualizar status");
    } finally {
      setBusyId(null);
    }
  }

  if (!loading && rows.length === 0) return null;

  const waiting = rows.filter((r) => !["in_service", "completed", "concluido", "concluído", "done", "paid", "pago"].includes(String(r.status).toLowerCase()));
  const inService = rows.filter((r) => String(r.status).toLowerCase() === "in_service");

  return (
    <div className="rounded-3xl border border-emerald-500/25 bg-[#0B1220] p-4 sm:p-5 shadow-[0_10px_40px_-10px_rgba(16,185,129,0.25)]">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-500/15 text-emerald-400">
            <UserPlus className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-black uppercase tracking-widest text-emerald-300">Fila Presencial</h3>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
              {waiting.length} aguardando • {inService.length} em atendimento
            </p>
          </div>
        </div>
        {loading && <Loader2 className="h-4 w-4 animate-spin text-emerald-400" />}
      </div>

      <div className="flex flex-col gap-2">
        {rows.map((r) => {
          const s = String(r.status).toLowerCase();
          const isWaiting = !["in_service", "completed", "concluido", "concluído", "done", "paid", "pago"].includes(s);
          const isInService = s === "in_service";
          return (
            <div
              key={r.id}
              className={cn(
                "flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-2xl border bg-black/30",
                isInService ? "border-amber-500/40" : "border-white/5",
              )}
            >
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <span className="grid h-9 w-9 place-items-center rounded-lg bg-emerald-500/15 text-emerald-300 font-black text-xs shrink-0">
                  #{r.walkin_ticket_number ?? "—"}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-black text-white truncate">{r.customers?.name || "Cliente"}</p>
                  <p className="text-[10px] uppercase tracking-wider text-slate-400 truncate">
                    {r.services?.name || "Serviço"} • {r.barbers?.name || "Barbeiro"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <div className="flex items-center gap-1 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                  <Clock size={11} />
                  {r.walkin_arrived_at ? format(parseISO(r.walkin_arrived_at), "HH:mm") : "—"}
                </div>
                {isWaiting && (
                  <Button
                    size="sm"
                    disabled={busyId === r.id}
                    onClick={() => advance(r, "in_service")}
                    className="h-8 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold gap-1"
                  >
                    <Play size={12} /> Iniciar
                  </Button>
                )}
                {isInService && (
                  <Button
                    size="sm"
                    disabled={busyId === r.id}
                    onClick={() => advance(r, "completed")}
                    className="h-8 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold gap-1"
                  >
                    <CheckCircle2 size={12} /> Concluir
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
