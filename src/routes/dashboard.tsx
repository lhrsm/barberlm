import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AppLayout } from "@/components/layout/AppLayout";
import { AppointmentModal } from "@/components/calendar/AppointmentModal";
import { AppointmentDetailsModal } from "@/components/calendar/AppointmentDetailsModal";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/dashboard")({
  component: DashboardLayout,
});

function DashboardLayout() {
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<string | undefined>();
  const [detailsOpen, setDetailsOpen] = useState(false);

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
        />
      </div>
    </AppLayout>
  );
}
