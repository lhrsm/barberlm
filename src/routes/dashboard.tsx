import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AppLayout } from "@/components/layout/AppLayout";
import { AppointmentModal } from "@/components/calendar/AppointmentModal";
import { AppointmentDetailsModal } from "@/components/calendar/AppointmentDetailsModal";
import { RescheduleWizard } from "@/components/reschedule/RescheduleWizard";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

export const Route = createFileRoute("/dashboard")({
  component: DashboardLayout,
});

function DashboardLayout() {
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<string | undefined>();
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [rescheduleAppt, setRescheduleAppt] = useState<any>(null);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    const handleOpenDetails = (e: any) => {
      if (e.detail?.id) {
        setSelectedAppointmentId(e.detail.id);
        setDetailsOpen(true);
      }
    };
    window.addEventListener('OPEN_APPOINTMENT_DETAILS', handleOpenDetails);
    return () => window.removeEventListener('OPEN_APPOINTMENT_DETAILS', handleOpenDetails);
  }, []);

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    queryClient.invalidateQueries({ queryKey: ['appointments'] });
    queryClient.invalidateQueries({ queryKey: ['calendar'] });
  };

  return (
    <AppLayout>
      <div className="min-h-screen bg-[#05070d] pb-20">
        <Outlet />
        <AppointmentModal />
        <AppointmentDetailsModal 
          appointmentId={selectedAppointmentId}
          open={detailsOpen}
          onOpenChange={setDetailsOpen}
          mode="admin"
          onSuccess={handleRefresh}
          onReschedule={(appt) => {
            setRescheduleAppt(appt);
            setRescheduleOpen(true);
          }}
        />
        <RescheduleWizard
          open={rescheduleOpen}
          onOpenChange={setRescheduleOpen}
          appointment={rescheduleAppt}
          actor="admin"
          source="admin_dashboard"
          onSuccess={handleRefresh}
        />
      </div>
    </AppLayout>
  );
}
