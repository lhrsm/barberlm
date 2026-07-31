import * as React from "react";
import { format, parseISO, differenceInMinutes } from "date-fns";
import {
  Clock,
  Scissors,
  CreditCard,
  Phone,
  StickyNote,
  Eye,
  Pencil,
  CheckCircle2,
  RefreshCcw,
  XCircle,
  CheckCheck,
  History,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { EntityAvatar } from "@/components/calendar/appointment/EntityAvatar";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { getAgendaStatus, getAgendaOrigin, ORIGIN_META, barberColor, paymentLabel } from "./status";

export interface AgendaActions {
  onView?: (app: any) => void;
  onEdit?: (app: any) => void;
  onConfirm?: (app: any) => void;
  onReschedule?: (app: any) => void;
  onCancel?: (app: any) => void;
  onComplete?: (app: any) => void;
  onHistory?: (app: any) => void;
}

interface Props extends AgendaActions {
  app: any;
  variant?: "full" | "compact" | "micro";
  className?: string;
  busy?: boolean;
}

function money(v: any) {
  return `R$ ${Number(v || 0).toFixed(2)}`;
}

function durationOf(app: any) {
  try {
    const mins = differenceInMinutes(new Date(app.end_time), new Date(app.start_time));
    return mins > 0 ? mins : app?.services?.duration_minutes || 30;
  } catch {
    return app?.services?.duration_minutes || 30;
  }
}

function QuickAction({
  label,
  icon: Icon,
  onClick,
  tone = "neutral",
  disabled,
}: {
  label: string;
  icon: any;
  onClick: () => void;
  tone?: "neutral" | "gold" | "green" | "red";
  disabled?: boolean;
}) {
  const tones = {
    neutral: "hover:bg-white/10 hover:text-white text-slate-400",
    gold: "hover:bg-[#F5C542]/15 hover:text-[#F5C542] text-slate-400",
    green: "hover:bg-emerald-500/15 hover:text-emerald-300 text-slate-400",
    red: "hover:bg-red-500/15 hover:text-red-300 text-slate-400",
  } as const;
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={cn(
        "grid h-8 w-8 place-items-center rounded-lg border border-white/5 bg-white/[0.03] transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F5C542]/70 focus-visible:ring-offset-1 focus-visible:ring-offset-[#0B1220]",
        "disabled:opacity-40 disabled:cursor-not-allowed",
        tones[tone],
      )}
    >
      <Icon size={14} />
    </button>
  );
}

