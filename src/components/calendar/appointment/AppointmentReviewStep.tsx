import { format, parseISO, addMinutes } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { EntityAvatar } from "./EntityAvatar";
import { AppointmentFinancialSummary } from "./AppointmentFinancialSummary";
import { PaymentSelector } from "./PaymentSelector";
import { resolveImageUrl, type FinancialBreakdown } from "./appointment-utils";

interface Props {
  barber: any;
  customer: any;
  service: any;
  selectedDate: string;
  selectedTime: string;
  shopName?: string | null;
  breakdown: FinancialBreakdown;
  paymentStatus: string;
  paymentMethod: string;
  onPaymentStatusChange: (v: string) => void;
  onPaymentMethodChange: (v: string) => void;
  mixedCredits: string;
  mixedOther: string;
  onMixedCreditsChange: (v: string) => void;
  onMixedOtherChange: (v: string) => void;
  onEditStep: (step: number) => void;
  errors: Record<string, string | null>;
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-right text-sm font-bold text-foreground">{value}</span>
    </div>
  );
}

export function AppointmentReviewStep({
  barber,
  customer,
  service,
  selectedDate,
  selectedTime,
  shopName,
  breakdown,
  paymentStatus,
  paymentMethod,
  onPaymentStatusChange,
  onPaymentMethodChange,
  mixedCredits,
  mixedOther,
  onMixedCreditsChange,
  onMixedOtherChange,
  onEditStep,
  errors,
}: Props) {
  const start = selectedDate && selectedTime ? parseISO(`${selectedDate}T${selectedTime}:00`) : null;
  const end = start && service ? addMinutes(start, service.duration_minutes || 30) : null;

  return (
    <div className="animate-in fade-in slide-in-from-right-2 space-y-4 duration-300">
      <div>
        <h2 className="text-base font-black text-foreground">Resumo do agendamento</h2>
        <p className="text-sm text-muted-foreground">Confira os dados antes de confirmar.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <EntityAvatar
                  imageUrl={resolveImageUrl(barber)}
                  name={barber?.name}
                  entityType="professional"
                  size={56}
                />
                <div className="min-w-0">
                  <p className="truncate text-sm font-black text-foreground">{barber?.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {barber?.category || "Barbeiro"}
                  </p>
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onEditStep(1)}
                className="h-8 shrink-0 rounded-lg text-xs font-semibold text-primary"
              >
                Alterar
              </Button>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <EntityAvatar
                  imageUrl={resolveImageUrl(customer)}
                  name={customer?.name}
                  entityType="customer"
                  size={56}
                />
                <div className="min-w-0">
                  <p className="truncate text-sm font-black text-foreground">{customer?.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {customer?.phone || "Sem telefone"}
                  </p>
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onEditStep(3)}
                className="h-8 shrink-0 rounded-lg text-xs font-semibold text-primary"
              >
                Alterar
              </Button>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <h3 className="mb-2 text-sm font-black text-foreground">Informações do atendimento</h3>
            <div className="divide-y divide-border/70">
              <InfoRow label="Serviço" value={service?.name || "—"} />
              <InfoRow
                label="Data"
                value={
                  selectedDate
                    ? format(parseISO(`${selectedDate}T12:00:00`), "dd 'de' MMMM 'de' yyyy", {
                        locale: ptBR,
                      })
                    : "—"
                }
              />
              <InfoRow label="Horário" value={selectedTime || "—"} />
              <InfoRow label="Término previsto" value={end ? format(end, "HH:mm") : "—"} />
              <InfoRow
                label="Duração"
                value={service ? `${service.duration_minutes} minutos` : "—"}
              />
              <InfoRow label="Local" value={shopName || "Barbearia"} />
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <AppointmentFinancialSummary breakdown={breakdown} />
          <PaymentSelector
            status={paymentStatus}
            method={paymentMethod}
            onStatusChange={onPaymentStatusChange}
            onMethodChange={onPaymentMethodChange}
            mixedCredits={mixedCredits}
            mixedOther={mixedOther}
            onMixedCreditsChange={onMixedCreditsChange}
            onMixedOtherChange={onMixedOtherChange}
            total={breakdown.total}
            methodError={errors.paymentMethod}
            mixedError={errors.mixed}
          />
        </div>
      </div>
    </div>
  );
}
