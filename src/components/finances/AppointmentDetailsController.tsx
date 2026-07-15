import { AppointmentDetailsModal } from "@/components/calendar/AppointmentDetailsModal";

interface Props {
  appointmentId: string | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  role: string | null;
  userId?: string;
  fetchTransactions: (bId?: string | null) => Promise<void> | void;
  fetchAppointments: (bId?: string | null) => Promise<void> | void;
}

export function AppointmentDetailsController({
  appointmentId,
  open,
  onOpenChange,
  role,
  userId,
  fetchTransactions,
  fetchAppointments,
}: Props) {
  return (
    <AppointmentDetailsModal
      appointmentId={appointmentId || undefined}
      open={open}
      onOpenChange={onOpenChange}
      onSuccess={() => {
        const barberIdFilter = role === "barber" ? userId ?? null : null;
        fetchTransactions(barberIdFilter);
        fetchAppointments(barberIdFilter);
      }}
    />
  );
}