export function AppointmentCard({
  app,
  variant = "full",
  className,
  busy,
  onView,
  onEdit,
  onConfirm,
  onReschedule,
  onCancel,
  onComplete,
  onHistory,
}: Props) {
  const sc = getAgendaStatus(app.status);
  const origin = getAgendaOrigin(app);
  const om = ORIGIN_META[origin];
  const bColor = barberColor(app.barber_id);
  const start = app.start_time ? parseISO(app.start_time) : null;
  const mins = durationOf(app);
  const isClosed = ["completed", "paid", "cancelled", "no_show"].includes(sc.key);

  const summary = (
    <div className="w-72 space-y-3">
      <div className="flex items-center gap-3">
        <EntityAvatar imageUrl={app.customers?.avatar_url} name={app.customers?.name} size={38} />
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-white">{app.customers?.name || "Cliente"}</p>
          <p className="truncate text-[11px] text-slate-400">
            {start ? format(start, "HH:mm") : "--:--"} • {mins} min
          </p>
        </div>
      </div>
      <dl className="space-y-1.5 text-[11px]">
        <div className="flex items-center gap-2 text-slate-300">
          <Scissors size={12} className="shrink-0 text-slate-500" />
          <span className="truncate">{app.services?.name || "Serviço"}</span>
        </div>
        <div className="flex items-center gap-2 text-slate-300">
          <EntityAvatar
            imageUrl={app.barbers?.avatar_url}
            name={app.barbers?.name}
            entityType="professional"
            size={16}
          />
          <span className="truncate">{app.barbers?.name || "Profissional"}</span>
        </div>
        <div className="flex items-center gap-2 text-slate-300">
          <CreditCard size={12} className="shrink-0 text-slate-500" />
          <span>{paymentLabel(app.payment_method)}</span>
          <span className="ml-auto font-bold text-[#F5C542]">{money(app.total_price)}</span>
        </div>
        {app.customers?.phone && (
          <div className="flex items-center gap-2 text-slate-300">
            <Phone size={12} className="shrink-0 text-slate-500" />
            <span>{app.customers.phone}</span>
          </div>
        )}
        {app.notes && (
          <div className="flex items-start gap-2 text-slate-400">
            <StickyNote size={12} className="mt-0.5 shrink-0 text-slate-500" />
            <span className="line-clamp-3">{app.notes}</span>
          </div>
        )}
      </dl>
    </div>
  );

  if (variant === "micro") {
    return (
      <HoverCard openDelay={180}>
        <HoverCardTrigger asChild>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onView?.(app);
            }}
            className={cn(
              "group relative flex w-full items-center gap-1.5 overflow-hidden rounded-lg border px-2 py-1.5 pl-2.5 text-left transition-all",
              "hover:-translate-y-px hover:shadow-[0_6px_18px_-8px_rgba(0,0,0,0.9)]",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F5C542]/70",
              sc.ring,
              sc.surface,
              className,
            )}
          >
            <span
              className="absolute left-0 top-1 bottom-1 w-[3px] rounded-r-full"
              style={{ background: bColor }}
              aria-hidden
            />
            <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", sc.accent)} aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[10px] font-bold leading-tight text-white">
                {start ? format(start, "HH:mm") : ""} {app.customers?.name || "Cliente"}
              </span>
              <span className="block truncate text-[9px] uppercase tracking-tight text-slate-400">
                {app.services?.name || "Serviço"}
              </span>
            </span>
          </button>
        </HoverCardTrigger>
        <HoverCardContent side="right" className="border-white/10 bg-[#0B1220] p-3">
          {summary}
        </HoverCardContent>
      </HoverCard>
    );
  }

  const compact = variant === "compact";

  return (
    <HoverCard openDelay={220}>
      <HoverCardTrigger asChild>
        <div
          role="button"
          tabIndex={0}
          aria-label={`Agendamento de ${app.customers?.name || "cliente"} às ${start ? format(start, "HH:mm") : ""}`}
          onClick={() => onView?.(app)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onView?.(app);
            }
          }}
          className={cn(
            "group relative flex flex-col gap-3 overflow-hidden rounded-2xl border p-3.5 pl-4 transition-all duration-200",
            "hover:-translate-y-0.5 hover:border-white/20 hover:shadow-[0_16px_40px_-20px_rgba(0,0,0,1)]",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F5C542]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#05070d]",
            busy && "pointer-events-none opacity-60",
            sc.ring,
            sc.surface,
            compact ? "min-w-0" : "min-w-[250px]",
            className,
          )}
        >
          <span
            className="absolute left-0 top-2.5 bottom-2.5 w-[3px] rounded-r-full"
            style={{ background: bColor }}
            aria-hidden
          />

          <div className="flex items-start gap-3">
            <EntityAvatar
              imageUrl={app.customers?.avatar_url}
              name={app.customers?.name}
              size={compact ? 34 : 40}
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold leading-tight text-white">
                {app.customers?.name || "Cliente"}
              </p>
              <p className="mt-0.5 flex items-center gap-1.5 truncate text-[11px] text-slate-400">
                <Clock size={11} className="shrink-0" />
                {start ? format(start, "HH:mm") : "--:--"}
                <span className="text-slate-600">•</span>
                {mins} min
              </p>
            </div>
            <span
              className={cn(
                "shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider",
                sc.badge,
              )}
            >
              {sc.label}
            </span>
          </div>

          <div className="flex items-center gap-2 text-slate-300">
            <Scissors size={12} className="shrink-0 text-slate-500" />
            <span className="truncate text-[11px] font-medium">{app.services?.name || "Serviço"}</span>
            <span
              className={cn(
                "ml-auto shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider",
                om.chip,
              )}
            >
              {om.label}
            </span>
          </div>

          <div className="flex items-center justify-between gap-2 border-t border-white/5 pt-2.5">
            <div className="flex min-w-0 items-center gap-2">
              <EntityAvatar
                imageUrl={app.barbers?.avatar_url}
                name={app.barbers?.name}
                entityType="professional"
                size={20}
              />
              <span className="truncate text-[11px] font-medium text-slate-300">
                {app.barbers?.name || "Profissional"}
              </span>
            </div>
            <div className="shrink-0 text-right">
              <span className="block text-sm font-bold text-[#F5C542]">{money(app.total_price)}</span>
              <span className="block text-[9px] uppercase tracking-wider text-slate-500">
                {paymentLabel(app.payment_method)}
              </span>
            </div>
          </div>

          {/* Ações rápidas */}
          <div
            className={cn(
              "flex flex-wrap items-center gap-1.5 border-t border-white/5 pt-2.5 transition-opacity",
              "opacity-100 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100",
            )}
          >
            {onView && <QuickAction label="Visualizar" icon={Eye} onClick={() => onView(app)} />}
            {onEdit && (
              <QuickAction label="Editar" icon={Pencil} onClick={() => onEdit(app)} disabled={isClosed} />
            )}
            {onConfirm && (
              <QuickAction
                label="Confirmar"
                icon={CheckCircle2}
                tone="green"
                onClick={() => onConfirm(app)}
                disabled={isClosed || sc.key === "confirmed"}
              />
            )}
            {onReschedule && (
              <QuickAction
                label="Reagendar"
                icon={RefreshCcw}
                tone="gold"
                onClick={() => onReschedule(app)}
                disabled={isClosed}
              />
            )}
            {onComplete && (
              <QuickAction
                label="Concluir"
                icon={CheckCheck}
                tone="gold"
                onClick={() => onComplete(app)}
                disabled={isClosed}
              />
            )}
            {onCancel && (
              <QuickAction
                label="Cancelar"
                icon={XCircle}
                tone="red"
                onClick={() => onCancel(app)}
                disabled={isClosed}
              />
            )}
            {onHistory && <QuickAction label="Histórico" icon={History} onClick={() => onHistory(app)} />}
          </div>
        </div>
      </HoverCardTrigger>
      <HoverCardContent side="right" className="hidden border-white/10 bg-[#0B1220] p-3 md:block">
        {summary}
      </HoverCardContent>
    </HoverCard>
  );
}
