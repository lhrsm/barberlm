import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AppLayout } from "@/components/layout/AppLayout";
import { AppointmentModal } from "@/components/calendar/AppointmentModal";

export const Route = createFileRoute("/dashboard")({
  component: DashboardLayout,
});

function DashboardLayout() {
  console.log("DashboardLayout rendering, current path:", window.location.pathname);
  return (
    <AppLayout>
      <div className="min-h-screen bg-[#05070d] pb-20">
        <Outlet />
        <AppointmentModal />
      </div>
    </AppLayout>
  );
}
