import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AppLayout } from "@/components/layout/AppLayout";
import { AppointmentModal } from "@/components/calendar/AppointmentModal";

export const Route = createFileRoute("/dashboard")({
  component: DashboardLayout,
});

function DashboardLayout() {
  return (
    <AppLayout>
      <div className="min-h-screen bg-[#05070d] pb-20">
        <div className="max-w-[1600px] mx-auto p-4 md:p-8 space-y-8">
          <Outlet />
        </div>
        <AppointmentModal />
      </div>
    </AppLayout>
  );
}
