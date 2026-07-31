import * as React from "react";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { AGENDA_STATUS_FILTERS } from "./status";

export interface AgendaFilterState {
  search: string;
  barberId: string;
  serviceId: string;
  status: string;
  payment: string;
  origin: string;
}

export const EMPTY_FILTERS: AgendaFilterState = {
  search: "",
  barberId: "all",
  serviceId: "all",
  status: "all",
  payment: "all",
  origin: "all",
};

interface Props {
  value: AgendaFilterState;
  onChange: (v: AgendaFilterState) => void;
  barbers: any[];
  services: any[];
  paymentMethods: string[];
  resultCount: number;
}

const selectCls =
  "h-10 rounded-xl border-white/10 bg-[#05070D] text-xs font-medium text-slate-200 focus:ring-[#F5C542]/50";

export function AgendaFilters({
  value,
  onChange,
  barbers,
  services,
  paymentMethods,
  resultCount,
}: Props) {
  const [open, setOpen] = React.useState(false);
  const set = (patch: Partial<AgendaFilterState>) => onChange({ ...value, ...patch });

  const activeCount = React.useMemo(
    () =>
      (["barberId", "serviceId", "status", "payment", "origin"] as const).filter(
        (k) => value[k] !== "all",
      ).length,
    [value],
  );

  return (
    <div className="rounded-3xl border border-[#F59E0B]/15 bg-[#0B1220] p-3 sm:p-4">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 sm:gap-3">
        <div className="relative min-w-0">
          <Search
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
            aria-hidden
          />
          <Input
            value={value.search}
            onChange={(e) => set({ search: e.target.value })}
            placeholder="Buscar cliente, telefone, serviço, profissional ou código"
            aria-label="Buscar na agenda"
            className="h-11 rounded-xl border-white/10 bg-[#05070D] pl-9 pr-9 text-sm text-white placeholder:text-slate-500 focus-visible:ring-[#F5C542]/50"
          />
          {value.search && (
            <button
              type="button"
              aria-label="Limpar busca"
              onClick={() => set({ search: "" })}
              className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-lg text-slate-500 hover:bg-white/5 hover:text-white"
            >
              <X size={14} />
            </button>
          )}
        </div>

        <Button
          type="button"
          variant="outline"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className={cn(
            "h-11 shrink-0 gap-2 rounded-xl border-white/10 bg-[#05070D] px-3 text-xs font-bold uppercase tracking-wider text-slate-300",
            "hover:border-[#F5C542]/40 hover:bg-[#F5C542]/10 hover:text-[#F5C542]",
            (open || activeCount > 0) && "border-[#F5C542]/40 text-[#F5C542]",
          )}
        >
          <SlidersHorizontal size={15} />
          <span className="hidden sm:inline">Filtros</span>
          {activeCount > 0 && (
            <span className="grid h-5 min-w-5 place-items-center rounded-full bg-[#F5C542] px-1 text-[10px] font-black text-black">
              {activeCount}
            </span>
          )}
        </Button>
      </div>

      {open && (
        <div className="mt-3 grid grid-cols-1 gap-2 border-t border-white/5 pt-3 sm:grid-cols-2 lg:grid-cols-5">
          <Select value={value.barberId} onValueChange={(v) => set({ barberId: v })}>
            <SelectTrigger className={selectCls} aria-label="Filtrar por profissional">
              <SelectValue placeholder="Profissional" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os profissionais</SelectItem>
              {barbers.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={value.serviceId} onValueChange={(v) => set({ serviceId: v })}>
            <SelectTrigger className={selectCls} aria-label="Filtrar por serviço">
              <SelectValue placeholder="Serviço" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os serviços</SelectItem>
              {services.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={value.status} onValueChange={(v) => set({ status: v })}>
            <SelectTrigger className={selectCls} aria-label="Filtrar por status">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              {AGENDA_STATUS_FILTERS.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={value.payment} onValueChange={(v) => set({ payment: v })}>
            <SelectTrigger className={selectCls} aria-label="Filtrar por forma de pagamento">
              <SelectValue placeholder="Pagamento" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os pagamentos</SelectItem>
              {paymentMethods.map((p) => (
                <SelectItem key={p} value={p}>
                  {p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={value.origin} onValueChange={(v) => set({ origin: v })}>
            <SelectTrigger className={selectCls} aria-label="Filtrar por origem">
              <SelectValue placeholder="Origem" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as origens</SelectItem>
              <SelectItem value="online">Online</SelectItem>
              <SelectItem value="manual">Manual</SelectItem>
              <SelectItem value="walk_in">Presencial (Walk-in)</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex items-center justify-between gap-2 sm:col-span-2 lg:col-span-5">
            <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
              {resultCount} resultado{resultCount === 1 ? "" : "s"}
            </p>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onChange({ ...EMPTY_FILTERS })}
              className="h-8 rounded-lg text-[11px] font-bold uppercase tracking-wider text-slate-400 hover:text-[#F5C542]"
            >
              Limpar filtros
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Filtro puramente client-side sobre os dados já carregados. */
export function applyAgendaFilters(
  appointments: any[],
  f: AgendaFilterState,
  originOf: (a: any) => string,
): any[] {
  const q = f.search.trim().toLowerCase();
  return appointments.filter((a) => {
    if (f.barberId !== "all" && a.barber_id !== f.barberId) return false;
    if (f.serviceId !== "all" && a.service_id !== f.serviceId) return false;
    if (f.payment !== "all" && String(a.payment_method || "") !== f.payment) return false;
    if (f.origin !== "all" && originOf(a) !== f.origin) return false;
    if (f.status !== "all") {
      const n = String(a.status || "").toLowerCase();
      const groups: Record<string, string[]> = {
        completed: ["completed", "concluido", "concluído", "done", "paid", "pago"],
        cancelled: ["cancelled", "canceled", "cancelado"],
        confirmed: ["confirmed", "confirmado"],
        rescheduled: ["rescheduled", "reagendado"],
        no_show: ["no_show", "faltou", "missed"],
        in_service: ["in_service", "em_atendimento"],
        scheduled: ["scheduled", "pending", "agendado", "awaiting_payment"],
      };
      if (!(groups[f.status] || [f.status]).includes(n)) return false;
    }
    if (q) {
      const hay = [
        a.customers?.name,
        a.customers?.phone,
        a.customer_name,
        a.customer_phone,
        a.services?.name,
        a.barbers?.name,
        a.id,
        a.walkin_ticket_number != null ? `#${a.walkin_ticket_number}` : "",
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}
