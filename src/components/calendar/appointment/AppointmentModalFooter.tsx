import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, CalendarCheck, Loader2 } from "lucide-react";

interface Props {
  step: number;
  isLoading: boolean;
  onBack: () => void;
  onNext: () => void;
  onConfirm: () => void;
  isEditing?: boolean;
}

export function AppointmentModalFooter({
  step,
  isLoading,
  onBack,
  onNext,
  onConfirm,
  isEditing,
}: Props) {
  const isLast = step === 4;
  return (
    <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
      {step > 1 ? (
        <Button
          type="button"
          variant="outline"
          onClick={onBack}
          disabled={isLoading}
          className="h-11 w-full rounded-xl border-border bg-background font-semibold text-foreground hover:bg-muted sm:w-auto"
        >
          <ArrowLeft className="mr-1.5 h-4 w-4" />
          Voltar
        </Button>
      ) : (
        <span className="hidden sm:block" />
      )}

      <Button
        type="button"
        onClick={isLast ? onConfirm : onNext}
        disabled={isLoading}
        className="h-11 w-full rounded-xl bg-primary font-bold text-primary-foreground shadow-sm transition-all hover:opacity-90 disabled:opacity-60 sm:w-auto"
      >
        {isLoading ? (
          <>
            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            {isLast ? (isEditing ? "Salvando alterações..." : "Criando agendamento...") : "Validando..."}
          </>
        ) : isLast ? (
          <>
            <CalendarCheck className="mr-1.5 h-4 w-4" />
            {isEditing ? "Salvar agendamento" : "Confirmar agendamento"}
          </>
        ) : (
          <>
            Continuar
            <ArrowRight className="ml-1.5 h-4 w-4" />
          </>
        )}
      </Button>
    </div>
  );
}
