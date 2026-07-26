import * as React from "react";
import { format, addDays, parseISO, addMinutes } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { EntityAvatar } from "./EntityAvatar";
import { AvailableSlotsGrid } from "./AvailableSlotsGrid";
import { resolveImageUrl, type Slot } from "./appointment-utils";
import { cn } from "@/lib/utils";

interface Props {
  barber: any;
  service: any;
  selectedDate: string;
  selectedTime: string;
  onDateChange: (date: string) => void;
  onTimeChange: (time: string) => void;
  slots: Slot[];
  slotsLoading: boolean;
  isDayEnabled: (date: Date) => boolean;
  nextAvailableDate: string | null;
  errors: Record<string, string | null>;
}

export function DateTimeStep({
  barber,
  service,
  selectedDate,
  selectedTime,
  onDateChange,
  onTimeChange,
  slots,
  slotsLoading,
  isDayEnabled,
  nextAvailableDate,
  errors,
}: Props) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const selected = selectedDate ? parseISO(`${selectedDate}T12:00:00`) : undefined;

  const endsAt =
    selectedTime && service?.duration_minutes
      ? format(
          addMinutes(parseISO(`${selectedDate}T${selectedTime}:00`), service.duration_minutes),
          "HH:mm",
        )
      : null;

  const shortcuts = [
    { label: "Hoje", date: format(new Date(), "yyyy-MM-dd") },
    { label: "Amanhã", date: format(addDays(new Date(), 1), "yyyy-MM-dd") },
    ...(nextAvailableDate ? [{ label: "Próximo dia disponível", date: nextAvailableDate }] : []),
  ];

  return (
    <div className="animate-in fade-in slide-in-from-right-2 space-y-4 duration-300">
      <div className="flex items-center gap-2.5 rounded-xl border border-border bg-muted/40 p-3">
        <EntityAvatar
          imageUrl={resolveImageUrl(barber)}
          name={barber?.name}
          entityType="professional"
          size={36}
        />
        <p className="min-w-0 truncate text-sm font-semibold text-foreground">
          Disponibilidade de{" "}
          <span className="text-primary">{barber?.name || "profissional"}</span>
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {shortcuts.map((s) => (
          <Button
            key={s.label}
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onDateChange(s.date)}
            className={cn(
              "h-8 rounded-full text-xs font-semibold",
              selectedDate === s.date && "border-primary bg-primary/10 text-primary",
            )}
          >
            {s.label}
          </Button>
        ))}
      </div>

      <div className="rounded-2xl border border-border bg-card p-2 shadow-sm">
        <Calendar
          mode="single"
          locale={ptBR}
          selected={selected}
          onSelect={(d) => d && onDateChange(format(d, "yyyy-MM-dd"))}
          disabled={(date) => date < today || !isDayEnabled(date)}
          className={cn("pointer-events-auto mx-auto p-2")}
        />
      </div>
      {errors.date && <p className="text-xs font-medium text-destructive">{errors.date}</p>}

      <div className="space-y-2">
        <h3 className="text-sm font-black text-foreground">Horários disponíveis</h3>
        <AvailableSlotsGrid
          slots={slots}
          value={selectedTime}
          onSelect={onTimeChange}
          loading={slotsLoading}
          error={errors.time}
        />
      </div>

      {service && (
        <div className="rounded-xl border border-border bg-muted/40 p-3 text-sm">
          <p className="text-muted-foreground">
            Serviço selecionado:{" "}
            <span className="font-bold text-foreground">{service.name}</span>
          </p>
          <p className="text-muted-foreground">
            Duração: <span className="font-bold text-foreground">{service.duration_minutes} minutos</span>
          </p>
          {endsAt && (
            <p className="text-muted-foreground">
              Término previsto: <span className="font-bold text-foreground">{endsAt}</span>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
